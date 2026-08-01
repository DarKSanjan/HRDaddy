/**
 * Shared employee creation logic.
 *
 * Both the single-employee `createEmployee` action and the bulk-import action
 * call through this helper so there is exactly one source of truth for "how to
 * persist a new employee row and fire its side-effects."
 */
import 'server-only'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { emit } from '@/core/events'
import { encryptPII } from '@/core/employees/pii-crypto'
import type { CreateEmployeeInput } from './schemas'

export interface CreateEmployeeCoreParams {
  orgId: string
  orgSlug: string
  userId: string
  input: CreateEmployeeInput
  /** When true, skip the work-email-uniqueness check (caller already verified). */
  skipEmailUniquenessCheck?: boolean
  /** When true, skip the manager-exists check (caller already verified). */
  skipManagerCheck?: boolean
}

export interface CreateEmployeeCoreResult {
  success: boolean
  employeeId?: string
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Create one employee with all side-effects (audit, event emit).
 * Does NOT call revalidatePath — caller is responsible for that.
 */
export async function createEmployeeCore(
  params: CreateEmployeeCoreParams
): Promise<CreateEmployeeCoreResult> {
  const { orgId, userId, input, skipEmailUniquenessCheck, skipManagerCheck } = params

  // Check work email uniqueness within org
  if (!skipEmailUniquenessCheck) {
    const exists = await dbAs(userId, async (tx) => {
      return tx.employee.findFirst({
        where: { orgId, workEmail: input.workEmail },
        select: { id: true },
      })
    })
    if (exists) {
      return { success: false, fieldErrors: { workEmail: 'An employee with this email already exists' } }
    }
  }

  // Validate manager exists if managerId provided
  if (input.managerId && !skipManagerCheck) {
    const managerExists = await dbAs(userId, async (tx) => {
      return tx.employee.findFirst({
        where: { id: input.managerId!, orgId },
        select: { id: true },
      })
    })
    if (!managerExists) {
      return { success: false, fieldErrors: { managerId: 'Manager not found' } }
    }
  }

  const employee = await dbAs(userId, async (tx) => {
    const createdEmployee = await tx.employee.create({
      data: {
        orgId,
        firstName: input.firstName,
        lastName: input.lastName,
        workEmail: input.workEmail,
        personalEmail: input.personalEmail || null,
        phone: input.phone || null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender || null,
        nationalId: encryptPII(input.nationalId || null),
        address: input.address || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        departmentId: input.departmentId || null,
        jobTitleId: input.jobTitleId || null,
        locationId: input.locationId || null,
        employmentTypeId: input.employmentTypeId || null,
        managerId: input.managerId || null,
        compensationAmountCents: input.compensationAmountCents ?? null,
        compensationCurrency: input.compensationCurrency || null,
        payType: input.payType ?? 'SALARIED',
        isWorkman: input.isWorkman ?? false,
        shiftTemplateId: input.shiftTemplateId || null,
        bankName: encryptPII(input.bankName || null),
        bankAccountNumber: encryptPII(input.bankAccountNumber || null),
        employmentStatus: 'DRAFT',
      },
    })

    await writeAudit({
      orgId,
      actorId: userId,
      action: 'employee.created',
      targetType: 'employee',
      targetId: createdEmployee.id,
      after: { firstName: input.firstName, lastName: input.lastName, workEmail: input.workEmail },
    }, tx)

    return createdEmployee
  })

  await emit('employee.created', { employeeId: employee.id }, { orgId, userId })

  return { success: true, employeeId: employee.id }
}
