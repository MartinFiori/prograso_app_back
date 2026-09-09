const DEFAULT_TIMEOUT_MS = 15000
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'

function getImgbbApiKey() {
  const key = process.env.IMGBB_API_KEY
  if (typeof key !== 'string') {
    return null
  }

  const trimmed = key.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getImgbbTimeoutMs() {
  const raw = process.env.IMGBB_TIMEOUT_MS
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_TIMEOUT_MS
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS
  }

  return parsed
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  IMGBB_UPLOAD_URL,
  getImgbbApiKey,
  getImgbbTimeoutMs,
}
