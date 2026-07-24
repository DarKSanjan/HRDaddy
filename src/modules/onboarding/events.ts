/**
 * Onboarding event handlers — listens to employee lifecycle events.
 *
 * Registered during module manifest import. Handlers are idempotent and must
 * not throw (the event bus logs and continues).
 *
 * Uses core services which have dbAdmin access internally.
 */
import {
  recomputeOnboardingDueDates,
  cancelOnboardingsForEmployee,
} from '@/core/onboarding'
import { on } from '@/core/events'
import type { EmploymentStatus } from '@prisma/client'

/**
 * When an employee's start date changes, recompute due dates for all
 * incomplete onboarding tasks.
 */
on('employee.updated', async (payload, ctx) => {
  const { employeeId, changes } = payload as {
    employeeId: string
    changes: { startDate?: Date | null }
  }
  if (!changes.startDate) return
  await recomputeOnboardingDueDates(ctx.orgId, employeeId, new Date(changes.startDate))
})

/**
 * When an employee is deactivated, cancel any in-flight onboarding.
 */
on('employee.status_changed', async (payload, ctx) => {
  const { employeeId, to } = payload as {
    employeeId: string
    from: EmploymentStatus
    to: EmploymentStatus
  }

  if (to !== 'DEACTIVATED' && to !== 'ARCHIVED') return

  await cancelOnboardingsForEmployee(ctx.orgId, employeeId, 'Employee deactivated')
})
