/**
 * Assets module queries — data fetching with role-scoped access.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { AssetStatus } from '@prisma/client'
import type { AssetListParams } from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AssetCategoryItem {
  id: string
  name: string
  isArchived: boolean
  createdAt: Date
  _count: { assets: number }
}

export interface AssetListItem {
  id: string
  name: string
  assetTag: string
  status: AssetStatus
  categoryId: string
  categoryName: string
  currentHolder: { id: string; firstName: string; lastName: string } | null
  purchaseDate: Date | null
  purchaseValueCents: number | null
  createdAt: Date
}

export interface AssetDetail {
  id: string
  name: string
  assetTag: string
  status: AssetStatus
  categoryId: string
  categoryName: string
  purchaseDate: Date | null
  purchaseValueCents: number | null
  notes: string | null
  currentAssignmentId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AssetAssignmentItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  assignedAt: Date
  assignedByFirstName: string
  assignedByLastName: string
  returnedAt: Date | null
  returnedByFirstName: string | null
  returnedByLastName: string | null
  conditionAtAssignment: string | null
  conditionAtReturn: string | null
  notes: string | null
}

export interface MyAssetItem {
  id: string
  assetId: string
  assetName: string
  assetTag: string
  categoryName: string
  assignedAt: Date
}

// ─────────────────────────────────────────────
// Category queries
// ─────────────────────────────────────────────

/**
 * List asset categories for an organisation.
 */
export async function listAssetCategories(
  userId: string,
  orgId: string
): Promise<AssetCategoryItem[]> {
  return dbAs(userId, async (tx) => {
    const categories = await tx.assetCategory.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true } } },
    })
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      isArchived: c.isArchived,
      createdAt: c.createdAt,
      _count: { assets: c._count.assets },
    }))
  })
}

/**
 * List active (non-archived) asset categories.
 */
