const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const url = process.env.SUPABASE_URL
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Missing Supabase environment variables')
}

function createUserClient(accessToken) {
  return createClient(url, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

module.exports = {
  createUserClient,
}
