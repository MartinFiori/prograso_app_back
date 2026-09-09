const eventStatusesRepository = require('../repositories/event-statuses.repository')

async function list() {
  return eventStatusesRepository.list()
}

module.exports = {
  list,
}
