const ACTIONS = Object.freeze({
  USER_INVITED: 'user_invited',
  PROFILE_UPDATED: 'profile_updated',
  ROLE_CHANGED: 'role_changed',
  EVENT_REGISTRATION_BLOCKED: 'event_registration_blocked',
  EVENT_REGISTRATION_UNBLOCKED: 'event_registration_unblocked',
  AUTH_SUSPENDED: 'auth_suspended',
  AUTH_REACTIVATED: 'auth_reactivated',
  USER_DELETED: 'user_deleted',
})

module.exports = {
  ACTIONS,
}
