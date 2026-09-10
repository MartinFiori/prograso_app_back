jest.mock('../src/supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../src/supabase/admin', () => ({
  from: jest.fn(),
}))

const request = require('supertest')
const app = require('../src/app')
const supabase = require('../src/supabase')
const supabaseAdmin = require('../src/supabase/admin')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../src/constants/error-codes')
const httpStatusCodes = require('../src/constants/http-status-codes')

const eventStatusesSql = [
  {
    code: 'draft',
    name: 'Borrador',
    description: 'El evento todavía no fue publicado.',
  },
  {
    code: 'cancelled',
    name: 'Cancelado',
    description: 'El evento fue cancelado.',
  },
  {
    code: 'completed',
    name: 'Finalizado',
    description: 'El evento ya se realizó.',
  },
  {
    code: 'open',
    name: 'Inscripciones abiertas',
    description: 'El evento permite nuevas inscripciones.',
  },
  {
    code: 'closed',
    name: 'Inscripciones cerradas',
    description: 'El evento ya no permite inscripciones.',
  },
]

const eventStatusesHttp = eventStatusesSql.map((row) => ({
  code: row.code,
  label: row.name,
  description: row.description,
}))

describe('event-statuses', () => {
  let statusesBuilder

  beforeEach(() => {
    statusesBuilder = createQueryBuilder({
      data: eventStatusesSql,
      error: null,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'event_statuses') {
        return statusesBuilder
      }

      return createQueryBuilder({ data: null, error: null })
    })
  })

  describe('GET /event-statuses', () => {
    it('allows unauthenticated users to list event statuses', async () => {
      const response = await request(app).get('/event-statuses')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.status).toBe('success')
      expect(response.body.statusCode).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual(eventStatusesHttp)
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(supabaseAdmin.from).toHaveBeenCalledWith('event_statuses')
      expect(statusesBuilder.select).toHaveBeenCalledWith('code, name, description')
      expect(statusesBuilder.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(statusesBuilder.eq).not.toHaveBeenCalled()
    })

    it('returns only code, label and description on each item', async () => {
      const response = await request(app).get('/event-statuses')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toHaveLength(eventStatusesHttp.length)
      response.body.data.forEach((status) => {
        expect(Object.keys(status).sort()).toEqual(['code', 'description', 'label'])
      })
    })

    it('returns 200 with an empty collection when there are no statuses', async () => {
      statusesBuilder.resolved = { data: [], error: null }

      const response = await request(app).get('/event-statuses')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toEqual([])
    })

    it('returns 200 with an empty collection when Supabase data is null', async () => {
      statusesBuilder.resolved = { data: null, error: null }

      const response = await request(app).get('/event-statuses')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toEqual([])
    })

    it('maps a Supabase error to DB_UNKNOWN_ERROR with postgrest payload', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
      statusesBuilder.resolved = {
        data: null,
        error: {
          code: 'PGRST204',
          message: 'column event_statuses.name does not exist',
          details: 'host=db.internal port=5432 password=secret',
        },
      }

      const response = await request(app).get('/event-statuses')

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER)
      expect(response.body).toEqual({
        status: 'error',
        statusCode: httpStatusCodes.INTERNAL_SERVER,
        description: 'column event_statuses.name does not exist',
        errorCode: errorCodes.DB_UNKNOWN_ERROR,
        data: {
          code: 'PGRST204',
          message: 'column event_statuses.name does not exist',
          details: 'host=db.internal port=5432 password=secret',
          hint: null,
        },
      })
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'event_statuses',
          code: 'PGRST204',
          message: 'column event_statuses.name does not exist',
        }),
      )
      consoleError.mockRestore()
    })
  })
})
