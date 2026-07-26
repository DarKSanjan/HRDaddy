'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

/**
 * Employee module server actions.
 * Every mutation:
 *   1. Resolves org from slug (never trusts client-provided orgId)
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
import { emit } from '@/core/events'
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  changeStatusSchema,
  assignManagerSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createJobTitleSchema,
  createWorkLocationSchema,
  createEmploymentTypeSchema,
} from './schemas'
import { validateTransition, requiresReassignment, requiresReason } from './lifecycle'
import { wouldCreateCycle } from './reporting-lines'
import type { EmploymentStatus } from '@prisma/client'

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
// Employee CRUD
// ─────────────────────────────────────────────

export async function createEmployee(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.create')

  const raw = Object.fromEntries(formData.entries())
  const parsed = createEmployeeSchema.safeParse({
    ...raw,
    compensationAmountCents: raw.compensationAmountCents
      ? Number(raw.compensationAmountCents)
      : undefined,
    inviteToPortal: raw.inviteToPortal === 'true',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const input = parsed.data

  // Check work email uniqueness within org
  const exists = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { orgId: org.id, workEmail: input.workEmail },
      select: { id: true },
    })
  })

  if (exists) {
    return { success: false, fieldErrors: { workEmail: 'An employee with this email already exists' } }
  }

  // Validate manager cycle if managerId provided
  if (input.managerId) {
    // For a new employee there's no cycle possible, but validate manager exists
    const managerExists = await dbAs(userId, async (tx) => {
      return tx.employee.findFirst({
        where: { id: input.managerId!, orgId: org.id },
        select: { id: true },
      })
    })
    if (!managerExists) {
      return { success: false, fieldErrors: { managerId: 'Manager not found' } }
    }
  }

  const employee = await dbAs(userId, async (tx) => {
    return tx.employee.create({
      data: {
        orgId: org.id,
        firstName: input.firstName,
        lastName: input.lastName,
        workEmail: input.workEmail,
        personalEmail: input.personalEmail || null,
        phone: input.phone || null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender || null,
        nationalId: input.nationalId || null,
        address: input.address || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        departmentId: input.departmentId || null,
        jobTitleId: input.jobTitleId || null,
        locationId: input.locationId || null,
        employmentTypeId: input.employmentTypeId || null,
        managerId: input.managerId || null,
        compensationAmountCents: input.compensationAmountCents ?? null,
        compensationCurrency: input.compensationCurrency || null,
        employmentStatus: 'DRAFT',
      },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'employee.created',
    targetType: 'employee',
    targetId: employee.id,
    after: { firstName: input.firstName, lastName: input.lastName, workEmail: input.workEmail },
  })

  await emit('employee.created', { employeeId: employee.id }, { orgId: org.id, userId })

  revalidatePath(`/${orgSlug}/employees`)
  return { success: true, data: { id: employee.id } }
}

export async function updateEmployee(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.edit')

  const raw = Object.fromEntries(formData.entries())
  const parsed = updateEmployeeSchema.safeParse({
    ...raw,
    employeeId: raw.employeeId,
    compensationAmountCents: raw.compensationAmountCents
      ? Number(raw.compensationAmountCents)
      : undefined,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { employeeId, ...input } = parsed.data

  // Get current state for audit
  const before = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { id: employeeId, orgId: org.id },
    })
  })

  if (!before) {
    return { success: false, error: 'Employee not found' }
  }

  // Check work email uniqueness if changed
  if (input.workEmail && input.workEmail !== before.workEmail) {
    const exists = await dbAs(userId, async (tx) => {
      return tx.employee.findFirst({
        where: { orgId: org.id, workEmail: input.workEmail!, id: { not: employeeId } },
        select: { id: true },
      })
    })
    if (exists) {
      return { success: false, fieldErrors: { workEmail: 'An employee with this email already exists' } }
    }
  }

  // Build update data — only include fields that were provided
  const updateData: Record<string, unknown> = {}
  if (input.firstName !== undefined) updateData.firstName = input.firstName
  if (input.lastName !== undefined) updateData.lastName = input.lastName
  if (input.workEmail !== undefined) updateData.workEmail = input.workEmail
  if (input.personalEmail !== undefined) updateData.personalEmail = input.personalEmail || null
  if (input.phone !== undefined) updateData.phone = input.phone || null
  if (input.dateOfBirth !== undefined) updateData.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null
  if (input.gender !== undefined) updateData.gender = input.gender || null
  if (input.nationalId !== undefined) updateData.nationalId = input.nationalId || null
  if (input.address !== undefined) updateData.address = input.address || null
  if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null
  if (input.departmentId !== undefined) updateData.departmentId = input.departmentId || null
  if (input.jobTitleId !== undefined) updateData.jobTitleId = input.jobTitleId || null
  if (input.locationId !== undefined) updateData.locationId = input.locationId || null
  if (input.employmentTypeId !== undefined) updateData.employmentTypeId = input.employmentTypeId || null
  if (input.compensationAmountCents !== undefined) updateData.compensationAmountCents = input.compensationAmountCents ?? null
  if (input.compensationCurrency !== undefined) updateData.compensationCurrency = input.compensationCurrency || null

  await dbAs(userId, async (tx) => {
    return tx.employee.update({
      where: { id: employeeId },
      data: updateData,
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'employee.updated',
    targetType: 'employee',
    targetId: employeeId,
    before,
    after: updateData,
  })

  revalidatePath(`/${orgSlug}/employees/${employeeId}`)
  revalidatePath(`/${orgSlug}/employees`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Status change
// ─────────────────────────────────────────────

export async function changeEmployeeStatus(
  orgSlug: string,
  input: { employeeId: string; newStatus: EmploymentStatus; reason?: string; reassignManagerId?: string }
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.edit')

  const parsed = changeStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { employeeId, newStatus, reason, reassignManagerId } = parsed.data

  const employee = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { id: employeeId, orgId: org.id },
      select: { id: true, employmentStatus: true, firstName: true, lastName: true },
    })
  })

  if (!employee) {
    return { success: false, error: 'Employee not found' }
  }

  // Validate transition
  const transition = validateTransition(employee.employmentStatus, newStatus)
  if (!transition.valid) {
    return { success: false, error: transition.error }
  }

  // Require reason for deactivation/suspension
  if (requiresReason(newStatus) && !reason) {
    return { success: false, error: `A reason is required for ${newStatus.toLowerCase()}` }
  }

  // Check direct reports if deactivating
  if (requiresReassignment(newStatus)) {
    const directReports = await dbAs(userId, async (tx) => {
      return tx.employee.findMany({
        where: { managerId: employeeId, orgId: org.id, employmentStatus: { not: 'ARCHIVED' } },
        select: { id: true },
      })
    })

    if (directReports.length > 0 && !reassignManagerId) {
      return {
        success: false,
        error: `This employee has ${directReports.length} direct report(s). Reassign them before deactivating.`,
      }
    }

    // Reassign direct reports if a new manager is specified
    if (directReports.length > 0 && reassignManagerId) {
      await dbAs(userId, async (tx) => {
        await tx.employee.updateMany({
          where: { managerId: employeeId, orgId: org.id },
          data: { managerId: reassignManagerId || null },
        })
      })
    }
  }

  await dbAs(userId, async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: {
        employmentStatus: newStatus,
        ...(newStatus === 'DEACTIVATED' || newStatus === 'ARCHIVED'
          ? { endDate: new Date() }
          : {}),
      },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'employee.status_changed',
    targetType: 'employee',
    targetId: employeeId,
    before: { status: employee.employmentStatus },
    after: { status: newStatus },
    metadata: { reason },
  })

  await emit('employee.status_changed', {
    employeeId,
    from: employee.employmentStatus,
    to: newStatus,
  }, { orgId: org.id, userId })

  revalidatePath(`/${orgSlug}/employees/${employeeId}`)
  revalidatePath(`/${orgSlug}/employees`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Manager assignment
// ─────────────────────────────────────────────

export async function assignManager(
  orgSlug: string,
  input: { employeeId: string; managerId?: string }
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.edit')

  const parsed = assignManagerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { employeeId, managerId } = parsed.data

  // If removing manager, just clear it
  if (!managerId) {
    await dbAs(userId, async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: { managerId: null },
      })
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'employee.manager_removed',
      targetType: 'employee',
      targetId: employeeId,
    })

    revalidatePath(`/${orgSlug}/employees/${employeeId}`)
    return { success: true }
  }

  // Validate manager exists
  const managerExists = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { id: managerId, orgId: org.id },
      select: { id: true },
    })
  })

  if (!managerExists) {
    return { success: false, error: 'Manager not found' }
  }

  // Cycle detection
  const hasCycle = await wouldCreateCycle(
    employeeId,
    managerId,
    async (id: string) => {
      const emp = await dbAs(userId, async (tx) => {
        return tx.employee.findFirst({
          where: { id, orgId: org.id },
          select: { managerId: true },
        })
      })
      return emp?.managerId ?? null
    }
  )

  if (hasCycle) {
    return { success: false, error: 'This assignment would create a circular reporting chain' }
  }

  await dbAs(userId, async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { managerId },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'employee.manager_assigned',
    targetType: 'employee',
    targetId: employeeId,
    after: { managerId },
  })

  revalidatePath(`/${orgSlug}/employees/${employeeId}`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Department actions
// ─────────────────────────────────────────────

export async function createDepartment(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  const raw = Object.fromEntries(formData.entries())
  const parsed = createDepartmentSchema.safeParse(raw)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const dept = await dbAs(userId, async (tx) => {
    return tx.department.create({
      data: {
        orgId: org.id,
        name: parsed.data.name,
        managerId: parsed.data.managerId || null,
      },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'department.created',
    targetType: 'department',
    targetId: dept.id,
    after: { name: parsed.data.name },
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true, data: { id: dept.id } }
}

export async function updateDepartment(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  const raw = Object.fromEntries(formData.entries())
  const parsed = updateDepartmentSchema.safeParse(raw)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { departmentId, ...data } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.managerId !== undefined) updateData.managerId = data.managerId || null

  await dbAs(userId, async (tx) => {
    await tx.department.update({
      where: { id: departmentId },
      data: updateData,
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'department.updated',
    targetType: 'department',
    targetId: departmentId,
    after: updateData,
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true }
}

export async function archiveDepartment(
  orgSlug: string,
  departmentId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  // Check for active employees
  const activeCount = await dbAs(userId, async (tx) => {
    return tx.employee.count({
      where: { departmentId, orgId: org.id, employmentStatus: { not: 'ARCHIVED' } },
    })
  })

  if (activeCount > 0) {
    return { success: false, error: `Cannot archive department with ${activeCount} active employee(s)` }
  }

  await dbAs(userId, async (tx) => {
    await tx.department.update({
      where: { id: departmentId },
      data: { isArchived: true },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'department.archived',
    targetType: 'department',
    targetId: departmentId,
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Job title actions
// ─────────────────────────────────────────────

export async function createJobTitle(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  const raw = Object.fromEntries(formData.entries())
  const parsed = createJobTitleSchema.safeParse(raw)

  if (!parsed.success) {
    return { success: false, fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Invalid' } }
  }

  const jt = await dbAs(userId, async (tx) => {
    return tx.jobTitle.create({ data: { orgId: org.id, name: parsed.data.name } })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'job_title.created',
    targetType: 'job_title',
    targetId: jt.id,
    after: { name: parsed.data.name },
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true, data: { id: jt.id } }
}

export async function deleteJobTitle(orgSlug: string, jobTitleId: string): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  await dbAs(userId, async (tx) => {
    await tx.jobTitle.delete({ where: { id: jobTitleId } })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'job_title.deleted',
    targetType: 'job_title',
    targetId: jobTitleId,
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Work location actions
// ─────────────────────────────────────────────

export async function createWorkLocation(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  const raw = Object.fromEntries(formData.entries())
  const parsed = createWorkLocationSchema.safeParse(raw)

  if (!parsed.success) {
    return { success: false, fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Invalid' } }
  }

  const loc = await dbAs(userId, async (tx) => {
    return tx.workLocation.create({
      data: { orgId: org.id, name: parsed.data.name, address: parsed.data.address || null },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'work_location.created',
    targetType: 'work_location',
    targetId: loc.id,
    after: { name: parsed.data.name },
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true, data: { id: loc.id } }
}

export async function deleteWorkLocation(orgSlug: string, locationId: string): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  await dbAs(userId, async (tx) => {
    await tx.workLocation.delete({ where: { id: locationId } })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'work_location.deleted',
    targetType: 'work_location',
    targetId: locationId,
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Employment type actions
// ─────────────────────────────────────────────

export async function createEmploymentType(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  const raw = Object.fromEntries(formData.entries())
  const parsed = createEmploymentTypeSchema.safeParse(raw)

  if (!parsed.success) {
    return { success: false, fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Invalid' } }
  }

  const et = await dbAs(userId, async (tx) => {
    return tx.employmentType.create({ data: { orgId: org.id, name: parsed.data.name } })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'employment_type.created',
    targetType: 'employment_type',
    targetId: et.id,
    after: { name: parsed.data.name },
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true, data: { id: et.id } }
}

export async function deleteEmploymentType(orgSlug: string, employmentTypeId: string): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  await dbAs(userId, async (tx) => {
    await tx.employmentType.delete({ where: { id: employmentTypeId } })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'employment_type.deleted',
    targetType: 'employment_type',
    targetId: employmentTypeId,
  })

  revalidatePath(`/${orgSlug}/settings/organisation`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Employee activity (audit log) — server action
// Derives user/org from session, checks audit.view permission.
// ─────────────────────────────────────────────

export async function fetchEmployeeActivity(
  orgSlug: string,
  employeeId: string,
  page = 1,
  pageSize = 20
): Promise<ActionResult & { data?: { entries: unknown[]; total: number } }> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'audit.view')

  const result = await dbAs(userId, async (tx) => {
    const entries = await tx.auditLog.findMany({
      where: { orgId: org.id, targetType: 'employee', targetId: employeeId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    const total = await tx.auditLog.count({
      where: { orgId: org.id, targetType: 'employee', targetId: employeeId },
    })
    return { entries, total }
  })

  return { success: true, data: result }
}

/**
 * Bulk archive employees. Validates each employee's status transition individually.
 */
