const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing Supabase admin environment variables')
}

const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

module.exports = supabaseAdmin
