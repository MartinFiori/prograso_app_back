const supabaseAdmin = require('../supabase/admin')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function adminAuth() {
  return supabaseAdmin.auth.admin
}

function nullableString(value) {
  return typeof value === 'string' ? value : null
}

function authProviderErrorData(error) {
  return {
    status: typeof error?.status === 'number' ? error.status : null,
    code: nullableString(error?.code),
    message: nullableString(error?.message),
  }
}

function authProviderError(error) {
  return buildApiError({
    statusCode: httpStatusCodes.SERVICE_UNAVAILABLE,
    description: 'Authentication provider request failed',
    errorCode: errorCodes.AUTH_PROVIDER_ERROR,
    data: authProviderErrorData(error),
  })
}

function isEmailTakenError(error) {
  const text = [error?.message, error?.code, String(error?.status ?? '')]
    .join(' ')
    .toLowerCase()

  return (
    text.includes('already been registered') ||
    text.includes('already registered') ||
    text.includes('already exists') ||
    text.includes('user_already_exists')
  )
}

function throwAuthError(error) {
  if (!error) {
    throw authProviderError()
  }

  if (isEmailTakenError(error)) {
    throw buildApiError({
      statusCode: httpStatusCodes.CONFLICT,
      description: 'A user with this email already exists',
      errorCode: errorCodes.USER_EMAIL_ALREADY_EXISTS,
    })
  }

  throw authProviderError(error)
}

async function listUsers(params) {
  const { data, error } = await adminAuth().listUsers(params)

  if (error) {
    throwAuthError(error)
  }

  return data?.users ?? []
}

function isNotFoundError(error) {
  const text = [error?.message, String(error?.status ?? '')].join(' ').toLowerCase()

  return error?.status === 404 || text.includes('not found')
}

async function getUserById(id) {
  const { data, error } = await adminAuth().getUserById(id)

  if (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throwAuthError(error)
  }

  return data?.user ?? null
}

async function inviteUserByEmail(email, options) {
  const { data, error } = await adminAuth().inviteUserByEmail(email, options)

  if (error || !data?.user) {
    throwAuthError(error)
  }

  return data.user
}

async function updateUserById(id, attributes) {
  const { data, error } = await adminAuth().updateUserById(id, attributes)

  if (error || !data?.user) {
    throwAuthError(error)
  }

  return data.user
}

async function deleteUser(id) {
  const { error } = await adminAuth().deleteUser(id)

  if (error) {
    throwAuthError(error)
  }
}

module.exports = {
  listUsers,
  getUserById,
  inviteUserByEmail,
  updateUserById,
  deleteUser,
}
