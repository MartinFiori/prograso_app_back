const { z } = require('zod')

const searchPlayersSchema = z.object({
  query: z
    .object({
      q: z.string().trim().min(2).max(60),
    })
    .strict(),
})

module.exports = { searchPlayersSchema }
