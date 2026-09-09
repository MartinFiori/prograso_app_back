const adminAuditLogsService = require('../services/admin-audit-logs.service')
const ApiSuccess = require('../classes/http_responses/api-success')

function queryOf(req) {
  return req.validatedQuery ?? req.query
}

async function list(req, res) {
  const { data, pagination } = await adminAuditLogsService.list(queryOf(req))
  const body = new ApiSuccess({ data, pagination })
  res.status(body.statusCode).json(body)
}

module.exports = {
  list,
}
