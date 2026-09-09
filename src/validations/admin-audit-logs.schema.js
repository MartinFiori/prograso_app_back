const { z } = require('zod')
const { ACTIONS } = require('../constants/admin-user-audit-actions')

const ACTION_VALUES = Object.values(ACTIONS)

function numericQuery(defaultValue, { min, max } = {}) {
  let schema = z.number().int().min(min)

  if (max !== undefined) {
    schema = schema.max(max)
  }

  return z.preprocess((value) => {
    if (value === undefined || value === '') {
      return defaultValue
    }

    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
      return Number(value)
    }

    return value
  }, schema)
}

const listAdminAuditLogsQuerySchema = z.object({
  query: z
    .object({
      page: numericQuery(1, { min: 1 }),
      limit: numericQuery(20, { min: 1, max: 100 }),
      target_user_id: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.string().uuid().optional(),
      ),
      action: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.enum(ACTION_VALUES).optional(),
      ),
    })
    .strict(),
})

module.exports = {
  listAdminAuditLogsQuerySchema,
}
