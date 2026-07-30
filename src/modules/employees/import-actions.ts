'use server'

import '@/modules/register'

/**
 * Bulk CSV employee import server actions.
 *
 * Two-phase approach:
 *   1. `validateImportCsv` — parses, resolves lookups, returns row-level errors.
 *   2. `commitImportCsv`  — re-validates then creates employees + side-effects.
 *
 * Manager-within-batch resolution:
 *   All employees are created without managerId first. Then a second pass
 *   resolves manager_email references (both to pre-existing employees and to
 *   other rows in the same batch) and sets managerId.
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission, retryOnce } from '@/core/auth'
import { dbAs } from '@/core/db'
import {
  parseCsvText,
  resolveAndValidateRows,
  resolveManagerReferences,
  MAX_CSV_SIZE_BYTES,
  type LookupMaps,
  type CsvParseResult,
} from './import-csv'
import { createEmployeeCore } from './create-employee-core'
import { wouldCreateCycleSync, type ReportingNode } from './reporting-lines'
import {
  listDepartments,
  listJobTitles,
  listWorkLocations,
  listEmploymentTypes,
  getShiftTemplates,
} from './queries'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ImportValidationResult {
  success: boolean
  error?: string
  rows?: Array<{
    rowIndex: number
    firstName: string
    lastName: string
    workEmail: string
    errors: string[]
    isValid: boolean
  }>
  validCount?: number
  invalidCount?: number
}

export interface ImportCommitResult {
  success: boolean
  error?: string
  created?: number
  failed?: number
  failures?: Array<{ rowIndex: number; workEmail: string; error: string }>
  managerWarnings?: Array<{ rowIndex: number; workEmail: string; warning: string }>
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Sequential, not Promise.all: each call below opens its own dbAs()
 * transaction, and firing 5+ of those at once against one route is the exact
 * concurrent-transaction load pattern already identified as a production
 * connection-contention risk (see the employees list page for the same
 * lesson). CSV import is not latency-sensitive enough to be worth the risk.
 */
async function buildLookupMaps(userId: string, orgId: string): Promise<LookupMaps> {
  const departments = await listDepartments(userId, orgId)
  const jobTitles = await listJobTitles(userId, orgId)
  const locations = await listWorkLocations(userId, orgId)
  const employmentTypes = await listEmploymentTypes(userId, orgId)
  const shiftTemplates = await getShiftTemplates(userId, orgId)

  return {
    departments: new Map(departments.map((d) => [d.name.toLowerCase(), d.id])),
    jobTitles: new Map(jobTitles.map((j) => [j.name.toLowerCase(), j.id])),
    locations: new Map(locations.map((l) => [l.name.toLowerCase(), l.id])),
    employmentTypes: new Map(employmentTypes.map((e) => [e.name.toLowerCase(), e.id])),
    shiftTemplates: new Map(shiftTemplates.map((s) => [s.name.toLowerCase(), s.id])),
  }
}

interface ExistingEmployeeData {
  existingEmails: Set<string> // lowercase work emails
  emailToId: Map<string, string> // lowercase work email -> id
  reportingNodes: ReportingNode[] // full org chain, for cycle detection
}

/** One query, not three — every consumer here just needs a different shape of the same row set. */
async function getExistingEmployeeData(userId: string, orgId: string): Promise<ExistingEmployeeData> {
  const employees = await dbAs(userId, async (tx) => {
    return tx.employee.findMany({
      where: { orgId },
      select: { id: true, workEmail: true, managerId: true },
    })
  })

  return {
    existingEmails: new Set(employees.map((e) => e.workEmail.toLowerCase())),
    emailToId: new Map(employees.map((e) => [e.workEmail.toLowerCase(), e.id])),
    reportingNodes: employees.map((e) => ({ id: e.id, managerId: e.managerId })),
  }
}

interface ImportContext {
  lookups: LookupMaps
  existingEmails: Set<string>
  existingEmailToId: Map<string, string>
  existingReportingNodes: ReportingNode[]
}

/** Everything both actions need before they can validate/create a single row, gathered in one retry-guarded batch. */
async function gatherImportContext(userId: string, orgId: string): Promise<ImportContext> {
  return retryOnce(
    async () => {
      const lookups = await buildLookupMaps(userId, orgId)
      const { existingEmails, emailToId, reportingNodes } = await getExistingEmployeeData(userId, orgId)
      return { lookups, existingEmails, existingEmailToId: emailToId, existingReportingNodes: reportingNodes }
    },
    () => false
  )
}

// ─────────────────────────────────────────────
// Validate action
// ─────────────────────────────────────────────

