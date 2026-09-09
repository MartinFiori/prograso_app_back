const { Router } = require('express')
const registrationStatusesController = require('../../controllers/registration-statuses.controller')

const router = Router()

router.get('/', registrationStatusesController.list)

module.exports = router
