jest.mock('../src/supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../src/supabase/admin', () => ({
  from: jest.fn(),
}))

const mockRpc = jest.fn()

jest.mock('../src/supabase/user-client', () => ({
  createUserClient: jest.fn(() => ({
    rpc: mockRpc,
    from: jest.fn(),
  })),
}))

const request = require('supertest')
const app = require('../src/app')
const supabase = require('../src/supabase')
const supabaseAdmin = require('../src/supabase/admin')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../src/constants/error-codes')
const httpStatusCodes = require('../src/constants/http-status-codes')

const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ADMIN_TOKEN = 'admin-access-token'
const USER_TOKEN = 'user-access-token'

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

function padUuid(index) {
  return `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`
}

describe('admin event registration sync', () => {
  let profilesBuilder

  beforeEach(() => {
    mockRpc.mockReset()
    profilesBuilder = createQueryBuilder({
      data: [{ id: ADMIN_ID, role: 'admin' }],
      error: null,
    })
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: { id: ADMIN_ID, role: 'admin' },
      error: null,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }

      return createQueryBuilder({ data: null, error: null })
    })
  })

  it('PUT [B,C] vs {A,B} removes A, adds C, and no-ops B', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({
      data: {
        applied: [
          { user_id: USER_A, op: 'remove' },
          { user_id: USER_C, op: 'add' },
        ],
        noops: [{ user_id: USER_B }],
        failures: [],
      },
      error: null,
    })

    const response = await request(app)
      .put('/admin/events/4/registrations')
      .set(authHeader(ADMIN_TOKEN))
      .send({ user_ids: [USER_B, USER_C] })

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.status).toBe('success')
    expect(response.body.data.applied).toEqual([
      { user_id: USER_A, op: 'remove' },
      { user_id: USER_C, op: 'add' },
    ])
    expect(response.body.data.noops).toEqual([{ user_id: USER_B }])
    expect(mockRpc).toHaveBeenCalledWith('admin_sync_event_registrations', {
      p_event_id: 4,
      p_user_ids: [USER_B, USER_C],
    })
  })

  it('PUT [] clears the roster', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({
      data: {
        applied: [{ user_id: USER_A, op: 'remove' }],
        noops: [],
        failures: [],
      },
      error: null,
    })

    const response = await request(app)
      .put('/admin/events/4/registrations')
      .set(authHeader(ADMIN_TOKEN))
      .send({ user_ids: [] })

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(mockRpc).toHaveBeenCalledWith('admin_sync_event_registrations', {
      p_event_id: 4,
      p_user_ids: [],
    })
    expect(response.body.data.applied).toEqual([{ user_id: USER_A, op: 'remove' }])
  })

  it('rejects 501 UUIDs with VALIDATION_FAILED and does not mutate', async () => {
    mockAuthenticatedAdmin()
    const userIds = Array.from({ length: 501 }, (_, index) => padUuid(index + 1))

    const response = await request(app)
      .put('/admin/events/4/registrations')
      .set(authHeader(ADMIN_TOKEN))
      .send({ user_ids: userIds })

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('rejects extra keys with VALIDATION_FAILED', async () => {
    mockAuthenticatedAdmin()

    const response = await request(app)
      .put('/admin/events/4/registrations')
      .set(authHeader(ADMIN_TOKEN))
      .send({ user_ids: [USER_A], extra: true })

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 403 for non-admin callers', async () => {
    mockAuthenticatedUser()
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: { id: USER_ID, role: 'user' },
      error: null,
    })

    const response = await request(app)
      .put('/admin/events/4/registrations')
      .set(authHeader(USER_TOKEN))
      .send({ user_ids: [USER_A] })

    expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 200 partial when one add is blocked', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({
      data: {
        applied: [{ user_id: USER_A, op: 'add' }],
        noops: [],
        failures: [
          {
            user_id: USER_C,
            errorCode: 'event_registration_forbidden',
            description: 'event_registration_forbidden',
          },
        ],
      },
      error: null,
    })

    const response = await request(app)
      .put('/admin/events/4/registrations')
      .set(authHeader(ADMIN_TOKEN))
      .send({ user_ids: [USER_A, USER_C] })

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data.applied).toEqual([{ user_id: USER_A, op: 'add' }])
    expect(response.body.data.failures).toEqual([
      {
        user_id: USER_C,
        errorCode: 'event_registration_forbidden',
        description: 'event_registration_forbidden',
      },
    ])
  })

  it('returns 404 event_not_found for an unknown event', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'event_not_found' },
    })

    const response = await request(app)
      .put('/admin/events/999/registrations')
      .set(authHeader(ADMIN_TOKEN))
      .send({ user_ids: [USER_A] })

    expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
    expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
  })
})
