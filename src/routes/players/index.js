const { Router } = require('express')
const authenticate = require('../../middleware/authenticate')
const validate = require('../../middleware/validate')
const playersController = require('../../controllers/players.controller')
const { searchPlayersSchema } = require('../../validations/players.schema')

const router = Router()

router.get('/', authenticate, validate(searchPlayersSchema), playersController.search)

module.exports = router
