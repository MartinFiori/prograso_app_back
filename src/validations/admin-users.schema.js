const { z } = require('zod')

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

const BAN_DURATION_RE = /^\d+(ns|us|ms|s|m|h)$/

const isoDateTime = z
  .string()
  .refine(
    (value) => ISO_DATETIME_RE.test(value) && Number.isFinite(Date.parse(value)),
    'must be a valid ISO datetime',
  )

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

function booleanQuery() {
  return z.preprocess((value) => {
    if (value === undefined || value === '') {
      return undefined
    }

    if (value === true || value === 'true') {
      return true
    }

    if (value === false || value === 'false') {
      return false
    }

    return value
  }, z.boolean().optional())
}

const userIdParam = z.string().uuid('userId must be a uuid')

const userIdParamSchema = z.object({
  params: z.object({
    userId: userIdParam,
  }),
})

const listAdminUsersQuerySchema = z.object({
  query: z
    .object({
      page: numericQuery(1, { min: 1 }),
      limit: numericQuery(20, { min: 1, max: 100 }),
      role: z.enum(['admin', 'user']).optional(),
      event_registration_blocked: booleanQuery(),
      auth_suspended: booleanQuery(),
      q: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.string().trim().min(1).max(200).optional(),
      ),
      sort: z
        .enum([
          'created_at.asc',
          'created_at.desc',
          'name.asc',
          'name.desc',
          'role.asc',
          'role.desc',
        ])
        .optional()
        .default('created_at.desc'),
    })
    .strict(),
})

const inviteUserSchema = z.object({
  body: z
    .object({
      email: z.string().trim().email(),
      name: z.string().trim().min(1).max(120),
      role: z.enum(['admin', 'user']).optional().default('user'),
    })
    .strict(),
})

const updateAdminUserSchema = z.object({
  params: z.object({
    userId: userIdParam,
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      avatar_url: z.union([z.string().trim().url(), z.null()]).optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'at least one field is required',
    }),
})

const updateUserRoleSchema = z.object({
  params: z.object({
    userId: userIdParam,
  }),
  body: z
    .object({
      role: z.enum(['admin', 'user']),
    })
    .strict(),
})

const putEventRegistrationBlockSchema = z.object({
  params: z.object({
    userId: userIdParam,
  }),
  body: z
    .object({
      reason: z.string().trim().min(1).max(500),
      blocked_until: z.union([isoDateTime, z.null()]).optional(),
    })
    .strict()
    .refine(
      (body) =>
        body.blocked_until == null || Date.parse(body.blocked_until) > Date.now(),
      {
        message: 'blocked_until must be a future datetime',
        path: ['blocked_until'],
      },
    ),
})

const putAuthSuspensionSchema = z.object({
  params: z.object({
    userId: userIdParam,
  }),
  body: z
    .object({
      reason: z.string().trim().min(1).max(500),
      ban_duration: z
        .string()
        .regex(BAN_DURATION_RE, 'ban_duration must look like 24h or 30m'),
    })
    .strict(),
})

module.exports = {
  userIdParamSchema,
  listAdminUsersQuerySchema,
  inviteUserSchema,
  updateAdminUserSchema,
  updateUserRoleSchema,
  putEventRegistrationBlockSchema,
  putAuthSuspensionSchema,
}
