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

function toPublicRegistration(row) {
  const profile = row.profile ?? {}

  return {
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    status_code: row.status_code,
    waitlist_position: row.waitlist_position,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile: {
      id: profile.id ?? row.user_id,
      name: profile.name ?? '',
      avatar_url: profile.avatar_url ?? null,
    },
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

async function listPublic(eventId, query) {
  const event = await eventsRepository.findById(eventId, {
    includePrivateFields: false,
    publicOnly: true,
  })

  if (!event) {
    throw eventNotFoundError()
  }

  const pagination = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  }

  const result = await eventRegistrationsRepository.listByEvent({
    eventId,
    filters: {},
    pagination,
    publicProfile: true,
  })

  return {
    data: result.data.map(toPublicRegistration),
    pagination: buildPagination(pagination.page, pagination.limit, result.total),
  }
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

function uniqueFirstSeen(userIds) {
  const seen = new Set()
  const unique = []

  for (const userId of userIds) {
    if (seen.has(userId)) {
      continue
    }

    seen.add(userId)
    unique.push(userId)
  }

  return unique
}

async function adminCreate(eventId, userId, accessToken) {
  return eventRegistrationsRepository.adminRegister(accessToken, eventId, userId)
}

async function adminSync(eventId, userIds, accessToken) {
  return eventRegistrationsRepository.adminSync(
    accessToken,
    eventId,
    uniqueFirstSeen(userIds),
  )
}

async function adminUpdate(registrationId, patch, accessToken) {
  return eventRegistrationsRepository.adminUpdate(accessToken, registrationId, patch)
}

async function adminRemove(registrationId, accessToken) {
  return eventRegistrationsRepository.adminDelete(accessToken, registrationId)
}

async function markPaid(eventId, userId, accessToken) {
  return eventRegistrationsRepository.markPaid(accessToken, eventId, userId)
}

module.exports = {
  register,
  getMine,
  unregister,
  listPublic,
  listAdmin,
  getAdminById,
  adminCreate,
  adminSync,
  adminUpdate,
  adminRemove,
  markPaid,
}
