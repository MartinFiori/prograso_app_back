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
const { createUserClient } = require('../src/supabase/user-client')
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

describe('PATCH /events/:eventId/registrations/:userId/paid', () => {
  let profilesBuilder

  const paidRow = {
    id: 12,
    event_id: 4,
    user_id: USER_A,
    status_code: 'confirmed',
    waitlist_position: null,
    has_paid: true,
    created_at: '2026-09-04T18:00:00.000Z',
    updated_at: '2026-09-04T18:00:00.000Z',
  }

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

  it('sets has_paid true for an admin', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({ data: paidRow, error: null })

    const response = await request(app)
      .patch(`/events/4/registrations/${USER_A}/paid`)
      .set(authHeader(ADMIN_TOKEN))
      .send({})

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data.has_paid).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('admin_mark_registration_paid', {
      p_event_id: 4,
      p_user_id: USER_A,
    })
  })

  it('is idempotent when already paid', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({ data: paidRow, error: null })

    const response = await request(app)
      .patch(`/events/4/registrations/${USER_A}/paid`)
      .set(authHeader(ADMIN_TOKEN))
      .send({})

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data.has_paid).toBe(true)
  })

  it('returns 403 for non-admin callers', async () => {
    mockAuthenticatedUser()
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: { id: USER_ID, role: 'user' },
      error: null,
    })

    const response = await request(app)
      .patch(`/events/4/registrations/${USER_A}/paid`)
      .set(authHeader(USER_TOKEN))
      .send({})

    expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 401 without a bearer token', async () => {
    const response = await request(app)
      .patch(`/events/4/registrations/${USER_A}/paid`)
      .send({})

    expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 404 registration_not_found', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'registration_not_found' },
    })

    const response = await request(app)
      .patch(`/events/4/registrations/${USER_A}/paid`)
      .set(authHeader(ADMIN_TOKEN))
      .send({})

    expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
    expect(response.body.errorCode).toBe(errorCodes.REGISTRATION_NOT_FOUND)
  })

  it('returns 404 event_not_found', async () => {
    mockAuthenticatedAdmin()
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'event_not_found' },
    })

    const response = await request(app)
      .patch(`/events/999/registrations/${USER_A}/paid`)
      .set(authHeader(ADMIN_TOKEN))
      .send({})

    expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
    expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
  })

  it('rejects extra keys and has_paid in the body', async () => {
    mockAuthenticatedAdmin()

    const extra = await request(app)
      .patch(`/events/4/registrations/${USER_A}/paid`)
      .set(authHeader(ADMIN_TOKEN))
      .send({ extra: true })

    expect(extra.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(extra.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)

    const falsePaid = await request(app)
      .patch(`/events/4/registrations/${USER_A}/paid`)
      .set(authHeader(ADMIN_TOKEN))
      .send({ has_paid: false })

    expect(falsePaid.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(falsePaid.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('GET /events/:eventId/registrations hides has_paid', () => {
  it('strips has_paid from the public roster', async () => {
    const eventBuilder = createQueryBuilder({
      data: {
        id: 4,
        category_id: 1,
        title: 'Open',
        starts_at: '2026-09-20T21:00:00.000Z',
        registration_deadline: null,
        capacity: 16,
        price: 15000,
        status_code: 'open',
        created_at: '2026-09-04T18:00:00.000Z',
        updated_at: '2026-09-04T18:00:00.000Z',
        category: { id: 1, name: 'Cat', image_url: null },
      },
      error: null,
    })
    const registrationsBuilder = createQueryBuilder({
      data: [
        {
          id: 12,
          event_id: 4,
          user_id: USER_A,
          status_code: 'confirmed',
          waitlist_position: null,
          has_paid: true,
          created_at: '2026-09-04T18:00:00.000Z',
          updated_at: '2026-09-04T18:00:00.000Z',
          profile: { id: USER_A, name: 'Ana', avatar_url: null },
        },
      ],
      error: null,
      count: 1,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'events') {
        return eventBuilder
      }
      if (table === 'event_registrations') {
        return registrationsBuilder
      }
      return createQueryBuilder({ data: null, error: null })
    })

    const response = await request(app).get('/events/4/registrations')

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data[0].has_paid).toBeUndefined()
    expect(response.body.data[0].user_id).toBe(USER_A)
  })
})

describe('GET /events/:eventId/registrations/me includes has_paid', () => {
  it('returns has_paid on the caller registration', async () => {
    mockAuthenticatedUser()
    const profilesBuilder = createQueryBuilder({
      data: { id: USER_ID, role: 'user' },
      error: null,
    })
    const eventBuilder = createQueryBuilder({
      data: { id: 4, title: 'Open', status_code: 'open', capacity: 16 },
      error: null,
    })
    const mineBuilder = createQueryBuilder({
      data: {
        id: 12,
        event_id: 4,
        user_id: USER_ID,
        status_code: 'confirmed',
        waitlist_position: null,
        has_paid: true,
        created_at: '2026-09-04T18:00:00.000Z',
        updated_at: '2026-09-04T18:00:00.000Z',
      },
      error: null,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }
      if (table === 'events') {
        return eventBuilder
      }
      return createQueryBuilder({ data: null, error: null })
    })
    createUserClient.mockImplementation(() => ({
      rpc: mockRpc,
      from: jest.fn(() => mineBuilder),
    }))

    const response = await request(app)
      .get('/events/4/registrations/me')
      .set(authHeader(USER_TOKEN))

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data.has_paid).toBe(true)
  })
})
