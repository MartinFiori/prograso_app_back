const supabase = require('../supabase')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function extractBearerToken(header) {
  if (typeof header !== 'string') {
    return null
  }

  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return null
  }

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

async function authenticate(req, _res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
      throw buildApiError({
        statusCode: httpStatusCodes.UNAUTHORIZED,
        description: 'Authentication required',
        errorCode: errorCodes.AUTH_USER_REQUIRED,
      })
    }

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data?.user?.id) {
      throw buildApiError({
        statusCode: httpStatusCodes.UNAUTHORIZED,
        description: 'Invalid or expired access token',
        errorCode: errorCodes.AUTH_INVALID_TOKEN,
      })
    }

    req.authUser = { id: data.user.id }
    req.accessToken = token
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = authenticate
