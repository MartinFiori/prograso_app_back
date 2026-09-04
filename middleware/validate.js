const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path
      .filter((segment) => segment !== 'body' && segment !== 'params' && segment !== 'query')
      .join('.'),
    message: issue.message,
  }))
}

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    })

    if (!result.success) {
      return next(
        buildApiError({
          statusCode: httpStatusCodes.BAD_REQUEST,
          description: 'Validation failed',
          errorCode: errorCodes.VALIDATION_FAILED,
          data: formatZodIssues(result.error),
        }),
      )
    }

    if (result.data.params) {
      req.params = { ...req.params, ...result.data.params }
    }

    if (result.data.body !== undefined) {
      req.body = result.data.body
    }

    if (result.data.query !== undefined) {
      req.validatedQuery = result.data.query
      try {
        req.query = result.data.query
      } catch (_err) {
        Object.defineProperty(req, 'query', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: result.data.query,
        })
      }
    }

    next()
  }
}

module.exports = validate
