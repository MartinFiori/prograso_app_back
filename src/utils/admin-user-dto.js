function isBlockActive(profile) {
  if (!profile?.event_registration_blocked) {
    return false
  }

  if (!profile.event_registration_blocked_until) {
    return true
  }

  return Date.parse(profile.event_registration_blocked_until) > Date.now()
}

function isAuthSuspended(authUser) {
  if (!authUser?.banned_until) {
    return false
  }

  return Date.parse(authUser.banned_until) > Date.now()
}

function toEventRegistrationAccess(profile, { includeReason = false } = {}) {
  const access = {
    blocked: isBlockActive(profile),
    blocked_at: profile?.event_registration_blocked_at ?? null,
    blocked_until: profile?.event_registration_blocked_until ?? null,
  }

  if (includeReason) {
    access.reason = profile?.event_registration_block_reason ?? null
    access.blocked_by = profile?.event_registration_blocked_by ?? null
  }

  return access
}

function toAdminUserDto(profile, authUser, { includeReason = false } = {}) {
  return {
    id: profile.id,
    email: authUser?.email ?? null,
    name: profile.name,
    avatar_url: profile.avatar_url ?? null,
    role: profile.role,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    last_sign_in_at: authUser?.last_sign_in_at ?? null,
    email_confirmed_at: authUser?.email_confirmed_at ?? null,
    auth_suspended: isAuthSuspended(authUser),
    banned_until: authUser?.banned_until ?? null,
    event_registration_access: toEventRegistrationAccess(profile, { includeReason }),
  }
}

module.exports = {
  isBlockActive,
  isAuthSuspended,
  toAdminUserDto,
}
