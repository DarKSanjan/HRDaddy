/**
 * Asset CSV import tests — pure parsing/validation logic.
 * Mirrors the employee import-csv.test.ts structure.
 */
import { describe, it, expect } from 'vitest'
import {
  parseCsvText,
  resolveAndValidateRows,
  generateCsvTemplate,
  CSV_HEADERS,
  MAX_CSV_ROWS,
  type AssetLookupMaps,
} from '../import-csv'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeLookups(overrides: Partial<AssetLookupMaps> = {}): AssetLookupMaps {
  return {
    categories: new Map([
      ['laptop', 'cat-1'],
      ['monitor', 'cat-2'],
      ['phone', 'cat-3'],
    ]),
    ...overrides,
  }
}

function makeValidCsvRow(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    name: 'MacBook Pro 16"',
    asset_tag: 'LAP-2024-001',
    category: 'Laptop',
    purchase_date: '2024-03-15',
    purchase_value: '3200.00',
    notes: 'M3 Pro chip',
  }
  const row = { ...defaults, ...overrides }
  return CSV_HEADERS.map((h) => row[h] ?? '').join(',')
}

function makeCsv(rows: string[]): string {
  return CSV_HEADERS.join(',') + '\n' + rows.join('\n')
}

// ─────────────────────────────────────────────
// parseCsvText tests
// ─────────────────────────────────────────────

describe('parseCsvText', () => {
  it('parses valid CSV with correct row count', () => {
    const csv = makeCsv([makeValidCsvRow()])
    const result = parseCsvText(csv)

    expect(result.globalErrors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].rowIndex).toBe(2)
  })

  it('returns error for no data rows', () => {
    const csv = CSV_HEADERS.join(',') + '\n'
    const result = parseCsvText(csv)

    expect(result.globalErrors).toContain('CSV file has no data rows.')
  })

  it('returns error for exceeding MAX_CSV_ROWS', () => {
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) =>
      makeValidCsvRow({ asset_tag: `LAP-${i}` })
    )
    const csv = makeCsv(rows)
    const result = parseCsvText(csv)

    expect(result.globalErrors[0]).toContain('maximum')
  })

  it('returns error for missing required columns', () => {
    const csv = 'category,notes\nLaptop,some notes\n'
    const result = parseCsvText(csv)

    expect(result.globalErrors[0]).toContain('name')
    expect(result.globalErrors[0]).toContain('asset_tag')
  })

  it('handles case-insensitive headers', () => {
    const csv = 'Name,Asset_Tag,Category,Purchase_Date,Purchase_Value,Notes\nTest,T-001,Laptop,,,'
    const result = parseCsvText(csv)

    expect(result.globalErrors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────
// resolveAndValidateRows tests
// ─────────────────────────────────────────────

describe('resolveAndValidateRows', () => {
  it('resolves valid row with category lookup', () => {
    const csv = makeCsv([makeValidCsvRow()])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors).toHaveLength(0)
    expect(result.rows[0].resolved).not.toBeNull()
    expect(result.rows[0].resolved!.categoryId).toBe('cat-1')
    expect(result.rows[0].resolved!.purchaseValueCents).toBe(320000)
  })

  it('reports error for unresolvable category', () => {
    const csv = makeCsv([makeValidCsvRow({ category: 'Spaceship' })])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors).toHaveLength(1)
    expect(result.rows[0].errors[0]).toContain('Spaceship')
    expect(result.rows[0].errors[0]).toContain('not found')
  })

  it('reports error for duplicate asset tag in existing data', () => {
    const csv = makeCsv([makeValidCsvRow()])
    const result = parseCsvText(csv)
    const lookups = makeLookups()
    const existing = new Set(['lap-2024-001'])

    resolveAndValidateRows(result.rows, lookups, existing)

    expect(result.rows[0].errors).toHaveLength(1)
    expect(result.rows[0].errors[0]).toContain('already exists')
  })

  it('reports error for duplicate asset tag within CSV batch', () => {
    const csv = makeCsv([
      makeValidCsvRow({ asset_tag: 'LAP-DUP' }),
      makeValidCsvRow({ asset_tag: 'LAP-DUP', name: 'Another laptop' }),
    ])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors).toHaveLength(0) // first is fine
    expect(result.rows[1].errors).toHaveLength(1) // second is duplicate
    expect(result.rows[1].errors[0]).toContain('duplicated within this CSV')
  })

  it('reports error for missing required fields', () => {
    const csv = makeCsv([makeValidCsvRow({ name: '', asset_tag: '' })])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors).toContain('name is required')
    expect(result.rows[0].errors).toContain('asset_tag is required')
  })

  it('validates purchase_date format', () => {
    const csv = makeCsv([makeValidCsvRow({ purchase_date: '15-03-2024' })])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors.some((e) => e.includes('YYYY-MM-DD'))).toBe(true)
  })

  it('validates purchase_value is numeric', () => {
    const csv = makeCsv([makeValidCsvRow({ purchase_value: 'abc' })])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors.some((e) => e.includes('positive number'))).toBe(true)
  })

  it('handles optional fields being empty', () => {
    const csv = makeCsv([makeValidCsvRow({ purchase_date: '', purchase_value: '', notes: '' })])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors).toHaveLength(0)
    expect(result.rows[0].resolved!.purchaseDate).toBeNull()
    expect(result.rows[0].resolved!.purchaseValueCents).toBeNull()
    expect(result.rows[0].resolved!.notes).toBeNull()
  })

  it('resolves category case-insensitively', () => {
    const csv = makeCsv([makeValidCsvRow({ category: 'LAPTOP' })])
    const result = parseCsvText(csv)
    const lookups = makeLookups()

    resolveAndValidateRows(result.rows, lookups, new Set())

    expect(result.rows[0].errors).toHaveLength(0)
    expect(result.rows[0].resolved!.categoryId).toBe('cat-1')
  })
})

// ─────────────────────────────────────────────
// generateCsvTemplate tests
// ─────────────────────────────────────────────

describe('generateCsvTemplate', () => {
  it('generates valid CSV with header and example row', () => {
    const template = generateCsvTemplate()
    const lines = template.trim().split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(CSV_HEADERS.join(','))
    expect(lines[1]).toContain('LAP-2024-001')
  })
})
