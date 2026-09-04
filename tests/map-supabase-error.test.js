const mapSupabaseError = require('../utils/map-supabase-error')
const errorCodes = require('../constants/error-codes')
const httpStatusCodes = require('../constants/http-status-codes')

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
    expect(err.errorCode).toBe(errorCodes.UNEXPECTED_ERROR)
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

  it('does not expose unexpected supabase errors', () => {
    const err = mapSupabaseError({
      code: '42P01',
      message: 'relation "event_categories" does not exist',
    })

    expect(err.statusCode).toBe(httpStatusCodes.INTERNAL_SERVER)
    expect(err.errorCode).toBe(errorCodes.UNEXPECTED_ERROR)
    expect(err.description).toBe('An unexpected error occurred')
    expect(err.data).toBeUndefined()
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
})