export async function validateImportCsv(
  orgSlug: string,
  csvText: string
): Promise<ImportValidationResult> {
  // File size check (csvText is the string content, approximate byte check)
  if (new TextEncoder().encode(csvText).length > MAX_CSV_SIZE_BYTES) {
    return { success: false, error: `CSV file exceeds maximum size of ${MAX_CSV_SIZE_BYTES / 1024 / 1024} MB` }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.create')

  // Parse CSV
  const parseResult: CsvParseResult = parseCsvText(csvText)
  if (parseResult.globalErrors.length > 0) {
    return { success: false, error: parseResult.globalErrors.join('; ') }
  }

  // Build lookups and existing emails
  const { lookups, existingEmails, existingEmailToId } = await gatherImportContext(userId, org.id)

  // Resolve and validate
  resolveAndValidateRows(parseResult.rows, lookups, existingEmails)
  resolveManagerReferences(parseResult.rows, existingEmailToId)

  const rows = parseResult.rows.map((r) => ({
    rowIndex: r.rowIndex,
    firstName: r.resolved?.firstName ?? (r.raw.first_name ?? '').trim(),
    lastName: r.resolved?.lastName ?? (r.raw.last_name ?? '').trim(),
    workEmail: r.resolved?.workEmail ?? (r.raw.work_email ?? '').trim(),
    errors: r.errors,
    isValid: r.errors.length === 0 && r.resolved !== null,
  }))

  const validCount = rows.filter((r) => r.isValid).length
  const invalidCount = rows.filter((r) => !r.isValid).length

  return { success: true, rows, validCount, invalidCount }
}

// ─────────────────────────────────────────────
// Commit action
// ─────────────────────────────────────────────

export async function commitImportCsv(
  orgSlug: string,
  csvText: string
): Promise<ImportCommitResult> {
  // Re-validate from scratch (don't trust client state)
  if (new TextEncoder().encode(csvText).length > MAX_CSV_SIZE_BYTES) {
    return { success: false, error: 'CSV file exceeds maximum size' }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.create')

  const parseResult = parseCsvText(csvText)
  if (parseResult.globalErrors.length > 0) {
    return { success: false, error: parseResult.globalErrors.join('; ') }
  }

  const { lookups, existingEmails, existingEmailToId, existingReportingNodes } =
    await gatherImportContext(userId, org.id)

  resolveAndValidateRows(parseResult.rows, lookups, existingEmails)
  resolveManagerReferences(parseResult.rows, existingEmailToId)

  // Only import valid rows
  const validRows = parseResult.rows.filter((r) => r.errors.length === 0 && r.resolved !== null)

  if (validRows.length === 0) {
    return { success: false, error: 'No valid rows to import' }
  }

  // Phase 1: Create all employees without managerId
  let created = 0
  let failed = 0
  const failures: Array<{ rowIndex: number; workEmail: string; error: string }> = []
  const createdEmailToId = new Map<string, string>() // track newly created for manager resolution

  for (const row of validRows) {
    const resolved = row.resolved!
    // Strip managerId for phase 1
    const input = {
      firstName: resolved.firstName,
      lastName: resolved.lastName,
      workEmail: resolved.workEmail,
      personalEmail: resolved.personalEmail,
      phone: resolved.phone,
      dateOfBirth: resolved.dateOfBirth,
      gender: resolved.gender,
      nationalId: resolved.nationalId,
      address: resolved.address,
      startDate: resolved.startDate,
      departmentId: resolved.departmentId,
      jobTitleId: resolved.jobTitleId,
      locationId: resolved.locationId,
      employmentTypeId: resolved.employmentTypeId,
      managerId: undefined, // set in phase 2
      compensationAmountCents: resolved.compensationAmountCents,
      compensationCurrency: resolved.compensationCurrency,
      payType: resolved.payType,
      isWorkman: resolved.isWorkman,
      shiftTemplateId: resolved.shiftTemplateId,
      bankName: resolved.bankName,
      bankAccountNumber: resolved.bankAccountNumber,
    }

    const result = await createEmployeeCore({
      orgId: org.id,
      orgSlug,
      userId,
      input,
      skipEmailUniquenessCheck: true, // already validated
      skipManagerCheck: true, // manager set in phase 2
    })

    if (result.success && result.employeeId) {
      created++
      createdEmailToId.set(resolved.workEmail.toLowerCase(), result.employeeId)
    } else {
      failed++
      failures.push({
        rowIndex: row.rowIndex,
        workEmail: resolved.workEmail,
        error: result.error || Object.values(result.fieldErrors ?? {}).join(', '),
      })
    }
  }

  // Phase 2: Set managerId for employees who have manager references.
  // Cycle detection runs here — phase 1 creates rows without a manager, so a
  // batch of e.g. "A manages B" + "B manages A" cannot cycle at creation time,
  // but would form a real A→B→A reporting loop once both updates land. The
  // in-memory node map is seeded from the org's existing chain and updated as
  // each assignment is applied, so a cycle spanning existing + newly-created
  // employees is caught too, not just cycles within the batch itself.
  const nodeMap = new Map<string, string | null>()
  for (const node of existingReportingNodes) {
    nodeMap.set(node.id, node.managerId)
  }
  for (const id of createdEmailToId.values()) {
    nodeMap.set(id, null)
  }

  const managerWarnings: Array<{ rowIndex: number; workEmail: string; warning: string }> = []

  for (const row of validRows) {
    const resolved = row.resolved!
    if (!resolved.managerId) continue

    const employeeId = createdEmailToId.get(resolved.workEmail.toLowerCase())
    if (!employeeId) continue // was a failed creation

    let managerId: string | undefined

    if (resolved.managerId.startsWith('__batch__:')) {
      // Manager is in this batch
      const mgrEmail = resolved.managerId.replace('__batch__:', '')
      managerId = createdEmailToId.get(mgrEmail) ?? existingEmailToId.get(mgrEmail)
    } else {
      // Manager is an existing employee
      managerId = resolved.managerId
    }

    if (!managerId) continue

    const wouldCycle = wouldCreateCycleSync(
      employeeId,
      managerId,
      Array.from(nodeMap, ([id, mgrId]) => ({ id, managerId: mgrId }))
    )

    if (wouldCycle) {
      managerWarnings.push({
        rowIndex: row.rowIndex,
        workEmail: resolved.workEmail,
        warning: 'Manager assignment skipped — would create a circular reporting relationship',
      })
      continue
    }

    try {
      await dbAs(userId, async (tx) => {
        await tx.employee.update({
          where: { id: employeeId },
          data: { managerId },
        })
      })
      nodeMap.set(employeeId, managerId)
    } catch {
      // Non-fatal: employee was created, just manager link failed
      console.error(`[BulkImport] Failed to set manager for ${resolved.workEmail}`)
    }
  }

  revalidatePath(`/${orgSlug}/employees`)
  return { success: true, created, failed, failures, managerWarnings }
}
