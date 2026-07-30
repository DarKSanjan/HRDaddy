/**
 * CSV Import — parsing, validation, and lookup resolution.
 *
 * This module is pure logic (no DB access) except for the lookup-resolution
 * helper which takes lookup maps as parameters. This keeps it testable without
 * mocking Prisma.
 */
import Papa from 'papaparse'
import { createEmployeeSchema } from './schemas'
import {
  CSV_HEADERS,
  CSV_TEMPLATE_ROW,
  MAX_CSV_ROWS,
  MAX_CSV_SIZE_BYTES,
  type CsvHeader,
} from './import-constants'

// Re-export constants so existing imports from import-csv still work
export { CSV_HEADERS, CSV_TEMPLATE_ROW, MAX_CSV_ROWS, MAX_CSV_SIZE_BYTES, type CsvHeader }

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CsvRawRow {
  [key: string]: string
}

export interface LookupMaps {
  departments: Map<string, string> // lowercase name -> id
  jobTitles: Map<string, string>
  locations: Map<string, string>
  employmentTypes: Map<string, string>
  shiftTemplates: Map<string, string>
}

export interface ParsedImportRow {
  rowIndex: number // 1-based (first data row = 1)
  raw: CsvRawRow
  errors: string[]
  resolved: ResolvedRow | null
}

export interface ResolvedRow {
  firstName: string
  lastName: string
  workEmail: string
  personalEmail?: string
  phone?: string
  dateOfBirth?: string
  gender?: string
  nationalId?: string
  address?: string
  startDate?: string
  departmentId?: string
  jobTitleId?: string
  locationId?: string
  employmentTypeId?: string
  managerEmail?: string // resolved to managerId later
  managerId?: string
  compensationAmountCents?: number
  compensationCurrency?: string
  payType?: 'SALARIED' | 'HOURLY'
  isWorkman?: boolean
  shiftTemplateId?: string
  bankName?: string
  bankAccountNumber?: string
}

export interface CsvParseResult {
  rows: ParsedImportRow[]
  globalErrors: string[]
}

// ─────────────────────────────────────────────
// CSV Parsing
// ─────────────────────────────────────────────

/**
 * Parse raw CSV text into structured rows, applying header validation.
 */
