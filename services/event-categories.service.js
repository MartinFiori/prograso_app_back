const eventCategoriesRepository = require('../repositories/event-categories.repository')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function notFoundError() {
  return buildApiError({
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Event category not found',
    errorCode: errorCodes.ENTITY_NOT_FOUND,
  })
}

function nowIso() {
  return new Date().toISOString()
}

async function listActive() {
  return eventCategoriesRepository.listActive()
}

async function getActiveById(id) {
  const category = await eventCategoriesRepository.findActiveById(id)

  if (!category) {
    throw notFoundError()
  }

  return category
}

async function create(payload) {
  return eventCategoriesRepository.insert({
    name: payload.name,
    description: payload.description ?? null,
    image_url: payload.image_url ?? null,
  })
}

async function update(id, payload) {
  const existing = await eventCategoriesRepository.findById(id)

  if (!existing) {
    throw notFoundError()
  }

  const updated = await eventCategoriesRepository.updateById(id, {
    ...payload,
    updated_at: nowIso(),
  })

  if (!updated) {
    throw notFoundError()
  }

  return updated
}

async function softDelete(id) {
  const existing = await eventCategoriesRepository.findById(id)

  if (!existing) {
    throw notFoundError()
  }

  if (!existing.is_active) {
    return
  }

  const updated = await eventCategoriesRepository.updateById(id, {
    is_active: false,
    updated_at: nowIso(),
  })

  if (!updated) {
    throw notFoundError()
  }
}

module.exports = {
  listActive,
  getActiveById,
  create,
  update,
  softDelete,
}
