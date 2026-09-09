const { z } = require('zod')

const idParam = z
  .string()
  .regex(/^\d+$/, 'id must be a positive integer')
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, 'id must be a positive integer')

const idParamSchema = z.object({
  params: z.object({
    id: idParam,
  }),
})

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined) {
    return undefined
  }

  if (value === true || value === 'true' || value === '1') {
    return true
  }

  if (value === false || value === 'false' || value === '0') {
    return false
  }

  return value
}, z.boolean().optional())

const categoryFields = {
  name: z.string().trim().min(1, 'name is required'),
  description: z.union([z.string(), z.null()]).optional(),
}

const createEventCategorySchema = z.object({
  body: z
    .object({
      name: categoryFields.name,
      description: categoryFields.description,
    })
    .strict(),
})

const updateEventCategoryFieldsSchema = z
  .object({
    name: categoryFields.name.optional(),
    description: categoryFields.description,
    is_active: optionalBoolean,
  })
  .strict()

const updateEventCategorySchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: updateEventCategoryFieldsSchema.refine((body) => Object.keys(body).length > 0, {
    message: 'Request body must not be empty',
  }),
})

const updateEventCategoryWithFileSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: updateEventCategoryFieldsSchema,
})

module.exports = {
  idParamSchema,
  createEventCategorySchema,
  updateEventCategorySchema,
  updateEventCategoryWithFileSchema,
}
