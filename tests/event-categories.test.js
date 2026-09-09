jest.mock('../src/supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../src/supabase/admin', () => ({
  from: jest.fn(),
}))

jest.mock('../src/services/imgbb.service', () => ({
  uploadImage: jest.fn(),
}))

const request = require('supertest')
const app = require('../src/app')
const supabase = require('../src/supabase')
const supabaseAdmin = require('../src/supabase/admin')
const imgbbService = require('../src/services/imgbb.service')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../src/constants/error-codes')
const httpStatusCodes = require('../src/constants/http-status-codes')
const buildApiError = require('../src/utils/buildApiError')

const ADMIN_ID = 'admin-user-id'
const USER_ID = 'regular-user-id'
const ADMIN_TOKEN = 'admin-access-token'
const USER_TOKEN = 'user-access-token'

const activeCategory = {
  id: 1,
  name: 'Canchas abiertas',
  description: 'Partidos abiertos para anotarse',
  image_url: 'https://example.com/image.jpg',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

const jpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00,
])

const IMGBB_PUBLIC_URL = 'https://i.ibb.co/Mkc39HTJ/prueba.jpg'

function mockAuthenticatedAdmin() {
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: ADMIN_ID } },
    error: null,
  })
}

function mockAuthenticatedUser() {
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  })
}

