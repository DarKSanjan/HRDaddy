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
import { getOrgContext, requirePermission } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { getNotificationAdapter } from '@/core/notifications'
import { getEmployeeIdForUser } from '@/core/employees'
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
    return tx.assetCategory.create({
      data: { orgId: org.id, name },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.category.created',
    targetType: 'asset_category',
    targetId: category.id,
    after: { name },
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
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.category.updated',
    targetType: 'asset_category',
    targetId: categoryId,
    before: { name: existing.name, isArchived: existing.isArchived },
    after: updateData,
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

  const { categoryId, name, assetTag, purchaseDate, purchaseValueCents, notes } = parsed.data

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
    return tx.asset.create({
      data: {
        orgId: org.id,
        categoryId,
        name,
        assetTag,
        status: 'AVAILABLE',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseValueCents: purchaseValueCents ?? null,
        notes: notes || null,
        updatedAt: new Date(),
      },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.created',
    targetType: 'asset',
    targetId: asset.id,
    after: { name, assetTag, categoryId },
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

  const { assetId, categoryId, name, assetTag, purchaseDate, purchaseValueCents, notes } = parsed.data

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

  await dbAs(userId, async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: updateData,
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.updated',
    targetType: 'asset',
    targetId: assetId,
    before: { name: existing.name, assetTag: existing.assetTag },
    after: updateData,
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Assign asset
// ─────────────────────────────────────────────

export async function assignAsset(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'asset.assign')

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
      select: { id: true, status: true, name: true, assetTag: true },
    })
  })
  if (!asset) return { success: false, error: 'Asset not found.' }

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

  // Create assignment and update asset in sequence (same dbAs call)
  const assignment = await dbAs(userId, async (tx) => {
    const created = await tx.assetAssignment.create({
      data: {
        orgId: org.id,
        assetId,
        employeeId,
        assignedById: assignerEmployeeId,
        conditionAtAssignment: conditionAtAssignment || null,
        notes: notes || null,
      },
    })
    await tx.asset.update({
      where: { id: assetId },
      data: { status: 'ASSIGNED', currentAssignmentId: created.id },
    })
    return created
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.assigned',
    targetType: 'asset',
    targetId: assetId,
    after: { employeeId, assignmentId: assignment.id, assetName: asset.name },
  })

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
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.returned',
    targetType: 'asset',
    targetId: assetId,
    before: { status: 'ASSIGNED' },
    after: { status: newStatus, returnToMaintenance: !!returnToMaintenance },
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
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.maintenance',
    targetType: 'asset',
    targetId: assetId,
    before: { status: 'AVAILABLE' },
    after: { status: 'IN_MAINTENANCE' },
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
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.available',
    targetType: 'asset',
    targetId: assetId,
    before: { status: 'IN_MAINTENANCE' },
    after: { status: 'AVAILABLE' },
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
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.retired',
    targetType: 'asset',
    targetId: assetId,
    before: { status: asset.status },
    after: { status: 'RETIRED' },
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
    })
  } else {
    await dbAs(userId, async (tx) => {
      await tx.asset.update({
        where: { id: assetId },
        data: { status: 'LOST', notes: notes || undefined },
      })
    })
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'asset.lost',
    targetType: 'asset',
    targetId: assetId,
    before: { status: asset.status },
    after: { status: 'LOST' },
  })

  revalidatePath(`/${orgSlug}/assets`)
  return { success: true }
}
