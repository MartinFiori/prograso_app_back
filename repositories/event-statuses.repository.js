const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

const TABLE = 'event_statuses'
const COLUMNS = 'code, name, description, is_active'

async function findByCode(code) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .eq('code', code)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

module.exports = {
  findByCode,
}
