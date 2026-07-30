/**
 * Integration-style tests for import-actions (with mocked DB/auth).
 * Uses the same mocking pattern as update-employee-manager.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const findFirst = vi.fn()
const findMany = vi.fn()
const create = vi.fn()
const update = vi.fn()

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({ employee: { findFirst, findMany, create, update } })
  ),
}))

vi.mock('@/core/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/core/events', () => ({ emit: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn(async () => ({
    org: { id: 'org-1', name: 'Test', slug: 'test' },
    enabledModules: ['employees'],
    membership: { id: 'mem-1', role: 'OWNER', isActive: true },
  })),
  requirePermission: vi.fn(async () => ({ userId: 'user-1', role: 'OWNER' })),
  retryOnce: vi.fn(async (read: () => Promise<unknown>) => read()),
}))

// Mock queries used by import-actions
vi.mock('../queries', () => ({
  listDepartments: vi.fn(async () => [
    { id: 'dept-1', name: 'Engineering', managerId: null, manager: null, _count: { employees: 3 } },
  ]),
  listJobTitles: vi.fn(async () => [{ id: 'jt-1', name: 'Software Engineer' }]),
  listWorkLocations: vi.fn(async () => [{ id: 'loc-1', name: 'Singapore HQ', address: null }]),
  listEmploymentTypes: vi.fn(async () => [{ id: 'et-1', name: 'Full-time', defaultShiftTemplateId: null }]),
  getShiftTemplates: vi.fn(async () => [
    { id: 'st-1', name: 'Standard 9-6', startMinutes: 540, endMinutes: 1080, standardMinutesPerDay: 480, overtimeMultiplier: 1.5, restDayMultiplier: 2.0, isArchived: false },
  ]),
}))

import { validateImportCsv, commitImportCsv } from '../import-actions'
import { CSV_HEADERS } from '../import-csv'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeValidCsvRow(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    first_name: 'Jane',
    last_name: 'Doe',
    work_email: 'jane@company.com',
    personal_email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    national_id: '',
    address: '',
    start_date: '',
    department: 'Engineering',
    job_title: 'Software Engineer',
    location: 'Singapore HQ',
    employment_type: 'Full-time',
    manager_email: '',
    compensation_amount: '5000',
    compensation_currency: 'SGD',
    pay_type: 'SALARIED',
    is_workman: 'false',
    shift_template: 'Standard 9-6',
    bank_name: '',
    bank_account_number: '',
  }
  const row = { ...defaults, ...overrides }
  return CSV_HEADERS.map((h) => row[h] ?? '').join(',')
}

function makeCsv(rows: string[]): string {
  return CSV_HEADERS.join(',') + '\n' + rows.join('\n')
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('validateImportCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no existing employees
    findMany.mockResolvedValue([])
  })

  it('returns validation result for a valid CSV', async () => {
    const csv = makeCsv([makeValidCsvRow()])
    const result = await validateImportCsv('test', csv)

    expect(result.success).toBe(true)
    expect(result.validCount).toBe(1)
    expect(result.invalidCount).toBe(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows![0].isValid).toBe(true)
  })

  it('detects duplicate email against existing DB', async () => {
    findMany.mockResolvedValue([{ id: 'emp-1', workEmail: 'jane@company.com' }])

    const csv = makeCsv([makeValidCsvRow()])
    const result = await validateImportCsv('test', csv)

    expect(result.success).toBe(true)
    expect(result.rows![0].isValid).toBe(false)
    expect(result.rows![0].errors[0]).toMatch(/already exists/)
  })

  it('rejects oversized CSV', async () => {
    // Create a string that exceeds 2MB
    const bigText = 'x'.repeat(3 * 1024 * 1024)
    const result = await validateImportCsv('test', bigText)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/exceeds maximum size/)
  })
})

describe('commitImportCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findMany.mockResolvedValue([])
    create.mockImplementation(async (args: { data: { workEmail: string } }) => ({
      id: `emp-${args.data.workEmail}`,
      ...args.data,
    }))
  })

  it('creates employees from valid rows', async () => {
    const csv = makeCsv([
      makeValidCsvRow({ work_email: 'a@company.com', first_name: 'Alice' }),
      makeValidCsvRow({ work_email: 'b@company.com', first_name: 'Bob' }),
    ])

    const result = await commitImportCsv('test', csv)

    expect(result.success).toBe(true)
    expect(result.created).toBe(2)
    expect(result.failed).toBe(0)
  })

  it('skips invalid rows and only creates valid ones', async () => {
    const csv = makeCsv([
      makeValidCsvRow({ work_email: 'valid@company.com' }),
      makeValidCsvRow({ work_email: 'invalid', first_name: '' }), // invalid email + missing name
    ])

    const result = await commitImportCsv('test', csv)

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
  })

  it('returns error when no valid rows exist', async () => {
    const csv = makeCsv([makeValidCsvRow({ first_name: '', work_email: 'bad' })])

    const result = await commitImportCsv('test', csv)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/No valid rows/)
  })

  it('skips a manager assignment that would create a circular reporting relationship within the batch', async () => {
    // A manages B, B manages A — both rows are individually valid, but
    // applying both manager links would create a 2-node cycle.
    const csv = makeCsv([
      makeValidCsvRow({ work_email: 'a@company.com', first_name: 'Alice', manager_email: 'b@company.com' }),
      makeValidCsvRow({ work_email: 'b@company.com', first_name: 'Bob', manager_email: 'a@company.com' }),
    ])

    const result = await commitImportCsv('test', csv)

    expect(result.success).toBe(true)
    expect(result.created).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.managerWarnings).toHaveLength(1)
    expect(result.managerWarnings![0].warning).toMatch(/circular/i)
    // Only one of the two manager links should have actually been applied.
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('still assigns a manager when the reference resolves to an existing employee with no cycle', async () => {
    findMany.mockResolvedValue([{ id: 'existing-mgr', workEmail: 'boss@company.com', managerId: null }])

    const csv = makeCsv([
      makeValidCsvRow({ work_email: 'a@company.com', manager_email: 'boss@company.com' }),
    ])

    const result = await commitImportCsv('test', csv)

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
    expect(result.managerWarnings).toHaveLength(0)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { managerId: 'existing-mgr' } })
    )
  })
})
