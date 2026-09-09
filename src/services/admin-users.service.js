const profilesRepository = require('../repositories/profiles.repository')
const authAdminRepository = require('../repositories/auth-admin.repository')
const auditLogsRepository = require('../repositories/admin-user-audit-logs.repository')
const buildApiError = require('../utils/buildApiError')
const httpStatusCodes = require('../constants/http-status-codes')
const errorCodes = require('../constants/error-codes')
const { ACTIONS } = require('../constants/admin-user-audit-actions')
const {
  isBlockActive,
  isAuthSuspended,
  toAdminUserDto,
} = require('../utils/admin-user-dto')

function userNotFoundError() {
  return buildApiError({
    statusCode: httpStatusCodes.NOT_FOUND,
    description: 'User not found',
    errorCode: errorCodes.USER_NOT_FOUND,
  })
}

function selfActionError() {
  return buildApiError({
    statusCode: httpStatusCodes.FORBIDDEN,
    description: 'Administrators cannot perform this action on themselves',
    errorCode: errorCodes.SELF_ADMIN_ACTION_FORBIDDEN,
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

async function hydrate(profile, { includeReason = false } = {}) {
  const authUser = await authAdminRepository.getUserById(profile.id)
  return toAdminUserDto(profile, authUser, { includeReason })
}

async function writeAudit({ actorId, targetId, action, reason, previousValues, newValues }) {
  await auditLogsRepository.insert({
    actor_user_id: actorId,
    target_user_id: targetId,
    action,
    reason: reason ?? null,
    previous_values: previousValues ?? null,
    new_values: newValues ?? null,
  })
}

async function requireFullProfile(userId) {
  const profile = await profilesRepository.findFullById(userId)

  if (!profile) {
    throw userNotFoundError()
  }

  return profile
}

async function list(query) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const filters = {
    role: query.role,
    event_registration_blocked: query.event_registration_blocked,
  }

  if (query.q && query.q.includes('@')) {
    const authUsers = await authAdminRepository.listUsers({ page: 1, perPage: 200 })
    const needle = query.q.toLowerCase()
    const ids = authUsers
      .filter((user) => (user.email ?? '').toLowerCase().includes(needle))
      .map((user) => user.id)

    if (ids.length === 0) {
      return { data: [], pagination: buildPagination(page, limit, 0) }
    }

    filters.ids = ids
  } else if (query.q) {
    filters.q = query.q
  }

  const result = await profilesRepository.list({
    filters,
    pagination: { page, limit },
    sort: query.sort,
  })
  let data = await Promise.all(
    result.data.map((profile) => hydrate(profile, { includeReason: false })),
  )

  if (query.auth_suspended === true) {
    data = data.filter((user) => user.auth_suspended)
  } else if (query.auth_suspended === false) {
    data = data.filter((user) => !user.auth_suspended)
  }
  return {
    data,
    pagination: buildPagination(page, limit, result.total),
  }
}

async function getById(userId) {
  const profile = await requireFullProfile(userId)
  return hydrate(profile, { includeReason: true })
}

async function invite(body, actorId) {
  const authUser = await authAdminRepository.inviteUserByEmail(body.email, {
    data: {
      name: body.name,
      full_name: body.name,
    },
  })

  let profile = await profilesRepository.findFullById(authUser.id)

  if (!profile) {
    try {
      profile = await profilesRepository.insert({
        id: authUser.id,
        name: body.name,
        role: 'user',
      })
    } catch (error) {
      await authAdminRepository.deleteUser(authUser.id)
      throw error
    }
  }

  if (body.role === 'admin' && profile.role !== 'admin') {
    profile = await profilesRepository.updateById(authUser.id, { role: 'admin' })
  }

  await writeAudit({
    actorId,
    targetId: authUser.id,
    action: ACTIONS.USER_INVITED,
    previousValues: null,
    newValues: { email: body.email, name: body.name, role: profile.role },
  })

  return hydrate(profile, { includeReason: true })
}

async function updateProfile(userId, patch, actorId) {
  const previous = await requireFullProfile(userId)
  const updated = await profilesRepository.updateById(userId, patch)

  await writeAudit({
    actorId,
    targetId: userId,
    action: ACTIONS.PROFILE_UPDATED,
    previousValues: { name: previous.name, avatar_url: previous.avatar_url },
    newValues: { name: updated.name, avatar_url: updated.avatar_url },
  })

  return hydrate(updated, { includeReason: true })
}

async function updateRole(userId, role, actorId) {
  const previous = await requireFullProfile(userId)

  if (previous.role === role) {
    return hydrate(previous, { includeReason: true })
  }

  if (actorId === userId && role === 'user') {
    throw selfActionError()
  }

  if (previous.role === 'admin' && role === 'user') {
    await profilesRepository.guardAdminMutation(actorId, userId, 'demote')
  }

  const updated = await profilesRepository.updateById(userId, { role })

  await writeAudit({
    actorId,
    targetId: userId,
    action: ACTIONS.ROLE_CHANGED,
    previousValues: { role: previous.role },
    newValues: { role: updated.role },
  })

  return hydrate(updated, { includeReason: true })
}

function sameBlock(profile, blockedUntil) {
  if (!isBlockActive(profile)) {
    return false
  }

  const currentUntil = profile.event_registration_blocked_until ?? null
  const nextUntil = blockedUntil ?? null
  return currentUntil === nextUntil
}

async function blockEventRegistration(userId, body, actorId) {
  const previous = await requireFullProfile(userId)
  const blockedUntil = body.blocked_until ?? null

  if (sameBlock(previous, blockedUntil) && previous.event_registration_block_reason === body.reason) {
    return hydrate(previous, { includeReason: true })
  }

  const updated = await profilesRepository.updateById(userId, {
    event_registration_blocked: true,
    event_registration_blocked_at: new Date().toISOString(),
    event_registration_blocked_until: blockedUntil,
    event_registration_block_reason: body.reason,
    event_registration_blocked_by: actorId,
  })

  await writeAudit({
    actorId,
    targetId: userId,
    action: ACTIONS.EVENT_REGISTRATION_BLOCKED,
    reason: body.reason,
    previousValues: {
      event_registration_blocked: previous.event_registration_blocked,
      event_registration_blocked_until: previous.event_registration_blocked_until,
    },
    newValues: {
      event_registration_blocked: true,
      event_registration_blocked_until: blockedUntil,
    },
  })

  return hydrate(updated, { includeReason: true })
}

async function unblockEventRegistration(userId, actorId) {
  const previous = await requireFullProfile(userId)

  if (!isBlockActive(previous)) {
    return hydrate(previous, { includeReason: true })
  }

  const updated = await profilesRepository.updateById(userId, {
    event_registration_blocked: false,
    event_registration_blocked_at: null,
    event_registration_blocked_until: null,
    event_registration_block_reason: null,
    event_registration_blocked_by: null,
  })

  await writeAudit({
    actorId,
    targetId: userId,
    action: ACTIONS.EVENT_REGISTRATION_UNBLOCKED,
    previousValues: {
      event_registration_blocked: true,
      event_registration_blocked_until: previous.event_registration_blocked_until,
    },
    newValues: { event_registration_blocked: false },
  })

  return hydrate(updated, { includeReason: true })
}

async function suspendAuth(userId, body, actorId) {
  if (actorId === userId) {
    throw selfActionError()
  }

  const profile = await requireFullProfile(userId)
  const authUser = await authAdminRepository.getUserById(userId)

  if (!authUser) {
    throw userNotFoundError()
  }

  if (isAuthSuspended(authUser)) {
    return toAdminUserDto(profile, authUser, { includeReason: true })
  }

  await profilesRepository.guardAdminMutation(actorId, userId, 'suspend')
  const updatedAuthUser = await authAdminRepository.updateUserById(userId, {
    ban_duration: body.ban_duration,
  })

  await writeAudit({
    actorId,
    targetId: userId,
    action: ACTIONS.AUTH_SUSPENDED,
    reason: body.reason,
    previousValues: { banned_until: authUser.banned_until ?? null },
    newValues: { ban_duration: body.ban_duration },
  })

  return toAdminUserDto(profile, updatedAuthUser, { includeReason: true })
}

async function unsuspendAuth(userId, actorId) {
  const profile = await requireFullProfile(userId)
  const authUser = await authAdminRepository.getUserById(userId)

  if (!authUser) {
    throw userNotFoundError()
  }

  if (!isAuthSuspended(authUser)) {
    return toAdminUserDto(profile, authUser, { includeReason: true })
  }

  const updatedAuthUser = await authAdminRepository.updateUserById(userId, {
    ban_duration: 'none',
  })

  await writeAudit({
    actorId,
    targetId: userId,
    action: ACTIONS.AUTH_REACTIVATED,
    previousValues: { banned_until: authUser.banned_until },
    newValues: { banned_until: null },
  })

  return toAdminUserDto(profile, updatedAuthUser, { includeReason: true })
}

async function remove(userId, actorId) {
  if (actorId === userId) {
    throw selfActionError()
  }

  const profile = await requireFullProfile(userId)
  await profilesRepository.guardAdminMutation(actorId, userId, 'delete')

  const [eventsCreated, registrations] = await Promise.all([
    profilesRepository.countEventsCreatedBy(userId),
    profilesRepository.countRegistrationsByUser(userId),
  ])

  if (eventsCreated > 0 || registrations > 0) {
    throw buildApiError({
      statusCode: httpStatusCodes.CONFLICT,
      description: 'The user still has related records that prevent deletion',
      errorCode: errorCodes.USER_DELETE_CONFLICT,
      data: {
        events_created: eventsCreated,
        registrations,
      },
    })
  }

  await writeAudit({
    actorId,
    targetId: userId,
    action: ACTIONS.USER_DELETED,
    previousValues: { role: profile.role, name: profile.name },
    newValues: null,
  })

  await authAdminRepository.deleteUser(userId)
}

module.exports = {
  list,
  getById,
  invite,
  updateProfile,
  updateRole,
  blockEventRegistration,
  unblockEventRegistration,
  suspendAuth,
  unsuspendAuth,
  remove,
}