export async function listActiveAssetCategories(
  userId: string,
  orgId: string
): Promise<{ id: string; name: string }[]> {
  return dbAs(userId, async (tx) => {
    return tx.assetCategory.findMany({
      where: { orgId, isArchived: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
  })
}

// ─────────────────────────────────────────────
// Asset queries
// ─────────────────────────────────────────────

/**
 * List assets for admin register view.
 */
export async function listAssets(
  userId: string,
  orgId: string,
  params: AssetListParams
): Promise<{ assets: AssetListItem[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' as const } },
              { assetTag: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const assets = await tx.asset.findMany({
      where,
      include: {
        category: { select: { name: true } },
        currentAssignment: {
          select: {
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    })
    const total = await tx.asset.count({ where })

    return {
      assets: assets.map((a) => ({
        id: a.id,
        name: a.name,
        assetTag: a.assetTag,
        status: a.status,
        categoryId: a.categoryId,
        categoryName: a.category.name,
        currentHolder: a.currentAssignment?.employee
          ? {
              id: a.currentAssignment.employee.id,
              firstName: a.currentAssignment.employee.firstName,
              lastName: a.currentAssignment.employee.lastName,
            }
          : null,
        purchaseDate: a.purchaseDate,
        purchaseValueCents: a.purchaseValueCents,
        createdAt: a.createdAt,
      })),
      total,
    }
  })
}

/**
 * Get a single asset with full details.
 */
export async function getAssetDetail(
  userId: string,
  orgId: string,
  assetId: string
): Promise<AssetDetail | null> {
  return dbAs(userId, async (tx) => {
    const asset = await tx.asset.findFirst({
      where: { id: assetId, orgId },
      include: { category: { select: { name: true } } },
    })
    if (!asset) return null
    return {
      id: asset.id,
      name: asset.name,
      assetTag: asset.assetTag,
      status: asset.status,
      categoryId: asset.categoryId,
      categoryName: asset.category.name,
      purchaseDate: asset.purchaseDate,
      purchaseValueCents: asset.purchaseValueCents,
      notes: asset.notes,
      currentAssignmentId: asset.currentAssignmentId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    }
  })
}

/**
 * Get assignment history for an asset.
 */
export async function getAssetAssignmentHistory(
  userId: string,
  orgId: string,
  assetId: string
): Promise<AssetAssignmentItem[]> {
  return dbAs(userId, async (tx) => {
    const assignments = await tx.assetAssignment.findMany({
      where: { assetId, orgId },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        assignedBy: { select: { firstName: true, lastName: true } },
        returnedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { assignedAt: 'desc' },
    })
    return assignments.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      employeeFirstName: a.employee.firstName,
      employeeLastName: a.employee.lastName,
      assignedAt: a.assignedAt,
      assignedByFirstName: a.assignedBy.firstName,
      assignedByLastName: a.assignedBy.lastName,
      returnedAt: a.returnedAt,
      returnedByFirstName: a.returnedBy?.firstName ?? null,
      returnedByLastName: a.returnedBy?.lastName ?? null,
      conditionAtAssignment: a.conditionAtAssignment,
      conditionAtReturn: a.conditionAtReturn,
      notes: a.notes,
    }))
  })
}

/**
 * List assets currently assigned to an employee (for "My Assets" view).
 */
export async function listMyAssets(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<MyAssetItem[]> {
  return dbAs(userId, async (tx) => {
    const assignments = await tx.assetAssignment.findMany({
      where: {
        orgId,
        employeeId,
        returnedAt: null,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetTag: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    })
    return assignments.map((a) => ({
      id: a.id,
      assetId: a.asset.id,
      assetName: a.asset.name,
      assetTag: a.asset.assetTag,
      categoryName: a.asset.category.name,
      assignedAt: a.assignedAt,
    }))
  })
}

/**
 * List active employees for assignment dropdown.
 */
export async function listActiveEmployees(
  userId: string,
  orgId: string
): Promise<{ id: string; firstName: string; lastName: string }[]> {
  return dbAs(userId, async (tx) => {
    return tx.employee.findMany({
      where: { orgId, employmentStatus: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
  })
}

// ─────────────────────────────────────────────
// Asset request queries
// ─────────────────────────────────────────────

export interface AssetRequestItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  categoryId: string
  categoryName: string
  requestedAssetId: string | null
  requestedAssetName: string | null
  requestedAssetTag: string | null
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED'
  requestedAt: Date
  reviewedById: string | null
  reviewedByFirstName: string | null
  reviewedByLastName: string | null
  reviewedAt: Date | null
  reviewNote: string | null
  fulfilledAssetId: string | null
  fulfilledAssetName: string | null
  fulfilledAssetTag: string | null
}

/**
 * List the caller's own asset requests.
 */
export async function listMyAssetRequests(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<AssetRequestItem[]> {
  return dbAs(userId, async (tx) => {
    const requests = await tx.assetRequest.findMany({
      where: { orgId, employeeId },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
        requestedAsset: { select: { name: true, assetTag: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
        fulfilledAsset: { select: { name: true, assetTag: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })
    return requests.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      categoryId: r.categoryId,
      categoryName: r.category.name,
      requestedAssetId: r.requestedAssetId,
      requestedAssetName: r.requestedAsset?.name ?? null,
      requestedAssetTag: r.requestedAsset?.assetTag ?? null,
      reason: r.reason,
      status: r.status,
      requestedAt: r.requestedAt,
      reviewedById: r.reviewedById,
      reviewedByFirstName: r.reviewedBy?.firstName ?? null,
      reviewedByLastName: r.reviewedBy?.lastName ?? null,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      fulfilledAssetId: r.fulfilledAssetId,
      fulfilledAssetName: r.fulfilledAsset?.name ?? null,
      fulfilledAssetTag: r.fulfilledAsset?.assetTag ?? null,
    }))
  })
}

/**
 * List all asset requests for admin approvals view.
 */
export async function listAllAssetRequests(
  userId: string,
  orgId: string,
  params: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED'; page: number; pageSize: number }
): Promise<{ requests: AssetRequestItem[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      ...(params.status ? { status: params.status } : {}),
    }

    const requests = await tx.assetRequest.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
        requestedAsset: { select: { name: true, assetTag: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
        fulfilledAsset: { select: { name: true, assetTag: true } },
      },
      orderBy: { requestedAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    })
    const total = await tx.assetRequest.count({ where })

    return {
      requests: requests.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeFirstName: r.employee.firstName,
        employeeLastName: r.employee.lastName,
        categoryId: r.categoryId,
        categoryName: r.category.name,
        requestedAssetId: r.requestedAssetId,
        requestedAssetName: r.requestedAsset?.name ?? null,
        requestedAssetTag: r.requestedAsset?.assetTag ?? null,
        reason: r.reason,
        status: r.status,
        requestedAt: r.requestedAt,
        reviewedById: r.reviewedById,
        reviewedByFirstName: r.reviewedBy?.firstName ?? null,
        reviewedByLastName: r.reviewedBy?.lastName ?? null,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        fulfilledAssetId: r.fulfilledAssetId,
        fulfilledAssetName: r.fulfilledAsset?.name ?? null,
        fulfilledAssetTag: r.fulfilledAsset?.assetTag ?? null,
      })),
      total,
    }
  })
}

/**
 * List available assets in a category (for request/fulfill dropdowns).
 */
export async function listAvailableAssetsByCategory(
  userId: string,
  orgId: string,
  categoryId: string
): Promise<{ id: string; name: string; assetTag: string }[]> {
  return dbAs(userId, async (tx) => {
    return tx.asset.findMany({
      where: { orgId, categoryId, status: 'AVAILABLE' },
      select: { id: true, name: true, assetTag: true },
      orderBy: { name: 'asc' },
    })
  })
}
