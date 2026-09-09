const multer = require('multer')
const { MAX_IMAGE_BYTES, isAllowedImageMime, sniffImageMime } = require('../constants/image-upload')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
})

const parseImageField = upload.fields([{ name: 'image', maxCount: 1 }])

function mapMulterError(err) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return buildApiError({
      statusCode: httpStatusCodes.PAYLOAD_TOO_LARGE,
      description: 'The uploaded image exceeds the maximum allowed size',
      errorCode: errorCodes.FILE_TOO_LARGE,
    })
  }

  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return buildApiError({
      statusCode: httpStatusCodes.BAD_REQUEST,
      description: 'Exactly one image file is allowed',
      errorCode: errorCodes.INVALID_FILE_UPLOAD,
    })
  }

  return buildApiError({
    statusCode: httpStatusCodes.BAD_REQUEST,
    description: 'The uploaded file is invalid',
    errorCode: errorCodes.INVALID_FILE_UPLOAD,
  })
}

function validateUploadedImage(file) {
  if (!file) {
    return null
  }

  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0 || file.size === 0) {
    throw buildApiError({
      statusCode: httpStatusCodes.BAD_REQUEST,
      description: 'The uploaded image is empty',
      errorCode: errorCodes.EMPTY_FILE_UPLOAD,
    })
  }

  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    throw buildApiError({
      statusCode: httpStatusCodes.PAYLOAD_TOO_LARGE,
      description: 'The uploaded image exceeds the maximum allowed size',
      errorCode: errorCodes.FILE_TOO_LARGE,
    })
  }

  const sniffed = sniffImageMime(file.buffer)
  const declared = file.mimetype

  if (!isAllowedImageMime(declared) || !sniffed || sniffed !== declared) {
    throw buildApiError({
      statusCode: httpStatusCodes.UNSUPPORTED_MEDIA_TYPE,
      description: 'The uploaded image type is not allowed',
      errorCode: sniffed && sniffed !== declared
        ? errorCodes.INVALID_FILE_CONTENT
        : errorCodes.UNSUPPORTED_MEDIA_TYPE,
    })
  }

  return file
}

function uploadImage(req, res, next) {
  parseImageField(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return next(mapMulterError(err))
      }

      return next(err)
    }

    try {
      const files = req.files && Array.isArray(req.files.image) ? req.files.image : []
      req.file = validateUploadedImage(files[0] ?? null)
      next()
    } catch (error) {
      next(error)
    }
  })
}

module.exports = uploadImage
