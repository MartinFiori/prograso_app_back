const { Router } = require('express')
const eventCategoriesController = require('../../controllers/event-categories.controller')
const authenticate = require('../../middleware/authenticate')
const requireAdmin = require('../../middleware/require-admin')
const validate = require('../../middleware/validate')
const {
  idParamSchema,
  createEventCategorySchema,
  updateEventCategorySchema,
} = require('../../validations/event-categories.schema')

const router = Router()

router.get('/', eventCategoriesController.list)
router.get('/:id', validate(idParamSchema), eventCategoriesController.getById)
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createEventCategorySchema),
  eventCategoriesController.create,
)
router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateEventCategorySchema),
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
