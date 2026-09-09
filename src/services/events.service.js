const eventsRepository = require('../repositories/events.repository')
const eventCategoriesRepository = require('../repositories/event-categories.repository')
const eventStatusesRepository = require('../repositories/event-statuses.repository')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')
const {
  DEFAULT_STATUS_CODE,
  CANCELLED_STATUS_CODE,
  PUBLIC_STATUS_CODES,
} = require('../constants/event-statuses')

function eventNotFoundError() {
  return buildApiError({
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'Event not found',
    errorCode: errorCodes.EVENT_NOT_FOUND,
  })
}

function nowIso() {
  return new Date().toISOString()
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
  }
}

function emptyList(pagination) {
  return {
    data: [],
    pagination: buildPagination(pagination.page, pagination.limit, 0),
  }
}

function assertValidDates(startsAt, registrationDeadline) {
  if (registrationDeadline == null) {
    return
  }

  if (Date.parse(registrationDeadline) > Date.parse(startsAt)) {
    throw buildApiError({
      statusCode: httpStatusCodes.BAD_REQUEST,
      description: 'registration_deadline must be before or equal to starts_at',
      errorCode: errorCodes.INVALID_EVENT_DATES,
    })
  }
}

async function assertCategoryUsable(categoryId) {
  const category = await eventCategoriesRepository.findById(categoryId)

  if (!category) {
    throw buildApiError({
      statusCode: httpStatusCodes.NOT_FOUND,
      description: 'Event category not found',
      errorCode: errorCodes.EVENT_CATEGORY_NOT_FOUND,
    })
  }

  if (!category.is_active) {
    throw buildApiError({
      statusCode: httpStatusCodes.CONFLICT,
      description: 'Cannot use an inactive event category',
      errorCode: errorCodes.EVENT_CATEGORY_INACTIVE,
    })
  }

  return category
}

async function assertStatusExists(statusCode) {
  const status = await eventStatusesRepository.findByCode(statusCode)

  if (!status) {
    throw buildApiError({
      statusCode: httpStatusCodes.NOT_FOUND,
      description: 'Event status not found',
      errorCode: errorCodes.EVENT_STATUS_NOT_FOUND,
    })
  }

  return status
}

function listFiltersFromQuery(query) {
  return {
    category_id: query.category_id,
    status_code: query.status_code,
    starts_from: query.starts_from,
    starts_to: query.starts_to,
  }
}

function listPaginationFromQuery(query) {
  return {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  }
}

async function listEvents(query, { publicOnly, includePrivateFields }) {
  const filters = listFiltersFromQuery(query)
  const pagination = listPaginationFromQuery(query)

  if (publicOnly && filters.status_code && !PUBLIC_STATUS_CODES.includes(filters.status_code)) {
    return emptyList(pagination)
  }

  const result = await eventsRepository.list({
    filters,
    pagination,
    publicOnly,
    includePrivateFields,
  })

  return {
    data: result.data,
    pagination: buildPagination(pagination.page, pagination.limit, result.total),
  }
}

async function listPublic(query) {
  return listEvents(query, { publicOnly: true, includePrivateFields: false })
}

async function listAdmin(query) {
  return listEvents(query, { publicOnly: false, includePrivateFields: true })
}

async function getPublicById(id) {
  const event = await eventsRepository.findById(id, {
    includePrivateFields: false,
    publicOnly: true,
  })

  if (!event) {
    throw eventNotFoundError()
  }

  return event
}

async function getAdminById(id) {
  const event = await eventsRepository.findById(id, {
    includePrivateFields: true,
    publicOnly: false,
  })

  if (!event) {
    throw eventNotFoundError()
  }

  return event
}

async function create(payload, createdBy) {
  await assertCategoryUsable(payload.category_id)

  const statusCode = payload.status_code ?? DEFAULT_STATUS_CODE
  await assertStatusExists(statusCode)
  assertValidDates(payload.starts_at, payload.registration_deadline)

  return eventsRepository.insert({
    category_id: payload.category_id,
    title: payload.title,
    starts_at: payload.starts_at,
    registration_deadline: payload.registration_deadline ?? null,
    capacity: payload.capacity,
    status_code: statusCode,
    created_by: createdBy,
  })
}

async function update(id, payload, accessToken) {
  const existing = await eventsRepository.findById(id)

  if (!existing) {
    throw eventNotFoundError()
  }

  if (payload.category_id !== undefined && payload.category_id !== existing.category_id) {
    await assertCategoryUsable(payload.category_id)
  }

  if (payload.status_code !== undefined && payload.status_code !== existing.status_code) {
    await assertStatusExists(payload.status_code)
  }

  const nextStartsAt = payload.starts_at ?? existing.starts_at
  const nextDeadline =
    payload.registration_deadline !== undefined
      ? payload.registration_deadline
      : existing.registration_deadline

  assertValidDates(nextStartsAt, nextDeadline)

  const hasCapacity = Object.prototype.hasOwnProperty.call(payload, 'capacity')

  const updated = hasCapacity
    ? await eventsRepository.updateByIdWithCapacityRecalc(id, payload, accessToken)
    : await eventsRepository.updateById(id, {
        ...payload,
        updated_at: nowIso(),
      })

  if (!updated) {
    throw eventNotFoundError()
  }

  return updated
}

async function softDelete(id) {
  const existing = await eventsRepository.findById(id)

  if (!existing) {
    throw eventNotFoundError()
  }

  if (existing.status_code === CANCELLED_STATUS_CODE) {
    return
  }

  const updated = await eventsRepository.updateById(id, {
    status_code: CANCELLED_STATUS_CODE,
    updated_at: nowIso(),
  })

  if (!updated) {
    throw eventNotFoundError()
  }
}

module.exports = {
  listPublic,
  listAdmin,
  getPublicById,
  getAdminById,
  create,
  update,
  softDelete,
}
