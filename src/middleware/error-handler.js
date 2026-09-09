const ApiError = require('../classes/http_responses/api-error')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function serializeError(err) {
  if (err instanceof ApiError) {
    return {
      status: 'error',
      statusCode: err.statusCode,
      description: err.description,
      errorCode: err.errorCode,
      data: err.data ?? null,
    }
  }

  return {
    status: 'error',
    statusCode: httpStatusCodes.INTERNAL_SERVER,
    description: 'An unexpected error occurred',
    errorCode: errorCodes.UNEXPECTED_ERROR,
    data: null,
  }
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  const payload = serializeError(err)

  if (!(err instanceof ApiError) || err.statusCode >= httpStatusCodes.INTERNAL_SERVER) {
    console.error({
      method: req.method,
      url: req.originalUrl,
      statusCode: payload.statusCode,
      errorCode: payload.errorCode,
      description: payload.description,
      data: payload.data,
    })
  }

  return res.status(payload.statusCode).json(payload)
}

module.exports = errorHandler
