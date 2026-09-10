const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

const TABLE = 'registration_statuses'
const COLUMNS = 'code, name, description'

async function list() {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .order('name', { ascending: true })

  if (error) {
    throw mapSupabaseError(error)
  }

  return data ?? []
}

module.exports = {
  list,
}
