const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

const TABLE = 'admin_user_audit_logs'
const COLUMNS =
  'id, actor_user_id, target_user_id, action, reason, previous_values, new_values, created_at'

async function insert(payload) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert(payload)
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function list({ filters = {}, pagination } = {}) {
  const page = pagination.page
  const limit = pagination.limit
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabaseAdmin
    .from(TABLE)
    .select(COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.target_user_id) {
    query = query.eq('target_user_id', filters.target_user_id)
  }

  if (filters.action) {
    query = query.eq('action', filters.action)
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

module.exports = {
  insert,
  list,
}
