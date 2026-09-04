const { Router } = require('express')
const exercises = require('./exercises')
const eventCategories = require('./event-categories')
const events = require('./events')
const adminEvents = require('./admin/events')
const adminEventRegistrations = require('./admin/event-registrations')

const router = Router()

router.use('/exercises', exercises)
router.use('/event-categories', eventCategories)
router.use('/events', events)
router.use('/admin/events', adminEvents)
router.use('/admin/event-registrations', adminEventRegistrations)

module.exports = router