describe('event-categories', () => {
  let profilesBuilder
  let categoriesBuilder

  beforeEach(() => {
    profilesBuilder = createQueryBuilder({
      data: { id: ADMIN_ID, role: 'admin' },
      error: null,
    })
    categoriesBuilder = createQueryBuilder({
      data: [activeCategory],
      error: null,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }
      return categoriesBuilder
    })
  })

  describe('GET /event-categories', () => {
    it('allows unauthenticated users to list active categories', async () => {
      const response = await request(app).get('/event-categories')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toEqual([activeCategory])
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
    })

    it('does not return inactive categories', async () => {
      categoriesBuilder.resolved = { data: [activeCategory], error: null }

      const response = await request(app).get('/event-categories')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(categoriesBuilder.eq).toHaveBeenCalledWith('is_active', true)
      expect(categoriesBuilder.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(response.body.data.every((category) => category.is_active === true)).toBe(true)
      expect(response.body.data.find((category) => category.name === 'Archivadas')).toBeUndefined()
    })
  })

  describe('GET /event-categories/:id', () => {
    it('allows unauthenticated users to get an active category', async () => {
      categoriesBuilder.resolved = { data: activeCategory, error: null }

      const response = await request(app).get('/event-categories/1')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(activeCategory)
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
    })

    it('returns 400 for an invalid id', async () => {
      const response = await request(app).get('/event-categories/abc')

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })

    it('returns 404 when the category does not exist or is inactive', async () => {
      categoriesBuilder.resolved = { data: null, error: null }

      const response = await request(app).get('/event-categories/99')

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.ENTITY_NOT_FOUND)
      expect(categoriesBuilder.eq).toHaveBeenCalledWith('is_active', true)
    })
  })

  describe('POST /event-categories', () => {
    const createPayload = {
      name: 'Canchas abiertas',
      description: 'Partidos abiertos para anotarse',
    }

    it('returns 401 when no token is provided', async () => {
      const response = await request(app).post('/event-categories').send(createPayload)

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
    })

    it('returns 403 when the authenticated user is not an admin', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(USER_TOKEN))
        .send(createPayload)

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
      expect(supabase.auth.getUser).toHaveBeenCalledWith(USER_TOKEN)
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
    })

    it('creates a category when the user is an admin', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.resolved = { data: activeCategory, error: null }

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .send(createPayload)

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toEqual(activeCategory)
      expect(categoriesBuilder.insert).toHaveBeenCalledWith({
        name: 'Canchas abiertas',
        description: 'Partidos abiertos para anotarse',
        image_url: null,
      })
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
    })

    it('returns 409 when the name already exists', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.resolved = {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "event_categories_name_unique"',
        },
      }
      categoriesBuilder.maybeSingle.mockResolvedValue(categoriesBuilder.resolved)

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .send(createPayload)

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_CATEGORY_NAME_ALREADY_EXISTS)
      expect(response.body.data).toBeNull()
    })

    it('rejects client-supplied image_url', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          name: 'Canchas abiertas',
          image_url: 'https://example.com/injected.jpg',
        })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(categoriesBuilder.insert).not.toHaveBeenCalled()
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
    })

    it('rejects disallowed fields', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          ...createPayload,
          id: 99,
          created_at: '2020-01-01T00:00:00.000Z',
          updated_at: '2020-01-01T00:00:00.000Z',
        })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(categoriesBuilder.insert).not.toHaveBeenCalled()
    })

    it('uploads an image and persists only the ImgBB data.url', async () => {
      mockAuthenticatedAdmin()
      imgbbService.uploadImage.mockResolvedValue(IMGBB_PUBLIC_URL)
      const created = { ...activeCategory, image_url: IMGBB_PUBLIC_URL }
      categoriesBuilder.resolved = { data: created, error: null }

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .field('name', 'Canchas abiertas')
        .field('description', 'Partidos abiertos para anotarse')
        .attach('image', jpegBuffer, { filename: 'prueba.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.data.image_url).toBe(IMGBB_PUBLIC_URL)
      expect(response.body.data.delete_url).toBeUndefined()
      expect(imgbbService.uploadImage).toHaveBeenCalledTimes(1)
      expect(categoriesBuilder.insert).toHaveBeenCalledWith({
        name: 'Canchas abiertas',
        description: 'Partidos abiertos para anotarse',
        image_url: IMGBB_PUBLIC_URL,
      })
    })

    it('does not persist when ImgBB fails', async () => {
      mockAuthenticatedAdmin()
      imgbbService.uploadImage.mockRejectedValue(
        buildApiError({
          statusCode: httpStatusCodes.SERVICE_UNAVAILABLE,
          description: 'Image upload failed',
          errorCode: errorCodes.IMAGE_UPLOAD_FAILED,
        }),
      )

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .field('name', 'Canchas abiertas')
        .attach('image', jpegBuffer, { filename: 'prueba.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(httpStatusCodes.SERVICE_UNAVAILABLE)
      expect(response.body.errorCode).toBe(errorCodes.IMAGE_UPLOAD_FAILED)
      expect(categoriesBuilder.insert).not.toHaveBeenCalled()
    })

    it('rejects an empty image without calling ImgBB', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .field('name', 'Canchas abiertas')
        .attach('image', Buffer.alloc(0), { filename: 'empty.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.EMPTY_FILE_UPLOAD)
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
      expect(categoriesBuilder.insert).not.toHaveBeenCalled()
    })

    it('rejects a disallowed image type without calling ImgBB', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(ADMIN_TOKEN))
        .field('name', 'Canchas abiertas')
        .attach('image', Buffer.from('not-an-image'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })

      expect(response.status).toBe(httpStatusCodes.UNSUPPORTED_MEDIA_TYPE)
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
    })

    it('does not upload when a non-admin sends a file', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app)
        .post('/event-categories')
        .set(authHeader(USER_TOKEN))
        .field('name', 'Canchas abiertas')
        .attach('image', jpegBuffer, { filename: 'prueba.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
    })

    it('does not upload when an unauthenticated request includes a file', async () => {
      const response = await request(app)
        .post('/event-categories')
        .field('name', 'Canchas abiertas')
        .attach('image', jpegBuffer, { filename: 'prueba.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(imgbbService.uploadImage).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /event-categories/:id', () => {
    it('updates a category and updated_at when the user is an admin', async () => {
      mockAuthenticatedAdmin()
      const updatedCategory = {
        ...activeCategory,
        name: 'Canchas cubiertas',
        updated_at: '2026-09-04T12:00:00.000Z',
      }

      categoriesBuilder.maybeSingle
        .mockResolvedValueOnce({ data: activeCategory, error: null })
        .mockResolvedValueOnce({ data: updatedCategory, error: null })

      const before = Date.now()
      const response = await request(app)
        .patch('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({ name: 'Canchas cubiertas' })
      const after = Date.now()

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.name).toBe('Canchas cubiertas')
      expect(categoriesBuilder.update).toHaveBeenCalledTimes(1)

      const updatePayload = categoriesBuilder.updates[0]
      expect(updatePayload.name).toBe('Canchas cubiertas')
      expect(updatePayload.image_url).toBeUndefined()
      expect(updatePayload.updated_at).toEqual(expect.any(String))

      const updatedAt = Date.parse(updatePayload.updated_at)
      expect(updatedAt).toBeGreaterThanOrEqual(before)
      expect(updatedAt).toBeLessThanOrEqual(after)
    })

    it('reactivates a category', async () => {
      mockAuthenticatedAdmin()
      const inactiveCategory = { ...activeCategory, is_active: false }
      const reactivated = { ...activeCategory, is_active: true }

      categoriesBuilder.maybeSingle
        .mockResolvedValueOnce({ data: inactiveCategory, error: null })
        .mockResolvedValueOnce({ data: reactivated, error: null })

      const response = await request(app)
        .patch('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({ is_active: true })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.is_active).toBe(true)
      expect(categoriesBuilder.updates[0].is_active).toBe(true)
      expect(categoriesBuilder.updates[0].updated_at).toEqual(expect.any(String))
    })

    it('returns 404 when the category does not exist', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .patch('/event-categories/99')
        .set(authHeader(ADMIN_TOKEN))
        .send({ name: 'Nueva' })

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.ENTITY_NOT_FOUND)
    })

    it('returns 400 for an empty body', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })

    it('returns 409 when the new name already belongs to another category', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle
        .mockResolvedValueOnce({ data: activeCategory, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "event_categories_name_unique"',
          },
        })

      const response = await request(app)
        .patch('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({ name: 'Canchas cubiertas' })

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_CATEGORY_NAME_ALREADY_EXISTS)
    })

    it('replaces image_url when a new image is uploaded', async () => {
      mockAuthenticatedAdmin()
      imgbbService.uploadImage.mockResolvedValue(IMGBB_PUBLIC_URL)
      const updatedCategory = { ...activeCategory, image_url: IMGBB_PUBLIC_URL }

      categoriesBuilder.maybeSingle
        .mockResolvedValueOnce({ data: activeCategory, error: null })
        .mockResolvedValueOnce({ data: updatedCategory, error: null })

      const response = await request(app)
        .patch('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))
        .attach('image', jpegBuffer, { filename: 'prueba.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.image_url).toBe(IMGBB_PUBLIC_URL)
      expect(response.body.data.delete_url).toBeUndefined()
      expect(imgbbService.uploadImage).toHaveBeenCalledTimes(1)
      expect(categoriesBuilder.updates[0].image_url).toBe(IMGBB_PUBLIC_URL)
    })

    it('does not update when ImgBB fails on PATCH', async () => {
      mockAuthenticatedAdmin()
      imgbbService.uploadImage.mockRejectedValue(
        buildApiError({
          statusCode: httpStatusCodes.SERVICE_UNAVAILABLE,
          description: 'Image upload failed',
          errorCode: errorCodes.IMAGE_UPLOAD_FAILED,
        }),
      )
      categoriesBuilder.maybeSingle.mockResolvedValue({ data: activeCategory, error: null })

      const response = await request(app)
        .patch('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))
        .attach('image', jpegBuffer, { filename: 'prueba.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(httpStatusCodes.SERVICE_UNAVAILABLE)
      expect(categoriesBuilder.update).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /event-categories/:id', () => {
    it('performs a logical delete', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle
        .mockResolvedValueOnce({ data: activeCategory, error: null })
        .mockResolvedValueOnce({
          data: { ...activeCategory, is_active: false },
          error: null,
        })

      const response = await request(app)
        .delete('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NO_CONTENT)
      expect(response.body).toEqual({})
      expect(categoriesBuilder.update).toHaveBeenCalledTimes(1)
      expect(categoriesBuilder.updates[0].is_active).toBe(false)
      expect(categoriesBuilder.updates[0].updated_at).toEqual(expect.any(String))
    })

    it('is idempotent when the category is already inactive', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle.mockResolvedValue({
        data: { ...activeCategory, is_active: false },
        error: null,
      })

      const response = await request(app)
        .delete('/event-categories/1')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NO_CONTENT)
      expect(categoriesBuilder.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the category does not exist', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .delete('/event-categories/99')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.ENTITY_NOT_FOUND)
    })
  })

  describe('inactive categories on public GET', () => {
    it('stops returning a deactivated category on public GET', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle
        .mockResolvedValueOnce({ data: activeCategory, error: null })
        .mockResolvedValueOnce({
          data: { ...activeCategory, is_active: false },
          error: null,
        })

      await request(app).delete('/event-categories/1').set(authHeader(ADMIN_TOKEN))

      categoriesBuilder.resolved = { data: [], error: null }
      categoriesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const listResponse = await request(app).get('/event-categories')
      const detailResponse = await request(app).get('/event-categories/1')

      expect(listResponse.body.data).toEqual([])
      expect(categoriesBuilder.eq).toHaveBeenCalledWith('is_active', true)
      expect(detailResponse.status).toBe(httpStatusCodes.NOT_FOUND)
    })
  })
})
