const { Router } = require('express')
const meController = require('../../controllers/me.controller')
const authenticate = require('../../middleware/authenticate')

const router = Router()

router.get('/', authenticate, meController.getMe)

module.exports = router
