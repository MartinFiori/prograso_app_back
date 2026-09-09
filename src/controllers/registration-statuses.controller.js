const registrationStatusesService = require('../services/registration-statuses.service')
const ApiSuccess = require('../classes/http_responses/api-success')

async function list(_req, res) {
  const data = await registrationStatusesService.list()
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

module.exports = {
  list,
}
