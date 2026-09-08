const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

const TABLE = 'event_statuses'
const COLUMNS = 'code, label, description'

function throwMappedError(error) {
  console.error({
    table: TABLE,
    code: error.code,
    message: error.message,
  })
  throw mapSupabaseError(error)
}

async function list() {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .order('label', { ascending: true })

  if (error) {
    throwMappedError(error)
  }

  return data ?? []
}

async function findByCode(code) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNS)
    .eq('code', code)
    .maybeSingle()

  if (error) {
    throwMappedError(error)
  }

  return data
}

module.exports = {
  list,
  findByCode,
}
