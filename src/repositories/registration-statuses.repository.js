const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

const TABLE = 'registration_statuses'
const COLUMNS = 'code, label, description'

async function list() {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .order('label', { ascending: true })

  if (error) {
    throw mapSupabaseError(error)
  }

  return data ?? []
}

module.exports = {
  list,
}
