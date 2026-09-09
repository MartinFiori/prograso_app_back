jest.mock('../src/supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../src/supabase/admin', () => ({
  from: jest.fn(),
}))

const request = require('supertest')
const app = require('../src/app')
const supabase = require('../src/supabase')
const supabaseAdmin = require('../src/supabase/admin')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../src/constants/error-codes')
const httpStatusCodes = require('../src/constants/http-status-codes')

const USER_ID = 'regular-user-id'
const USER_TOKEN = 'user-access-token'
const ADMIN_ID = 'admin-user-id'
const ADMIN_TOKEN = 'admin-access-token'

const meProfile = {
  id: USER_ID,
  role: 'user',
  name: 'Ana',
  avatar_url: 'https://example.com/avatar.jpg',
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

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
    expect(profilesBuilder.select).toHaveBeenCalledWith('id, role, name, avatar_url')
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
      },
      error: null,
    }

    const response = await request(app).get('/me').set(authHeader(ADMIN_TOKEN))

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data.role).toBe('admin')
    expect(response.body.data.avatar_url).toBeNull()
  })
})
