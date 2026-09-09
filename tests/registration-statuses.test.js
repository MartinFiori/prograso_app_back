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
const httpStatusCodes = require('../src/constants/http-status-codes')

const sqlRows = [
  {
    code: 'confirmed',
    name: 'Confirmada',
    description: 'El usuario tiene un lugar confirmado.',
  },
  {
    code: 'waitlisted',
    name: 'En espera',
    description: 'El usuario está en lista de espera.',
  },
]

describe('GET /registration-statuses', () => {
  let statusesBuilder

  beforeEach(() => {
    statusesBuilder = createQueryBuilder({
      data: [],
      error: null,
    })

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'registration_statuses') {
        return statusesBuilder
      }

      throw new Error(`unexpected table ${table}`)
    })
  })

  it('returns 200 for an anonymous caller and data [] when empty', async () => {
    const response = await request(app).get('/registration-statuses')

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.status).toBe('success')
    expect(response.body.data).toEqual([])
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })

  it('maps SQL {code,name,description} to {code,label,description} with label = name', async () => {
    statusesBuilder.resolved = { data: sqlRows, error: null }

    const response = await request(app).get('/registration-statuses')

    expect(response.status).toBe(httpStatusCodes.OK)
    expect(response.body.data).toEqual([
      {
        code: 'confirmed',
        label: 'Confirmada',
        description: 'El usuario tiene un lugar confirmado.',
      },
      {
        code: 'waitlisted',
        label: 'En espera',
        description: 'El usuario está en lista de espera.',
      },
    ])
    expect(response.body.data.every((item) => !Object.hasOwn(item, 'name'))).toBe(true)
  })

  it('selects code, name, description (not label) and orders by name ASC', async () => {
    statusesBuilder.resolved = { data: sqlRows, error: null }

    await request(app).get('/registration-statuses')

    expect(statusesBuilder.select).toHaveBeenCalledWith('code, name, description')
    expect(String(statusesBuilder.selectArgs[0])).not.toMatch(/\blabel\b/)
    expect(statusesBuilder.order).toHaveBeenCalledWith('name', { ascending: true })
    expect(supabaseAdmin.from).toHaveBeenCalledWith('registration_statuses')
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })
})
