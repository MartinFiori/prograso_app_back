const profilesRepository = require('../repositories/profiles.repository')
const imgbbService = require('./imgbb.service')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function toMeDto(profile) {
  return {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    avatar_url: profile.avatar_url ?? null,
    category: profile.category ?? null,
    gender: profile.gender ?? null,
    phone_number: profile.phone_number ?? null,
  }
}

function notFound() {
  return buildApiError({
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Profile not found',
    errorCode: errorCodes.PROFILE_NOT_FOUND,
  })
}

function pickDefined(patch) {
  const payload = {}

  for (const key of ['name', 'avatar_url', 'category', 'gender', 'phone_number']) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
      payload[key] = patch[key]
    }
  }

  return payload
}

async function getMe(userId) {
  const profile = await profilesRepository.findMeById(userId)

  if (!profile) {
    throw notFound()
  }

  return toMeDto(profile)
}

async function updateMe(userId, patch, file) {
  const profile = await profilesRepository.findMeById(userId)

  if (!profile) {
    throw notFound()
  }

  const payload = pickDefined(patch ?? {})

  if (file) {
    payload.avatar_url = await imgbbService.uploadImage(file)
  }

  if (Object.keys(payload).length === 0) {
    throw buildApiError({
      statusCode: httpStatusCodes.BAD_REQUEST,
      description: 'Request body must not be empty',
      errorCode: errorCodes.VALIDATION_FAILED,
    })
  }

  const updated = await profilesRepository.updateById(userId, payload)

  if (!updated) {
    throw notFound()
  }

  const fresh = await profilesRepository.findMeById(userId)

  if (!fresh) {
    throw notFound()
  }

  return toMeDto(fresh)
}

module.exports = {
  getMe,
  updateMe,
}
