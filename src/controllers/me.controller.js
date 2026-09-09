const meService = require('../services/me.service')
const ApiSuccess = require('../classes/http_responses/api-success')

async function getMe(req, res) {
  const data = await meService.getMe(req.authUser.id)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

module.exports = {
  getMe,
}
