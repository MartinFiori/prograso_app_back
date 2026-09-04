const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

const TABLE = 'event_categories'
const COLUMNS = 'id, name, description, image_url, is_active, created_at, updated_at'

async function listActive() {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw mapSupabaseError(error)
  }

  return data ?? []
}

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function findActiveById(id) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

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

async function updateById(id, payload) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

module.exports = {
  listActive,
  findById,
  findActiveById,
  insert,
  updateById,
}
