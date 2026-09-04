const { z } = require('zod')

const idParam = z
  .string()
  .regex(/^\d+$/, 'id must be a positive integer')
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, 'id must be a positive integer')

const imageUrlSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return value
}, z.union([z.string().url('image_url must be a valid URL'), z.null()]).optional())

const idParamSchema = z.object({
  params: z.object({
    id: idParam,
  }),
})

const createEventCategorySchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'name is required'),
      description: z.union([z.string(), z.null()]).optional(),
      image_url: imageUrlSchema,
    })
    .strict(),
})

const updateEventCategorySchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z
    .object({
      name: z.string().trim().min(1, 'name is required').optional(),
      description: z.union([z.string(), z.null()]).optional(),
      image_url: imageUrlSchema,
      is_active: z.boolean().optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Request body must not be empty',
    }),
})

module.exports = {
  idParamSchema,
  createEventCategorySchema,
  updateEventCategorySchema,
}
