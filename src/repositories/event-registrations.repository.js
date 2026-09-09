const supabaseAdmin = require('../supabase/admin')
const { createUserClient } = require('../supabase/user-client')
const mapSupabaseError = require('../utils/map-supabase-error')
const {
  CONFIRMED_STATUS_CODE,
  WAITLISTED_STATUS_CODE,
} = require('../constants/registration-statuses')

const TABLE = 'event_registrations'
const REGISTRATION_COLUMNS =
  'id, event_id, user_id, status_code, waitlist_position, created_at, updated_at'
const PUBLIC_COLUMNS = `${REGISTRATION_COLUMNS}, profile:profiles(id, name, avatar_url)`
const ADMIN_COLUMNS = `${REGISTRATION_COLUMNS}, profile:profiles(id, name, avatar_url, role)`
const ADMIN_SEARCH_COLUMNS = `${REGISTRATION_COLUMNS}, profile:profiles!inner(id, name, avatar_url, role)`

function unwrapRpc(data) {
  if (Array.isArray(data)) {
    return data[0] ?? null
  }

  return data ?? null
}

async function callRpc(accessToken, fnName, params) {
  const client = createUserClient(accessToken)
  const { data, error } = await client.rpc(fnName, params)

  if (error) {
    throw mapSupabaseError(error)
  }

  return unwrapRpc(data)
}

function escapeIlike(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function register(accessToken, eventId) {
  return callRpc(accessToken, 'register_for_event', { p_event_id: eventId })
}

async function unregister(accessToken, eventId) {
  return callRpc(accessToken, 'unregister_from_event', { p_event_id: eventId })
}

async function adminRegister(accessToken, eventId, userId) {
  return callRpc(accessToken, 'admin_register_for_event', {
    p_event_id: eventId,
    p_user_id: userId,
  })
}

async function adminSync(accessToken, eventId, userIds) {
  const client = createUserClient(accessToken)
  const { data, error } = await client.rpc('admin_sync_event_registrations', {
    p_event_id: eventId,
    p_user_ids: userIds,
  })

  if (error) {
    throw mapSupabaseError(error)
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data)) {
    return data[0] ?? { applied: [], noops: [], failures: [] }
  }

  return { applied: [], noops: [], failures: [] }
}

async function adminUpdate(accessToken, registrationId, patch) {
  return callRpc(accessToken, 'admin_update_registration', {
    p_registration_id: registrationId,
    p_patch: patch,
  })
}

async function adminDelete(accessToken, registrationId) {
  return callRpc(accessToken, 'admin_delete_registration', {
    p_registration_id: registrationId,
  })
}

async function findMine(accessToken, eventId, userId) {
  const client = createUserClient(accessToken)
  const { data, error } = await client
    .from(TABLE)
    .select(REGISTRATION_COLUMNS)
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function findById(registrationId) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(ADMIN_COLUMNS)
    .eq('id', registrationId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function countByStatus(eventId, statusCode) {
  const { count, error } = await supabaseAdmin
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status_code', statusCode)

  if (error) {
    throw mapSupabaseError(error)
  }

  return count ?? 0
}

async function listByEvent({ eventId, filters = {}, pagination, publicProfile = false }) {
  const page = pagination.page
  const limit = pagination.limit
  const from = (page - 1) * limit
  const to = from + limit - 1
  const columns = publicProfile
    ? PUBLIC_COLUMNS
    : filters.search
      ? ADMIN_SEARCH_COLUMNS
      : ADMIN_COLUMNS

  let query = supabaseAdmin
    .from(TABLE)
    .select(columns, { count: 'exact' })
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .range(from, to)

  if (filters.status_code) {
    query = query.eq('status_code', filters.status_code)
  }

  if (filters.search) {
    query = query.ilike('profiles.name', `%${escapeIlike(filters.search)}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: data ?? [],
    total: count ?? 0,
  }
}

async function getCapacityCounts(eventId) {
  const confirmedCount = await countByStatus(eventId, CONFIRMED_STATUS_CODE)
  const waitlistedCount = await countByStatus(eventId, WAITLISTED_STATUS_CODE)

  return {
    confirmed_count: confirmedCount,
    waitlisted_count: waitlistedCount,
  }
}

module.exports = {
  register,
  unregister,
  adminRegister,
  adminSync,
  adminUpdate,
  adminDelete,
  findMine,
  findById,
  listByEvent,
  getCapacityCounts,
}