export async function bulkArchiveEmployees(
  orgSlug: string,
  employeeIds: string[]
): Promise<ActionResult & { data?: { archived: number; skipped: number } }> {
  if (!employeeIds.length || employeeIds.length > 100) {
    return { success: false, error: 'Select between 1 and 100 employees' }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.archive')

  const result = await dbAs(userId, async (tx) => {
    // Fetch current statuses
    const employees = await tx.employee.findMany({
      where: { id: { in: employeeIds }, orgId: org.id },
      select: { id: true, employmentStatus: true, firstName: true, lastName: true },
    })

    let archived = 0
    let skipped = 0

    for (const emp of employees) {
      // Only DEACTIVATED employees can transition to ARCHIVED per lifecycle rules
      if (emp.employmentStatus !== 'DEACTIVATED') {
        skipped++
        continue
      }

      await tx.employee.update({
        where: { id: emp.id },
        data: { employmentStatus: 'ARCHIVED' },
      })
      archived++
    }

    return { archived, skipped }
  })

  if (result.archived > 0) {
    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'employee.bulk_archived',
      targetType: 'employee',
      targetId: org.id,
      after: { count: result.archived, employeeIds },
    })
  }

  revalidatePath(`/${orgSlug}/employees`)
  return { success: true, data: result }
}
