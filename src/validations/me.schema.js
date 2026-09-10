const { z } = require('zod')
const {
  PROFILE_CATEGORIES,
  PROFILE_GENDERS,
} = require('../constants/profile-enums')

function emptyToNull(value) {
  if (value === undefined) {
    return undefined
  }

  if (value === null || value === '') {
    return null
  }

  return value
}

const nullableCategory = z.preprocess(
  emptyToNull,
  z.union([z.enum(PROFILE_CATEGORIES), z.null()]).optional(),
)

const nullableGender = z.preprocess(
  emptyToNull,
  z.union([z.enum(PROFILE_GENDERS), z.null()]).optional(),
)

const nullableAvatarUrl = z.preprocess(
  emptyToNull,
  z.union([z.string().trim().url(), z.null()]).optional(),
)

const nullablePhoneNumber = z.preprocess((value) => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null
  }

  return typeof value === 'string' ? value.trim() : value
}, z.union([
  z.null(),
  z
    .string()
    .max(20)
    .regex(/^\+?[0-9][0-9 ]{0,18}$/),
]).optional())

const updateMeFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    avatar_url: nullableAvatarUrl,
    category: nullableCategory,
    gender: nullableGender,
    phone_number: nullablePhoneNumber,
  })
  .strict()

const updateMeSchema = z.object({
  body: updateMeFieldsSchema.refine((body) => Object.keys(body).length > 0, {
    message: 'Request body must not be empty',
  }),
})

const updateMeWithFileSchema = z.object({
  body: updateMeFieldsSchema,
})

module.exports = {
  updateMeSchema,
  updateMeWithFileSchema,
}
