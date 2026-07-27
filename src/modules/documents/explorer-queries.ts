/**
 * Document Explorer queries — builds the virtual folder tree over existing data.
 * No new tables or models; computes folder views from EmployeeDocument/DocumentCategory
 * and PayrollPeriod/PayrollRecord.
 */
import 'server-only'
import { dbAs } from '@/core/db'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface FolderEntry {
  id: string
  name: string
  type: 'folder'
  meta?: string
}

export interface FileEntry {
  id: string
  name: string
  type: 'file'
  mimeType?: string
  fileSize?: number
  createdAt?: Date
  /** For payroll "files": the recordId for PDF generation */
  recordId?: string
  /** Whether this is a virtual on-demand PDF */
  isVirtual?: boolean
  /** Type of virtual PDF for download routing */
  pdfType?: 'payroll' | 'performance-cycle' | 'performance-review'
}

export type ExplorerEntry = FolderEntry | FileEntry

// ─────────────────────────────────────────────
// Root level — returns the top-level folders
// ─────────────────────────────────────────────

export function getRootFolders(enabledModules: string[]): FolderEntry[] {
  const folders: FolderEntry[] = [
    { id: 'employee-documents', name: 'Employee Documents', type: 'folder' },
  ]
  if (enabledModules.includes('payroll')) {
    folders.push({ id: 'payroll', name: 'Payroll', type: 'folder' })
  }
  if (enabledModules.includes('performance')) {
    folders.push({ id: 'performance', name: 'Performance', type: 'folder' })
  }
  return folders
}

// ─────────────────────────────────────────────
// Employee Documents branch
// ─────────────────────────────────────────────

/**
 * List employees that have documents — one folder per employee.
 * If selfOnly is true, only returns the given employeeId.
 * Delegates to the shared listDocuments query to ensure consistency.
 */
