const playersService = require('../services/players.service')
const ApiSuccess = require('../classes/http_responses/api-success')

async function search(req, res) {
  const data = await playersService.search(req.validatedQuery ?? req.query, req.authUser.id)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

module.exports = { search }
