const registrationStatusesRepository = require('../repositories/registration-statuses.repository')

function toCatalogItem(row) {
  return {
    code: row.code,
    label: row.name,
    description: row.description,
  }
}

async function list() {
  const rows = await registrationStatusesRepository.list()
  return rows.map(toCatalogItem)
}

module.exports = {
  list,
}
