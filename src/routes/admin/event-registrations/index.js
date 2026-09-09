const { Router } = require('express')
const eventRegistrationsController = require('../../../controllers/event-registrations.controller')
const authenticate = require('../../../middleware/authenticate')
const requireAdmin = require('../../../middleware/require-admin')
const validate = require('../../../middleware/validate')
const {
  registrationIdParamSchema,
  adminUpdateRegistrationSchema,
} = require('../../../validations/event-registrations.schema')

const router = Router()

router.use(authenticate, requireAdmin)
router.get(
  '/:registrationId',
  validate(registrationIdParamSchema),
  eventRegistrationsController.getAdminById,
)
router.patch(
  '/:registrationId',
  validate(adminUpdateRegistrationSchema),
  eventRegistrationsController.adminUpdate,
)
router.delete(
  '/:registrationId',
  validate(registrationIdParamSchema),
  eventRegistrationsController.adminRemove,
)

module.exports = router
