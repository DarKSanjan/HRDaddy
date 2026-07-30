import Papa from 'papaparse'
import { CSV_HEADERS, MAX_CSV_ROWS } from './import-constants'

export { CSV_HEADERS, MAX_CSV_ROWS, MAX_CSV_SIZE_BYTES } from './import-constants'

export interface CsvRawRow {
  [key: string]: string
}

export interface ParsedHolidayImportRow {
  rowIndex: number
  raw: CsvRawRow
  errors: string[]
  resolved: ResolvedHolidayRow | null
}

export interface ResolvedHolidayRow {
  date: string
  name: string
}

export interface HolidayCsvParseResult {
  rows: ParsedHolidayImportRow[]
  globalErrors: string[]
}

export function parseCsvText(csvText: string): HolidayCsvParseResult {
  const globalErrors: string[] = []

  const parseResult = Papa.parse<CsvRawRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) =>
      header.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseResult.errors.length > 0) {
    const critical = parseResult.errors.filter((e) => e.type === 'Delimiter' || e.type === 'Quotes')
    if (critical.length > 0) {
      globalErrors.push(`CSV parsing error: ${critical[0].message}`)
      return { rows: [], globalErrors }
    }
  }

  const headers = parseResult.meta.fields ?? []
  const missingHeaders = CSV_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    globalErrors.push(`Missing required columns: ${missingHeaders.join(', ')}`)
    return { rows: [], globalErrors }
  }

  const dataRows = parseResult.data
  if (dataRows.length === 0) {
    globalErrors.push('CSV file has no data rows.')
    return { rows: [], globalErrors }
  }

  if (dataRows.length > MAX_CSV_ROWS) {
    globalErrors.push(`CSV file has ${dataRows.length} rows — maximum is ${MAX_CSV_ROWS}.`)
    return { rows: [], globalErrors }
  }

  const rows: ParsedHolidayImportRow[] = dataRows.map((raw, index) => ({
    rowIndex: index + 2,
    raw,
    errors: [],
    resolved: null,
  }))

  return { rows, globalErrors }
}

export interface ExistingHolidayKey {
  date: string
  name: string
}

export function resolveAndValidateRows(
  rows: ParsedHolidayImportRow[],
  existingKeys: Set<string>
): void {
  const batchKeys = new Set<string>()

  for (const row of rows) {
    const raw = row.raw
    const errors: string[] = []

    const dateStr = (raw.date ?? '').trim()
    const name = (raw.name ?? '').trim()

    if (!dateStr) errors.push('date is required')
    if (!name) errors.push('name is required')

    let parsedDate: string | null = null
    if (dateStr) {
      const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      if (!dateMatch) {
        errors.push('date must be in YYYY-MM-DD format')
      } else {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) {
          errors.push('date is not a valid date')
        } else {
          parsedDate = dateStr
        }
      }
    }

    if (parsedDate && name) {
      const key = `${parsedDate}|${name.toLowerCase()}`
      if (existingKeys.has(key)) {
        errors.push(`Holiday "${name}" on ${parsedDate} already exists`)
      } else if (batchKeys.has(key)) {
        errors.push(`Duplicate entry within this CSV: "${name}" on ${parsedDate}`)
      }
      batchKeys.add(key)
    }

    row.errors = errors
    if (errors.length === 0 && parsedDate && name) {
      row.resolved = { date: parsedDate, name }
    }
  }
}

export function generateCsvTemplate(): string {
  return CSV_HEADERS.join(',') + '\n' + '2026-01-01,"New Year\'s Day"' + '\n'
}
