const supabaseAdmin = require('../supabase/admin')
const mapSupabaseError = require('../utils/map-supabase-error')

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

module.exports = {
  findById,
}
