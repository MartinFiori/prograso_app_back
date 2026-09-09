const eventCategoriesRepository = require('../repositories/event-categories.repository')
const imgbbService = require('./imgbb.service')
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

async function resolveImageUrl(file) {
  if (!file) {
    return null
  }

  return imgbbService.uploadImage(file)
}

async function create(payload, file) {
  const imageUrl = await resolveImageUrl(file)

  return eventCategoriesRepository.insert({
    name: payload.name,
    description: payload.description ?? null,
    image_url: imageUrl,
  })
}

async function update(id, payload, file) {
  const existing = await eventCategoriesRepository.findById(id)

  if (!existing) {
    throw notFoundError()
  }

  const patch = {
    ...payload,
    updated_at: nowIso(),
  }

  if (file) {
    patch.image_url = await resolveImageUrl(file)
  }

  const updated = await eventCategoriesRepository.updateById(id, patch)

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
