/**
 * Documents module queries — data fetching with permission scoping.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { Prisma } from '@prisma/client'
import type { DocumentListParams } from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DocumentCategoryItem {
  id: string
  name: string
  isSensitive: boolean
  createdAt: Date
  _count: { documents: number }
}

export interface DocumentListItem {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  expiresAt: Date | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  employee: { id: string; firstName: string; lastName: string }
  category: { id: string; name: string; isSensitive: boolean }
  uploadedBy: { id: string; firstName: string; lastName: string }
}

// ─────────────────────────────────────────────
// Category queries
// ─────────────────────────────────────────────

export async function listCategories(
  userId: string,
  orgId: string
): Promise<DocumentCategoryItem[]> {
  return dbAs(userId, async (tx) => {
    return tx.documentCategory.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        isSensitive: true,
        createdAt: true,
        _count: { select: { documents: true } },
      },
      orderBy: { name: 'asc' },
    })
  }) as unknown as DocumentCategoryItem[]
}

// ─────────────────────────────────────────────
// Document queries
// ─────────────────────────────────────────────

export async function listDocuments(
  userId: string,
  orgId: string,
  params: DocumentListParams,
  options?: { viewAll?: boolean; excludeSensitive?: boolean }
): Promise<{ documents: DocumentListItem[]; total: number }> {
  const {
    employeeId,
    categoryId,
    search,
    showArchived,
    page = 1,
    pageSize = 20,
  } = params

  return dbAs(userId, async (tx) => {
    const where: Prisma.EmployeeDocumentWhereInput = {
      orgId,
      ...(employeeId ? { employeeId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(showArchived ? {} : { isArchived: false }),
      ...(search
        ? { fileName: { contains: search, mode: 'insensitive' } }
        : {}),
      ...(options?.excludeSensitive
        ? { category: { isSensitive: false } }
        : {}),
    }

    const documents = await tx.employeeDocument.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        expiresAt: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        category: { select: { id: true, name: true, isSensitive: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    const total = await tx.employeeDocument.count({ where })

    return { documents: documents as unknown as DocumentListItem[], total }
  })
}

/**
 * Get a single document with full details for download permission checks.
 */
export async function getDocument(
  userId: string,
  orgId: string,
  documentId: string
): Promise<(DocumentListItem & { fileKey: string; employeeId: string }) | null> {
  return dbAs(userId, async (tx) => {
    return tx.employeeDocument.findFirst({
      where: { id: documentId, orgId },
      select: {
        id: true,
        fileName: true,
        fileKey: true,
        fileSize: true,
        mimeType: true,
        expiresAt: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        employeeId: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        category: { select: { id: true, name: true, isSensitive: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }) as unknown as (DocumentListItem & { fileKey: string; employeeId: string }) | null
}

/**
 * Get documents expiring within a given number of days.
 */
export async function getExpiringDocuments(
  userId: string,
  orgId: string,
  withinDays: number = 30
): Promise<DocumentListItem[]> {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + withinDays)

  return dbAs(userId, async (tx) => {
    return tx.employeeDocument.findMany({
      where: {
        orgId,
        isArchived: false,
        expiresAt: { lte: deadline, not: null },
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        expiresAt: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        category: { select: { id: true, name: true, isSensitive: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { expiresAt: 'asc' },
    })
  }) as unknown as DocumentListItem[]
}
