/**
 * Unit tests for CSV import parsing, validation, and manager resolution.
 *
 * These are pure-logic tests — no DB mocking needed since import-csv.ts
 * accepts lookup maps and email sets as parameters.
 */
import { describe, it, expect } from 'vitest'
import {
  parseCsvText,
  resolveAndValidateRows,
  resolveManagerReferences,
  generateCsvTemplate,
  CSV_HEADERS,
  MAX_CSV_ROWS,
  type LookupMaps,
} from '../import-csv'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeLookups(overrides: Partial<LookupMaps> = {}): LookupMaps {
  return {
    departments: new Map([['engineering', 'dept-1'], ['marketing', 'dept-2']]),
    jobTitles: new Map([['software engineer', 'jt-1'], ['designer', 'jt-2']]),
    locations: new Map([['singapore hq', 'loc-1']]),
    employmentTypes: new Map([['full-time', 'et-1'], ['contract', 'et-2']]),
    shiftTemplates: new Map([['standard 9-6', 'st-1']]),
    ...overrides,
  }
}

function makeValidCsvRow(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    first_name: 'Jane',
    last_name: 'Doe',
    work_email: 'jane@company.com',
    personal_email: 'jane@personal.com',
    phone: '+65 9123 4567',
    date_of_birth: '1990-05-15',
    gender: 'Female',
    national_id: 'S1234567A',
    address: '123 Main St',
    start_date: '2024-01-15',
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
    bank_name: 'DBS',
    bank_account_number: '1234567890',
  }
  const row = { ...defaults, ...overrides }
  return CSV_HEADERS.map((h) => row[h] ?? '').join(',')
}

function makeCsv(rows: string[]): string {
  return CSV_HEADERS.join(',') + '\n' + rows.join('\n')
}

// ─────────────────────────────────────────────
// parseCsvText
// ─────────────────────────────────────────────

