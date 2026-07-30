'use server'

import '@/modules/register'

import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import {
  parseCsvText,
  resolveAndValidateRows,
  MAX_CSV_SIZE_BYTES,
  type HolidayCsvParseResult,
} from './import-csv'

export interface HolidayImportValidationResult {
  success: boolean
  error?: string
  rows?: Array<{
    rowIndex: number
    date: string
    name: string
    errors: string[]
    isValid: boolean
  }>
  validCount?: number
  invalidCount?: number
}

export interface HolidayImportCommitResult {
  success: boolean
  error?: string
  created?: number
  failed?: number
  failures?: Array<{ rowIndex: number; date: string; error: string }>
}

async function getExistingHolidayKeys(userId: string, orgId: string): Promise<Set<string>> {
  const holidays = await dbAs(userId, async (tx) => {
    return tx.holiday.findMany({
      where: { orgId },
      select: { date: true, name: true },
    })
  })
  return new Set(
    holidays.map((h: { date: Date; name: string }) => {
      const d = new Date(h.date)
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      return `${dateStr}|${h.name.toLowerCase()}`
    })
  )
}

export async function validateHolidayImportCsv(
  orgSlug: string,
  csvText: string
): Promise<HolidayImportValidationResult> {
  if (new TextEncoder().encode(csvText).length > MAX_CSV_SIZE_BYTES) {
    return { success: false, error: `CSV file exceeds maximum size of ${MAX_CSV_SIZE_BYTES / 1024 / 1024} MB` }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'calendar.holiday.manage')

  const parseResult: HolidayCsvParseResult = parseCsvText(csvText)
  if (parseResult.globalErrors.length > 0) {
    return { success: false, error: parseResult.globalErrors.join('; ') }
  }

  const existingKeys = await getExistingHolidayKeys(userId, org.id)
  resolveAndValidateRows(parseResult.rows, existingKeys)

  const rows = parseResult.rows.map((r) => ({
    rowIndex: r.rowIndex,
    date: r.resolved?.date ?? (r.raw.date ?? '').trim(),
    name: r.resolved?.name ?? (r.raw.name ?? '').trim(),
    errors: r.errors,
    isValid: r.errors.length === 0 && r.resolved !== null,
  }))

  const validCount = rows.filter((r) => r.isValid).length
  const invalidCount = rows.filter((r) => !r.isValid).length

  return { success: true, rows, validCount, invalidCount }
}

export async function commitHolidayImportCsv(
  orgSlug: string,
  csvText: string
): Promise<HolidayImportCommitResult> {
  if (new TextEncoder().encode(csvText).length > MAX_CSV_SIZE_BYTES) {
    return { success: false, error: 'CSV file exceeds maximum size' }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'calendar.holiday.manage')

  const parseResult = parseCsvText(csvText)
  if (parseResult.globalErrors.length > 0) {
    return { success: false, error: parseResult.globalErrors.join('; ') }
  }

  const existingKeys = await getExistingHolidayKeys(userId, org.id)
  resolveAndValidateRows(parseResult.rows, existingKeys)

  const validRows = parseResult.rows.filter((r) => r.errors.length === 0 && r.resolved !== null)

  if (validRows.length === 0) {
    return { success: false, error: 'No valid rows to import' }
  }

  let created = 0
  let failed = 0
  const failures: Array<{ rowIndex: number; date: string; error: string }> = []

  for (const row of validRows) {
    const resolved = row.resolved!
    try {
      const [y, m, d] = resolved.date.split('-').map(Number)
      await dbAs(userId, async (tx) => {
        await tx.holiday.create({
          data: {
            orgId: org.id,
            date: new Date(Date.UTC(y, m - 1, d)),
            name: resolved.name,
          },
        })
      })
      created++
    } catch (err) {
      failed++
      failures.push({
        rowIndex: row.rowIndex,
        date: resolved.date,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  if (created > 0) {
    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'holiday.bulk_imported',
      targetType: 'holiday',
      targetId: org.id,
      after: { count: created },
    })
  }

  revalidatePath(`/${orgSlug}/calendar`)
  return { success: true, created, failed, failures }
}
