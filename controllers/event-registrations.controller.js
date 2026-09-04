const eventRegistrationsService = require('../services/event-registrations.service')
const ApiSuccess = require('../classes/http_responses/api-success')
const httpStatusCodes = require('../constants/http-status-codes')

function queryOf(req) {
  return req.validatedQuery ?? req.query
}

async function register(req, res) {
  const data = await eventRegistrationsService.register(
    req.params.eventId,
    req.accessToken,
  )
  const body = new ApiSuccess({ data, statusCode: httpStatusCodes.CREATED })
  res.status(body.statusCode).json(body)
}

async function getMine(req, res) {
  const data = await eventRegistrationsService.getMine(
    req.params.eventId,
    req.accessToken,
    req.authUser.id,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function unregister(req, res) {
  const data = await eventRegistrationsService.unregister(
    req.params.eventId,
    req.accessToken,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function listAdmin(req, res) {
  const { data, pagination, meta } = await eventRegistrationsService.listAdmin(
    req.params.eventId,
    queryOf(req),
  )
  const body = new ApiSuccess({ data, pagination, meta })
  res.status(body.statusCode).json(body)
}

async function getAdminById(req, res) {
  const data = await eventRegistrationsService.getAdminById(req.params.registrationId)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function adminCreate(req, res) {
  const data = await eventRegistrationsService.adminCreate(
    req.params.eventId,
    req.body.user_id,
    req.accessToken,
  )
  const body = new ApiSuccess({ data, statusCode: httpStatusCodes.CREATED })
  res.status(body.statusCode).json(body)
}

async function adminUpdate(req, res) {
  const data = await eventRegistrationsService.adminUpdate(
    req.params.registrationId,
    req.body,
    req.accessToken,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function adminRemove(req, res) {
  const data = await eventRegistrationsService.adminRemove(
    req.params.registrationId,
    req.accessToken,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

module.exports = {
  register,
  getMine,
  unregister,
  listAdmin,
  getAdminById,
  adminCreate,
  adminUpdate,
  adminRemove,
}
