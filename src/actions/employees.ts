'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifySession, getOrgBySlug, requirePermission } from '@/lib/dal'
import { PERMISSIONS } from '@/lib/permissions'

export interface EmployeeFormState {
  error: string | null
  fieldErrors?: Record<string, string>
}

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  workEmail: z.string().email('Valid work email is required'),
  personalEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  startDate: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentType: z.string().optional(),
})

export async function createEmployee(
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const orgSlug = formData.get('orgSlug') as string
  if (!orgSlug) {
    return { error: 'Organisation not found' }
  }

  const org = await getOrgBySlug(orgSlug)
  if (!org) {
    return { error: 'Organisation not found' }
  }

  const { userId } = await requirePermission(org.id, PERMISSIONS.EMPLOYEE_CREATE)

  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    workEmail: formData.get('workEmail'),
    personalEmail: formData.get('personalEmail') || undefined,
    phone: formData.get('phone') || undefined,
    dateOfBirth: formData.get('dateOfBirth') || undefined,
    startDate: formData.get('startDate') || undefined,
    department: formData.get('department') || undefined,
    jobTitle: formData.get('jobTitle') || undefined,
    employmentType: formData.get('employmentType') || undefined,
  }

  const parsed = createEmployeeSchema.safeParse(rawData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString()
      if (field) fieldErrors[field] = issue.message
    }
    return { error: 'Please fix the errors below', fieldErrors }
  }

  const data = parsed.data

  // Find or create department if provided
  let departmentId: string | undefined
  if (data.department) {
    const dept = await db.department.upsert({
      where: {
        id: 'placeholder', // Will never match, forces create path in findFirst fallback
      },
      update: {},
      create: {
        orgId: org.id,
        name: data.department,
      },
    }).catch(async () => {
      // Fallback: find existing or create
      const existing = await db.department.findFirst({
        where: { orgId: org.id, name: data.department },
      })
      if (existing) return existing
      return db.department.create({
        data: { orgId: org.id, name: data.department! },
      })
    })
    departmentId = dept.id
  }

  // Find or create job title if provided
  let jobTitleId: string | undefined
  if (data.jobTitle) {
    const existing = await db.jobTitle.findFirst({
      where: { orgId: org.id, name: data.jobTitle },
    })
    if (existing) {
      jobTitleId = existing.id
    } else {
      const created = await db.jobTitle.create({
        data: { orgId: org.id, name: data.jobTitle },
      })
      jobTitleId = created.id
    }
  }

  // Create employee
  const employee = await db.employee.create({
    data: {
      orgId: org.id,
      firstName: data.firstName,
      lastName: data.lastName,
      workEmail: data.workEmail,
      personalEmail: data.personalEmail || null,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      departmentId: departmentId || null,
      jobTitleId: jobTitleId || null,
      employmentStatus: 'DRAFT',
    },
  })

  // Create audit log
  await db.auditLog.create({
    data: {
      orgId: org.id,
      actorId: userId,
      action: 'employee.created',
      targetType: 'Employee',
      targetId: employee.id,
      after: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        workEmail: employee.workEmail,
      },
    },
  })

  redirect(`/${orgSlug}/employees/${employee.id}`)
}

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  workEmail: z.string().email('Valid work email is required'),
  personalEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
})

export async function updateEmployee(
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const orgSlug = formData.get('orgSlug') as string
  const employeeId = formData.get('employeeId') as string

  if (!orgSlug || !employeeId) {
    return { error: 'Missing required data' }
  }

  const org = await getOrgBySlug(orgSlug)
  if (!org) {
    return { error: 'Organisation not found' }
  }

  const { userId } = await requirePermission(org.id, PERMISSIONS.EMPLOYEE_EDIT)

  // Verify employee belongs to org
  const existing = await db.employee.findFirst({
    where: { id: employeeId, orgId: org.id },
  })
  if (!existing) {
    return { error: 'Employee not found' }
  }

  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    workEmail: formData.get('workEmail'),
    personalEmail: formData.get('personalEmail') || undefined,
    phone: formData.get('phone') || undefined,
  }

  const parsed = updateEmployeeSchema.safeParse(rawData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString()
      if (field) fieldErrors[field] = issue.message
    }
    return { error: 'Please fix the errors below', fieldErrors }
  }

  const data = parsed.data
  const before = {
    firstName: existing.firstName,
    lastName: existing.lastName,
    workEmail: existing.workEmail,
  }

  await db.employee.update({
    where: { id: employeeId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      workEmail: data.workEmail,
      personalEmail: data.personalEmail || null,
      phone: data.phone || null,
    },
  })

  await db.auditLog.create({
    data: {
      orgId: org.id,
      actorId: userId,
      action: 'employee.updated',
      targetType: 'Employee',
      targetId: employeeId,
      before,
      after: {
        firstName: data.firstName,
        lastName: data.lastName,
        workEmail: data.workEmail,
      },
    },
  })

  redirect(`/${orgSlug}/employees/${employeeId}`)
}

export async function deactivateEmployee(
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const orgSlug = formData.get('orgSlug') as string
  const employeeId = formData.get('employeeId') as string

  if (!orgSlug || !employeeId) {
    return { error: 'Missing required data' }
  }

  const org = await getOrgBySlug(orgSlug)
  if (!org) {
    return { error: 'Organisation not found' }
  }

  const { userId } = await requirePermission(org.id, PERMISSIONS.EMPLOYEE_ARCHIVE)

  const existing = await db.employee.findFirst({
    where: { id: employeeId, orgId: org.id },
  })
  if (!existing) {
    return { error: 'Employee not found' }
  }

  await db.employee.update({
    where: { id: employeeId },
    data: {
      employmentStatus: 'DEACTIVATED',
      endDate: new Date(),
    },
  })

  await db.auditLog.create({
    data: {
      orgId: org.id,
      actorId: userId,
      action: 'employee.deactivated',
      targetType: 'Employee',
      targetId: employeeId,
      before: { employmentStatus: existing.employmentStatus },
      after: { employmentStatus: 'DEACTIVATED' },
    },
  })

  redirect(`/${orgSlug}/employees/${employeeId}`)
}
