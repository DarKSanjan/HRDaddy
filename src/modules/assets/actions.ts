'use server'

import '@/modules/register'

/**
 * Assets module server actions.
 * Every mutation:
 *   1. Resolves org from slug
 *   2. Checks permission
 *   3. Validates input with Zod
 *   4. Performs mutation via dbAs (RLS-scoped)
 *   5. Writes audit entry
 *   6. Revalidates cache
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission, verifySession } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { Prisma } from '@prisma/client'
import { getNotificationAdapter } from '@/core/notifications'
import { getEmployeeIdForUser } from '@/core/employees'
import { hasPermission } from '@/core/permissions'
import { listAvailableAssetsByCategory, isInAssetAssignChain } from './queries'
import {
  createAssetCategorySchema,
  updateAssetCategorySchema,
  createAssetSchema,
  updateAssetSchema,
  assignAssetSchema,
  returnAssetSchema,
  markAssetMaintenanceSchema,
  markAssetAvailableSchema,
  retireAssetSchema,
  reportAssetLostSchema,
  requestAssetSchema,
  cancelAssetRequestSchema,
  approveAssetRequestSchema,
  rejectAssetRequestSchema,
  fulfillAssetRequestSchema,
} from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  data?: unknown
}

// ─────────────────────────────────────────────
// Asset status state machine
// ─────────────────────────────────────────────
// AVAILABLE → ASSIGNED (via assignAsset)
// AVAILABLE → IN_MAINTENANCE (via markAssetInMaintenance)
// AVAILABLE → RETIRED (via retireAsset)
// AVAILABLE → LOST (via reportAssetLost)
// ASSIGNED → AVAILABLE (via returnAsset)
// ASSIGNED → IN_MAINTENANCE (via returnAsset with returnToMaintenance)
// ASSIGNED → LOST (via reportAssetLost — closes open assignment)
// IN_MAINTENANCE → AVAILABLE (via markAssetAvailable)
// IN_MAINTENANCE → RETIRED (via retireAsset)
// IN_MAINTENANCE → LOST (via reportAssetLost)
// RETIRED → terminal (no transitions out)
// LOST → terminal (no transitions out)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Category actions
// ─────────────────────────────────────────────

export async function createAssetCategory(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parsed = createAssetCategorySchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { name } = parsed.data

  const category = await dbAs(userId, async (tx) => {
    const createdCategory = await tx.assetCategory.create({
      data: { orgId: org.id, name },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.category.created',
      targetType: 'asset_category',
      targetId: createdCategory.id,
      after: { name },
    }, tx)

    return createdCategory
  })

  revalidatePath(`/${orgSlug}/settings/assets`)
  return { success: true, data: { id: category.id } }
}

export async function updateAssetCategory(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parsed = updateAssetCategorySchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { categoryId, name, isArchived } = parsed.data

  const existing = await dbAs(userId, async (tx) => {
    return tx.assetCategory.findFirst({
      where: { id: categoryId, orgId: org.id },
    })
  })

  if (!existing) return { success: false, error: 'Category not found' }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (isArchived !== undefined) updateData.isArchived = isArchived

  await dbAs(userId, async (tx) => {
    await tx.assetCategory.update({
      where: { id: categoryId },
      data: updateData,
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.category.updated',
      targetType: 'asset_category',
      targetId: categoryId,
      before: { name: existing.name, isArchived: existing.isArchived },
      after: updateData,
    }, tx)
  })

  revalidatePath(`/${orgSlug}/settings/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Asset CRUD actions
// ─────────────────────────────────────────────

export async function createAsset(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parsed = createAssetSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { categoryId, name, assetTag, purchaseDate, purchaseValueCents, notes, personInChargeId } = parsed.data

  // Validate category exists and is not archived
  const category = await dbAs(userId, async (tx) => {
    return tx.assetCategory.findFirst({
      where: { id: categoryId, orgId: org.id, isArchived: false },
      select: { id: true },
    })
  })
  if (!category) {
    return { success: false, error: 'Asset category not found or is archived.' }
  }

  // Check asset tag uniqueness within org
  const existingTag = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { orgId: org.id, assetTag },
      select: { id: true },
    })
  })
  if (existingTag) {
    return { success: false, fieldErrors: { assetTag: 'This asset tag is already in use.' } }
  }

  const asset = await dbAs(userId, async (tx) => {
    const createdAsset = await tx.asset.create({
      data: {
        orgId: org.id,
        categoryId,
        name,
        assetTag,
        status: 'AVAILABLE',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseValueCents: purchaseValueCents ?? null,
        notes: notes || null,
        personInChargeId: personInChargeId || null,
        updatedAt: new Date(),
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.created',
      targetType: 'asset',
      targetId: createdAsset.id,
      after: { name, assetTag, categoryId },
    }, tx)

    return createdAsset
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true, data: { id: asset.id } }
}

export async function updateAsset(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parsed = updateAssetSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { assetId, categoryId, name, assetTag, purchaseDate, purchaseValueCents, notes, personInChargeId } = parsed.data

  const existing = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
    })
  })
  if (!existing) return { success: false, error: 'Asset not found.' }

  // Validate category if changed
  if (categoryId) {
    const category = await dbAs(userId, async (tx) => {
      return tx.assetCategory.findFirst({
        where: { id: categoryId, orgId: org.id, isArchived: false },
        select: { id: true },
      })
    })
    if (!category) {
      return { success: false, error: 'Asset category not found or is archived.' }
    }
  }

  // Check tag uniqueness if changed
  if (assetTag && assetTag !== existing.assetTag) {
    const existingTag = await dbAs(userId, async (tx) => {
      return tx.asset.findFirst({
        where: { orgId: org.id, assetTag, id: { not: assetId } },
        select: { id: true },
      })
    })
    if (existingTag) {
      return { success: false, fieldErrors: { assetTag: 'This asset tag is already in use.' } }
    }
  }

  const updateData: Record<string, unknown> = {}
  if (categoryId !== undefined) updateData.categoryId = categoryId
  if (name !== undefined) updateData.name = name
  if (assetTag !== undefined) updateData.assetTag = assetTag
  if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null
  if (purchaseValueCents !== undefined) updateData.purchaseValueCents = purchaseValueCents
  if (notes !== undefined) updateData.notes = notes
  if (personInChargeId !== undefined) updateData.personInChargeId = personInChargeId || null

  await dbAs(userId, async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: updateData,
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.updated',
      targetType: 'asset',
      targetId: assetId,
      before: { name: existing.name, assetTag: existing.assetTag },
      after: updateData,
    }, tx)
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Assign asset
// ─────────────────────────────────────────────

/**
 * Core assignment write — creates the AssetAssignment row and flips the
 * Asset to ASSIGNED. Shared by assignAsset() and fulfillAssetRequest() so
 * assignment history stays consistent regardless of entry point. Callers are
 * responsible for their own pre-checks (AVAILABLE status, no open assignment,
 * employee/asset existence) before calling this.
 */
