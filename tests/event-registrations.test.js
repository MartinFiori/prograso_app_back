jest.mock('../supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../supabase/admin', () => ({
  from: jest.fn(),
}))

jest.mock('../supabase/user-client', () => ({
  createUserClient: jest.fn(),
}))

const request = require('supertest')
const app = require('../app')
const supabase = require('../supabase')
const supabaseAdmin = require('../supabase/admin')
const { createUserClient } = require('../supabase/user-client')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../constants/error-codes')
const httpStatusCodes = require('../constants/http-status-codes')

const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333'
const ADMIN_TOKEN = 'admin-access-token'
const USER_TOKEN = 'user-access-token'

const openEvent = {
  id: 4,
  category_id: 2,
  title: 'Cancha abierta',
  starts_at: '2026-09-04T21:00:00.000Z',
  registration_deadline: '2026-09-10T18:00:00.000Z',
  capacity: 16,
  status_code: 'open',
  created_by: ADMIN_ID,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const confirmedRegistration = {
  id: 12,
  event_id: 4,
  user_id: USER_ID,
  status_code: 'confirmed',
  waitlist_position: null,
  created_at: '2026-09-04T18:00:00.000Z',
  updated_at: '2026-09-04T18:00:00.000Z',
}

const waitlistedRegistration = {
  ...confirmedRegistration,
  id: 13,
  status_code: 'waitlisted',
  waitlist_position: 1,
}

const adminRegistration = {
  ...confirmedRegistration,
  profile: {
    id: USER_ID,
    name: 'Ana Gomez',
    avatar_url: null,
    role: 'user',
  },
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

function mockRpcError(message) {
  return {
    data: null,
    error: { code: 'P0001', message },
  }
}

describe('event registrations', () => {
  let profilesBuilder
  let eventsBuilder
  let registrationsBuilder
  let userRegistrationsBuilder
  let userRpc

  beforeEach(() => {
    profilesBuilder = createQueryBuilder({
      data: { id: USER_ID, role: 'user' },
      error: null,
    })
    eventsBuilder = createQueryBuilder({
      data: openEvent,
      error: null,
    })
    registrationsBuilder = createQueryBuilder({
      data: [adminRegistration],
      error: null,
      count: 1,
    })
    userRegistrationsBuilder = createQueryBuilder({
      data: confirmedRegistration,
      error: null,
    })
    userRpc = jest.fn().mockResolvedValue({
      data: confirmedRegistration,
      error: null,
    })

    createUserClient.mockReturnValue({
      rpc: userRpc,
      from: jest.fn(() => userRegistrationsBuilder),
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }
      if (table === 'events') {
        return eventsBuilder
      }
      return registrationsBuilder
    })
  })

  describe('POST /events/:eventId/registrations', () => {
    it('returns 401 when no token is provided', async () => {
      const response = await request(app).post('/events/4/registrations').send({})

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
      expect(createUserClient).not.toHaveBeenCalled()
    })

    it('returns 401 when the token is invalid', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid' },
      })

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader('bad-token'))
        .send({})

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INVALID_TOKEN)
      expect(supabase.auth.getUser).toHaveBeenCalledWith('bad-token')
    })

    it('returns 404 when the authenticated user has no profile', async () => {
      mockAuthenticatedUser()
      profilesBuilder.resolved = { data: null, error: null }

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.PROFILE_NOT_FOUND)
      expect(userRpc).not.toHaveBeenCalled()
    })

    it('registers the authenticated user in an open event', async () => {
      mockAuthenticatedUser()

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toEqual(confirmedRegistration)
      expect(createUserClient).toHaveBeenCalledWith(USER_TOKEN)
      expect(userRpc).toHaveBeenCalledWith('register_for_event', { p_event_id: 4 })
    })

    it('rejects registration when the event is not open', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue(mockRpcError('event_not_open'))

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_OPEN)
    })

    it('rejects registration after the registration deadline', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue(mockRpcError('registration_deadline_expired'))

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.REGISTRATION_DEADLINE_EXPIRED)
    })

    it('rejects a second registration for the same event', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue(mockRpcError('registration_already_exists'))

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.REGISTRATION_ALREADY_EXISTS)
    })

    it('rejects an extra user_id in the body', async () => {
      mockAuthenticatedUser()

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({ user_id: OTHER_USER_ID })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(userRpc).not.toHaveBeenCalled()
    })

    it('creates a confirmed registration when capacity is available', async () => {
      mockAuthenticatedUser()

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.data.status_code).toBe('confirmed')
      expect(response.body.data.waitlist_position).toBeNull()
    })

    it('creates a waitlisted registration when the event is full', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue({ data: waitlistedRegistration, error: null })

      const response = await request(app)
        .post('/events/4/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.data).toEqual(waitlistedRegistration)
      expect(response.body.data.status_code).toBe('waitlisted')
      expect(response.body.data.waitlist_position).toBe(1)
    })

    it('returns 400 for an invalid eventId', async () => {
      mockAuthenticatedUser()

      const response = await request(app)
        .post('/events/abc/registrations')
        .set(authHeader(USER_TOKEN))
        .send({})

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })
  })

  describe('GET /events/:eventId/registrations/me', () => {
    it('returns the authenticated user registration', async () => {
      mockAuthenticatedUser()

      const response = await request(app)
        .get('/events/4/registrations/me')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(confirmedRegistration)
      expect(createUserClient).toHaveBeenCalledWith(USER_TOKEN)
      expect(userRegistrationsBuilder.eqs).toEqual([
        ['event_id', 4],
        ['user_id', USER_ID],
      ])
    })

    it('returns 404 when the user is not registered', async () => {
      mockAuthenticatedUser()
      userRegistrationsBuilder.resolved = { data: null, error: null }
      userRegistrationsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .get('/events/4/registrations/me')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.REGISTRATION_NOT_FOUND)
    })

    it('does not look up another user_id when querying own registration', async () => {
      mockAuthenticatedUser()

      const response = await request(app)
        .get('/events/4/registrations/me')
        .query({ user_id: OTHER_USER_ID })
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(userRegistrationsBuilder.eqs).toContainEqual(['user_id', USER_ID])
      expect(userRegistrationsBuilder.eqs).not.toContainEqual(['user_id', OTHER_USER_ID])
    })
  })

  describe('DELETE /events/:eventId/registrations/me', () => {
    it('unregisters a confirmed user', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue({ data: confirmedRegistration, error: null })

      const response = await request(app)
        .delete('/events/4/registrations/me')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(confirmedRegistration)
      expect(userRpc).toHaveBeenCalledWith('unregister_from_event', { p_event_id: 4 })
    })

    it('promotes the first waitlisted user when a confirmed registration is deleted', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue({ data: confirmedRegistration, error: null })

      const response = await request(app)
        .delete('/events/4/registrations/me')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(userRpc).toHaveBeenCalledWith('unregister_from_event', { p_event_id: 4 })
      expect(createUserClient).toHaveBeenCalledWith(USER_TOKEN)
    })

    it('unregisters a waitlisted user', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue({ data: waitlistedRegistration, error: null })

      const response = await request(app)
        .delete('/events/4/registrations/me')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.status_code).toBe('waitlisted')
      expect(userRpc).toHaveBeenCalledWith('unregister_from_event', { p_event_id: 4 })
    })

    it('returns 404 when there is no registration to delete', async () => {
      mockAuthenticatedUser()
      userRpc.mockResolvedValue(mockRpcError('registration_not_found'))

      const response = await request(app)
        .delete('/events/4/registrations/me')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.REGISTRATION_NOT_FOUND)
    })
  })

  describe('admin authorization', () => {
    it('returns 403 when a regular user hits admin registration endpoints', async () => {
      mockAuthenticatedUser()

      const response = await request(app)
        .get('/admin/events/4/registrations')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    })
  })

  describe('GET /admin/events/:eventId/registrations', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
      profilesBuilder.resolved = { data: { id: ADMIN_ID, role: 'admin' }, error: null }
    })

    it('lists registrations with profile, pagination and capacity meta', async () => {
      const response = await request(app)
        .get('/admin/events/4/registrations')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual([adminRegistration])
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      })
      expect(response.body.meta).toEqual({
        capacity: 16,
        confirmed_count: 1,
        waitlisted_count: 1,
      })
      expect(registrationsBuilder.eqs).toContainEqual(['event_id', 4])
      expect(registrationsBuilder.range).toHaveBeenCalledWith(0, 19)
      expect(
        registrationsBuilder.select.mock.calls.some((args) =>
          String(args[0]).includes('profile:profiles'),
        ),
      ).toBe(true)
      expect(
        registrationsBuilder.select.mock.calls.every(
          (args) => !String(args[0]).includes('auth.users'),
        ),
      ).toBe(true)
    })

    it('filters by status_code and search', async () => {
      const response = await request(app)
        .get('/admin/events/4/registrations')
        .query({ status_code: 'waitlisted', search: 'ana', page: 2, limit: 10 })
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(registrationsBuilder.eqs).toContainEqual(['status_code', 'waitlisted'])
      expect(registrationsBuilder.ilike).toHaveBeenCalledWith('profiles.name', '%ana%')
      expect(registrationsBuilder.range).toHaveBeenCalledWith(10, 19)
    })

    it('returns 404 when the event does not exist', async () => {
      eventsBuilder.resolved = { data: null, error: null }
      eventsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .get('/admin/events/99/registrations')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.EVENT_NOT_FOUND)
    })
  })

  describe('POST /admin/events/:eventId/registrations', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
      profilesBuilder.resolved = { data: { id: ADMIN_ID, role: 'admin' }, error: null }
    })

    it('adds a user to an event', async () => {
      const response = await request(app)
        .post('/admin/events/4/registrations')
        .set(authHeader(ADMIN_TOKEN))
        .send({ user_id: USER_ID })

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.data).toEqual(confirmedRegistration)
      expect(createUserClient).toHaveBeenCalledWith(ADMIN_TOKEN)
      expect(userRpc).toHaveBeenCalledWith('admin_register_for_event', {
        p_event_id: 4,
        p_user_id: USER_ID,
      })
    })

    it('rejects an invalid user_id', async () => {
      const response = await request(app)
        .post('/admin/events/4/registrations')
        .set(authHeader(ADMIN_TOKEN))
        .send({ user_id: 'not-a-uuid' })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(userRpc).not.toHaveBeenCalled()
    })
  })

  describe('GET /admin/event-registrations/:registrationId', () => {
    it('returns a registration for an admin', async () => {
      mockAuthenticatedAdmin()
      profilesBuilder.resolved = { data: { id: ADMIN_ID, role: 'admin' }, error: null }
      registrationsBuilder.resolved = { data: adminRegistration, error: null }
      registrationsBuilder.maybeSingle.mockResolvedValue({
        data: adminRegistration,
        error: null,
      })

      const response = await request(app)
        .get('/admin/event-registrations/12')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(adminRegistration)
      expect(registrationsBuilder.eqs).toContainEqual(['id', 12])
    })
  })

  describe('PATCH /admin/event-registrations/:registrationId', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
      profilesBuilder.resolved = { data: { id: ADMIN_ID, role: 'admin' }, error: null }
    })

    it('updates a registration status', async () => {
      userRpc.mockResolvedValue({ data: waitlistedRegistration, error: null })

      const response = await request(app)
        .patch('/admin/event-registrations/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ status_code: 'waitlisted', waitlist_position: 1 })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(waitlistedRegistration)
      expect(userRpc).toHaveBeenCalledWith('admin_update_registration', {
        p_registration_id: 12,
        p_patch: { status_code: 'waitlisted', waitlist_position: 1 },
      })
    })

    it('rejects forbidden fields', async () => {
      const response = await request(app)
        .patch('/admin/event-registrations/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ user_id: OTHER_USER_ID })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
      expect(userRpc).not.toHaveBeenCalled()
    })

    it('rejects cancelled as a patchable status', async () => {
      const response = await request(app)
        .patch('/admin/event-registrations/12')
        .set(authHeader(ADMIN_TOKEN))
        .send({ status_code: 'cancelled' })

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })
  })

  describe('DELETE /admin/event-registrations/:registrationId', () => {
    it('deletes a registration as admin', async () => {
      mockAuthenticatedAdmin()
      profilesBuilder.resolved = { data: { id: ADMIN_ID, role: 'admin' }, error: null }
      userRpc.mockResolvedValue({ data: confirmedRegistration, error: null })

      const response = await request(app)
        .delete('/admin/event-registrations/12')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(confirmedRegistration)
      expect(userRpc).toHaveBeenCalledWith('admin_delete_registration', {
        p_registration_id: 12,
      })
    })
  })
})
