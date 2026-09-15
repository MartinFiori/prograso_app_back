const { z } = require('zod')
const { OPEN_STATUS_CODE } = require('../constants/event-statuses')

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

const isoDateTime = z
  .string()
  .refine(
    (value) => ISO_DATETIME_RE.test(value) && Number.isFinite(Date.parse(value)),
    'must be a valid ISO datetime',
  )

const idParam = z
  .string()
  .regex(/^\d+$/, 'id must be a positive integer')
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, 'id must be a positive integer')

const positiveInt = z.number({ error: 'must be a positive integer' }).int().positive()

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

const idParamSchema = z.object({
  params: z.object({
    id: idParam,
  }),
})

function listEventsQuery(statusCodeSchema) {
  const shape = {
    category_id: idParam.optional(),
    starts_from: isoDateTime.optional(),
    starts_to: isoDateTime.optional(),
    page: numericQuery(1, { min: 1 }),
    limit: numericQuery(20, { min: 1, max: 100 }),
  }

  if (statusCodeSchema) {
    shape.status_code = statusCodeSchema.optional()
  }

  return z.object({
    query: z
      .object(shape)
      .strict()
      .refine(
        (query) =>
          !query.starts_from ||
          !query.starts_to ||
          Date.parse(query.starts_from) <= Date.parse(query.starts_to),
        {
          message: 'starts_from must be before or equal to starts_to',
          path: ['starts_from'],
        },
      ),
  })
}

const listPublicEventsQuerySchema = listEventsQuery(z.literal(OPEN_STATUS_CODE))
const listEventsQuerySchema = listEventsQuery(z.string().min(1))

const createEventSchema = z.object({
  body: z
    .object({
      category_id: positiveInt,
      title: z.string().trim().min(1, 'title is required'),
      starts_at: isoDateTime,
      end_at: isoDateTime,
      capacity: positiveInt,
      price: positiveInt,
      status_code: z.string().min(1).optional(),
    })
    .strict(),
})

const updateEventSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z
    .object({
      category_id: positiveInt.optional(),
      title: z.string().trim().min(1, 'title is required').optional(),
      starts_at: isoDateTime.optional(),
      end_at: isoDateTime.optional(),
      capacity: positiveInt.optional(),
      price: positiveInt.optional(),
      status_code: z.string().min(1).optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Request body must not be empty',
    }),
})

module.exports = {
  idParamSchema,
  listPublicEventsQuerySchema,
  listEventsQuerySchema,
  createEventSchema,
  updateEventSchema,
}
