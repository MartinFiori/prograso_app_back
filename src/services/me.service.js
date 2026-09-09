const profilesRepository = require('../repositories/profiles.repository')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function toMeDto(profile) {
  return {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    avatar_url: profile.avatar_url ?? null,
  }
}

async function getMe(userId) {
  const profile = await profilesRepository.findMeById(userId)

  if (!profile) {
    throw buildApiError({
      statusCode: httpStatusCodes.NOT_FOUND,
      description: 'Profile not found',
      errorCode: errorCodes.PROFILE_NOT_FOUND,
    })
  }

  return toMeDto(profile)
}

module.exports = {
  getMe,
}
