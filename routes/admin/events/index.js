const { Router } = require('express')
const eventsController = require('../../../controllers/events.controller')
const eventRegistrationsController = require('../../../controllers/event-registrations.controller')
const authenticate = require('../../../middleware/authenticate')
const requireAdmin = require('../../../middleware/require-admin')
const validate = require('../../../middleware/validate')
const { listEventsQuerySchema } = require('../../../validations/events.schema')
const {
  listAdminRegistrationsQuerySchema,
  adminCreateRegistrationSchema,
} = require('../../../validations/event-registrations.schema')

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/', validate(listEventsQuerySchema), eventsController.listAdmin)
router.get(
  '/:eventId/registrations',
  validate(listAdminRegistrationsQuerySchema),
  eventRegistrationsController.listAdmin,
)
router.post(
  '/:eventId/registrations',
  validate(adminCreateRegistrationSchema),
  eventRegistrationsController.adminCreate,
)

module.exports = router
