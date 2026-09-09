const auditLogsRepository = require('../repositories/admin-user-audit-logs.repository')

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
  }
}

async function list(query) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const result = await auditLogsRepository.list({
    filters: {
      target_user_id: query.target_user_id,
      action: query.action,
    },
    pagination: { page, limit },
  })

  return {
    data: result.data,
    pagination: buildPagination(page, limit, result.total),
  }
}

module.exports = {
  list,
}
