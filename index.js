const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const routes = require('./routes/index.js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY)

async function getData() {

  const { data, error } = await supabase.auth.signUp({
    email: "zvg74041@laoia.com",
    password: 'Vaslola123!'
  })

  console.log("getdDataerror", error)
  console.log("getdData", data)
}

// supabase.auth.onAuthStateChange((event, session) => {
//   console.log(event, session)
// })

async function getExercises() {

  let { data: exercises, error } = await supabase.from('exercises').select(`title, created_at`)
  console.log("esersisses", exercises)
}

// getExercises()
// getData()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
app.use('/', routes)

app.get('/health', (req, res) => res.status(200).json({ success: true, msg: 'hola mundo' }))

app.listen(PORT, () => {
  console.log("");
  console.log("-".repeat(100));
  console.log(`Server running on "http://localhost:${PORT}"`);
  console.log("-".repeat(100));
  console.log("Último cambio: " + new Date().toString().slice(16, 24) + "hs");
  console.log("");
})