async function performAssetAssignment(
  userId: string,
  params: {
    orgId: string
    assetId: string
    employeeId: string
    assignedById: string
    conditionAtAssignment?: string | null
    notes?: string | null
  },
  onComplete?: (tx: Prisma.TransactionClient, created: { id: string }) => Promise<void>
): Promise<{ id: string }> {
  return dbAs(userId, async (tx) => {
    const created = await tx.assetAssignment.create({
      data: {
        orgId: params.orgId,
        assetId: params.assetId,
        employeeId: params.employeeId,
        assignedById: params.assignedById,
        conditionAtAssignment: params.conditionAtAssignment || null,
        notes: params.notes || null,
      },
    })
    await tx.asset.update({
      where: { id: params.assetId },
      data: { status: 'ASSIGNED', currentAssignmentId: created.id },
    })

    if (onComplete) await onComplete(tx, created)
    return created
  })
}

export async function assignAsset(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  const session = await verifySession()
  const userId = session.userId

  const parsed = assignAssetSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { assetId, employeeId, conditionAtAssignment, notes } = parsed.data

  const assignerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!assignerEmployeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const asset = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
      select: { id: true, status: true, name: true, assetTag: true, personInChargeId: true },
    })
  })
  if (!asset) return { success: false, error: 'Asset not found.' }

  const hasRolePermission = hasPermission(membership.role, enabledModules, 'asset.assign')
  if (!hasRolePermission) {
    if (!asset.personInChargeId) {
      return { success: false, error: 'You do not have permission to assign this asset.' }
    }
    const inChain = await isInAssetAssignChain(userId, org.id, asset.personInChargeId, assignerEmployeeId)
    if (!inChain) {
      return { success: false, error: 'You do not have permission to assign this asset.' }
    }
  }

  if (asset.status !== 'AVAILABLE') {
    return { success: false, error: `Cannot assign asset — current status is ${asset.status}. Only AVAILABLE assets can be assigned.` }
  }

  // Verify no open assignment already exists (defensive — status should be AVAILABLE)
  const openAssignment = await dbAs(userId, async (tx) => {
    return tx.assetAssignment.findFirst({
      where: { assetId, orgId: org.id, returnedAt: null },
      select: { id: true },
    })
  })
  if (openAssignment) {
    return { success: false, error: 'Asset already has an open assignment. Return it first.' }
  }

  // Validate employee exists
  const employee = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { id: employeeId, orgId: org.id },
      select: { id: true, firstName: true, lastName: true, userId: true },
    })
  })
  if (!employee) return { success: false, error: 'Employee not found.' }

  const assignment = await performAssetAssignment(userId, {
    orgId: org.id,
    assetId,
    employeeId,
    assignedById: assignerEmployeeId,
    conditionAtAssignment,
    notes,
  }, async (tx, createdAssignment) => writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.assigned',
    targetType: 'asset',
    targetId: assetId,
    after: { employeeId, assignmentId: createdAssignment.id, assetName: asset.name },
  }, tx))

  // Notify the assignee
  if (employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: employee.userId,
      title: 'Asset assigned to you',
      message: `${asset.name} (${asset.assetTag}) has been assigned to you.`,
      link: `/${orgSlug}/assets`,
    })
  }

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true, data: { assignmentId: assignment.id } }
}

