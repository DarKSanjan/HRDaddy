/**
 * Asset CSV Import — parsing, validation, and lookup resolution.
 * Pure logic (no DB access) — lookup resolution takes lookup maps as parameters.
 */
import Papa from 'papaparse'
import {
  CSV_HEADERS,
  CSV_TEMPLATE_ROW,
  MAX_CSV_ROWS,
  MAX_CSV_SIZE_BYTES,
  type AssetCsvHeader,
} from './import-constants'

export { CSV_HEADERS, CSV_TEMPLATE_ROW, MAX_CSV_ROWS, MAX_CSV_SIZE_BYTES, type AssetCsvHeader }

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CsvRawRow {
  [key: string]: string
}

export interface AssetLookupMaps {
  categories: Map<string, string> // lowercase name → id
}

export interface ParsedAssetImportRow {
  rowIndex: number
  raw: CsvRawRow
  errors: string[]
  resolved: ResolvedAssetRow | null
}

export interface ResolvedAssetRow {
  name: string
  assetTag: string
  categoryId: string
  purchaseDate: string | null
  purchaseValueCents: number | null
  notes: string | null
}

export interface AssetCsvParseResult {
  rows: ParsedAssetImportRow[]
  globalErrors: string[]
}

// ─────────────────────────────────────────────
// Parse CSV
// ─────────────────────────────────────────────

const REQUIRED_HEADERS: AssetCsvHeader[] = ['name', 'asset_tag']

export function parseCsvText(csvText: string): AssetCsvParseResult {
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

  // Check required headers
  const headers = parseResult.meta.fields ?? []
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
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

  const rows: ParsedAssetImportRow[] = dataRows.map((raw, index) => ({
    rowIndex: index + 2, // 1-based, +1 for header
    raw,
    errors: [],
    resolved: null,
  }))

  return { rows, globalErrors }
}

// ─────────────────────────────────────────────
// Resolve and validate rows
// ─────────────────────────────────────────────

export function resolveAndValidateRows(
  rows: ParsedAssetImportRow[],
  lookups: AssetLookupMaps,
  existingAssetTags: Set<string> // lowercase existing tags in the org
): void {
  const batchTags = new Set<string>() // track intra-CSV duplicates (lowercase)

  for (const row of rows) {
    const raw = row.raw
    const errors: string[] = []

    // Required fields
    const name = (raw.name ?? '').trim()
    const assetTag = (raw.asset_tag ?? '').trim()
    const categoryName = (raw.category ?? '').trim()

    if (!name) errors.push('name is required')
    if (!assetTag) errors.push('asset_tag is required')
    if (!categoryName) errors.push('category is required')

    // Check asset tag uniqueness
    const tagLower = assetTag.toLowerCase()
    if (assetTag) {
      if (existingAssetTags.has(tagLower)) {
        errors.push(`asset_tag "${assetTag}" already exists in this organisation`)
      } else if (batchTags.has(tagLower)) {
        errors.push(`asset_tag "${assetTag}" is duplicated within this CSV`)
      }
      batchTags.add(tagLower)
    }

    // Resolve category
    let categoryId: string | undefined
    if (categoryName) {
      categoryId = lookups.categories.get(categoryName.toLowerCase())
      if (!categoryId) {
        errors.push(`Category "${categoryName}" not found — create it first before importing`)
      }
    }

    // Optional fields
    let purchaseDate: string | null = null
    const rawPurchaseDate = (raw.purchase_date ?? '').trim()
    if (rawPurchaseDate) {
      const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(rawPurchaseDate)
      if (!dateMatch) {
        errors.push('purchase_date must be in YYYY-MM-DD format')
      } else {
        const d = new Date(rawPurchaseDate)
        if (isNaN(d.getTime())) {
          errors.push('purchase_date is not a valid date')
        } else {
          purchaseDate = rawPurchaseDate
        }
      }
    }

    let purchaseValueCents: number | null = null
    const rawPurchaseValue = (raw.purchase_value ?? '').trim()
    if (rawPurchaseValue) {
      const numValue = parseFloat(rawPurchaseValue)
      if (isNaN(numValue) || numValue < 0) {
        errors.push('purchase_value must be a positive number')
      } else {
        purchaseValueCents = Math.round(numValue * 100)
      }
    }

    const notes = (raw.notes ?? '').trim() || null

    row.errors = errors
    if (errors.length === 0 && categoryId) {
      row.resolved = {
        name,
        assetTag,
        categoryId,
        purchaseDate,
        purchaseValueCents,
        notes,
      }
    }
  }
}

// ─────────────────────────────────────────────
// Generate template
// ─────────────────────────────────────────────

export function generateCsvTemplate(): string {
  return CSV_HEADERS.join(',') + '\n' + CSV_TEMPLATE_ROW.join(',') + '\n'
}
