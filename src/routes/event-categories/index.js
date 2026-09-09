const { Router } = require('express')
const eventCategoriesController = require('../../controllers/event-categories.controller')
const authenticate = require('../../middleware/authenticate')
const requireAdmin = require('../../middleware/require-admin')
const uploadImage = require('../../middleware/upload-image')
const validate = require('../../middleware/validate')
const {
  idParamSchema,
  createEventCategorySchema,
  updateEventCategorySchema,
  updateEventCategoryWithFileSchema,
} = require('../../validations/event-categories.schema')

function validateCategoryUpdate(req, res, next) {
  const schema = req.file ? updateEventCategoryWithFileSchema : updateEventCategorySchema
  return validate(schema)(req, res, next)
}

const router = Router()

router.get('/', eventCategoriesController.list)
router.get('/:id', validate(idParamSchema), eventCategoriesController.getById)
router.post(
  '/',
  authenticate,
  requireAdmin,
  uploadImage,
  validate(createEventCategorySchema),
  eventCategoriesController.create,
)
router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  uploadImage,
  validateCategoryUpdate,
  eventCategoriesController.update,
)
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  validate(idParamSchema),
  eventCategoriesController.remove,
)

module.exports = router
