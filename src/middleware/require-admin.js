const profilesRepository = require('../repositories/profiles.repository')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

async function requireAdmin(req, _res, next) {
  try {
    if (!req.authUser?.id) {
      throw buildApiError({
        statusCode: httpStatusCodes.UNAUTHORIZED,
        description: 'Authentication required',
        errorCode: errorCodes.AUTH_USER_REQUIRED,
      })
    }

    const profile = await profilesRepository.findById(req.authUser.id)

    if (!profile || profile.role !== 'admin') {
      throw buildApiError({
        statusCode: httpStatusCodes.FORBIDDEN,
        description: 'Administrator role required',
        errorCode: errorCodes.AUTH_INSUFFICIENT_PERMISSIONS,
      })
    }

    req.profile = { id: profile.id, role: profile.role }
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = requireAdmin
