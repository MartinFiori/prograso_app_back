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
const { PUBLIC_STATUS_CODES } = require('../src/constants/event-statuses')

const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_TOKEN = 'admin-access-token'
const USER_TOKEN = 'user-access-token'

const draftEvent = {
  id: 12,
  category_id: 2,
  title: 'Borrador interno',
  starts_at: '2026-09-20T21:00:00.000Z',
  registration_deadline: null,
  capacity: 16,
  price: 15000,
  status_code: 'draft',
  created_by: ADMIN_ID,
  created_at: '2026-09-08T12:00:00.000Z',
  updated_at: '2026-09-08T12:00:00.000Z',
  category: { id: 2, name: 'Cancha abierta', image_url: null },
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

function mockAuthenticatedUser() {
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  })
}

function mockAuthenticatedAdmin() {
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: ADMIN_ID } },
    error: null,
  })
}

function applyPublicStatusFilter(builder) {
  builder.maybeSingle.mockImplementation(() => {
    const row = builder.resolved?.data ?? null
    const statusFilter = (builder.ins || []).find(([column]) => column === 'status_code')

    if (statusFilter && row && !statusFilter[1].includes(row.status_code)) {
      return Promise.resolve({ data: null, error: null })
    }

    return Promise.resolve(builder.resolved)
  })
}

