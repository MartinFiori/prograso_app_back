const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
require('dotenv').config()

const routes = require('./routes/index.js')
const errorHandler = require('./middleware/error-handler')

const app = express()

app.use(cors())
app.use(express.json())

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

app.use('/', routes)

app.get('/health', (req, res) => res.status(200).json({ success: true, msg: 'hola mundo' }))

app.use(errorHandler)

module.exports = app
