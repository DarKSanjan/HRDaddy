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
}

export type ExplorerEntry = FolderEntry | FileEntry

// ─────────────────────────────────────────────
// Root level — returns the two top-level folders
// ─────────────────────────────────────────────

export function getRootFolders(): FolderEntry[] {
  return [
    { id: 'employee-documents', name: 'Employee Documents', type: 'folder' },
    { id: 'payroll', name: 'Payroll', type: 'folder' },
  ]
}

// ─────────────────────────────────────────────
// Employee Documents branch
// ─────────────────────────────────────────────

/**
 * List employees that have documents — one folder per employee.
 * If selfOnly is true, only returns the given employeeId.
 */
export async function getEmployeeFolders(
  userId: string,
  orgId: string,
  selfEmployeeId: string | null
): Promise<FolderEntry[]> {
  return dbAs(userId, async (tx) => {
    const where = selfEmployeeId
      ? { orgId, employeeId: selfEmployeeId, isArchived: false }
      : { orgId, isArchived: false }

    const employees = await tx.employeeDocument.findMany({
      where,
      select: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      distinct: ['employeeId'],
      orderBy: { employee: { lastName: 'asc' } },
    })

    return employees.map((e) => ({
      id: e.employee.id,
      name: `${e.employee.firstName} ${e.employee.lastName}`,
      type: 'folder' as const,
    }))
  })
}

/**
 * List document categories for a specific employee — one folder per category.
 */
export async function getCategoryFoldersForEmployee(
  userId: string,
  orgId: string,
  employeeId: string,
  excludeSensitive: boolean
): Promise<FolderEntry[]> {
  return dbAs(userId, async (tx) => {
    const docs = await tx.employeeDocument.findMany({
      where: {
        orgId,
        employeeId,
        isArchived: false,
        ...(excludeSensitive ? { category: { isSensitive: false } } : {}),
      },
      select: {
        category: { select: { id: true, name: true } },
      },
      distinct: ['categoryId'],
    })

    return docs.map((d) => ({
      id: d.category.id,
      name: d.category.name,
      type: 'folder' as const,
    }))
  })
}

/**
 * List actual documents for an employee + category.
 */
export async function getDocumentsForCategory(
  userId: string,
  orgId: string,
  employeeId: string,
  categoryId: string,
  excludeSensitive: boolean
): Promise<FileEntry[]> {
  return dbAs(userId, async (tx) => {
    const docs = await tx.employeeDocument.findMany({
      where: {
        orgId,
        employeeId,
        categoryId,
        isArchived: false,
        ...(excludeSensitive ? { category: { isSensitive: false } } : {}),
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return docs.map((d) => ({
      id: d.id,
      name: d.fileName,
      type: 'file' as const,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      createdAt: d.createdAt,
    }))
  })
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
    }))
  })
}
