const profilesRepository = require('../repositories/profiles.repository')

async function search(query, currentUserId) {
  return profilesRepository.searchPlayers(query.q, currentUserId)
}

module.exports = { search }
