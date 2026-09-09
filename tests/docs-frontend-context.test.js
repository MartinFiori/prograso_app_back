const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')

const DOC_PATHS = {
  frontendContext: path.join(ROOT, 'docs', 'frontend-context.md'),
  events: path.join(ROOT, 'docs', 'api', 'events.md'),
  eventCategories: path.join(ROOT, 'docs', 'api', 'event-categories.md'),
  apiIndex: path.join(ROOT, 'docs', 'api', 'README.md'),
  project: path.join(ROOT, 'sdd', 'PROJECT.md'),
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function seedAdminEmail() {
  const sql = read(path.join(ROOT, 'schemas', 'user_to_admin.sql'))
  const match = sql.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (!match) {
    throw new Error('Could not parse email from schemas/user_to_admin.sql')
  }
  return match[0]
}

describe('docs frontend context', () => {
  const files = {}

  beforeAll(() => {
    for (const [key, filePath] of Object.entries(DOC_PATHS)) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing documentation file (${key}): ${filePath}`)
      }
      files[key] = read(filePath)
    }
  })

  it('exists for the four new markdown files and PROJECT.md', () => {
    for (const filePath of Object.values(DOC_PATHS)) {
      expect(fs.existsSync(filePath)).toBe(true)
    }
  })

  it('mentions mounted catalog routes in the endpoint map', () => {
    const map = files.frontendContext
    expect(map).toContain('/health')
    expect(map).toContain('/exercises')
    expect(map).toContain('/events')
    expect(map).toContain('/event-categories')
    expect(map).toContain('/event-statuses')
  })

  it('indexes existing registration and status contracts', () => {
    expect(files.apiIndex).toContain('event-registrations.md')
    expect(files.apiIndex).toContain('event-statuses.md')
  })

  it('PROJECT.md is no longer pending inspection', () => {
    expect(files.project).not.toContain('PENDIENTE DE INSPECCIÓN')
  })

  it('new docs and PROJECT.md do not contain JWT-like eyJ or the admin seed email', () => {
    const email = seedAdminEmail()
    for (const content of Object.values(files)) {
      expect(content).not.toContain('eyJ')
      expect(content).not.toContain(email)
    }
  })
})
