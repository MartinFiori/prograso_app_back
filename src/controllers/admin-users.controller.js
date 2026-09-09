const adminUsersService = require('../services/admin-users.service')
const ApiSuccess = require('../classes/http_responses/api-success')
const httpStatusCodes = require('../constants/http-status-codes')

function queryOf(req) {
  return req.validatedQuery ?? req.query
}

async function list(req, res) {
  const { data, pagination } = await adminUsersService.list(queryOf(req))
  const body = new ApiSuccess({ data, pagination })
  res.status(body.statusCode).json(body)
}

async function getById(req, res) {
  const data = await adminUsersService.getById(req.params.userId)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function invite(req, res) {
  const data = await adminUsersService.invite(req.body, req.profile.id)
  const body = new ApiSuccess({ data, statusCode: httpStatusCodes.CREATED })
  res.status(body.statusCode).json(body)
}

async function update(req, res) {
  const data = await adminUsersService.updateProfile(
    req.params.userId,
    req.body,
    req.profile.id,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function updateRole(req, res) {
  const data = await adminUsersService.updateRole(
    req.params.userId,
    req.body.role,
    req.profile.id,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function blockEventRegistration(req, res) {
  const data = await adminUsersService.blockEventRegistration(
    req.params.userId,
    req.body,
    req.profile.id,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function unblockEventRegistration(req, res) {
  const data = await adminUsersService.unblockEventRegistration(
    req.params.userId,
    req.profile.id,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function suspendAuth(req, res) {
  const data = await adminUsersService.suspendAuth(
    req.params.userId,
    req.body,
    req.profile.id,
  )
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function unsuspendAuth(req, res) {
  const data = await adminUsersService.unsuspendAuth(req.params.userId, req.profile.id)
  const body = new ApiSuccess({ data })
  res.status(body.statusCode).json(body)
}

async function remove(req, res) {
  await adminUsersService.remove(req.params.userId, req.profile.id)
  res.status(httpStatusCodes.NO_CONTENT).send()
}

module.exports = {
  list,
  getById,
  invite,
  update,
  updateRole,
  blockEventRegistration,
  unblockEventRegistration,
  suspendAuth,
  unsuspendAuth,
  remove,
}