export async function getEmployeeFolders(
  userId: string,
  orgId: string,
  selfEmployeeId: string | null
): Promise<FolderEntry[]> {
  // Use the shared listDocuments query (large page size to get all docs)
  const { listDocuments } = await import('./queries')
  const { documents } = await listDocuments(userId, orgId, {
    ...(selfEmployeeId ? { employeeId: selfEmployeeId } : {}),
    pageSize: 10000,
  })

  // Extract unique employees from results
  const employeeMap = new Map<string, { firstName: string; lastName: string }>()
  for (const doc of documents) {
    if (!employeeMap.has(doc.employee.id)) {
      employeeMap.set(doc.employee.id, {
        firstName: doc.employee.firstName,
        lastName: doc.employee.lastName,
      })
    }
  }

  // Sort by last name
  const entries = Array.from(employeeMap.entries())
    .sort(([, a], [, b]) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

  return entries.map(([id, emp]) => ({
    id,
    name: `${emp.firstName} ${emp.lastName}`,
    type: 'folder' as const,
  }))
}

/**
 * List document categories for a specific employee — one folder per category.
 * Delegates to the shared listDocuments query to ensure consistency.
 */
export async function getCategoryFoldersForEmployee(
  userId: string,
  orgId: string,
  employeeId: string,
  excludeSensitive: boolean
): Promise<FolderEntry[]> {
  // Use the shared listDocuments query (no pagination, no search, non-archived only)
  const { listDocuments } = await import('./queries')
  const { documents } = await listDocuments(userId, orgId, {
    employeeId,
    pageSize: 1000,
  }, { excludeSensitive })

  // Extract unique categories from results
  const categoryMap = new Map<string, string>()
  for (const doc of documents) {
    if (!categoryMap.has(doc.category.id)) {
      categoryMap.set(doc.category.id, doc.category.name)
    }
  }

  return Array.from(categoryMap.entries()).map(([id, name]) => ({
    id,
    name,
    type: 'folder' as const,
  }))
}

/**
 * List actual documents for an employee + category.
 * Delegates to the shared listDocuments query to ensure consistency.
 */
export async function getDocumentsForCategory(
  userId: string,
  orgId: string,
  employeeId: string,
  categoryId: string,
  excludeSensitive: boolean
): Promise<FileEntry[]> {
  // Use the shared listDocuments query
  const { listDocuments } = await import('./queries')
  const { documents } = await listDocuments(userId, orgId, {
    employeeId,
    categoryId,
    pageSize: 1000,
  }, { excludeSensitive })

  return documents.map((d) => ({
    id: d.id,
    name: d.fileName,
    type: 'file' as const,
    mimeType: d.mimeType,
    fileSize: d.fileSize,
    createdAt: d.createdAt,
  }))
}

// ─────────────────────────────────────────────
// Payroll branch
// ─────────────────────────────────────────────

export function getPayrollSubfolders(): FolderEntry[] {
  return [
    { id: 'by-month', name: 'By Month', type: 'folder' },
    { id: 'by-employee', name: 'By Employee', type: 'folder' },
  ]
}

/**
 * List payroll periods as folders (By Month view).
 * Only shows published or paid periods (employees shouldn't see draft payroll).
 */
export async function getPayrollPeriodFolders(
  userId: string,
  orgId: string
): Promise<FolderEntry[]> {
  return dbAs(userId, async (tx) => {
    const periods = await tx.payrollPeriod.findMany({
      where: { orgId, status: { in: ['PUBLISHED', 'PAID'] } },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    })

    return periods.map((p) => ({
      id: p.id,
      name: p.name,
      type: 'folder' as const,
      meta: `${p.startDate.toLocaleDateString('en-SG')} - ${p.endDate.toLocaleDateString('en-SG')}`,
    }))
  })
}

/**
 * List employees within a payroll period (virtual files with PDF download).
 * If selfOnly, restricts to the given employeeId.
 */
export async function getPayrollEmployeesInPeriod(
  userId: string,
  orgId: string,
  periodId: string,
  selfEmployeeId: string | null
): Promise<FileEntry[]> {
  return dbAs(userId, async (tx) => {
    const records = await tx.payrollRecord.findMany({
      where: {
        orgId,
        periodId,
        isPublished: true,
        ...(selfEmployeeId ? { employeeId: selfEmployeeId } : {}),
      },
      select: {
        id: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { employee: { lastName: 'asc' } },
    })

    return records.map((r) => ({
      id: r.id,
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      type: 'file' as const,
      recordId: r.id,
      isVirtual: true,
      pdfType: 'payroll' as const,
    }))
  })
}

/**
 * List employees who have published payroll records (By Employee view).
 * If selfOnly, restricts to the given employeeId.
 */
export async function getPayrollEmployeeFolders(
  userId: string,
  orgId: string,
  selfEmployeeId: string | null
): Promise<FolderEntry[]> {
  return dbAs(userId, async (tx) => {
    const records = await tx.payrollRecord.findMany({
      where: {
        orgId,
        isPublished: true,
        ...(selfEmployeeId ? { employeeId: selfEmployeeId } : {}),
      },
      select: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      distinct: ['employeeId'],
      orderBy: { employee: { lastName: 'asc' } },
    })

    return records.map((r) => ({
      id: r.employee.id,
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      type: 'folder' as const,
    }))
  })
}

/**
 * List payroll periods for a specific employee (By Employee → Employee → periods).
 * If selfOnly, already restricted at the folder level.
 */
export async function getPayrollPeriodsForEmployee(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<FileEntry[]> {
  return dbAs(userId, async (tx) => {
    const records = await tx.payrollRecord.findMany({
      where: {
        orgId,
        employeeId,
        isPublished: true,
      },
      select: {
        id: true,
        period: { select: { name: true, startDate: true, endDate: true } },
      },
      orderBy: { period: { startDate: 'desc' } },
    })

    return records.map((r) => ({
      id: r.id,
      name: r.period.name,
      type: 'file' as const,
      recordId: r.id,
      isVirtual: true,
      pdfType: 'payroll' as const,
    }))
  })
}

// ─────────────────────────────────────────────
// Performance branch
// ─────────────────────────────────────────────

export function getPerformanceSubfolders(): FolderEntry[] {
  return [
    { id: 'by-quarter', name: 'By Quarter', type: 'folder' },
  ]
}

/**
 * List performance cycles as folders (By Quarter view).
 * Only shows cycles with at least one PUBLISHED review.
 */
export async function getPerformanceCycleFolders(
  userId: string,
  orgId: string
): Promise<FolderEntry[]> {
  return dbAs(userId, async (tx) => {
    const cycles = await tx.performanceCycle.findMany({
      where: {
        orgId,
        reviews: { some: { status: 'PUBLISHED' } },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    })

    return cycles.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'folder' as const,
      meta: `${c.startDate.toLocaleDateString('en-SG')} - ${c.endDate.toLocaleDateString('en-SG')}`,
    }))
  })
}

/**
 * List published reviews within a performance cycle as virtual file entries.
 * Returns one "whole cycle" file plus one file per employee.
 * If selfOnly, restricts to the given employeeId.
 */
export async function getPerformanceReviewsInCycle(
  userId: string,
  orgId: string,
  cycleId: string,
  selfEmployeeId: string | null
): Promise<FileEntry[]> {
  return dbAs(userId, async (tx) => {
    const cycle = await tx.performanceCycle.findFirst({
      where: { id: cycleId, orgId },
      select: { name: true },
    })
    if (!cycle) return []

    const reviews = await tx.performanceReview.findMany({
      where: {
        orgId,
        cycleId,
        status: 'PUBLISHED',
        ...(selfEmployeeId ? { employeeId: selfEmployeeId } : {}),
      },
      select: {
        id: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { employee: { lastName: 'asc' } },
    })

    const files: FileEntry[] = []

    // First entry: whole-cycle PDF (only if viewer can see all, i.e. not self-only)
    if (!selfEmployeeId && reviews.length > 0) {
      files.push({
        id: `cycle-${cycleId}`,
        name: `${cycle.name} — All Reviews`,
        type: 'file' as const,
        recordId: cycleId,
        isVirtual: true,
        pdfType: 'performance-cycle' as const,
      })
    }

    // Per-employee review PDFs
    for (const r of reviews) {
      files.push({
        id: r.id,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        type: 'file' as const,
        recordId: r.id,
        isVirtual: true,
        pdfType: 'performance-review' as const,
      })
    }

    return files
  })
}
