import { describe, it, expect } from 'vitest'
import {
  parseCsvText,
  resolveAndValidateRows,
} from '../import-csv'

describe('holiday CSV import', () => {
  it('parses a valid CSV with date and name columns', () => {
    const csv = `date,name\n2026-01-01,New Year's Day\n2026-12-25,Christmas Day\n`
    const result = parseCsvText(csv)
    expect(result.globalErrors).toEqual([])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].rowIndex).toBe(2)
    expect(result.rows[1].rowIndex).toBe(3)
  })

  it('reports missing required columns', () => {
    const csv = `foo,bar\n1,2\n`
    const result = parseCsvText(csv)
    expect(result.globalErrors[0]).toContain('Missing required columns')
  })

  it('reports empty CSV', () => {
    const csv = `date,name\n`
    const result = parseCsvText(csv)
    expect(result.globalErrors[0]).toContain('no data rows')
  })

  it('validates date format', () => {
    const csv = `date,name\n01-01-2026,New Year's Day\n`
    const result = parseCsvText(csv)
    resolveAndValidateRows(result.rows, new Set())
    expect(result.rows[0].errors).toContain('date must be in YYYY-MM-DD format')
  })

  it('validates name is required', () => {
    const csv = `date,name\n2026-01-01,\n`
    const result = parseCsvText(csv)
    resolveAndValidateRows(result.rows, new Set())
    expect(result.rows[0].errors).toContain('name is required')
  })

  it('detects existing duplicates', () => {
    const csv = `date,name\n2026-01-01,New Year's Day\n`
    const existing = new Set(["2026-01-01|new year's day"])
    const result = parseCsvText(csv)
    resolveAndValidateRows(result.rows, existing)
    expect(result.rows[0].errors[0]).toContain('already exists')
  })

  it('detects intra-CSV duplicates', () => {
    const csv = `date,name\n2026-01-01,New Year's Day\n2026-01-01,New Year's Day\n`
    const result = parseCsvText(csv)
    resolveAndValidateRows(result.rows, new Set())
    expect(result.rows[0].errors).toHaveLength(0)
    expect(result.rows[1].errors[0]).toContain('Duplicate entry within this CSV')
  })

  it('resolves valid rows correctly', () => {
    const csv = `date,name\n2026-05-01,Labour Day\n`
    const result = parseCsvText(csv)
    resolveAndValidateRows(result.rows, new Set())
    expect(result.rows[0].resolved).toEqual({ date: '2026-05-01', name: 'Labour Day' })
  })
})
