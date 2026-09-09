const imgbbService = require('../src/services/imgbb.service')
const errorCodes = require('../src/constants/error-codes')
const httpStatusCodes = require('../src/constants/http-status-codes')
const { IMGBB_UPLOAD_URL } = require('../src/config/imgbb')

const jpegFile = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  mimetype: 'image/jpeg',
  originalname: 'prueba.jpg',
}

const successfulImgbbBody = {
  data: {
    id: 'B2ySwJDY',
    url_viewer: 'https://ibb.co/B2ySwJDY',
    url: 'https://i.ibb.co/Mkc39HTJ/prueba.jpg',
    display_url: 'https://i.ibb.co/fdkPQWRT/prueba.jpg',
    delete_url: 'https://ibb.co/B2ySwJDY/token',
  },
  success: true,
  status: 200,
}

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

describe('imgbb.service', () => {
  const originalKey = process.env.IMGBB_API_KEY

  beforeEach(() => {
    process.env.IMGBB_API_KEY = 'test-imgbb-key'
    global.fetch = jest.fn()
  })

  afterEach(() => {
    process.env.IMGBB_API_KEY = originalKey
    jest.restoreAllMocks()
  })

  it('returns only data.url on a successful ImgBB response', async () => {
    global.fetch.mockResolvedValue(jsonResponse(successfulImgbbBody))

    const url = await imgbbService.uploadImage(jpegFile)

    expect(url).toBe('https://i.ibb.co/Mkc39HTJ/prueba.jpg')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [requestUrl, options] = global.fetch.mock.calls[0]
    expect(requestUrl).toBe(IMGBB_UPLOAD_URL)
    expect(String(requestUrl)).not.toContain('test-imgbb-key')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
  })

  it('rejects success: false', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ success: false, data: {} }, false, 400))

    await expect(imgbbService.uploadImage(jpegFile)).rejects.toMatchObject({
      statusCode: httpStatusCodes.SERVICE_UNAVAILABLE,
      errorCode: errorCodes.IMAGE_PROVIDER_INVALID_RESPONSE,
    })
  })

  it('rejects a response without data.url', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ success: true, data: { display_url: 'https://i.ibb.co/x/display.jpg' } }),
    )

    await expect(imgbbService.uploadImage(jpegFile)).rejects.toMatchObject({
      errorCode: errorCodes.IMAGE_PROVIDER_INVALID_RESPONSE,
    })
  })

  it('rejects a non-https url', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ success: true, data: { url: 'http://i.ibb.co/Mkc39HTJ/prueba.jpg' } }),
    )

    await expect(imgbbService.uploadImage(jpegFile)).rejects.toMatchObject({
      errorCode: errorCodes.IMAGE_PROVIDER_INVALID_RESPONSE,
    })
  })

  it('maps a timeout to IMAGE_PROVIDER_TIMEOUT', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    global.fetch.mockRejectedValue(abortError)

    await expect(imgbbService.uploadImage(jpegFile)).rejects.toMatchObject({
      statusCode: httpStatusCodes.SERVICE_UNAVAILABLE,
      errorCode: errorCodes.IMAGE_PROVIDER_TIMEOUT,
    })
  })

  it('fails safely when the API key is missing', async () => {
    delete process.env.IMGBB_API_KEY

    await expect(imgbbService.uploadImage(jpegFile)).rejects.toMatchObject({
      errorCode: errorCodes.IMGBB_NOT_CONFIGURED,
      description: 'Image upload is not configured',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not include the API key in the public error', async () => {
    process.env.IMGBB_API_KEY = 'super-secret-imgbb-key'
    global.fetch.mockRejectedValue(new Error('connect ECONNREFUSED'))

    try {
      await imgbbService.uploadImage(jpegFile)
      throw new Error('expected uploadImage to reject')
    } catch (error) {
      expect(error.errorCode).toBe(errorCodes.IMAGE_UPLOAD_FAILED)
      expect(JSON.stringify(error)).not.toContain('super-secret-imgbb-key')
      expect(error.description).not.toContain('super-secret-imgbb-key')
      expect(error.message).not.toContain('super-secret-imgbb-key')
    }
  })
})
