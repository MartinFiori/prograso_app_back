const eventCategoriesService = require('../services/event-categories.service')
const ApiSuccess = require('../classes/http_responses/api-success')
const httpStatusCodes = require('../constants/http-status-codes')

async function list(_req, res) {
  const data = await eventCategoriesService.listActive()
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function getById(req, res) {
  const data = await eventCategoriesService.getActiveById(req.params.id)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function create(req, res) {
  const data = await eventCategoriesService.create(req.body)
  const body = new ApiSuccess({ data, statusCode: httpStatusCodes.CREATED })
  res.status(body.statusCode).json(body)
}

async function update(req, res) {
  const data = await eventCategoriesService.update(req.params.id, req.body)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function remove(req, res) {
  await eventCategoriesService.softDelete(req.params.id)
  res.status(httpStatusCodes.NO_CONTENT).send()
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
}
