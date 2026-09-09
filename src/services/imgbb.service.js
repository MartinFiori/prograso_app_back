const { IMGBB_UPLOAD_URL, getImgbbApiKey, getImgbbTimeoutMs } = require('../config/imgbb')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function providerError(errorCode, description) {
  return buildApiError({
    statusCode: httpStatusCodes.SERVICE_UNAVAILABLE,
    description,
    errorCode,
  })
}

function isAbortError(error) {
  return Boolean(error) && (error.name === 'AbortError' || error.code === 'ABORT_ERR')
}

function isPublicHttpsUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname.length > 0
  } catch (_err) {
    return false
  }
}

async function parseJsonBody(response) {
  try {
    return await response.json()
  } catch (_err) {
    return null
  }
}

async function uploadImage(file) {
  const apiKey = getImgbbApiKey()

  if (!apiKey) {
    throw providerError(
      errorCodes.IMGBB_NOT_CONFIGURED,
      'Image upload is not configured',
    )
  }

  const buffer = file?.buffer
  const mimeType = file?.mimetype || 'application/octet-stream'
  const filename = file?.originalname || 'image'

  const form = new FormData()
  form.append('key', apiKey)
  form.append('image', new Blob([buffer], { type: mimeType }), filename)

  let response
  try {
    response = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(getImgbbTimeoutMs()),
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw providerError(
        errorCodes.IMAGE_PROVIDER_TIMEOUT,
        'Image provider timed out',
      )
    }

    throw providerError(
      errorCodes.IMAGE_UPLOAD_FAILED,
      'Image upload failed',
    )
  }

  const payload = await parseJsonBody(response)

  if (!payload || payload.success !== true || typeof payload.data?.url !== 'string') {
    throw providerError(
      errorCodes.IMAGE_PROVIDER_INVALID_RESPONSE,
      'Image provider returned an invalid response',
    )
  }

  const imageUrl = payload.data.url.trim()

  if (!isPublicHttpsUrl(imageUrl)) {
    throw providerError(
      errorCodes.IMAGE_PROVIDER_INVALID_RESPONSE,
      'Image provider returned an invalid response',
    )
  }

  return imageUrl
}

module.exports = {
  uploadImage,
  isPublicHttpsUrl,
}
