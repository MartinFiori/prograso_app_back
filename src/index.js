require('dotenv').config()
const app = require('./app')

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log('')
  console.log('-'.repeat(100))
  console.log(`Server running on "http://localhost:${PORT}"`)
  console.log('-'.repeat(100))
  console.log('Último cambio: ' + new Date().toString().slice(16, 24) + 'hs')
  console.log('')
})
