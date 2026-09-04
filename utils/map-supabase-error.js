const buildApiError = require('./buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

const BUSINESS_ERRORS = [
  {
    token: 'registration_deadline_expired',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'The registration deadline has expired',
    errorCode: errorCodes.REGISTRATION_DEADLINE_EXPIRED,
  },
  {
    token: 'registration_already_exists',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'The user is already registered for this event',
    errorCode: errorCodes.REGISTRATION_ALREADY_EXISTS,
  },
  {
    token: 'registration_not_found',
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Registration not found',
    errorCode: errorCodes.REGISTRATION_NOT_FOUND,
  },
  {
    token: 'waitlist_position_conflict',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'Waitlist position is already taken',
    errorCode: errorCodes.WAITLIST_POSITION_CONFLICT,
  },
  {
    token: 'invalid_registration_status',
    statusCode: httpStatusCodes.UNPROCESSABLE_ENTITY,
    description: 'Invalid registration status transition',
    errorCode: errorCodes.INVALID_REGISTRATION_STATUS,
  },
  {
    token: 'invalid_waitlist_position',
    statusCode: httpStatusCodes.BAD_REQUEST,
    description: 'Invalid waitlist position',
    errorCode: errorCodes.INVALID_WAITLIST_POSITION,
  },
  {
    token: 'event_capacity_full',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'Event capacity is full',
    errorCode: errorCodes.EVENT_CAPACITY_FULL,
  },
  {
    token: 'event_not_open',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'Event is not open for registration',
    errorCode: errorCodes.EVENT_NOT_OPEN,
  },
  {
    token: 'profile_not_found',
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Profile not found',
    errorCode: errorCodes.PROFILE_NOT_FOUND,
  },
  {
    token: 'event_not_found',
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Event not found',
    errorCode: errorCodes.EVENT_NOT_FOUND,
  },
  {
    token: 'authentication_required',
    statusCode: httpStatusCodes.UNAUTHORIZED,
    description: 'Authentication required',
    errorCode: errorCodes.AUTH_USER_REQUIRED,
  },
  {
    token: 'admin_required',
    statusCode: httpStatusCodes.FORBIDDEN,
    description: 'Administrator role required',
    errorCode: errorCodes.ADMIN_REQUIRED,
  },
]

function errorText(error) {
  if (!error) {
    return ''
  }

  return [error.message, error.details, error.hint]
    .filter((part) => typeof part === 'string')
    .join(' ')
}

function includesConstraint(error, constraint) {
  return errorText(error).includes(constraint)
}

function mapBusinessError(error) {
  const text = errorText(error)

  return BUSINESS_ERRORS.find((entry) => text.includes(entry.token))
}

function mapSupabaseError(error) {
  const businessError = mapBusinessError(error)

  if (businessError) {
    return buildApiError({
      statusCode: businessError.statusCode,
      description: businessError.description,
      errorCode: businessError.errorCode,
    })
  }

  if (includesConstraint(error, 'event_categories_name_unique')) {
    return buildApiError({
      statusCode: httpStatusCodes.CONFLICT,
      description: 'An event category with this name already exists',
      errorCode: errorCodes.EVENT_CATEGORY_NAME_ALREADY_EXISTS,
    })
  }

  if (includesConstraint(error, 'event_registrations_event_user_unique')) {
    return buildApiError({
      statusCode: httpStatusCodes.CONFLICT,
      description: 'The user is already registered for this event',
      errorCode: errorCodes.REGISTRATION_ALREADY_EXISTS,
    })
  }

  if (includesConstraint(error, 'event_waitlist_position_unique')) {
    return buildApiError({
      statusCode: httpStatusCodes.CONFLICT,
      description: 'Waitlist position is already taken',
      errorCode: errorCodes.WAITLIST_POSITION_CONFLICT,
    })
  }

  if (error?.code === '23503') {
    if (includesConstraint(error, 'events_category_id_fkey')) {
      return buildApiError({
        statusCode: httpStatusCodes.NOT_FOUND,
        description: 'Event category not found',
        errorCode: errorCodes.EVENT_CATEGORY_NOT_FOUND,
      })
    }

    if (includesConstraint(error, 'events_status_code_fkey')) {
      return buildApiError({
        statusCode: httpStatusCodes.NOT_FOUND,
        description: 'Event status not found',
        errorCode: errorCodes.EVENT_STATUS_NOT_FOUND,
      })
    }

    if (includesConstraint(error, 'event_registrations_user_id_fkey')) {
      return buildApiError({
        statusCode: httpStatusCodes.NOT_FOUND,
        description: 'Profile not found',
        errorCode: errorCodes.PROFILE_NOT_FOUND,
      })
    }

    if (includesConstraint(error, 'event_registrations_event_id_fkey')) {
      return buildApiError({
        statusCode: httpStatusCodes.NOT_FOUND,
        description: 'Event not found',
        errorCode: errorCodes.EVENT_NOT_FOUND,
      })
    }

    if (includesConstraint(error, 'event_registrations_status_code_fkey')) {
      return buildApiError({
        statusCode: httpStatusCodes.UNPROCESSABLE_ENTITY,
        description: 'Invalid registration status transition',
        errorCode: errorCodes.INVALID_REGISTRATION_STATUS,
      })
    }
  }

  if (error?.code === '23514') {
    if (includesConstraint(error, 'events_registration_deadline_valid')) {
      return buildApiError({
        statusCode: httpStatusCodes.BAD_REQUEST,
        description: 'registration_deadline must be before or equal to starts_at',
        errorCode: errorCodes.INVALID_EVENT_DATES,
      })
    }

    if (includesConstraint(error, 'events_capacity_positive')) {
      return buildApiError({
        statusCode: httpStatusCodes.BAD_REQUEST,
        description: 'capacity must be greater than zero',
        errorCode: errorCodes.INVALID_EVENT_CAPACITY,
      })
    }

    if (includesConstraint(error, 'event_registrations_waitlist_position_valid')) {
      return buildApiError({
        statusCode: httpStatusCodes.BAD_REQUEST,
        description: 'Invalid waitlist position',
        errorCode: errorCodes.INVALID_WAITLIST_POSITION,
      })
    }
  }

  return buildApiError({
    statusCode: httpStatusCodes.INTERNAL_SERVER,
    description: 'An unexpected error occurred',
    errorCode: errorCodes.UNEXPECTED_ERROR,
  })
}

module.exports = mapSupabaseError
