const eventStatusesRepository = require('../repositories/event-statuses.repository')

function toCatalogItem(row) {
  return {
    code: row.code,
    label: row.label,
    description: row.description,
  }
}

async function list() {
  const rows = await eventStatusesRepository.list()
  return rows.map(toCatalogItem)
}

module.exports = {
  list,
}
