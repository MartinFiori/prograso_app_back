const { Router } = require('express')
const adminUsersController = require('../../../controllers/admin-users.controller')
const authenticate = require('../../../middleware/authenticate')
const requireAdmin = require('../../../middleware/require-admin')
const validate = require('../../../middleware/validate')
const {
  userIdParamSchema,
  listAdminUsersQuerySchema,
  inviteUserSchema,
  updateAdminUserSchema,
  updateUserRoleSchema,
  putEventRegistrationBlockSchema,
  putAuthSuspensionSchema,
} = require('../../../validations/admin-users.schema')

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/', validate(listAdminUsersQuerySchema), adminUsersController.list)
router.post('/invitations', validate(inviteUserSchema), adminUsersController.invite)
router.get('/:userId', validate(userIdParamSchema), adminUsersController.getById)
router.patch('/:userId', validate(updateAdminUserSchema), adminUsersController.update)
router.patch(
  '/:userId/role',
  validate(updateUserRoleSchema),
  adminUsersController.updateRole,
)
router.put(
  '/:userId/event-registration-block',
  validate(putEventRegistrationBlockSchema),
  adminUsersController.blockEventRegistration,
)
router.delete(
  '/:userId/event-registration-block',
  validate(userIdParamSchema),
  adminUsersController.unblockEventRegistration,
)
router.put(
  '/:userId/auth-suspension',
  validate(putAuthSuspensionSchema),
  adminUsersController.suspendAuth,
)
router.delete(
  '/:userId/auth-suspension',
  validate(userIdParamSchema),
  adminUsersController.unsuspendAuth,
)
router.delete('/:userId', validate(userIdParamSchema), adminUsersController.remove)

module.exports = router