// ─────────────────────────────────────────────
// Return asset
// ─────────────────────────────────────────────

export async function returnAsset(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.assign')

  const parsed = returnAssetSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { assetId, conditionAtReturn, notes, returnToMaintenance } = parsed.data

  const returnerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!returnerEmployeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const asset = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
      select: { id: true, status: true, name: true, currentAssignmentId: true },
    })
  })
  if (!asset) return { success: false, error: 'Asset not found.' }

  if (asset.status !== 'ASSIGNED') {
    return { success: false, error: `Cannot return asset — current status is ${asset.status}. Only ASSIGNED assets can be returned.` }
  }

  // Find the open assignment
  const openAssignment = await dbAs(userId, async (tx) => {
    return tx.assetAssignment.findFirst({
      where: { assetId, orgId: org.id, returnedAt: null },
      select: { id: true },
    })
  })
  if (!openAssignment) {
    return { success: false, error: 'No open assignment found for this asset.' }
  }

  const newStatus = returnToMaintenance ? 'IN_MAINTENANCE' : 'AVAILABLE'

  await dbAs(userId, async (tx) => {
    await tx.assetAssignment.update({
      where: { id: openAssignment.id },
      data: {
        returnedAt: new Date(),
        returnedById: returnerEmployeeId,
        conditionAtReturn: conditionAtReturn || null,
        notes: notes || null,
      },
    })
    await tx.asset.update({
      where: { id: assetId },
      data: { status: newStatus, currentAssignmentId: null },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.returned',
      targetType: 'asset',
      targetId: assetId,
      before: { status: 'ASSIGNED' },
      after: { status: newStatus, returnToMaintenance: !!returnToMaintenance },
    }, tx)
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Mark asset in maintenance
// ─────────────────────────────────────────────

export async function markAssetInMaintenance(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.assign')

  const parsed = markAssetMaintenanceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { assetId, notes } = parsed.data

  const asset = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
      select: { id: true, status: true },
    })
  })
  if (!asset) return { success: false, error: 'Asset not found.' }

  if (asset.status !== 'AVAILABLE') {
    return { success: false, error: `Cannot mark as in maintenance — current status is ${asset.status}. Only AVAILABLE assets can be moved to maintenance.` }
  }

  await dbAs(userId, async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: { status: 'IN_MAINTENANCE', notes: notes || undefined },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.maintenance',
      targetType: 'asset',
      targetId: assetId,
      before: { status: 'AVAILABLE' },
      after: { status: 'IN_MAINTENANCE' },
    }, tx)
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Mark asset available (from maintenance)
// ─────────────────────────────────────────────

