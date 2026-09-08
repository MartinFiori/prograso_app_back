const { Router } = require('express')
const eventStatusesController = require('../../controllers/event-statuses.controller')

const router = Router()

router.get('/', eventStatusesController.list)

module.exports = router
