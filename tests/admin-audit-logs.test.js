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

const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_TOKEN = 'admin-access-token'
const USER_TOKEN = 'user-access-token'

const auditRow = {
  id: 1,
  actor_user_id: ADMIN_ID,
  target_user_id: USER_ID,
  action: 'role_changed',
  reason: null,
  previous_values: { role: 'user' },
  new_values: { role: 'admin' },
  created_at: '2026-09-08T12:00:00.000Z',
}

const AUDIT_COLUMNS =
  'id, actor_user_id, target_user_id, action, reason, previous_values, new_values, created_at'

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

describe('GET /admin/audit-logs', () => {
  let profilesBuilder
  let auditBuilder

  beforeEach(() => {
    profilesBuilder = createQueryBuilder({
      data: { id: ADMIN_ID, role: 'admin' },
      error: null,
    })
    auditBuilder = createQueryBuilder({
      data: [auditRow],
      error: null,
      count: 1,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesBuilder
      }

      if (table === 'admin_user_audit_logs') {
        return auditBuilder
      }

      throw new Error(`unexpected table ${table}`)
    })
  })

  it('returns 401 when no Bearer token is provided', async () => {
    const response = await request(app).get('/admin/audit-logs')

    expect(response.status).toBe(httpStatusCodes.UNAUTHORIZED)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_USER_REQUIRED)
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not an admin', async () => {
    mockAuthenticatedUser()
    profilesBuilder.resolved = { data: { id: USER_ID, role: 'user' }, error: null }

    const response = await request(app).get('/admin/audit-logs').set(authHeader(USER_TOKEN))

    expect(response.status).toBe(httpStatusCodes.FORBIDDEN)
    expect(response.body.errorCode).toBe(errorCodes.AUTH_INSUFFICIENT_PERMISSIONS)
    expect(supabaseAdmin.from).not.toHaveBeenCalledWith('admin_user_audit_logs')
  })

  it('returns 200 with data and pagination, exact count and created_at desc', async () => {
    mockAuthenticatedAdmin()

    const response = await request(app).get('/admin/audit-logs').set(authHeader(ADMIN_TOKEN))

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.status).toBe('success')
    expect(response.body.data).toEqual([auditRow])
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    })
    expect(auditBuilder.select).toHaveBeenCalledWith(AUDIT_COLUMNS, { count: 'exact' })
    expect(auditBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(supabaseAdmin.from).toHaveBeenCalledWith('admin_user_audit_logs')
  })

  it('returns 400 VALIDATION_FAILED for an invalid action', async () => {
    mockAuthenticatedAdmin()

    const response = await request(app)
      .get('/admin/audit-logs')
      .query({ action: 'not_a_real_action' })
      .set(authHeader(ADMIN_TOKEN))

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(supabaseAdmin.from).not.toHaveBeenCalledWith('admin_user_audit_logs')
  })

  it('returns 400 VALIDATION_FAILED for an invalid target_user_id', async () => {
    mockAuthenticatedAdmin()

    const response = await request(app)
      .get('/admin/audit-logs')
      .query({ target_user_id: 'not-a-uuid' })
      .set(authHeader(ADMIN_TOKEN))

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(supabaseAdmin.from).not.toHaveBeenCalledWith('admin_user_audit_logs')
  })

  it('returns 400 VALIDATION_FAILED for an extra query key', async () => {
    mockAuthenticatedAdmin()

    const response = await request(app)
      .get('/admin/audit-logs')
      .query({ extra: 'nope' })
      .set(authHeader(ADMIN_TOKEN))

    expect(response.status).toBe(httpStatusCodes.BAD_REQUEST)
    expect(response.body.errorCode).toBe(errorCodes.VALIDATION_FAILED)
    expect(supabaseAdmin.from).not.toHaveBeenCalledWith('admin_user_audit_logs')
  })
})