export async function markAssetAvailable(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.assign')

  const parsed = markAssetAvailableSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { assetId, notes } = parsed.data

  const asset = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
      select: { id: true, status: true },
    })
  })
  if (!asset) return { success: false, error: 'Asset not found.' }

  if (asset.status !== 'IN_MAINTENANCE') {
    return { success: false, error: `Cannot mark as available — current status is ${asset.status}. Only IN_MAINTENANCE assets can be marked available.` }
  }

  await dbAs(userId, async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: { status: 'AVAILABLE', notes: notes || undefined },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.available',
      targetType: 'asset',
      targetId: assetId,
      before: { status: 'IN_MAINTENANCE' },
      after: { status: 'AVAILABLE' },
    }, tx)
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Retire asset
// ─────────────────────────────────────────────

export async function retireAsset(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parsed = retireAssetSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { assetId, notes } = parsed.data

  const asset = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
      select: { id: true, status: true },
    })
  })
  if (!asset) return { success: false, error: 'Asset not found.' }

  // Cannot retire an ASSIGNED asset — must return it first
  if (asset.status === 'ASSIGNED') {
    return { success: false, error: 'Cannot retire an assigned asset. Return it first.' }
  }
  // Can only retire from AVAILABLE or IN_MAINTENANCE
  if (asset.status !== 'AVAILABLE' && asset.status !== 'IN_MAINTENANCE') {
    return { success: false, error: `Cannot retire asset — current status is ${asset.status}.` }
  }

  await dbAs(userId, async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: { status: 'RETIRED', notes: notes || undefined },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.retired',
      targetType: 'asset',
      targetId: assetId,
      before: { status: asset.status },
      after: { status: 'RETIRED' },
    }, tx)
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Report asset lost
// ─────────────────────────────────────────────

export async function reportAssetLost(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.manage')

  const parsed = reportAssetLostSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { assetId, notes } = parsed.data

  const returnerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!returnerEmployeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const asset = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
      select: { id: true, status: true },
    })
  })
  if (!asset) return { success: false, error: 'Asset not found.' }

  // Cannot report lost if already terminal
  if (asset.status === 'RETIRED' || asset.status === 'LOST') {
    return { success: false, error: `Cannot report asset as lost — current status is ${asset.status}.` }
  }

  // If currently assigned, close the open assignment
  if (asset.status === 'ASSIGNED') {
    await dbAs(userId, async (tx) => {
      const openAssignment = await tx.assetAssignment.findFirst({
        where: { assetId, orgId: org.id, returnedAt: null },
        select: { id: true },
      })
      if (openAssignment) {
        await tx.assetAssignment.update({
          where: { id: openAssignment.id },
          data: {
            returnedAt: new Date(),
            returnedById: returnerEmployeeId,
            conditionAtReturn: 'LOST',
            notes: notes || null,
          },
        })
      }
      await tx.asset.update({
        where: { id: assetId },
        data: { status: 'LOST', currentAssignmentId: null, notes: notes || undefined },
      })

      await writeAudit({
        orgId: org.id,
        actorId: userId,
        action: 'asset.lost',
        targetType: 'asset',
        targetId: assetId,
        before: { status: asset.status },
        after: { status: 'LOST' },
      }, tx)
    })
  } else {
    await dbAs(userId, async (tx) => {
      await tx.asset.update({
        where: { id: assetId },
        data: { status: 'LOST', notes: notes || undefined },
      })

      await writeAudit({
        orgId: org.id,
        actorId: userId,
        action: 'asset.lost',
        targetType: 'asset',
        targetId: assetId,
        before: { status: asset.status },
        after: { status: 'LOST' },
      }, tx)
    })
  }

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Asset request actions
// ─────────────────────────────────────────────