describe('parseCsvText', () => {
  it('parses valid CSV with correct number of rows', () => {
    const csv = makeCsv([makeValidCsvRow()])
    const result = parseCsvText(csv)
    expect(result.globalErrors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].rowIndex).toBe(1)
  })

  it('returns error when CSV has no data rows', () => {
    const csv = CSV_HEADERS.join(',') + '\n'
    const result = parseCsvText(csv)
    expect(result.globalErrors).toContain('CSV file contains no data rows')
  })

  it('returns error when CSV exceeds max rows', () => {
    const rows = Array(MAX_CSV_ROWS + 1)
      .fill(null)
      .map((_, i) => makeValidCsvRow({ work_email: `user${i}@company.com` }))
    const csv = makeCsv(rows)
    const result = parseCsvText(csv)
    expect(result.globalErrors[0]).toMatch(/exceeds maximum/)
  })

  it('returns error when required columns are missing', () => {
    const csv = 'first_name,last_name\nJane,Doe\n'
    const result = parseCsvText(csv)
    expect(result.globalErrors[0]).toMatch(/Missing required columns/)
  })

  it('handles case-insensitive headers', () => {
    const header = 'First_Name,Last_Name,Work_Email'
    const row = 'Jane,Doe,jane@company.com'
    const csv = `${header}\n${row}\n`
    const result = parseCsvText(csv)
    expect(result.globalErrors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────
// resolveAndValidateRows
// ─────────────────────────────────────────────

describe('resolveAndValidateRows', () => {
  it('resolves valid row with all lookups', () => {
    const csv = makeCsv([makeValidCsvRow()])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors).toHaveLength(0)
    expect(rows[0].resolved).not.toBeNull()
    expect(rows[0].resolved!.departmentId).toBe('dept-1')
    expect(rows[0].resolved!.jobTitleId).toBe('jt-1')
    expect(rows[0].resolved!.locationId).toBe('loc-1')
    expect(rows[0].resolved!.employmentTypeId).toBe('et-1')
    expect(rows[0].resolved!.shiftTemplateId).toBe('st-1')
    expect(rows[0].resolved!.compensationAmountCents).toBe(500000)
  })

  it('reports error for unresolvable department', () => {
    const csv = makeCsv([makeValidCsvRow({ department: 'NonExistent' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors).toContain('Department "NonExistent" not found')
    expect(rows[0].resolved).toBeNull()
  })

  it('reports error for unresolvable job title', () => {
    const csv = makeCsv([makeValidCsvRow({ job_title: 'Unknown Role' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors[0]).toMatch(/Job title "Unknown Role" not found/)
  })

  it('reports error for unresolvable location', () => {
    const csv = makeCsv([makeValidCsvRow({ location: 'Mars' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors[0]).toMatch(/Location "Mars" not found/)
  })

  it('reports error for duplicate work email against existing DB', () => {
    const csv = makeCsv([makeValidCsvRow({ work_email: 'existing@company.com' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set(['existing@company.com']))

    expect(rows[0].errors).toContain('Work email already exists in the organisation')
  })

  it('reports error for duplicate work email within the CSV', () => {
    const csv = makeCsv([
      makeValidCsvRow({ work_email: 'dupe@company.com', first_name: 'Alice' }),
      makeValidCsvRow({ work_email: 'dupe@company.com', first_name: 'Bob' }),
    ])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    // First row is fine, second has duplicate error
    expect(rows[0].errors).toHaveLength(0)
    expect(rows[1].errors[0]).toMatch(/Duplicate work email in CSV/)
  })

  it('reports error for invalid pay_type', () => {
    const csv = makeCsv([makeValidCsvRow({ pay_type: 'WEEKLY' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors.some((e) => e.includes('pay_type'))).toBe(true)
  })

  it('reports Zod validation errors for missing required fields', () => {
    const csv = makeCsv([makeValidCsvRow({ first_name: '', last_name: '' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors.some((e) => e.includes('firstName'))).toBe(true)
    expect(rows[0].errors.some((e) => e.includes('lastName'))).toBe(true)
  })

  it('handles invalid compensation amount', () => {
    const csv = makeCsv([makeValidCsvRow({ compensation_amount: 'abc' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors).toContain('Compensation amount must be a non-negative number')
  })

  it('allows optional fields to be empty', () => {
    const csv = makeCsv([
      makeValidCsvRow({
        personal_email: '',
        phone: '',
        date_of_birth: '',
        department: '',
        job_title: '',
        location: '',
        employment_type: '',
        shift_template: '',
        compensation_amount: '',
        compensation_currency: '',
        pay_type: '',
        manager_email: '',
        bank_name: '',
        bank_account_number: '',
      }),
    ])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    expect(rows[0].errors).toHaveLength(0)
    expect(rows[0].resolved).not.toBeNull()
  })

  it('collects ALL errors in one pass, not just the first', () => {
    const csv = makeCsv([
      makeValidCsvRow({
        first_name: '',
        work_email: 'invalid-email',
        department: 'NonExistent',
        compensation_amount: '-10',
      }),
    ])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())

    // Should have multiple errors
    expect(rows[0].errors.length).toBeGreaterThanOrEqual(3)
  })
})

// ─────────────────────────────────────────────
// resolveManagerReferences
// ─────────────────────────────────────────────

describe('resolveManagerReferences', () => {
  it('resolves manager from existing employees', () => {
    const csv = makeCsv([makeValidCsvRow({ manager_email: 'boss@company.com' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())
    resolveManagerReferences(rows, new Map([['boss@company.com', 'mgr-id-1']]))

    expect(rows[0].resolved!.managerId).toBe('mgr-id-1')
    expect(rows[0].errors).toHaveLength(0)
  })

  it('resolves manager from same CSV batch', () => {
    const csv = makeCsv([
      makeValidCsvRow({ work_email: 'boss@company.com', first_name: 'Boss' }),
      makeValidCsvRow({ work_email: 'report@company.com', manager_email: 'boss@company.com' }),
    ])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())
    resolveManagerReferences(rows, new Map())

    expect(rows[1].resolved!.managerId).toBe('__batch__:boss@company.com')
    expect(rows[1].errors).toHaveLength(0)
  })

  it('errors when manager email not found anywhere', () => {
    const csv = makeCsv([
      makeValidCsvRow({ work_email: 'user@company.com', manager_email: 'ghost@company.com' }),
    ])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())
    resolveManagerReferences(rows, new Map())

    expect(rows[0].errors).toContain('Manager email "ghost@company.com" not found')
    expect(rows[0].resolved).toBeNull()
  })

  it('does not error when manager_email is empty', () => {
    const csv = makeCsv([makeValidCsvRow({ manager_email: '' })])
    const { rows } = parseCsvText(csv)
    resolveAndValidateRows(rows, makeLookups(), new Set())
    resolveManagerReferences(rows, new Map())

    expect(rows[0].errors).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────
// generateCsvTemplate
// ─────────────────────────────────────────────

describe('generateCsvTemplate', () => {
  it('generates a valid CSV with headers and one example row', () => {
    const template = generateCsvTemplate()
    const lines = template.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(CSV_HEADERS.join(','))
    expect(lines[1].split(',').length).toBe(CSV_HEADERS.length)
  })
})
