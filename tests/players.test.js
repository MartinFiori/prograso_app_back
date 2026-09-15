jest.mock('../src/supabase', () => ({ auth: { getUser: jest.fn() } }))
jest.mock('../src/supabase/admin', () => ({ from: jest.fn() }))

const request = require('supertest')
const app = require('../src/app')
const supabase = require('../src/supabase')
const supabaseAdmin = require('../src/supabase/admin')
const { createQueryBuilder } = require('./helpers/mock-query-builder')

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'user-token'

describe('GET /players', () => {
  beforeEach(() => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('searches registered profiles by name and excludes the caller', async () => {
    const rows = [{ id: '22222222-2222-4222-8222-222222222222', name: 'Ana', avatar_url: null }]
    const builder = createQueryBuilder({ data: rows, error: null })
    supabaseAdmin.from.mockReturnValue(builder)

    const response = await request(app)
      .get('/players?q=Ana')
      .set({ Authorization: `Bearer ${TOKEN}` })

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(rows)
    expect(builder.ilike).toHaveBeenCalledWith('name', '%Ana%')
    expect(builder.neq).toHaveBeenCalledWith('id', USER_ID)
    expect(builder.limit).toHaveBeenCalledWith(10)
  })

  it('requires authentication and at least two characters', async () => {
    const unauthenticated = await request(app).get('/players?q=Ana')
    expect(unauthenticated.status).toBe(401)

    const invalid = await request(app)
      .get('/players?q=A')
      .set({ Authorization: `Bearer ${TOKEN}` })
    expect(invalid.status).toBe(400)
  })
})
