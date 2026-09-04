const eventsRepository = require('../repositories/events.repository')
const eventRegistrationsRepository = require('../repositories/event-registrations.repository')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')

function eventNotFoundError() {
  return buildApiError({
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Event not found',
    errorCode: errorCodes.EVENT_NOT_FOUND,
  })
}

function registrationNotFoundError() {
  return buildApiError({
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Registration not found',
    errorCode: errorCodes.REGISTRATION_NOT_FOUND,
  })
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
  }
}

async function assertEventExists(eventId) {
  const event = await eventsRepository.findById(eventId)

  if (!event) {
    throw eventNotFoundError()
  }

  return event
}

async function register(eventId, accessToken) {
  return eventRegistrationsRepository.register(accessToken, eventId)
}

async function getMine(eventId, accessToken, userId) {
  await assertEventExists(eventId)

  const registration = await eventRegistrationsRepository.findMine(
    accessToken,
    eventId,
    userId,
  )

  if (!registration) {
    throw registrationNotFoundError()
  }

  return registration
}

async function unregister(eventId, accessToken) {
  return eventRegistrationsRepository.unregister(accessToken, eventId)
}

async function listAdmin(eventId, query) {
  const event = await assertEventExists(eventId)
  const pagination = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  }

  const result = await eventRegistrationsRepository.listByEvent({
    eventId,
    filters: {
      status_code: query.status_code,
      search: query.search,
    },
    pagination,
  })

  const counts = await eventRegistrationsRepository.getCapacityCounts(eventId)

  return {
    data: result.data,
    pagination: buildPagination(pagination.page, pagination.limit, result.total),
    meta: {
      capacity: event.capacity,
      confirmed_count: counts.confirmed_count,
      waitlisted_count: counts.waitlisted_count,
    },
  }
}

async function getAdminById(registrationId) {
  const registration = await eventRegistrationsRepository.findById(registrationId)

  if (!registration) {
    throw registrationNotFoundError()
  }

  return registration
}

async function adminCreate(eventId, userId, accessToken) {
  return eventRegistrationsRepository.adminRegister(accessToken, eventId, userId)
}

async function adminUpdate(registrationId, patch, accessToken) {
  return eventRegistrationsRepository.adminUpdate(accessToken, registrationId, patch)
}

async function adminRemove(registrationId, accessToken) {
  return eventRegistrationsRepository.adminDelete(accessToken, registrationId)
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
