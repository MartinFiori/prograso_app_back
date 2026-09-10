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

const USER_ID = 'regular-user-id'
const USER_TOKEN = 'user-access-token'
const ADMIN_ID = 'admin-user-id'
const ADMIN_TOKEN = 'admin-access-token'
const ME_COLUMNS = 'id, role, name, avatar_url, category, gender, phone_number'

const meProfile = {
  id: USER_ID,
  role: 'user',
  name: 'Ana',
  avatar_url: 'https://example.com/avatar.jpg',
  category: '9na',
  gender: 'Masculino',
  phone_number: '+549110000000',
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

const jpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00,
])

describe('GET /me', () => {
  let profilesBuilder

  beforeEach(() => {
    profilesBuilder = createQueryBuilder({
      data: meProfile,
      error: null,
    })

    supabaseAdmin.from.mockImplementation(() => profilesBuilder)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await request(app).get('/me')

    expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
  })

  it('returns 401 when the token is invalid', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid' },
    })

    const response = await request(app).get('/me').set(authHeader(USER_TOKEN))

    expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_INVALID_TOKEN)
  })

  it('returns 404 when the profile does not exist', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
    profilesBuilder.resolved = { data: null, error: null }

    const response = await request(app).get('/me').set(authHeader(USER_TOKEN))

    expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
    expect(response.body.errorCode).toBe(errorCodes.PROFILE_NOT_FOUND)
  })

  it('returns the allowlisted profile for an authenticated user', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })

    const response = await request(app).get('/me').set(authHeader(USER_TOKEN))

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.status).toBe('success')
    expect(response.body.data).toEqual(meProfile)
    expect(response.body.data.event_registration_block_reason).toBeUndefined()
    expect(profilesBuilder.select).toHaveBeenCalledWith(ME_COLUMNS)
  })

  it('returns admin role when the profile is admin', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: ADMIN_ID } },
      error: null,
    })
    profilesBuilder.resolved = {
      data: {
        id: ADMIN_ID,
        role: 'admin',
        name: 'Ada',
        avatar_url: null,
        category: null,
        gender: null,
        phone_number: null,
      },
      error: null,
    }

    const response = await request(app).get('/me').set(authHeader(ADMIN_TOKEN))

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data.role).toBe('admin')
    expect(response.body.data.avatar_url).toBeNull()
    expect(response.body.data.phone_number).toBeNull()
  })
})

describe('PATCH /me', () => {
  let profilesBuilder

  beforeEach(() => {
    profilesBuilder = createQueryBuilder({
      data: meProfile,
      error: null,
    })

    supabaseAdmin.from.mockImplementation(() => profilesBuilder)
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
    imgbbService.uploadImage.mockReset()
  })

  it('returns 401 when no token is provided', async () => {
    const response = await request(app).patch('/me').send({ name: 'Ana Gomez' })

    expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
  })

  it('returns 404 when the profile does not exist', async () => {
    profilesBuilder.resolved = { data: null, error: null }

    const response = await request(app)
      .patch('/me')
      .set(authHeader(USER_TOKEN))
      .send({ name: 'Ana Gomez' })

    expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
    expect(response.body.errorCode).toBe(errorCodes.PROFILE_NOT_FOUND)
  })

  it('updates allowlisted fields for the authenticated user', async () => {
    const updated = {
      ...meProfile,
      name: 'Ana Gomez',
      category: '7ma',
      gender: 'No binario',
      phone_number: '+5491130483185',
    }
    profilesBuilder.resolved = { data: updated, error: null }

    const response = await request(app)
      .patch('/me')
      .set(authHeader(USER_TOKEN))
      .send({
        name: '  Ana Gomez  ',
        category: '7ma',
        gender: 'No binario',
        phone_number: ' +5491130483185 ',
      })

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data).toEqual(updated)
    expect(response.body.data.event_registration_block_reason).toBeUndefined()
    expect(profilesBuilder.update).toHaveBeenCalledWith({
      name: 'Ana Gomez',
      category: '7ma',
      gender: 'No binario',
      phone_number: '+5491130483185',
    })
    expect(profilesBuilder.eq).toHaveBeenCalledWith('id', USER_ID)
  })

  it('clears phone_number when empty', async () => {
    profilesBuilder.resolved = {
      data: { ...meProfile, phone_number: null },
      error: null,
    }

    const response = await request(app)
      .patch('/me')
      .set(authHeader(USER_TOKEN))
      .send({ phone_number: '' })

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(profilesBuilder.update).toHaveBeenCalledWith({ phone_number: null })
  })

  it('rejects extra keys including role', async () => {
    const response = await request(app)
      .patch('/me')
      .set(authHeader(USER_TOKEN))
      .send({ name: 'Ana', role: 'admin' })

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(profilesBuilder.update).not.toHaveBeenCalled()
  })

  it('rejects an invalid category', async () => {
    const response = await request(app)
      .patch('/me')
      .set(authHeader(USER_TOKEN))
      .send({ category: '1ra' })

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(profilesBuilder.update).not.toHaveBeenCalled()
  })

  it('rejects an invalid phone_number', async () => {
    const response = await request(app)
      .patch('/me')
      .set(authHeader(USER_TOKEN))
      .send({ phone_number: 'not-a-phone' })

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
  })

  it('uploads an image and stores avatar_url', async () => {
    const uploaded = 'https://i.ibb.co/avatar.jpg'
    imgbbService.uploadImage.mockResolvedValue(uploaded)
    profilesBuilder.resolved = {
      data: { ...meProfile, avatar_url: uploaded },
      error: null,
    }

    const response = await request(app)
      .patch('/me')
      .set(authHeader(USER_TOKEN))
      .attach('image', jpegBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' })

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(imgbbService.uploadImage).toHaveBeenCalledTimes(1)
    expect(profilesBuilder.update).toHaveBeenCalledWith({ avatar_url: uploaded })
    expect(response.body.data.avatar_url).toBe(uploaded)
  })
})
