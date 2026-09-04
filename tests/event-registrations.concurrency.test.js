const { createClient } = require('@supabase/supabase-js')

const enabled = process.env.RUN_REGISTRATION_DB_TESTS === 'true'
const describeDb = enabled ? describe : describe.skip

describeDb('event registrations concurrency', () => {
  const url = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const tokenA = process.env.TEST_USER_A_ACCESS_TOKEN
  const tokenB = process.env.TEST_USER_B_ACCESS_TOKEN
  const eventId = Number(process.env.TEST_EVENT_ID)

  function userClient(accessToken) {
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

  it('does not exceed capacity when two users take the last spot concurrently', async () => {
    expect(url && publishableKey && tokenA && tokenB && eventId > 0).toBe(true)

    const [resultA, resultB] = await Promise.all([
      userClient(tokenA).rpc('register_for_event', { p_event_id: eventId }),
      userClient(tokenB).rpc('register_for_event', { p_event_id: eventId }),
    ])

    const rows = [resultA.data, resultB.data].filter(Boolean)
    const errors = [resultA.error, resultB.error].filter(Boolean)

    expect(rows.length + errors.length).toBe(2)
    expect(rows.filter((row) => row.status_code === 'confirmed').length).toBeLessThanOrEqual(1)

    const adminClient = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('capacity')
      .eq('id', eventId)
      .maybeSingle()

    expect(eventError).toBeNull()

    const { count: confirmedCount, error: countError } = await adminClient
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status_code', 'confirmed')

    expect(countError).toBeNull()
    expect(confirmedCount).toBeLessThanOrEqual(event.capacity)

    const { data: waitlisted, error: waitlistError } = await adminClient
      .from('event_registrations')
      .select('waitlist_position')
      .eq('event_id', eventId)
      .eq('status_code', 'waitlisted')

    expect(waitlistError).toBeNull()

    const positions = (waitlisted ?? []).map((row) => row.waitlist_position)
    expect(new Set(positions).size).toBe(positions.length)
  })
})
