jest.mock('../supabase', () => ({
  auth: {
    getUser: jest.fn(),
  },
}))

jest.mock('../supabase/admin', () => ({
  from: jest.fn(),
}))

const request = require('supertest')
const app = require('../app')
const supabase = require('../supabase')
const supabaseAdmin = require('../supabase/admin')
const { createQueryBuilder } = require('./helpers/mock-query-builder')
const errorCodes = require('../constants/error-codes')
const httpStatusCodes = require('../constants/http-status-codes')

const eventStatuses = [
  {
    code: 'draft',
    label: 'Borrador',
    description: 'El evento todavía no fue publicado.',
  },
  {
    code: 'cancelled',
    label: 'Cancelado',
    description: 'El evento fue cancelado.',
  },
  {
    code: 'completed',
    label: 'Finalizado',
    description: 'El evento ya se realizó.',
  },
  {
    code: 'open',
    label: 'Inscripciones abiertas',
    description: 'El evento permite nuevas inscripciones.',
  },
  {
    code: 'closed',
    label: 'Inscripciones cerradas',
    description: 'El evento ya no permite inscripciones.',
  },
]

describe('event-statuses', () => {
  let statusesBuilder

  beforeEach(() => {
    statusesBuilder = createQueryBuilder({
      data: eventStatuses,
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
      expect(response.body.data).toEqual(eventStatuses)
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(supabaseAdmin.from).toHaveBeenCalledWith('event_statuses')
      expect(statusesBuilder.select).toHaveBeenCalledWith('code, label, description')
      expect(statusesBuilder.order).toHaveBeenCalledWith('label', { ascending: true })
      expect(statusesBuilder.eq).not.toHaveBeenCalled()
    })

    it('returns only code, label and description on each item', async () => {
      const response = await request(app).get('/event-statuses')

      expect(response.status).toBe(httpStatusCodes.OK)
      expect(response.body.data).toHaveLength(eventStatuses.length)
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

    it('maps a Supabase error to the centralized unexpected error', async () => {
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
        description: 'An unexpected error occurred',
        errorCode: errorCodes.UNEXPECTED_ERROR,
        data: null,
      })
      expect(JSON.stringify(response.body)).not.toContain('password=secret')
      expect(JSON.stringify(response.body)).not.toContain('column event_statuses.name does not exist')
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
