jest.mock('../supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../supabase/admin', () => ({
  from: jest.fn(),
}))

const request = require('supertest')
const app = require('../app')
const supabase = require('../supabase')
const supabaseAdmin = require('../supabase/admin')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../constants/error-codes')
const httpStatusCodes = require('../constants/http-status-codes')
const { PUBLIC_STATUS_CODES, CANCELLED_STATUS_CODE } = require('../constants/event-statuses')

const ADMIN_ID = 'admin-user-id'
const USER_ID = 'regular-user-id'
const ADMIN_TOKEN = 'admin-access-token'
const USER_TOKEN = 'user-access-token'

const activeCategory = {
  id: 2,
  name: 'Canchas abiertas',
  description: 'Partidos abiertos para anotarse',
  image_url: 'https://example.com/cancha.jpg',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const publicCategory = {
  id: 2,
  name: 'Canchas abiertas',
  image_url: 'https://example.com/cancha.jpg',
}

const publicEvent = {
  id: 1,
  category_id: 2,
  title: 'Cancha abierta - Viernes 4 de septiembre',
  starts_at: '2026-09-04T21:00:00.000Z',
  registration_deadline: '2026-09-04T18:00:00.000Z',
  capacity: 16,
  status_code: 'open',
  category: publicCategory,
}

const adminEvent = {
  ...publicEvent,
  created_by: ADMIN_ID,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const draftStatus = {
  code: 'draft',
  name: 'Borrador',
  description: 'El evento todavía no fue publicado.',
  is_active: true,
}

const createPayload = {
  category_id: 2,
  title: 'Cancha abierta - Viernes 4 de septiembre',
  starts_at: '2026-09-04T21:00:00.000Z',
  registration_deadline: '2026-09-04T18:00:00.000Z',
  capacity: 16,
  status_code: 'draft',
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

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

describe('events', () => {
  let profilesBuilder
  let categoriesBuilder
  let statusesBuilder
  let eventsBuilder

  beforeEach(() => {
    profilesBuilder = createQueryBuilder({
      data: { id: ADMIN_ID, role: 'admin' },
      error: null,
    })
    categoriesBuilder = createQueryBuilder({
      data: activeCategory,
      error: null,
    })
    statusesBuilder = createQueryBuilder({
      data: draftStatus,
      error: null,
    })
    eventsBuilder = createQueryBuilder({
      data: [publicEvent],
      error: null,
      count: 1,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }
      if (table === 'event_categories') {
        return categoriesBuilder
      }
      if (table === 'event_statuses') {
        return statusesBuilder
      }
      return eventsBuilder
    })
  })

  describe('GET /events', () => {
    it('allows unauthenticated users to list public events', async () => {
      const response = await request(app).get('/events')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toEqual([publicEvent])
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      })
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(String(eventsBuilder.selectArgs[0])).not.toContain('created_by')
    })

    it('does not return draft events', async () => {
      const response = await request(app).get('/events')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(eventsBuilder.in).toHaveBeenCalledWith('status_code', [...PUBLIC_STATUS_CODES])
      expect(eventsBuilder.ins[0][1]).not.toContain('draft')
    })

    it('does not return cancelled events', async () => {
      const response = await request(app).get('/events')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(eventsBuilder.ins[0][1]).not.toContain(CANCELLED_STATUS_CODE)
    })

    it('returns an empty list when filtering the public list by draft', async () => {
      const response = await request(app).get('/events').query({ status_code: 'draft' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual([])
      expect(response.body.pagination.total).toBe(0)
      expect(eventsBuilder.in).not.toHaveBeenCalled()
    })

    it('filters by category and date range', async () => {
      const response = await request(app).get('/events').query({
        category_id: 2,
        starts_from: '2026-09-04T00:00:00.000Z',
        starts_to: '2026-09-05T00:00:00.000Z',
      })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(eventsBuilder.eq).toHaveBeenCalledWith('category_id', 2)
      expect(eventsBuilder.gte).toHaveBeenCalledWith('starts_at', '2026-09-04T00:00:00.000Z')
      expect(eventsBuilder.lte).toHaveBeenCalledWith('starts_at', '2026-09-05T00:00:00.000Z')
      expect(eventsBuilder.order).toHaveBeenCalledWith('starts_at', { ascending: true })
      expect(eventsBuilder.range).toHaveBeenCalledWith(0, 19)
    })
  })

  describe('GET /events/:id', () => {
    it('allows unauthenticated users to get a public event', async () => {
      eventsBuilder.resolved = { data: publicEvent, error: null }
      eventsBuilder.maybeSingle.mockResolvedValue(eventsBuilder.resolved)

      const response = await request(app).get('/events/1')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(publicEvent)
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(eventsBuilder.in).toHaveBeenCalledWith('status_code', [...PUBLIC_STATUS_CODES])
      expect(response.body.data.created_by).toBeUndefined()
    })

    it('returns 400 for an invalid id', async () => {
      const response = await request(app).get('/events/abc')

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })

    it('returns 404 when the event does not exist or is not public', async () => {
      eventsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app).get('/events/99')

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
    })
  })

  describe('POST /events', () => {
    it('returns 401 when no token is provided', async () => {
      const response = await request(app).post('/events').send(createPayload)

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
    })

    it('returns 403 when the authenticated user is not an admin', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app)
        .post('/events')
        .set(authHeader(USER_TOKEN))
        .send(createPayload)

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
      expect(supabase.auth.getUser).toHaveBeenCalledWith(USER_TOKEN)
    })

    it('creates an event when the user is an admin', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.resolved = { data: adminEvent, error: null }
      eventsBuilder.maybeSingle.mockResolvedValue(eventsBuilder.resolved)

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send(createPayload)

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toEqual(adminEvent)
      expect(eventsBuilder.insert).toHaveBeenCalledWith({
        category_id: 2,
        title: 'Cancha abierta - Viernes 4 de septiembre',
        starts_at: '2026-09-04T21:00:00.000Z',
        registration_deadline: '2026-09-04T18:00:00.000Z',
        capacity: 16,
        status_code: 'draft',
        created_by: ADMIN_ID,
      })
    })

    it('sets created_by from the authenticated admin profile', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.resolved = { data: adminEvent, error: null }
      eventsBuilder.maybeSingle.mockResolvedValue(eventsBuilder.resolved)

      await request(app).post('/events').set(authHeader(ADMIN_TOKEN)).send(createPayload)

      expect(eventsBuilder.inserts[0].created_by).toBe(ADMIN_ID)
    })

    it('rejects a body that tries to overwrite created_by', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          ...createPayload,
          created_by: USER_ID,
          id: 99,
          created_at: '2020-01-01T00:00:00.000Z',
          updated_at: '2020-01-01T00:00:00.000Z',
        })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })

    it('returns 404 when the category does not exist', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send(createPayload)

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_CATEGORY_NOT_FOUND)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })

    it('returns 409 when the category is inactive', async () => {
      mockAuthenticatedAdmin()
      categoriesBuilder.maybeSingle.mockResolvedValue({
        data: { ...activeCategory, is_active: false },
        error: null,
      })

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send(createPayload)

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_CATEGORY_INACTIVE)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })

    it('returns 404 when the status does not exist', async () => {
      mockAuthenticatedAdmin()
      statusesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send({ ...createPayload, status_code: 'missing' })

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_STATUS_NOT_FOUND)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })

    it('rejects capacity equal to or less than zero', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send({ ...createPayload, capacity: 0 })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })

    it('rejects a registration deadline after starts_at', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          ...createPayload,
          registration_deadline: '2026-09-04T22:00:00.000Z',
        })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.INVALID_EVENT_DATES)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })

    it('rejects unknown properties', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send({ ...createPayload, extra: true })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /events/:id', () => {
    it('updates an event partially when the user is an admin', async () => {
      mockAuthenticatedAdmin()
      const updatedEvent = {
        ...adminEvent,
        title: 'Cancha cubierta',
        updated_at: '2026-09-04T12:00:00.000Z',
      }

      eventsBuilder.maybeSingle
        .mockResolvedValueOnce({ data: adminEvent, error: null })
        .mockResolvedValueOnce({ data: updatedEvent, error: null })

      const response = await request(app)
        .patch('/events/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({ title: 'Cancha cubierta' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.title).toBe('Cancha cubierta')
      expect(eventsBuilder.update).toHaveBeenCalledTimes(1)
      expect(eventsBuilder.updates[0].title).toBe('Cancha cubierta')
      expect(eventsBuilder.updates[0].created_by).toBeUndefined()
    })

    it('revalidates the merged starts_at and registration_deadline', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.maybeSingle.mockResolvedValue({ data: adminEvent, error: null })

      const response = await request(app)
        .patch('/events/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({ starts_at: '2026-09-04T17:00:00.000Z' })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.INVALID_EVENT_DATES)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('updates updated_at', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.maybeSingle
        .mockResolvedValueOnce({ data: adminEvent, error: null })
        .mockResolvedValueOnce({ data: adminEvent, error: null })

      const before = Date.now()
      const response = await request(app)
        .patch('/events/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({ title: 'Cancha cubierta' })
      const after = Date.now()

      expect(response.status).toBe(httpStatusCodes.OK)
      const updatedAt = Date.parse(eventsBuilder.updates[0].updated_at)
      expect(updatedAt).toBeGreaterThanOrEqual(before)
      expect(updatedAt).toBeLessThanOrEqual(after)
    })

    it('returns 404 when the event does not exist', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .patch('/events/99')
        .set(authHeader(ADMIN_TOKEN))
        .send({ title: 'Nueva' })

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
    })

    it('returns 400 for an empty body', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/events/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })

    it('rejects unknown properties', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/events/1')
        .set(authHeader(ADMIN_TOKEN))
        .send({ title: 'Ok', extra: true })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('returns 403 when a non-admin tries to update an event', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app)
        .patch('/events/1')
        .set(authHeader(USER_TOKEN))
        .send({ title: 'Hack' })

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /events/:id', () => {
    it('performs a logical delete by setting cancelled', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.maybeSingle
        .mockResolvedValueOnce({ data: adminEvent, error: null })
        .mockResolvedValueOnce({
          data: { ...adminEvent, status_code: CANCELLED_STATUS_CODE },
          error: null,
        })

      const response = await request(app).delete('/events/1').set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NO_CONTENT)
      expect(response.body).toEqual({})
      expect(eventsBuilder.update).toHaveBeenCalledTimes(1)
      expect(eventsBuilder.updates[0].status_code).toBe(CANCELLED_STATUS_CODE)
      expect(eventsBuilder.updates[0].updated_at).toEqual(expect.any(String))
      expect(eventsBuilder.delete).not.toHaveBeenCalled()
    })

    it('does not physically delete the row', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.maybeSingle
        .mockResolvedValueOnce({ data: adminEvent, error: null })
        .mockResolvedValueOnce({
          data: { ...adminEvent, status_code: CANCELLED_STATUS_CODE },
          error: null,
        })

      await request(app).delete('/events/1').set(authHeader(ADMIN_TOKEN))

      expect(eventsBuilder.deleteCalled).toBe(false)
      expect(eventsBuilder.delete).not.toHaveBeenCalled()
    })

    it('is idempotent when the event is already cancelled', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.maybeSingle.mockResolvedValue({
        data: { ...adminEvent, status_code: CANCELLED_STATUS_CODE },
        error: null,
      })

      const response = await request(app).delete('/events/1').set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NO_CONTENT)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
      expect(eventsBuilder.delete).not.toHaveBeenCalled()
    })

    it('returns 404 when the event does not exist', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app).delete('/events/99').set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
    })

    it('returns 403 when a non-admin tries to cancel an event', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app).delete('/events/1').set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })
  })

  describe('GET /admin/events', () => {
    it('returns 401 when no token is provided', async () => {
      const response = await request(app).get('/admin/events')

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
    })

    it('returns 403 when the authenticated user is not an admin', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app).get('/admin/events').set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    })

    it('returns events of every status including drafts', async () => {
      mockAuthenticatedAdmin()
      const draftEvent = { ...adminEvent, id: 2, status_code: 'draft' }
      eventsBuilder.resolved = { data: [adminEvent, draftEvent], error: null, count: 2 }

      const response = await request(app).get('/admin/events').set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual([adminEvent, draftEvent])
      expect(eventsBuilder.in).not.toHaveBeenCalled()
      expect(String(eventsBuilder.selectArgs[0])).toContain('created_by')
    })
  })
})
