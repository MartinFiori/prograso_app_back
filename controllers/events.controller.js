const eventsService = require('../services/events.service')
const ApiSuccess = require('../classes/http_responses/api-success')
const httpStatusCodes = require('../constants/http-status-codes')

function queryOf(req) {
  return req.validatedQuery ?? req.query
}

async function list(req, res) {
  const { data, pagination } = await eventsService.listPublic(queryOf(req))
  const body = new ApiSuccess({ data, pagination })
  res.status(body.statusCode).json(body)
}

async function listAdmin(req, res) {
  const { data, pagination } = await eventsService.listAdmin(queryOf(req))
  const body = new ApiSuccess({ data, pagination })
  res.status(body.statusCode).json(body)
}

async function getById(req, res) {
  const data = await eventsService.getPublicById(req.params.id)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function create(req, res) {
  const data = await eventsService.create(req.body, req.profile.id)
  const body = new ApiSuccess({ data, statusCode: httpStatusCodes.CREATED })
  res.status(body.statusCode).json(body)
}

async function update(req, res) {
  const data = await eventsService.update(req.params.id, req.body)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function remove(req, res) {
  await eventsService.softDelete(req.params.id)
  res.status(httpStatusCodes.NO_CONTENT).send()
}

module.exports = {
  list,
  listAdmin,
  getById,
  create,
  update,
  remove,
}