describe('events', () => {
  let profilesBuilder
  let eventsBuilder

  beforeEach(() => {
    mockRpc.mockReset()
    mockRpc.mockResolvedValue({
      data: { ...draftEvent, capacity: 2 },
      error: null,
    })
    createUserClient.mockClear()
    profilesBuilder = createQueryBuilder({
      data: { id: ADMIN_ID, role: 'admin' },
      error: null,
    })
    eventsBuilder = createQueryBuilder({
      data: draftEvent,
      error: null,
    })
    applyPublicStatusFilter(eventsBuilder)

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }

      return eventsBuilder
    })
  })

  describe('GET /admin/events/:id', () => {
    it('returns 200 for a draft with created_by, created_at and updated_at', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app).get('/admin/events/12').set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.status).toBe('success')
      expect(response.body.data.id).toBe(12)
      expect(response.body.data.status_code).toBe('draft')
      expect(response.body.data.created_by).toBe(ADMIN_ID)
      expect(response.body.data.created_at).toBe(draftEvent.created_at)
      expect(response.body.data.updated_at).toBe(draftEvent.updated_at)
      expect(eventsBuilder.eqs).toContainEqual(['id', 12])
      expect(eventsBuilder.ins.find(([column]) => column === 'status_code')).toBeUndefined()
      expect(String(eventsBuilder.selectArgs[0])).toContain('price')
    })

    it('returns 401 when no Bearer token is provided', async () => {
      const response = await request(app).get('/admin/events/12')

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
    })

    it('returns 403 when the caller is not an admin', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app).get('/admin/events/12').set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    })

    it('returns 404 event_not_found when the event does not exist', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.resolved = { data: null, error: null }

      const response = await request(app).get('/admin/events/999').set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
    })
  })

  describe('GET /events/:id public vs admin draft', () => {
    it('returns 404 event_not_found for the same draft id on the public route', async () => {
      mockAuthenticatedAdmin()

      const adminResponse = await request(app)
        .get('/admin/events/12')
        .set(authHeader(ADMIN_TOKEN))

      expect(adminResponse.status).toBe(httpStatusCodes.OK)
      expect(adminResponse.body.data.created_by).toBe(ADMIN_ID)

      const publicResponse = await request(app).get('/events/12')

      expect(publicResponse.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(publicResponse.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
      expect(eventsBuilder.ins).toContainEqual(['status_code', [...PUBLIC_STATUS_CODES]])
      expect(supabase.auth.getUser).toHaveBeenCalledTimes(1)
    })

    it('includes price on public GET /events/:id for an open event', async () => {
      const openEvent = {
        ...draftEvent,
        id: 1,
        status_code: 'open',
        price: 15000,
      }
      eventsBuilder.resolved = { data: openEvent, error: null }

      const response = await request(app).get('/events/1')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.price).toBe(15000)
      expect(String(eventsBuilder.selectArgs[0])).toContain('price')
    })
  })

  describe('POST /events created_by', () => {
    it('rejects created_by in the body with 400 VALIDATION_FAILED', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          category_id: 2,
          title: 'Open night',
          starts_at: '2026-09-20T21:00:00.000Z',
          capacity: 16,
          price: 15000,
          created_by: ADMIN_ID,
        })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })

    it('rejects missing price with 400 VALIDATION_FAILED', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .post('/events')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          category_id: 2,
          title: 'Open night',
          starts_at: '2026-09-20T21:00:00.000Z',
          capacity: 16,
        })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(eventsBuilder.insert).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /events/:id capacity recalc', () => {
    it('returns 401 when no Bearer token is provided', async () => {
      const response = await request(app).patch('/events/12').send({ capacity: 2 })

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
      expect(mockRpc).not.toHaveBeenCalled()
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('returns 403 when the caller is not an admin', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(USER_TOKEN))
        .send({ capacity: 2 })

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
      expect(mockRpc).not.toHaveBeenCalled()
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('returns 400 VALIDATION_FAILED for capacity 0 without mutating', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: 0 })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(mockRpc).not.toHaveBeenCalled()
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('returns 400 VALIDATION_FAILED for a negative capacity without mutating', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: -1 })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(mockRpc).not.toHaveBeenCalled()
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('returns 404 event_not_found when the event does not exist', async () => {
      mockAuthenticatedAdmin()
      eventsBuilder.resolved = { data: null, error: null }

      const response = await request(app)
        .patch('/events/999')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: 2 })

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
      expect(mockRpc).not.toHaveBeenCalled()
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('does not call admin_update_event when capacity is omitted', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ title: 'Cancha de noche' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.id).toBe(12)
      expect(mockRpc).not.toHaveBeenCalled()
      expect(eventsBuilder.update).toHaveBeenCalledTimes(1)
      expect(eventsBuilder.updates[0]).toEqual(
        expect.objectContaining({
          title: 'Cancha de noche',
          updated_at: expect.any(String),
        }),
      )
      expect(eventsBuilder.updates[0]).not.toHaveProperty('capacity')
    })

    it('persists price on table update when capacity is omitted', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ price: 18000 })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(mockRpc).not.toHaveBeenCalled()
      expect(eventsBuilder.updates[0]).toEqual(
        expect.objectContaining({
          price: 18000,
          updated_at: expect.any(String),
        }),
      )
    })

    it('calls admin_update_event and skips table update when capacity is present', async () => {
      mockAuthenticatedAdmin()
      mockRpc.mockImplementation(async (_fnName, params) => {
        eventsBuilder.resolved = {
          data: { ...draftEvent, capacity: params.p_patch.capacity },
          error: null,
        }
        return {
          data: { ...draftEvent, capacity: params.p_patch.capacity },
          error: null,
        }
      })

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: 2 })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.status).toBe('success')
      expect(response.body.data.capacity).toBe(2)
      expect(response.body.data.category).toEqual(draftEvent.category)
      expect(mockRpc).toHaveBeenCalledWith('admin_update_event', {
        p_event_id: 12,
        p_patch: { capacity: 2 },
      })
      expect(createUserClient).toHaveBeenCalledWith(ADMIN_TOKEN)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('still calls admin_update_event when capacity equals the current value', async () => {
      mockAuthenticatedAdmin()

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: 16 })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(mockRpc).toHaveBeenCalledWith('admin_update_event', {
        p_event_id: 12,
        p_patch: { capacity: 16 },
      })
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('sends title and capacity together to the RPC without a table update', async () => {
      mockAuthenticatedAdmin()
      mockRpc.mockImplementation(async (_fnName, params) => {
        eventsBuilder.resolved = {
          data: {
            ...draftEvent,
            capacity: params.p_patch.capacity,
            title: params.p_patch.title,
          },
          error: null,
        }
        return {
          data: {
            ...draftEvent,
            capacity: params.p_patch.capacity,
            title: params.p_patch.title,
          },
          error: null,
        }
      })

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: 2, title: 'Cancha de noche' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.capacity).toBe(2)
      expect(response.body.data.title).toBe('Cancha de noche')
      expect(mockRpc).toHaveBeenCalledWith('admin_update_event', {
        p_event_id: 12,
        p_patch: { capacity: 2, title: 'Cancha de noche' },
      })
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('does not update the events table when the capacity RPC fails', async () => {
      mockAuthenticatedAdmin()
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'event_not_found' },
      })

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: 2 })

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })

    it('maps a serialization failure to 409 event_update_conflict without table update', async () => {
      mockAuthenticatedAdmin()
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '40001', message: 'could not serialize access due to concurrent update' },
      })

      const response = await request(app)
        .patch('/events/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ capacity: 1 })

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_UPDATE_CONFLICT)
      expect(eventsBuilder.update).not.toHaveBeenCalled()
    })
  })
})
