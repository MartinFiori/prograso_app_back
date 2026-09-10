const { Router } = require('express')
const meController = require('../../controllers/me.controller')
const authenticate = require('../../middleware/authenticate')
const uploadImage = require('../../middleware/upload-image')
const validate = require('../../middleware/validate')
const {
  updateMeSchema,
  updateMeWithFileSchema,
} = require('../../validations/me.schema')

function validateMeUpdate(req, res, next) {
  const schema = req.file ? updateMeWithFileSchema : updateMeSchema
  return validate(schema)(req, res, next)
}

const router = Router()

router.get('/', authenticate, meController.getMe)
router.patch(
  '/',
  authenticate,
  uploadImage,
  validateMeUpdate,
  meController.updateMe,
)

module.exports = router