export function parseCsvText(csvText: string): CsvParseResult {
  const globalErrors: string[] = []

  const result = Papa.parse<CsvRawRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (result.errors.length > 0) {
    // Only surface fatal parse errors
    const fatalErrors = result.errors.filter(
      (e) => e.type === 'Delimiter' || e.type === 'FieldMismatch'
    )
    if (fatalErrors.length > 0) {
      globalErrors.push(
        ...fatalErrors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`)
      )
    }
  }

  if (result.data.length === 0) {
    globalErrors.push('CSV file contains no data rows')
    return { rows: [], globalErrors }
  }

  if (result.data.length > MAX_CSV_ROWS) {
    globalErrors.push(`CSV exceeds maximum of ${MAX_CSV_ROWS} rows (found ${result.data.length})`)
    return { rows: [], globalErrors }
  }

  // Validate required headers exist
  const fileHeaders = result.meta.fields?.map((h) => h.toLowerCase().replace(/\s+/g, '_')) ?? []
  const requiredHeaders: CsvHeader[] = ['first_name', 'last_name', 'work_email']
  const missingRequired = requiredHeaders.filter((h) => !fileHeaders.includes(h))
  if (missingRequired.length > 0) {
    globalErrors.push(`Missing required columns: ${missingRequired.join(', ')}`)
    return { rows: [], globalErrors }
  }

  const rows: ParsedImportRow[] = result.data.map((rawRow, index) => ({
    rowIndex: index + 1,
    raw: rawRow,
    errors: [],
    resolved: null,
  }))

  return { rows, globalErrors }
}

// ─────────────────────────────────────────────
// Lookup resolution & validation
// ─────────────────────────────────────────────

/**
 * Resolve lookup names to IDs and validate each row against the schema.
 * Mutates the ParsedImportRow.errors and .resolved fields in place.
 */
export function resolveAndValidateRows(
  rows: ParsedImportRow[],
  lookups: LookupMaps,
  existingEmails: Set<string> // lowercase work emails that already exist in the org
): void {
  // Track emails within the CSV for intra-file duplicate detection
  const seenEmails = new Map<string, number>() // email -> first row index

  for (const row of rows) {
    const raw = row.raw
    const errors: string[] = []

    // Extract fields with fallback for snake_case headers
    const firstName = (raw.first_name ?? '').trim()
    const lastName = (raw.last_name ?? '').trim()
    const workEmail = (raw.work_email ?? '').trim().toLowerCase()
    const personalEmail = (raw.personal_email ?? '').trim()
    const phone = (raw.phone ?? '').trim()
    const dateOfBirth = (raw.date_of_birth ?? '').trim()
    const gender = (raw.gender ?? '').trim()
    const nationalId = (raw.national_id ?? '').trim()
    const address = (raw.address ?? '').trim()
    const startDate = (raw.start_date ?? '').trim()
    const departmentName = (raw.department ?? '').trim()
    const jobTitleName = (raw.job_title ?? '').trim()
    const locationName = (raw.location ?? '').trim()
    const employmentTypeName = (raw.employment_type ?? '').trim()
    const managerEmail = (raw.manager_email ?? '').trim().toLowerCase()
    const compensationRaw = (raw.compensation_amount ?? '').trim()
    const compensationCurrency = (raw.compensation_currency ?? '').trim()
    const payType = (raw.pay_type ?? '').trim().toUpperCase()
    const isWorkmanRaw = (raw.is_workman ?? '').trim().toLowerCase()
    const shiftTemplateName = (raw.shift_template ?? '').trim()
    const bankName = (raw.bank_name ?? '').trim()
    const bankAccountNumber = (raw.bank_account_number ?? '').trim()

    // Resolve lookups
    let departmentId: string | undefined
    if (departmentName) {
      departmentId = lookups.departments.get(departmentName.toLowerCase())
      if (!departmentId) {
        errors.push(`Department "${departmentName}" not found`)
      }
    }

    let jobTitleId: string | undefined
    if (jobTitleName) {
      jobTitleId = lookups.jobTitles.get(jobTitleName.toLowerCase())
      if (!jobTitleId) {
        errors.push(`Job title "${jobTitleName}" not found`)
      }
    }

    let locationId: string | undefined
    if (locationName) {
      locationId = lookups.locations.get(locationName.toLowerCase())
      if (!locationId) {
        errors.push(`Location "${locationName}" not found`)
      }
    }

    let employmentTypeId: string | undefined
    if (employmentTypeName) {
      employmentTypeId = lookups.employmentTypes.get(employmentTypeName.toLowerCase())
      if (!employmentTypeId) {
        errors.push(`Employment type "${employmentTypeName}" not found`)
      }
    }

    let shiftTemplateId: string | undefined
    if (shiftTemplateName) {
      shiftTemplateId = lookups.shiftTemplates.get(shiftTemplateName.toLowerCase())
      if (!shiftTemplateId) {
        errors.push(`Shift template "${shiftTemplateName}" not found`)
      }
    }

    // Parse compensation
    let compensationAmountCents: number | undefined
    if (compensationRaw) {
      const num = Number(compensationRaw)
      if (isNaN(num) || num < 0) {
        errors.push('Compensation amount must be a non-negative number')
      } else {
        compensationAmountCents = Math.round(num * 100)
      }
    }

    // Email uniqueness: check against existing DB emails
    if (workEmail && existingEmails.has(workEmail)) {
      errors.push('Work email already exists in the organisation')
    }

    // Email uniqueness: check within the CSV itself
    if (workEmail) {
      const firstSeen = seenEmails.get(workEmail)
      if (firstSeen !== undefined) {
        errors.push(`Duplicate work email in CSV (also in row ${firstSeen})`)
      } else {
        seenEmails.set(workEmail, row.rowIndex)
      }
    }

    // Build the resolved input for Zod schema validation
    const resolvedInput = {
      firstName,
      lastName,
      workEmail,
      personalEmail: personalEmail || undefined,
      phone: phone || undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      nationalId: nationalId || undefined,
      address: address || undefined,
      startDate: startDate || undefined,
      departmentId: departmentId || undefined,
      jobTitleId: jobTitleId || undefined,
      locationId: locationId || undefined,
      employmentTypeId: employmentTypeId || undefined,
      managerId: undefined as string | undefined, // resolved later
      compensationAmountCents,
      compensationCurrency: compensationCurrency || undefined,
      payType: (payType === 'SALARIED' || payType === 'HOURLY') ? payType as 'SALARIED' | 'HOURLY' : undefined,
      isWorkman: isWorkmanRaw === 'true' ? true : isWorkmanRaw === 'false' ? false : undefined,
      shiftTemplateId: shiftTemplateId || undefined,
      bankName: bankName || undefined,
      bankAccountNumber: bankAccountNumber || undefined,
    }

    // payType validation: if provided but invalid, error
    if (payType && payType !== 'SALARIED' && payType !== 'HOURLY') {
      errors.push(`Invalid pay_type "${raw.pay_type}". Must be SALARIED or HOURLY`)
    }

    // Validate against Zod schema (except managerId — resolved later)
    const zodResult = createEmployeeSchema.safeParse(resolvedInput)
    if (!zodResult.success) {
      for (const issue of zodResult.error.issues) {
        const field = issue.path.join('.')
        // Skip managerId errors — we handle managers separately
        if (field === 'managerId') continue
        errors.push(`${field}: ${issue.message}`)
      }
    }

    row.errors = errors
    row.resolved = errors.length === 0
      ? { ...resolvedInput, managerEmail: managerEmail || undefined }
      : null
  }
}

/**
 * Resolve manager references within the batch.
 *
 * APPROACH: Two-pass creation.
 * 1. All employees are created first without managerId.
 * 2. After all are created, manager_email references are resolved:
 *    - If the manager already existed in the org, use their ID.
 *    - If the manager is another row in the same CSV, use the newly-created ID.
 * 3. A second DB pass sets managerId on employees whose manager was identified.
 *
 * This avoids dependency ordering and handles circular references gracefully
 * (two employees who manage each other — last one set wins, same as single-create).
 */
export function resolveManagerReferences(
  rows: ParsedImportRow[],
  existingEmailToId: Map<string, string> // existing org employees: email -> id
): void {
  // Build a map of CSV emails -> row index for intra-batch resolution
  const csvEmailToRow = new Map<string, number>()
  for (const row of rows) {
    if (row.resolved?.workEmail) {
      csvEmailToRow.set(row.resolved.workEmail.toLowerCase(), row.rowIndex)
    }
  }

  for (const row of rows) {
    if (!row.resolved?.managerEmail) continue

    const mgrEmail = row.resolved.managerEmail.toLowerCase()

    // Check existing employees first
    if (existingEmailToId.has(mgrEmail)) {
      row.resolved.managerId = existingEmailToId.get(mgrEmail)
      continue
    }

    // Check if manager is in the same CSV batch
    if (csvEmailToRow.has(mgrEmail)) {
      // Mark for second-pass resolution after creation
      row.resolved.managerId = `__batch__:${mgrEmail}`
      continue
    }

    // Manager not found anywhere
    row.errors.push(`Manager email "${row.resolved.managerEmail}" not found`)
    row.resolved = null
  }
}

/**
 * Generate a CSV template string with headers and one example row.
 */
export function generateCsvTemplate(): string {
  const header = CSV_HEADERS.join(',')
  const example = CSV_TEMPLATE_ROW.join(',')
  return `${header}\n${example}\n`
}
