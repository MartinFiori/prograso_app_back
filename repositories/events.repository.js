const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')
const { PUBLIC_STATUS_CODES } = require('../constants/event-statuses')

const TABLE = 'events'
const CATEGORY_EMBED = 'category:event_categories(id, name, image_url)'
const PUBLIC_COLUMNS = `id, category_id, title, starts_at, registration_deadline, capacity, status_code, ${CATEGORY_EMBED}`
const ADMIN_COLUMNS = `id, category_id, title, starts_at, registration_deadline, capacity, status_code, created_by, created_at, updated_at, ${CATEGORY_EMBED}`

function columnsFor({ includePrivateFields }) {
  return includePrivateFields ? ADMIN_COLUMNS : PUBLIC_COLUMNS
}

async function list({ filters = {}, pagination, publicOnly = false, includePrivateFields = false } = {}) {
  const page = pagination.page
  const limit = pagination.limit
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabaseAdmin
    .from(TABLE)
    .select(columnsFor({ includePrivateFields }), { count: 'exact' })
    .order('starts_at', { ascending: true })
    .range(from, to)

  if (publicOnly) {
    query = query.in('status_code', [...PUBLIC_STATUS_CODES])
  }

  if (filters.status_code) {
    query = query.eq('status_code', filters.status_code)
  }

  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id)
  }

  if (filters.starts_from) {
    query = query.gte('starts_at', filters.starts_from)
  }

  if (filters.starts_to) {
    query = query.lte('starts_at', filters.starts_to)
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

async function findById(id, { includePrivateFields = true, publicOnly = false } = {}) {
  let query = supabaseAdmin
    .from(TABLE)
    .select(columnsFor({ includePrivateFields }))
    .eq('id', id)

  if (publicOnly) {
    query = query.in('status_code', [...PUBLIC_STATUS_CODES])
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function insert(payload) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
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
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(ADMIN_COLUMNS)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

module.exports = {
  list,
  findById,
  insert,
  updateById,
}
