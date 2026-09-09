const errorHandler = require('../src/middleware/error-handler')
const buildApiError = require('../src/utils/buildApiError')
const httpStatusCodes = require('../src/constants/http-status-codes')
const errorCodes = require('../src/constants/error-codes')

function mockRes() {
  return {
    headersSent: false,
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

describe('errorHandler', () => {
  it('logs description and data for 500 ApiError responses', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const err = buildApiError({
      statusCode: httpStatusCodes.INTERNAL_SERVER,
      description: 'column profiles.event_registration_blocked does not exist',
      errorCode: errorCodes.DB_UNKNOWN_ERROR,
      data: {
        code: 'PGRST204',
        message: 'column profiles.event_registration_blocked does not exist',
        details: null,
        hint: null,
      },
    })
    const req = { method: 'GET', originalUrl: '/admin/users?page=1&limit=20' }
    const res = mockRes()

    errorHandler(err, req, res, () => {})

    expect(res.statusCode).toBe(httpStatusCodes.INTERNAL_SERVER)
    expect(res.body.errorCode).toBe(errorCodes.DB_UNKNOWN_ERROR)
    expect(consoleError).toHaveBeenCalledWith({
      method: 'GET',
      url: '/admin/users?page=1&limit=20',
      statusCode: httpStatusCodes.INTERNAL_SERVER,
      errorCode: errorCodes.DB_UNKNOWN_ERROR,
      description: 'column profiles.event_registration_blocked does not exist',
      data: {
        code: 'PGRST204',
        message: 'column profiles.event_registration_blocked does not exist',
        details: null,
        hint: null,
      },
    })
    consoleError.mockRestore()
  })

  it('keeps UNEXPECTED_ERROR for thrown values that are not ApiError', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = mockRes()

    errorHandler(new Error('boom'), { method: 'GET', originalUrl: '/' }, res, () => {})

    expect(res.body).toEqual({
      status: 'error',
      statusCode: httpStatusCodes.INTERNAL_SERVER,
      description: 'An unexpected error occurred',
      errorCode: errorCodes.UNEXPECTED_ERROR,
      data: null,
    })
    consoleError.mockRestore()
  })
})
