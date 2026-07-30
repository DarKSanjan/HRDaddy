'use server'

import '@/modules/register'

/**
 * Asset CSV bulk import server actions.
 *
 * Two-phase approach:
 *   1. `validateAssetImportCsv` — parses, resolves lookups, returns row-level errors.
 *   2. `commitAssetImportCsv`  — re-validates then creates assets.
 *
 * CRITICAL: No Promise.all of multiple dbAs() calls. Batch lookups into single
 * queries rather than N+1. This codebase has hit concurrent-transaction
 * connection contention bugs twice already — do not reintroduce.
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission, retryOnce } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import {
  parseCsvText,
  resolveAndValidateRows,
  MAX_CSV_SIZE_BYTES,
  type AssetLookupMaps,
  type AssetCsvParseResult,
} from './import-csv'
import { listActiveAssetCategories } from './queries'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AssetImportValidationResult {
  success: boolean
  error?: string
  rows?: Array<{
    rowIndex: number
    name: string
    assetTag: string
    errors: string[]
    isValid: boolean
  }>
  validCount?: number
  invalidCount?: number
}

export interface AssetImportCommitResult {
  success: boolean
  error?: string
  created?: number
  failed?: number
  failures?: Array<{ rowIndex: number; assetTag: string; error: string }>
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Sequential calls only — no Promise.all.
 * Each query uses a single dbAs() call; running them concurrently risks
 * the exact connection-pool exhaustion bug documented in the employee importer.
 */
async function buildAssetLookupMaps(userId: string, orgId: string): Promise<AssetLookupMaps> {
  const categories = await listActiveAssetCategories(userId, orgId)
  return {
    categories: new Map(categories.map((c) => [c.name.toLowerCase(), c.id])),
  }
}

async function getExistingAssetTags(userId: string, orgId: string): Promise<Set<string>> {
  const assets = await dbAs(userId, async (tx) => {
    return tx.asset.findMany({
      where: { orgId },
      select: { assetTag: true },
    })
  })
  return new Set(assets.map((a) => a.assetTag.toLowerCase()))
}

interface AssetImportContext {
  lookups: AssetLookupMaps
  existingAssetTags: Set<string>
}

async function gatherAssetImportContext(userId: string, orgId: string): Promise<AssetImportContext> {
  return retryOnce(
    async () => {
      const lookups = await buildAssetLookupMaps(userId, orgId)
      const existingAssetTags = await getExistingAssetTags(userId, orgId)
      return { lookups, existingAssetTags }
    },
    () => false
  )
}

// ─────────────────────────────────────────────
// Validate action
// ─────────────────────────────────────────────

export async function validateAssetImportCsv(
  orgSlug: string,
  csvText: string
): Promise<AssetImportValidationResult> {
  if (new TextEncoder().encode(csvText).length > MAX_CSV_SIZE_BYTES) {
    return { success: false, error: `CSV file exceeds maximum size of ${MAX_CSV_SIZE_BYTES / 1024 / 1024} MB` }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parseResult: AssetCsvParseResult = parseCsvText(csvText)
  if (parseResult.globalErrors.length > 0) {
    return { success: false, error: parseResult.globalErrors.join('; ') }
  }

  const { lookups, existingAssetTags } = await gatherAssetImportContext(userId, org.id)
  resolveAndValidateRows(parseResult.rows, lookups, existingAssetTags)

  const rows = parseResult.rows.map((r) => ({
    rowIndex: r.rowIndex,
    name: r.resolved?.name ?? (r.raw.name ?? '').trim(),
    assetTag: r.resolved?.assetTag ?? (r.raw.asset_tag ?? '').trim(),
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

export async function commitAssetImportCsv(
  orgSlug: string,
  csvText: string
): Promise<AssetImportCommitResult> {
  // Re-validate from scratch — don't trust client state
  if (new TextEncoder().encode(csvText).length > MAX_CSV_SIZE_BYTES) {
    return { success: false, error: 'CSV file exceeds maximum size' }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parseResult = parseCsvText(csvText)
  if (parseResult.globalErrors.length > 0) {
    return { success: false, error: parseResult.globalErrors.join('; ') }
  }

  const { lookups, existingAssetTags } = await gatherAssetImportContext(userId, org.id)
  resolveAndValidateRows(parseResult.rows, lookups, existingAssetTags)

  const validRows = parseResult.rows.filter((r) => r.errors.length === 0 && r.resolved !== null)

  if (validRows.length === 0) {
    return { success: false, error: 'No valid rows to import' }
  }

  // Create assets sequentially — no Promise.all
  let created = 0
  let failed = 0
  const failures: Array<{ rowIndex: number; assetTag: string; error: string }> = []

  for (const row of validRows) {
    const resolved = row.resolved!
    try {
      await dbAs(userId, async (tx) => {
        await tx.asset.create({
          data: {
            orgId: org.id,
            categoryId: resolved.categoryId,
            name: resolved.name,
            assetTag: resolved.assetTag,
            status: 'AVAILABLE',
            purchaseDate: resolved.purchaseDate ? new Date(resolved.purchaseDate) : null,
            purchaseValueCents: resolved.purchaseValueCents,
            notes: resolved.notes,
            updatedAt: new Date(),
          },
        })
      })
      created++
    } catch (err) {
      failed++
      failures.push({
        rowIndex: row.rowIndex,
        assetTag: resolved.assetTag,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  if (created > 0) {
    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.bulk_imported',
      targetType: 'asset',
      targetId: org.id,
      after: { count: created },
    })
  }

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true, created, failed, failures }
}
