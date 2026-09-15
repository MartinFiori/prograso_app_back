const buildApiError = require('./buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

const BUSINESS_ERRORS = [
  {
    token: 'event_already_started',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'The event has already started',
    errorCode: errorCodes.EVENT_ALREADY_STARTED,
  },
  {
    token: 'registration_already_exists',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'The user is already registered for this event',
    errorCode: errorCodes.REGISTRATION_ALREADY_EXISTS,
  },
  {
    token: 'paired_registration_not_found',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'The registration does not belong to a pair',
    errorCode: errorCodes.PAIRED_REGISTRATION_NOT_FOUND,
  },
  {
    token: 'registration_not_found',
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Registration not found',
    errorCode: errorCodes.REGISTRATION_NOT_FOUND,
  },
  {
    token: 'invalid_companion',
    statusCode: httpStatusCodes.BAD_REQUEST,
    description: 'The companion must be a different registered user',
    errorCode: errorCodes.INVALID_COMPANION,
  },
  {
    token: 'companion_not_allowed',
    statusCode: httpStatusCodes.BAD_REQUEST,
    description: 'This event does not accept pair registrations',
    errorCode: errorCodes.COMPANION_NOT_ALLOWED,
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
    token: 'invalid_event_capacity',
    statusCode: httpStatusCodes.BAD_REQUEST,
    description: 'capacity must be greater than zero',
    errorCode: errorCodes.INVALID_EVENT_CAPACITY,
  },
  {
    token: 'event_update_conflict',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'The event could not be updated due to a concurrent update',
    errorCode: errorCodes.EVENT_UPDATE_CONFLICT,
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
  {
    token: 'event_registration_forbidden',
    statusCode: httpStatusCodes.FORBIDDEN,
    description: 'The user is not allowed to register for events',
    errorCode: errorCodes.EVENT_REGISTRATION_FORBIDDEN,
  },
  {
    token: 'self_admin_action_forbidden',
    statusCode: httpStatusCodes.FORBIDDEN,
    description: 'Administrators cannot perform this action on themselves',
    errorCode: errorCodes.SELF_ADMIN_ACTION_FORBIDDEN,
  },
  {
    token: 'last_admin_protected',
    statusCode: httpStatusCodes.CONFLICT,
    description: 'The last active administrator cannot be modified this way',
    errorCode: errorCodes.LAST_ADMIN_PROTECTED,
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

function blockedUntilFromError(error) {
  const details = typeof error?.details === 'string' ? error.details.trim() : ''

  if (!details) {
    return { blocked_until: null }
  }

  return { blocked_until: details }
}

function mapSupabaseError(error) {
  if (error?.code === '40001' || error?.code === '40P01') {
    return buildApiError({
      statusCode: httpStatusCodes.CONFLICT,
      description: 'The event could not be updated due to a concurrent update',
      errorCode: errorCodes.EVENT_UPDATE_CONFLICT,
    })
  }

  const businessError = mapBusinessError(error)

  if (businessError) {
    const payload = {
      statusCode: businessError.statusCode,
      description: businessError.description,
      errorCode: businessError.errorCode,
    }

    if (businessError.errorCode === errorCodes.EVENT_REGISTRATION_FORBIDDEN) {
      payload.data = blockedUntilFromError(error)
    }

    return buildApiError(payload)
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
    if (includesConstraint(error, 'events_time_range_valid')) {
      return buildApiError({
        statusCode: httpStatusCodes.BAD_REQUEST,
        description: 'end_at must be after starts_at',
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

  const data = postgrestErrorData(error)
  const description = data.message || 'An unexpected error occurred'

  return buildApiError({
    statusCode: httpStatusCodes.INTERNAL_SERVER,
    description,
    errorCode: errorCodes.DB_UNKNOWN_ERROR,
    data,
  })
}

function nullableString(value) {
  return typeof value === 'string' ? value : null
}

function postgrestErrorData(error) {
  return {
    code: nullableString(error?.code),
    message: nullableString(error?.message),
    details: nullableString(error?.details),
    hint: nullableString(error?.hint),
  }
}

module.exports = mapSupabaseError
