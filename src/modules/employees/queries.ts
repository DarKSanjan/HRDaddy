/**
 * Employee queries — data fetching with role-based field visibility.
 *
 * Sensitive fields (dateOfBirth, nationalId, address, personalEmail, phone,
 * compensation) are NEVER fetched unless the viewer is:
 *   1. An OWNER or HR_ADMIN (employee.view_all)
 *   2. The employee themselves (employee.view_own)
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { OrgRole, EmploymentStatus, Prisma } from '@prisma/client'
import type { EmployeeListParams } from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface EmployeeListItem {
  id: string
  firstName: string
  lastName: string
  workEmail: string
  employmentStatus: EmploymentStatus
  startDate: Date | null
  department: { id: string; name: string } | null
  jobTitle: { id: string; name: string } | null
  workLocation: { id: string; name: string } | null
  employmentType: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string } | null
}

export interface EmployeeProfile {
  id: string
  orgId: string
  userId: string | null
  firstName: string
  lastName: string
  workEmail: string
  employmentStatus: EmploymentStatus
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
  department: { id: string; name: string } | null
  jobTitle: { id: string; name: string } | null
  workLocation: { id: string; name: string } | null
  employmentType: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string } | null
  directReports: { id: string; firstName: string; lastName: string }[]
  // Sensitive fields — only populated when viewer has access
  personalEmail?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  gender?: string | null
  nationalId?: string | null
  address?: string | null
  compensationAmountCents?: number | null
  compensationCurrency?: string | null
}

// ─────────────────────────────────────────────
// Field visibility
// ─────────────────────────────────────────────

const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

function canViewSensitive(
  viewerRole: OrgRole,
  viewerUserId: string,
  employeeUserId: string | null
): boolean {
  // Admin roles can always see sensitive data
  if (ADMIN_ROLES.includes(viewerRole)) return true
  // Employee can see their own data
  if (employeeUserId && viewerUserId === employeeUserId) return true
  return false
}

function buildSensitiveSelect(includeSensitive: boolean) {
  if (includeSensitive) {
    return {
      personalEmail: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      nationalId: true,
      address: true,
      compensationAmountCents: true,
      compensationCurrency: true,
    }
  }
  return {
    personalEmail: false,
    phone: false,
    dateOfBirth: false,
    gender: false,
    nationalId: false,
    address: false,
    compensationAmountCents: false,
    compensationCurrency: false,
  }
}

// ─────────────────────────────────────────────
// List employees
// ─────────────────────────────────────────────

export async function listEmployees(
  userId: string,
  orgId: string,
  params: EmployeeListParams
): Promise<{ employees: EmployeeListItem[]; total: number }> {
  const {
    search,
    departmentId,
    status,
    employmentTypeId,
    locationId,
    sortBy = 'lastName',
    sortOrder = 'asc',
    page = 1,
    pageSize = 20,
  } = params

  return dbAs(userId, async (tx) => {
    const where: Prisma.EmployeeWhereInput = {
      orgId,
      // Never show archived employees in the list by default
      ...(status ? { employmentStatus: status } : { employmentStatus: { not: 'ARCHIVED' } }),
      ...(departmentId ? { departmentId } : {}),
      ...(employmentTypeId ? { employmentTypeId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { workEmail: { contains: search, mode: 'insensitive' } },
              { jobTitle: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const [employees, total] = await Promise.all([
      tx.employee.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          workEmail: true,
          employmentStatus: true,
          startDate: true,
          department: { select: { id: true, name: true } },
          jobTitle: { select: { id: true, name: true } },
          workLocation: { select: { id: true, name: true } },
          employmentType: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.employee.count({ where }),
    ])

    return { employees: employees as unknown as EmployeeListItem[], total }
  })
}

// ─────────────────────────────────────────────
// Get employee profile
// ─────────────────────────────────────────────

export async function getEmployeeProfile(
  viewerUserId: string,
  viewerRole: OrgRole,
  orgId: string,
  employeeId: string
): Promise<EmployeeProfile | null> {
  return dbAs(viewerUserId, async (tx) => {
    // First, get the employee's userId to determine visibility
    const employeeMeta = await tx.employee.findFirst({
      where: { id: employeeId, orgId },
      select: { userId: true },
    })

    if (!employeeMeta) return null

    const includeSensitive = canViewSensitive(viewerRole, viewerUserId, employeeMeta.userId)

    const employee = await tx.employee.findFirst({
      where: { id: employeeId, orgId },
      select: {
        id: true,
        orgId: true,
        userId: true,
        firstName: true,
        lastName: true,
        workEmail: true,
        employmentStatus: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true } },
        jobTitle: { select: { id: true, name: true } },
        workLocation: { select: { id: true, name: true } },
        employmentType: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        directReports: { select: { id: true, firstName: true, lastName: true } },
        ...buildSensitiveSelect(includeSensitive),
      },
    })

    return employee as EmployeeProfile | null
  })
}

// ─────────────────────────────────────────────
// Get employee for editing (admin-only)
// ─────────────────────────────────────────────

export async function getEmployeeForEdit(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<EmployeeProfile | null> {
  return dbAs(userId, async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, orgId },
      select: {
        id: true,
        orgId: true,
        userId: true,
        firstName: true,
        lastName: true,
        workEmail: true,
        personalEmail: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        nationalId: true,
        address: true,
        employmentStatus: true,
        startDate: true,
        endDate: true,
        compensationAmountCents: true,
        compensationCurrency: true,
        createdAt: true,
        updatedAt: true,
        departmentId: true,
        jobTitleId: true,
        locationId: true,
        employmentTypeId: true,
        managerId: true,
        department: { select: { id: true, name: true } },
        jobTitle: { select: { id: true, name: true } },
        workLocation: { select: { id: true, name: true } },
        employmentType: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        directReports: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return employee as EmployeeProfile | null
  })
}

// ─────────────────────────────────────────────
// Org structure queries
// ─────────────────────────────────────────────

export async function listDepartments(userId: string, orgId: string) {
  return dbAs(userId, async (tx) => {
    return tx.department.findMany({
      where: { orgId, isArchived: false },
      select: {
        id: true,
        name: true,
        managerId: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { employees: { where: { employmentStatus: { not: 'ARCHIVED' } } } } },
      },
      orderBy: { name: 'asc' },
    })
  })
}

export async function listJobTitles(userId: string, orgId: string) {
  return dbAs(userId, async (tx) => {
    return tx.jobTitle.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  })
}

export async function listWorkLocations(userId: string, orgId: string) {
  return dbAs(userId, async (tx) => {
    return tx.workLocation.findMany({
      where: { orgId },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    })
  })
}

export async function listEmploymentTypes(userId: string, orgId: string) {
  return dbAs(userId, async (tx) => {
    return tx.employmentType.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  })
}

// ─────────────────────────────────────────────
// Activity / audit log for an employee
// ─────────────────────────────────────────────

export async function getEmployeeActivity(
  userId: string,
  orgId: string,
  employeeId: string,
  page = 1,
  pageSize = 20
) {
  return dbAs(userId, async (tx) => {
    const [entries, total] = await Promise.all([
      tx.auditLog.findMany({
        where: { orgId, targetType: 'employee', targetId: employeeId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.auditLog.count({
        where: { orgId, targetType: 'employee', targetId: employeeId },
      }),
    ])
    return { entries, total }
  })
}
