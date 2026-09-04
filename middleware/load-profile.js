const profilesRepository = require('../repositories/profiles.repository')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

async function loadProfile(req, _res, next) {
  try {
    if (!req.authUser?.id) {
      throw buildApiError({
        statusCode: httpStatusCodes.UNAUTHORIZED,
        description: 'Authentication required',
        errorCode: errorCodes.AUTH_USER_REQUIRED,
      })
    }

    const profile = await profilesRepository.findById(req.authUser.id)

    if (!profile) {
      throw buildApiError({
        statusCode: httpStatusCodes.NOT_FOUND,
        description: 'Profile not found',
        errorCode: errorCodes.PROFILE_NOT_FOUND,
      })
    }

    req.profile = { id: profile.id, role: profile.role }
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = loadProfile
