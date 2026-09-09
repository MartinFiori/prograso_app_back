const { Router } = require('express')
const eventsController = require('../../controllers/events.controller')
const eventRegistrationsController = require('../../controllers/event-registrations.controller')
const authenticate = require('../../middleware/authenticate')
const requireAdmin = require('../../middleware/require-admin')
const loadProfile = require('../../middleware/load-profile')
const validate = require('../../middleware/validate')
const {
  idParamSchema,
  listEventsQuerySchema,
  createEventSchema,
  updateEventSchema,
} = require('../../validations/events.schema')
const {
  eventIdParamSchema,
  listPublicRegistrationsQuerySchema,
  registerForEventSchema,
} = require('../../validations/event-registrations.schema')

const router = Router()

router.get('/', validate(listEventsQuerySchema), eventsController.list)
router.post(
  '/:eventId/registrations',
  authenticate,
  loadProfile,
  validate(registerForEventSchema),
  eventRegistrationsController.register,
)
router.get(
  '/:eventId/registrations/me',
  authenticate,
  loadProfile,
  validate(eventIdParamSchema),
  eventRegistrationsController.getMine,
)
router.delete(
  '/:eventId/registrations/me',
  authenticate,
  loadProfile,
  validate(eventIdParamSchema),
  eventRegistrationsController.unregister,
)
router.get(
  '/:eventId/registrations',
  validate(listPublicRegistrationsQuerySchema),
  eventRegistrationsController.listPublic,
)
router.get('/:id', validate(idParamSchema), eventsController.getById)
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createEventSchema),
  eventsController.create,
)
router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateEventSchema),
  eventsController.update,
)
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  validate(idParamSchema),
  eventsController.remove,
)

module.exports = router
