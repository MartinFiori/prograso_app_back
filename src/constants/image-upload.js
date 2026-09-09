const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const ALLOWED_IMAGE_MIME_SET = new Set(ALLOWED_IMAGE_MIME_TYPES)

function hasPrefix(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) {
    return false
  }

  for (let index = 0; index < bytes.length; index += 1) {
    if (buffer[index] !== bytes[index]) {
      return false
    }
  }

  return true
}

function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null
  }

  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg'
  }

  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }

  if (hasPrefix(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || hasPrefix(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return 'image/gif'
  }

  if (
    hasPrefix(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

function isAllowedImageMime(mime) {
  return typeof mime === 'string' && ALLOWED_IMAGE_MIME_SET.has(mime)
}

module.exports = {
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  sniffImageMime,
  isAllowedImageMime,
}
