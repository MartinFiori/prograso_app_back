const mapSupabaseError = require('../src/utils/map-supabase-error')
const errorCodes = require('../src/constants/error-codes')
const httpStatusCodes = require('../src/constants/http-status-codes')

describe('mapSupabaseError', () => {
  it('maps unique violations to a stable 409 code', () => {
    const err = mapSupabaseError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "event_categories_name_unique"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.CONFLICT)
    expect(err.errorCode).toBe(errorCodes.EVENT_CATEGORY_NAME_ALREADY_EXISTS)
    expect(err.data).toBeUndefined()
  })

  it('does not map unrelated unique violations to event categories', () => {
    const err = mapSupabaseError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "other_table_unique"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.INTERNAL_SERVER)
    expect(err.errorCode).toBe(errorCodes.DB_UNKNOWN_ERROR)
    expect(err.data).toEqual({
      code: '23505',
      message: 'duplicate key value violates unique constraint "other_table_unique"',
      details: null,
      hint: null,
    })
  })

  it('maps event category foreign key violations', () => {
    const err = mapSupabaseError({
      code: '23503',
      message: 'insert or update on table "events" violates foreign key constraint "events_category_id_fkey"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.NOT_FOUND)
    expect(err.errorCode).toBe(errorCodes.EVENT_CATEGORY_NOT_FOUND)
  })

  it('maps event status foreign key violations', () => {
    const err = mapSupabaseError({
      code: '23503',
      message: 'insert or update on table "events" violates foreign key constraint "events_status_code_fkey"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.NOT_FOUND)
    expect(err.errorCode).toBe(errorCodes.EVENT_STATUS_NOT_FOUND)
  })

  it('maps invalid event date check constraints', () => {
    const err = mapSupabaseError({
      code: '23514',
      message: 'new row for relation "events" violates check constraint "events_registration_deadline_valid"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.BAD_REQUEST)
    expect(err.errorCode).toBe(errorCodes.INVALID_EVENT_DATES)
  })

  it('maps invalid capacity check constraints', () => {
    const err = mapSupabaseError({
      code: '23514',
      message: 'new row for relation "events" violates check constraint "events_capacity_positive"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.BAD_REQUEST)
    expect(err.errorCode).toBe(errorCodes.INVALID_EVENT_CAPACITY)
  })

  it('maps unmapped postgrest errors to DB_UNKNOWN_ERROR with payload', () => {
    const err = mapSupabaseError({
      code: '42P01',
      message: 'relation "event_categories" does not exist',
      details: 'schema cache',
      hint: 'reload schema',
    })

    expect(err.statusCode).toBe(httpStatusCodes.INTERNAL_SERVER)
    expect(err.errorCode).toBe(errorCodes.DB_UNKNOWN_ERROR)
    expect(err.description).toBe('relation "event_categories" does not exist')
    expect(err.data).toEqual({
      code: '42P01',
      message: 'relation "event_categories" does not exist',
      details: 'schema cache',
      hint: 'reload schema',
    })
  })

  it('uses null for missing postgrest fields on unmapped errors', () => {
    const err = mapSupabaseError({})

    expect(err.errorCode).toBe(errorCodes.DB_UNKNOWN_ERROR)
    expect(err.description).toBe('An unexpected error occurred')
    expect(err.data).toEqual({
      code: null,
      message: null,
      details: null,
      hint: null,
    })
  })

  it('maps registration business exceptions without leaking sql', () => {
    const err = mapSupabaseError({
      code: 'P0001',
      message: 'event_not_open',
    })

    expect(err.statusCode).toBe(httpStatusCodes.CONFLICT)
    expect(err.errorCode).toBe(errorCodes.EVENT_NOT_OPEN)
    expect(err.description).toBe('Event is not open for registration')
  })

  it('maps duplicate event registration unique violations', () => {
    const err = mapSupabaseError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "event_registrations_event_user_unique"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.CONFLICT)
    expect(err.errorCode).toBe(errorCodes.REGISTRATION_ALREADY_EXISTS)
  })

  it('maps waitlist position unique violations', () => {
    const err = mapSupabaseError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "event_waitlist_position_unique_idx"',
    })

    expect(err.statusCode).toBe(httpStatusCodes.CONFLICT)
    expect(err.errorCode).toBe(errorCodes.WAITLIST_POSITION_CONFLICT)
  })

  it('maps invalid registration status exceptions to 422', () => {
    const err = mapSupabaseError({
      code: 'P0001',
      message: 'invalid_registration_status',
    })

    expect(err.statusCode).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY)
    expect(err.errorCode).toBe(errorCodes.INVALID_REGISTRATION_STATUS)
  })

  it('maps event registration forbidden with blocked_until and without a reason', () => {
    const err = mapSupabaseError({
      code: 'P0001',
      message: 'event_registration_forbidden',
      details: '2026-12-01T00:00:00+00',
    })

    expect(err.statusCode).toBe(httpStatusCodes.FORBIDDEN)
    expect(err.errorCode).toBe(errorCodes.EVENT_REGISTRATION_FORBIDDEN)
    expect(err.data).toEqual({ blocked_until: '2026-12-01T00:00:00+00' })
    expect(err.description).not.toMatch(/reason/i)
  })

  it('maps invalid_event_capacity exceptions from RPC', () => {
    const err = mapSupabaseError({
      code: 'P0001',
      message: 'invalid_event_capacity',
    })

    expect(err.statusCode).toBe(httpStatusCodes.BAD_REQUEST)
    expect(err.errorCode).toBe(errorCodes.INVALID_EVENT_CAPACITY)
  })

  it('maps serialization failures to event_update_conflict', () => {
    const err = mapSupabaseError({
      code: '40001',
      message: 'could not serialize access due to concurrent update',
    })

    expect(err.statusCode).toBe(httpStatusCodes.CONFLICT)
    expect(err.errorCode).toBe(errorCodes.EVENT_UPDATE_CONFLICT)
  })

  it('maps deadlocks to event_update_conflict', () => {
    const err = mapSupabaseError({
      code: '40P01',
      message: 'deadlock detected',
    })

    expect(err.statusCode).toBe(httpStatusCodes.CONFLICT)
    expect(err.errorCode).toBe(errorCodes.EVENT_UPDATE_CONFLICT)
  })
})
