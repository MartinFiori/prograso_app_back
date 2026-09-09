jest.mock('../src/supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../src/supabase/admin', () => ({
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    admin: {
      listUsers: jest.fn(),
      getUserById: jest.fn(),
      inviteUserByEmail: jest.fn(),
      updateUserById: jest.fn(),
      deleteUser: jest.fn(),
    },
  },
}))

const request = require('supertest')
const app = require('../src/app')
const supabase = require('../src/supabase')
const supabaseAdmin = require('../src/supabase/admin')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../src/constants/error-codes')
const httpStatusCodes = require('../src/constants/http-status-codes')
const { ACTIONS } = require('../src/constants/admin-user-audit-actions')

const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ADMIN_ID = '33333333-3333-4333-8333-333333333333'
const ADMIN_TOKEN = 'admin-access-token'
const USER_TOKEN = 'user-access-token'

const userProfile = {
  id: USER_ID,
  role: 'user',
  name: 'Ana Gomez',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  event_registration_blocked: false,
  event_registration_blocked_at: null,
  event_registration_blocked_until: null,
  event_registration_block_reason: null,
  event_registration_blocked_by: null,
}

const authUser = {
  id: USER_ID,
  email: 'ana@example.com',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-03T00:00:00.000Z',
  banned_until: null,
  created_at: '2026-01-01T00:00:00.000Z',
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

describe('admin users', () => {
  let profilesBuilder
  let eventsBuilder
  let registrationsBuilder
  let auditBuilder
  let targetProfile

  function applyProfileUpdates() {
    profilesBuilder.update.mockImplementation((payload) => {
      profilesBuilder.updates.push(payload)
      targetProfile = { ...targetProfile, ...payload }
      return profilesBuilder
    })
  }

  beforeEach(() => {
    targetProfile = { ...userProfile }
    profilesBuilder = createQueryBuilder({
      data: [targetProfile],
      error: null,
      count: 1,
    })
    eventsBuilder = createQueryBuilder({ data: [], error: null, count: 0 })
    registrationsBuilder = createQueryBuilder({ data: [], error: null, count: 0 })
    auditBuilder = createQueryBuilder({
      data: { id: 1 },
      error: null,
    })

    profilesBuilder.maybeSingle.mockImplementation(() => {
      const select = String(profilesBuilder.selectArgs?.[0] ?? '')
      if (select === 'id, role') {
        return Promise.resolve({ data: { id: ADMIN_ID, role: 'admin' }, error: null })
      }
      return Promise.resolve({ data: targetProfile, error: null })
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }
      if (table === 'events') {
        return eventsBuilder
      }
      if (table === 'event_registrations') {
        return registrationsBuilder
      }
      return auditBuilder
    })

    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null })
    supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
      data: { user: authUser },
      error: null,
    })
    supabaseAdmin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [authUser] },
      error: null,
    })
    supabaseAdmin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: authUser },
      error: null,
    })
    supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
      data: { user: authUser },
      error: null,
    })
    supabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ data: { user: {} }, error: null })
  })

  describe('authorization', () => {
    it('returns 401 when no token is provided', async () => {
      const response = await request(app).get('/admin/users')

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
    })

    it('returns 401 when the token is invalid', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid' },
      })

      const response = await request(app)
        .get('/admin/users')
        .set(authHeader('bad-token'))

      expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INVALID_TOKEN)
    })

    it('returns 403 when the caller is not an admin', async () => {
      mockAuthenticatedUser()
      profilesBuilder.maybeSingle.mockResolvedValue({
        data: { id: USER_ID, role: 'user' },
        error: null,
      })

      const response = await request(app)
        .get('/admin/users')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    })

    it('returns 403 when the caller has no profile', async () => {
      mockAuthenticatedUser()
      profilesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

      const response = await request(app)
        .get('/admin/users')
        .set(authHeader(USER_TOKEN))

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    })
  })

  describe('GET /admin/users', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('lists users with a sanitized dto and pagination', async () => {
      const response = await request(app)
        .get('/admin/users')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toMatchObject({
        id: USER_ID,
        email: 'ana@example.com',
        name: 'Ana Gomez',
        avatar_url: null,
        role: 'user',
        auth_suspended: false,
        event_registration_access: {
          blocked: false,
          blocked_at: null,
          blocked_until: null,
        },
      })
      expect(response.body.data[0].event_registration_access.reason).toBeUndefined()
      expect(response.body.data[0].encrypted_password).toBeUndefined()
      expect(response.body.data[0].app_metadata).toBeUndefined()
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      })
    })

    it('filters by role and rejects unknown query keys', async () => {
      const ok = await request(app)
        .get('/admin/users')
        .query({ role: 'admin', page: 2, limit: 10 })
        .set(authHeader(ADMIN_TOKEN))

      expect(ok.status).toBe(httpStatusCodes.OK)
      expect(profilesBuilder.eqs).toContainEqual(['role', 'admin'])
      expect(profilesBuilder.rangeArgs).toEqual([10, 19])

      const invalid = await request(app)
        .get('/admin/users')
        .query({ unexpected: '1' })
        .set(authHeader(ADMIN_TOKEN))

      expect(invalid.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(invalid.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })

    it('maps auth provider failures to 503', async () => {
      supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: { message: 'upstream timeout', status: 500 },
      })

      const response = await request(app)
        .get('/admin/users')
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.SERVICE_UNAVAILABLE)
      expect(response.body.errorCode).toBe(errorCodes.AUTH_PROVIDER_ERROR)
      expect(response.body.description).not.toContain('upstream timeout')
      expect(response.body.data).toEqual({
        status: 500,
        code: null,
        message: 'upstream timeout',
      })
    })

    it('maps profile list postgrest errors to DB_UNKNOWN_ERROR', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
      profilesBuilder.resolved = {
        data: null,
        error: {
          code: 'PGRST204',
          message: 'Could not find the column',
          details: null,
          hint: 'Perhaps you meant event_registration_blocked',
        },
        count: null,
      }

      const response = await request(app)
        .get('/admin/users')
        .query({ page: 1, limit: 20 })
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER)
      expect(response.body.errorCode).toBe(errorCodes.DB_UNKNOWN_ERROR)
      expect(response.body.data).toEqual({
        code: 'PGRST204',
        message: 'Could not find the column',
        details: null,
        hint: 'Perhaps you meant event_registration_blocked',
      })
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          errorCode: errorCodes.DB_UNKNOWN_ERROR,
          data: expect.objectContaining({ code: 'PGRST204' }),
        }),
      )
      consoleError.mockRestore()
    })
  })

  describe('GET /admin/users/:userId', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('returns detail including the block reason', async () => {
      targetProfile = {
        ...userProfile,
        event_registration_blocked: true,
        event_registration_blocked_at: '2026-01-04T00:00:00.000Z',
        event_registration_blocked_until: null,
        event_registration_block_reason: 'internal note',
        event_registration_blocked_by: ADMIN_ID,
      }

      const response = await request(app)
        .get(`/admin/users/${USER_ID}`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.event_registration_access.reason).toBe('internal note')
      expect(response.body.data.event_registration_access.blocked).toBe(true)
    })

    it('returns 404 when the profile does not exist', async () => {
      profilesBuilder.maybeSingle.mockImplementation(() => {
        const select = String(profilesBuilder.selectArgs?.[0] ?? '')
        if (select === 'id, role') {
          return Promise.resolve({ data: { id: ADMIN_ID, role: 'admin' }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const response = await request(app)
        .get(`/admin/users/${USER_ID}`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND)
      expect(response.body.errorCode).toBe(errorCodes.USER_NOT_FOUND)
    })
  })

  describe('POST /admin/users/invitations', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('invites a user without inventing a password and writes audit', async () => {
      const response = await request(app)
        .post('/admin/users/invitations')
        .set(authHeader(ADMIN_TOKEN))
        .send({ email: 'ana@example.com', name: 'Ana Gomez', role: 'user' })

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(response.body.data.email).toBe('ana@example.com')
      expect(response.body.data.password).toBeUndefined()
      expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
        'ana@example.com',
        { data: { name: 'Ana Gomez', full_name: 'Ana Gomez' } },
      )
      expect(auditBuilder.inserts[0]).toMatchObject({
        actor_user_id: ADMIN_ID,
        target_user_id: USER_ID,
        action: ACTIONS.USER_INVITED,
      })
    })

    it('applies an admin role after the profile exists', async () => {
      applyProfileUpdates()

      const response = await request(app)
        .post('/admin/users/invitations')
        .set(authHeader(ADMIN_TOKEN))
        .send({ email: 'ana@example.com', name: 'Ana Gomez', role: 'admin' })

      expect(response.status).toBe(httpStatusCodes.CREATED)
      expect(profilesBuilder.updates.some((patch) => patch.role === 'admin')).toBe(true)
    })

    it('maps a duplicated email to 409', async () => {
      supabaseAdmin.auth.admin.inviteUserByEmail.mockResolvedValue({
        data: { user: null },
        error: { message: 'A user with this email address has already been registered' },
      })

      const response = await request(app)
        .post('/admin/users/invitations')
        .set(authHeader(ADMIN_TOKEN))
        .send({ email: 'ana@example.com', name: 'Ana Gomez' })

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.USER_EMAIL_ALREADY_EXISTS)
    })

    it('compensates with deleteUser when the profile insert fails', async () => {
      profilesBuilder.maybeSingle.mockImplementation(() => {
        const select = String(profilesBuilder.selectArgs?.[0] ?? '')
        if (select === 'id, role') {
          return Promise.resolve({ data: { id: ADMIN_ID, role: 'admin' }, error: null })
        }
        if (profilesBuilder.inserts.length > 0) {
          return Promise.resolve({
            data: null,
            error: { message: 'insert failed', code: '400' },
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const response = await request(app)
        .post('/admin/users/invitations')
        .set(authHeader(ADMIN_TOKEN))
        .send({ email: 'ana@example.com', name: 'Ana Gomez' })

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER)
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID)
    })
  })

  describe('PATCH /admin/users/:userId', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('updates allowlisted fields and rejects extra keys', async () => {
      applyProfileUpdates()

      const ok = await request(app)
        .patch(`/admin/users/${USER_ID}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ name: 'Ana G.' })

      expect(ok.status).toBe(httpStatusCodes.OK)
      expect(ok.body.data.name).toBe('Ana G.')

      const extra = await request(app)
        .patch(`/admin/users/${USER_ID}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ name: 'Ana', role: 'admin' })

      expect(extra.status).toBe(httpStatusCodes.BAD_REQUEST)
      expect(extra.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    })
  })

  describe('PATCH /admin/users/:userId/role', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('promotes a user to admin and writes audit', async () => {
      applyProfileUpdates()

      const response = await request(app)
        .patch(`/admin/users/${USER_ID}/role`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ role: 'admin' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.role).toBe('admin')
      expect(auditBuilder.inserts[0].action).toBe(ACTIONS.ROLE_CHANGED)
      expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled()
    })

    it('is idempotent when the role is unchanged', async () => {
      const response = await request(app)
        .patch(`/admin/users/${USER_ID}/role`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ role: 'user' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(auditBuilder.inserts).toHaveLength(0)
    })

    it('rejects self-demotion', async () => {
      targetProfile = { ...userProfile, id: ADMIN_ID, role: 'admin', name: 'Admin' }
      supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
        data: { user: { ...authUser, id: ADMIN_ID } },
        error: null,
      })

      const response = await request(app)
        .patch(`/admin/users/${ADMIN_ID}/role`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ role: 'user' })

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.SELF_ADMIN_ACTION_FORBIDDEN)
    })

    it('protects the last admin', async () => {
      targetProfile = { ...userProfile, id: OTHER_ADMIN_ID, role: 'admin' }
      supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'last_admin_protected' },
      })

      const response = await request(app)
        .patch(`/admin/users/${OTHER_ADMIN_ID}/role`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ role: 'user' })

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.LAST_ADMIN_PROTECTED)
    })
  })

  describe('event registration block', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('blocks indefinitely with a reason', async () => {
      applyProfileUpdates()

      const response = await request(app)
        .put(`/admin/users/${USER_ID}/event-registration-block`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ reason: 'abuse' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.event_registration_access.blocked).toBe(true)
      expect(profilesBuilder.updates[0]).toMatchObject({
        event_registration_blocked: true,
        event_registration_block_reason: 'abuse',
        event_registration_blocked_by: ADMIN_ID,
      })
      expect(auditBuilder.inserts[0].action).toBe(ACTIONS.EVENT_REGISTRATION_BLOCKED)
    })

    it('rejects a missing reason and a past until date', async () => {
      const missing = await request(app)
        .put(`/admin/users/${USER_ID}/event-registration-block`)
        .set(authHeader(ADMIN_TOKEN))
        .send({})

      expect(missing.status).toBe(httpStatusCodes.BAD_REQUEST)

      const past = await request(app)
        .put(`/admin/users/${USER_ID}/event-registration-block`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ reason: 'abuse', blocked_until: '2020-01-01T00:00:00.000Z' })

      expect(past.status).toBe(httpStatusCodes.BAD_REQUEST)
    })

    it('unblocks by clearing operational fields', async () => {
      targetProfile = {
        ...userProfile,
        event_registration_blocked: true,
        event_registration_blocked_at: '2026-01-04T00:00:00.000Z',
        event_registration_block_reason: 'abuse',
        event_registration_blocked_by: ADMIN_ID,
      }
      applyProfileUpdates()

      const response = await request(app)
        .delete(`/admin/users/${USER_ID}/event-registration-block`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(profilesBuilder.updates[0]).toEqual({
        event_registration_blocked: false,
        event_registration_blocked_at: null,
        event_registration_blocked_until: null,
        event_registration_block_reason: null,
        event_registration_blocked_by: null,
      })
    })

    it('is idempotent when already unblocked', async () => {
      const response = await request(app)
        .delete(`/admin/users/${USER_ID}/event-registration-block`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(auditBuilder.inserts).toHaveLength(0)
    })
  })

  describe('auth suspension', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('suspends a user through Auth Admin', async () => {
      const bannedUser = {
        ...authUser,
        banned_until: '2027-01-01T00:00:00.000Z',
      }
      supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
        data: { user: bannedUser },
        error: null,
      })

      const response = await request(app)
        .put(`/admin/users/${USER_ID}/auth-suspension`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ reason: 'fraud', ban_duration: '24h' })

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data.auth_suspended).toBe(true)
      expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(USER_ID, {
        ban_duration: '24h',
      })
    })

    it('rejects self-suspension', async () => {
      targetProfile = { ...userProfile, id: ADMIN_ID, role: 'admin' }

      const response = await request(app)
        .put(`/admin/users/${ADMIN_ID}/auth-suspension`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ reason: 'fraud', ban_duration: '24h' })

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.SELF_ADMIN_ACTION_FORBIDDEN)
    })

    it('reactivates a suspended user', async () => {
      supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
        data: { user: { ...authUser, banned_until: '2027-01-01T00:00:00.000Z' } },
        error: null,
      })
      supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
        data: { user: { ...authUser, banned_until: null } },
        error: null,
      })

      const response = await request(app)
        .delete(`/admin/users/${USER_ID}/auth-suspension`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(USER_ID, {
        ban_duration: 'none',
      })
    })
  })

  describe('DELETE /admin/users/:userId', () => {
    beforeEach(() => {
      mockAuthenticatedAdmin()
    })

    it('deletes a user without dependencies after writing audit', async () => {
      const response = await request(app)
        .delete(`/admin/users/${USER_ID}`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.NO_CONTENT)
      expect(auditBuilder.inserts[0].action).toBe(ACTIONS.USER_DELETED)
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID)
    })

    it('conflicts when the user created events', async () => {
      eventsBuilder.resolved = { data: [], error: null, count: 2 }

      const response = await request(app)
        .delete(`/admin/users/${USER_ID}`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.CONFLICT)
      expect(response.body.errorCode).toBe(errorCodes.USER_DELETE_CONFLICT)
      expect(response.body.data).toEqual({ events_created: 2, registrations: 0 })
      expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled()
    })

    it('rejects self-deletion', async () => {
      const response = await request(app)
        .delete(`/admin/users/${ADMIN_ID}`)
        .set(authHeader(ADMIN_TOKEN))

      expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
      expect(response.body.errorCode).toBe(errorCodes.SELF_ADMIN_ACTION_FORBIDDEN)
    })
  })
})