export async function requestAsset(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.request')

  const parsed = requestAssetSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { categoryId, requestedAssetId, reason } = parsed.data

  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  // Validate category exists and is active
  const category = await dbAs(userId, async (tx) => {
    return tx.assetCategory.findFirst({
      where: { id: categoryId, orgId: org.id, isArchived: false },
      select: { id: true },
    })
  })
  if (!category) {
    return { success: false, error: 'Asset category not found or is archived.' }
  }

  // If a specific asset is requested, validate it exists, is in the right category, and is AVAILABLE
  if (requestedAssetId) {
    const asset = await dbAs(userId, async (tx) => {
      return tx.asset.findFirst({
        where: { id: requestedAssetId, orgId: org.id },
        select: { id: true, status: true, categoryId: true },
      })
    })
    if (!asset) {
      return { success: false, error: 'Requested asset not found.' }
    }
    if (asset.categoryId !== categoryId) {
      return { success: false, error: 'Requested asset does not belong to the selected category.' }
    }
    if (asset.status !== 'AVAILABLE') {
      return { success: false, error: 'Requested asset is not currently available.' }
    }
  }

  const request = await dbAs(userId, async (tx) => {
    const createdRequest = await tx.assetRequest.create({
      data: {
        orgId: org.id,
        employeeId,
        categoryId,
        requestedAssetId: requestedAssetId || null,
        reason,
        status: 'PENDING',
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.request.created',
      targetType: 'asset_request',
      targetId: createdRequest.id,
      after: { categoryId, requestedAssetId, reason },
    }, tx)

    return createdRequest
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true, data: { id: request.id } }
}

export async function cancelAssetRequest(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const session = await verifySession()
  const userId = session.userId

  const parsed = cancelAssetRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { requestId } = parsed.data

  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const request = await dbAs(userId, async (tx) => {
    return tx.assetRequest.findFirst({
      where: { id: requestId, orgId: org.id },
      select: { id: true, employeeId: true, status: true },
    })
  })

  if (!request) {
    return { success: false, error: 'Asset request not found.' }
  }

  if (request.employeeId !== employeeId) {
    return { success: false, error: 'You can only cancel your own requests.' }
  }

  if (request.status !== 'PENDING') {
    return { success: false, error: 'Cannot cancel a request that is no longer pending.' }
  }

  await dbAs(userId, async (tx) => {
    await tx.assetRequest.delete({
      where: { id: requestId },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.request.cancelled',
      targetType: 'asset_request',
      targetId: requestId,
      before: { status: 'PENDING' },
      after: { status: 'CANCELLED' },
    }, tx)
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

export async function approveAssetRequest(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.assign')

  const parsed = approveAssetRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { requestId, reviewNote } = parsed.data

  const reviewerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!reviewerEmployeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const request = await dbAs(userId, async (tx) => {
    return tx.assetRequest.findFirst({
      where: { id: requestId, orgId: org.id },
      include: {
        employee: { select: { userId: true, firstName: true, lastName: true } },
      },
    })
  })

  if (!request) {
    return { success: false, error: 'Asset request not found.' }
  }

  if (request.status !== 'PENDING') {
    return { success: false, error: 'Only pending requests can be approved.' }
  }

  await dbAs(userId, async (tx) => {
    await tx.assetRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerEmployeeId,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.request.approved',
      targetType: 'asset_request',
      targetId: requestId,
      before: { status: 'PENDING' },
      after: { status: 'APPROVED', reviewNote },
    }, tx)
  })

  // Notify the requester
  if (request.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: request.employee.userId,
      title: 'Asset request approved',
      message: `Your asset request has been approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
      link: `/${orgSlug}/assets`,
    })
  }

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

export async function rejectAssetRequest(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.assign')

  const parsed = rejectAssetRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Rejection reason is required.' }
  }

  const { requestId, reviewNote } = parsed.data

  const reviewerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!reviewerEmployeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const request = await dbAs(userId, async (tx) => {
    return tx.assetRequest.findFirst({
      where: { id: requestId, orgId: org.id },
      include: {
        employee: { select: { userId: true, firstName: true, lastName: true } },
      },
    })
  })

  if (!request) {
    return { success: false, error: 'Asset request not found.' }
  }

  if (request.status !== 'PENDING') {
    return { success: false, error: 'Only pending requests can be rejected.' }
  }

  await dbAs(userId, async (tx) => {
    await tx.assetRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerEmployeeId,
        reviewedAt: new Date(),
        reviewNote: reviewNote,
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.request.rejected',
      targetType: 'asset_request',
      targetId: requestId,
      before: { status: 'PENDING' },
      after: { status: 'REJECTED', reviewNote },
    }, tx)
  })

  // Notify the requester
  if (request.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: request.employee.userId,
      title: 'Asset request rejected',
      message: `Your asset request was rejected. Reason: ${reviewNote}`,
      link: `/${orgSlug}/assets`,
    })
  }

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

export async function fulfillAssetRequest(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  const session = await verifySession()
  const userId = session.userId

  const parsed = fulfillAssetRequestSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { requestId, assetId } = parsed.data

  const assignerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!assignerEmployeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const request = await dbAs(userId, async (tx) => {
    return tx.assetRequest.findFirst({
      where: { id: requestId, orgId: org.id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
        category: { select: { id: true } },
      },
    })
  })

  if (!request) {
    return { success: false, error: 'Asset request not found.' }
  }

  if (request.status !== 'APPROVED') {
    return { success: false, error: 'Only approved requests can be fulfilled.' }
  }

  // Validate the asset
  const asset = await dbAs(userId, async (tx) => {
    return tx.asset.findFirst({
      where: { id: assetId, orgId: org.id },
      select: { id: true, status: true, categoryId: true, name: true, assetTag: true, personInChargeId: true },
    })
  })

  if (!asset) {
    return { success: false, error: 'Asset not found.' }
  }

  const hasRolePermission = hasPermission(membership.role, enabledModules, 'asset.assign')
  if (!hasRolePermission) {
    if (!asset.personInChargeId) {
      return { success: false, error: 'You do not have permission to assign this asset.' }
    }
    const inChain = await isInAssetAssignChain(userId, org.id, asset.personInChargeId, assignerEmployeeId)
    if (!inChain) {
      return { success: false, error: 'You do not have permission to assign this asset.' }
    }
  }

  if (asset.status !== 'AVAILABLE') {
    return { success: false, error: `Cannot fulfill with this asset — it is currently ${asset.status}. Only AVAILABLE assets can be assigned.` }
  }

  if (asset.categoryId !== request.category.id) {
    return { success: false, error: 'Asset does not belong to the requested category.' }
  }

  // Verify no open assignment already exists (defensive — status should be AVAILABLE)
  const openAssignment = await dbAs(userId, async (tx) => {
    return tx.assetAssignment.findFirst({
      where: { assetId, orgId: org.id, returnedAt: null },
      select: { id: true },
    })
  })
  if (openAssignment) {
    return { success: false, error: 'Asset already has an open assignment. Return it first.' }
  }

  // Perform the actual assignment (shared with assignAsset, so assignment history stays consistent)
  const assignment = await performAssetAssignment(userId, {
    orgId: org.id,
    assetId,
    employeeId: request.employeeId,
    assignedById: assignerEmployeeId,
    conditionAtAssignment: null,
    notes: `Fulfilled from asset request ${requestId}`,
  }, async (tx, createdAssignment) => {
    await tx.assetRequest.update({
      where: { id: requestId },
      data: {
        status: 'FULFILLED',
        fulfilledAssetId: assetId,
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'asset.request.fulfilled',
      targetType: 'asset_request',
      targetId: requestId,
      after: { assetId, assignmentId: createdAssignment.id, employeeId: request.employeeId },
    }, tx)
  })

  // Notify the requester
  if (request.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: request.employee.userId,
      title: 'Asset request fulfilled',
      message: `${asset.name} (${asset.assetTag}) has been assigned to you.`,
      link: `/${orgSlug}/assets`,
    })
  }

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true, data: { assignmentId: assignment.id } }
}

/**
 * List AVAILABLE assets in a category, for the "pick a specific asset"
 * dropdown in the request-asset dialog. Same permission as requesting itself.
 */
export async function getAvailableAssetsInCategory(
  orgSlug: string,
  categoryId: string
): Promise<{ id: string; name: string; assetTag: string }[]> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.request')
  return listAvailableAssetsByCategory(userId, org.id, categoryId)
}
