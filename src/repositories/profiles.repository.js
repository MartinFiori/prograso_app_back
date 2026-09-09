const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

const AUTH_COLUMNS = 'id, role'
const ME_COLUMNS = 'id, role, name, avatar_url'
const ADMIN_COLUMNS = [
  'id',
  'role',
  'name',
  'avatar_url',
  'created_at',
  'updated_at',
  'event_registration_blocked',
  'event_registration_blocked_at',
  'event_registration_blocked_until',
  'event_registration_block_reason',
  'event_registration_blocked_by',
].join(', ')

function escapeIlike(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(AUTH_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function findMeById(id) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(ME_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function findFullById(id) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(ADMIN_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function insert(payload) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert(payload)
    .select(ADMIN_COLUMNS)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function updateById(id, payload) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(payload)
    .eq('id', id)
    .select(ADMIN_COLUMNS)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function list({ filters = {}, pagination, sort }) {
  const page = pagination.page
  const limit = pagination.limit
  const from = (page - 1) * limit
  const to = from + limit - 1
  const [sortColumn, sortDirection] = (sort ?? 'created_at.desc').split('.')
  const nowIso = new Date().toISOString()

  let query = supabaseAdmin
    .from('profiles')
    .select(ADMIN_COLUMNS, { count: 'exact' })
    .order(sortColumn, { ascending: sortDirection === 'asc' })
    .range(from, to)

  if (filters.role) {
    query = query.eq('role', filters.role)
  }

  if (filters.ids) {
    query = query.in('id', filters.ids)
  }

  if (filters.q) {
    query = query.ilike('name', `%${escapeIlike(filters.q)}%`)
  }

  if (filters.event_registration_blocked === true) {
    query = query
      .eq('event_registration_blocked', true)
      .or(
        `event_registration_blocked_until.is.null,event_registration_blocked_until.gt.${nowIso}`,
      )
  }

  if (filters.event_registration_blocked === false) {
    query = query.or(
      `event_registration_blocked.eq.false,event_registration_blocked_until.lte.${nowIso}`,
    )
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

async function countByForeignKey(table, column, id) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, id)

  if (error) {
    throw mapSupabaseError(error)
  }

  return count ?? 0
}

async function countEventsCreatedBy(userId) {
  return countByForeignKey('events', 'created_by', userId)
}

async function countRegistrationsByUser(userId) {
  return countByForeignKey('event_registrations', 'user_id', userId)
}

async function guardAdminMutation(actorId, targetId, action) {
  const { error } = await supabaseAdmin.rpc('guard_admin_user_mutation', {
    p_actor_id: actorId,
    p_target_id: targetId,
    p_action: action,
  })

  if (error) {
    throw mapSupabaseError(error)
  }
}

module.exports = {
  findById,
  findMeById,
  findFullById,
  insert,
  updateById,
  list,
  countEventsCreatedBy,
  countRegistrationsByUser,
  guardAdminMutation,
}
