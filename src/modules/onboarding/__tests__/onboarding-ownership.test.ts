/**
 * Unit tests for the assignee-ownership check on completeTask/reopenTask.
 *
 * onboarding.complete_task is granted to every role so employees can work
 * their own checklist — without an ownership check, that same permission key
 * would let any employee act on any other employee's task by taskId, since
 * nothing else scopes it. These tests pin the fix: self-service works for
 * your own task, is rejected for someone else's, and HR/Owner (onboarding.view_all)
 * retain full oversight regardless of assignee.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const TASK_ID = 'cltask00000000000000000001'

const mockTask = {
  id: TASK_ID,
  status: 'PENDING' as string,
  assigneeId: 'employee-self',
  onboardingId: 'onboarding-1',
  onboarding: { status: 'IN_PROGRESS' },
}

const findFirst = vi.fn(async () => mockTask)
const update = vi.fn(async () => ({}))
const count = vi.fn(async () => 1)
const onboardingUpdate = vi.fn(async () => ({}))

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/permissions', () => ({
  hasPermission: vi.fn((role: string, _enabledModules: string[], key: string) =>
    key === 'onboarding.view_all' ? role === 'OWNER' || role === 'HR_ADMIN' : true
  ),
}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({
      employeeOnboardingTask: { findFirst, update, count },
      employeeOnboarding: { update: onboardingUpdate },
    })
  ),
}))

vi.mock('@/core/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/core/events', () => ({ emit: vi.fn() }))
vi.mock('@/core/notifications', () => ({ getNotificationAdapter: () => ({ send: vi.fn() }) }))
vi.mock('@/core/calendar/holidays-sg', () => ({ getHolidaysForRange: vi.fn(() => []) }))
vi.mock('@/core/onboarding', () => ({
  calculateWorkingDayDueDate: vi.fn(),
  resolveOnboardingAssignee: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let currentRole = 'EMPLOYEE'
let callerEmployeeId = 'employee-self'

vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn(async () => ({
    org: { id: 'org-1', name: 'Test', slug: 'test' },
    enabledModules: ['employees', 'onboarding'],
    membership: { id: 'mem-1', role: currentRole, isActive: true },
  })),
  requirePermission: vi.fn(async () => ({ userId: 'user-1', role: currentRole })),
}))

vi.mock('@/core/employees', () => ({
  getEmployeeIdForUser: vi.fn(async () => callerEmployeeId),
  getOrgSettings: vi.fn(async () => ({ timezone: 'Asia/Singapore', workingDays: [1, 2, 3, 4, 5] })),
}))

import { completeTask, reopenTask } from '../actions'

describe('completeTask / reopenTask — assignee ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRole = 'EMPLOYEE'
    callerEmployeeId = 'employee-self'
    mockTask.status = 'PENDING'
    findFirst.mockImplementation(async () => mockTask)
  })

  it('completeTask succeeds for the assigned employee completing their own task', async () => {
    const result = await completeTask('test', { taskId: TASK_ID })
    expect(result.success).toBe(true)
    expect(update).toHaveBeenCalled()
  })

  it('completeTask rejects an employee completing a task assigned to someone else', async () => {
    callerEmployeeId = 'a-different-employee'
    const result = await completeTask('test', { taskId: TASK_ID })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/only complete tasks assigned to you/i)
    expect(update).not.toHaveBeenCalled()
  })

  it('completeTask allows HR/Owner (onboarding.view_all) to complete any task', async () => {
    currentRole = 'OWNER'
    callerEmployeeId = 'a-different-employee'
    const result = await completeTask('test', { taskId: TASK_ID })
    expect(result.success).toBe(true)
    expect(update).toHaveBeenCalled()
  })

  it('reopenTask succeeds for the assigned employee reopening their own completed task', async () => {
    mockTask.status = 'COMPLETED'
    const result = await reopenTask('test', { taskId: TASK_ID })
    expect(result.success).toBe(true)
    expect(update).toHaveBeenCalled()
  })

  it('reopenTask rejects an employee reopening a task assigned to someone else', async () => {
    mockTask.status = 'COMPLETED'
    callerEmployeeId = 'a-different-employee'
    const result = await reopenTask('test', { taskId: TASK_ID })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/only reopen tasks assigned to you/i)
    expect(update).not.toHaveBeenCalled()
  })

  it('reopenTask allows HR/Owner (onboarding.view_all) to reopen any task', async () => {
    mockTask.status = 'COMPLETED'
    currentRole = 'OWNER'
    callerEmployeeId = 'a-different-employee'
    const result = await reopenTask('test', { taskId: TASK_ID })
    expect(result.success).toBe(true)
    expect(update).toHaveBeenCalled()
  })
})
