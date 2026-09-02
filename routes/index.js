const { Router } = require('express')
const exercises = require('./exercises')
const router = Router();

router.use('/exercises', exercises)

module.exports = router