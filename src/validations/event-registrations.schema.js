const { z } = require('zod')
const { PATCHABLE_STATUS_CODES } = require('../constants/registration-statuses')

const eventIdParam = z
  .string()
  .regex(/^\d+$/, 'eventId must be a positive integer')
  .transform((value) => Number(value))
  .refine(
    (value) => Number.isInteger(value) && value > 0,
    'eventId must be a positive integer',
  )

const registrationIdParam = z
  .string()
  .regex(/^\d+$/, 'registrationId must be a positive integer')
  .transform((value) => Number(value))
  .refine(
    (value) => Number.isInteger(value) && value > 0,
    'registrationId must be a positive integer',
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

const eventIdParamSchema = z.object({
  params: z.object({
    eventId: eventIdParam,
  }),
})

const listPublicRegistrationsQuerySchema = z.object({
  params: z.object({
    eventId: eventIdParam,
  }),
  query: z
    .object({
      page: numericQuery(1, { min: 1 }),
      limit: numericQuery(20, { min: 1, max: 100 }),
    })
    .strict(),
})

const registerForEventSchema = z.object({
  params: z.object({
    eventId: eventIdParam,
  }),
  body: z.object({}).strict(),
})

const listAdminRegistrationsQuerySchema = z.object({
  params: z.object({
    eventId: eventIdParam,
  }),
  query: z
    .object({
      status_code: z.string().min(1).optional(),
      search: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.string().trim().min(1).optional(),
      ),
      page: numericQuery(1, { min: 1 }),
      limit: numericQuery(20, { min: 1, max: 100 }),
    })
    .strict(),
})

const adminCreateRegistrationSchema = z.object({
  params: z.object({
    eventId: eventIdParam,
  }),
  body: z
    .object({
      user_id: z.string().uuid(),
    })
    .strict(),
})

const adminSyncRegistrationsSchema = z.object({
  params: z.object({
    eventId: eventIdParam,
  }),
  body: z
    .object({
      user_ids: z.array(z.string().uuid()).max(500),
    })
    .strict(),
})

const registrationIdParamSchema = z.object({
  params: z.object({
    registrationId: registrationIdParam,
  }),
})

const adminUpdateRegistrationSchema = z.object({
  params: z.object({
    registrationId: registrationIdParam,
  }),
  body: z
    .object({
      status_code: z.enum(PATCHABLE_STATUS_CODES).optional(),
      waitlist_position: z
        .union([
          z.number({ error: 'must be a positive integer' }).int().positive(),
          z.null(),
        ])
        .optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Request body must not be empty',
    }),
})

const markRegistrationPaidSchema = z.object({
  params: z.object({
    eventId: eventIdParam,
    userId: z.string().uuid(),
  }),
  body: z.object({}).strict(),
})

module.exports = {
  eventIdParamSchema,
  listPublicRegistrationsQuerySchema,
  registerForEventSchema,
  listAdminRegistrationsQuerySchema,
  adminCreateRegistrationSchema,
  adminSyncRegistrationsSchema,
  registrationIdParamSchema,
  adminUpdateRegistrationSchema,
  markRegistrationPaidSchema,
}
