const { Router } = require('express')
const adminAuditLogsController = require('../../../controllers/admin-audit-logs.controller')
const authenticate = require('../../../middleware/authenticate')
const requireAdmin = require('../../../middleware/require-admin')
const validate = require('../../../middleware/validate')
const { listAdminAuditLogsQuerySchema } = require('../../../validations/admin-audit-logs.schema')

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/', validate(listAdminAuditLogsQuerySchema), adminAuditLogsController.list)

module.exports = router
