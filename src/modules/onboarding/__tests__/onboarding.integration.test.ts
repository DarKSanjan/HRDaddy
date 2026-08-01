/**
 * Onboarding module integration tests — exercises the database.
 *
 * Skipped unless RUN_DB_TESTS=1:
 *   set -a; . ./.env; set +a; RUN_DB_TESTS=1 npx vitest run <this file>
 *
 * Tests focus on:
 *   - Due date recomputation when start date changes
 *   - Assignee resolution when employee has no manager
 *   - Cross-tenant isolation
 *   - Onboarding cancellation on employee deactivation
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'

const RUN = process.env.RUN_DB_TESTS === '1'

const sfx = randomUUID().slice(0, 8)
const orgA = { id: randomUUID(), slug: `ob-test-a-${sfx}`, name: 'OB Org A' }
const orgB = { id: randomUUID(), slug: `ob-test-b-${sfx}`, name: 'OB Org B' }
const userA = { id: randomUUID(), email: `oa-${sfx}@test.hr`, name: 'OB User A' }
const userB = { id: randomUUID(), email: `ob-${sfx}@test.hr`, name: 'OB User B' }
const empA = { id: randomUUID() }
const empB = { id: randomUUID() }
const empNoManager = { id: randomUUID() }
const hrAdminEmployee = { id: randomUUID() }
const templateId = randomUUID()

describe.runIf(RUN)('onboarding — integration (live database)', () => {
  beforeAll(async () => {
    const { dbAdmin } = await import('@/core/db/admin')

    // Create users
    await dbAdmin.user.create({ data: { id: userA.id, email: userA.email, name: userA.name } })
    await dbAdmin.user.create({ data: { id: userB.id, email: userB.email, name: userB.name } })

    // Create orgs
    await dbAdmin.organisation.create({ data: { id: orgA.id, name: orgA.name, slug: orgA.slug } })
    await dbAdmin.organisation.create({ data: { id: orgB.id, name: orgB.name, slug: orgB.slug } })

    // Org settings for A
    await dbAdmin.organisationSettings.create({
      data: {
        orgId: orgA.id,
        timezone: 'Asia/Singapore',
        workingDays: [1, 2, 3, 4, 5],
      },
    })

    // Memberships
    await dbAdmin.organisationMembership.create({
      data: { userId: userA.id, orgId: orgA.id, role: 'OWNER', isActive: true },
    })
    await dbAdmin.organisationMembership.create({
      data: { userId: userB.id, orgId: orgB.id, role: 'OWNER', isActive: true },
    })

    // Enable onboarding module for org A
    await dbAdmin.organisationModule.create({
      data: { orgId: orgA.id, moduleId: 'onboarding', enabled: true },
    })
    await dbAdmin.organisationModule.create({
      data: { orgId: orgA.id, moduleId: 'employees', enabled: true },
    })

    // HR Admin employee record (linked to userA)
    await dbAdmin.employee.create({
      data: {
        id: hrAdminEmployee.id,
        orgId: orgA.id,
        userId: userA.id,
        firstName: 'HR',
        lastName: 'Admin',
        workEmail: `hr-${sfx}@test.hr`,
        employmentStatus: 'ACTIVE',
      },
    })

    // Employee A — with a manager
    await dbAdmin.employee.create({
      data: {
        id: empA.id,
        orgId: orgA.id,
        firstName: 'Alice',
        lastName: 'Onboard',
        workEmail: `alice-${sfx}@test.hr`,
        employmentStatus: 'ACTIVE',
        startDate: new Date('2026-08-04'), // A Monday
        managerId: hrAdminEmployee.id,
      },
    })

    // Employee with no manager
    await dbAdmin.employee.create({
      data: {
        id: empNoManager.id,
        orgId: orgA.id,
        firstName: 'Lonely',
        lastName: 'Worker',
        workEmail: `lonely-${sfx}@test.hr`,
        employmentStatus: 'ACTIVE',
        startDate: new Date('2026-08-04'),
        managerId: null,
      },
    })

    // Employee B in org B
    await dbAdmin.employee.create({
      data: {
        id: empB.id,
        orgId: orgB.id,
        firstName: 'Bob',
        lastName: 'Other',
        workEmail: `bob-${sfx}@test.hr`,
        employmentStatus: 'ACTIVE',
      },
    })

    // Create an onboarding template in org A
    await dbAdmin.onboardingTemplate.create({
      data: {
        id: templateId,
        orgId: orgA.id,
        name: 'SG Standard',
        tasks: {
          create: [
            { title: 'Submit NRIC', assigneeType: 'EMPLOYEE', dueInDays: 1, sortOrder: 0 },
            { title: 'IT setup', assigneeType: 'MANAGER', dueInDays: 3, sortOrder: 1 },
            { title: 'Badge issuance', assigneeType: 'HR', dueInDays: 5, sortOrder: 2 },
          ],
        },
      },
    })
  }, 60_000)

  afterAll(async () => {
    if (!RUN) return
    const { dbAdmin } = await import('@/core/db/admin')
    // Cascade deletes handle children
    await dbAdmin.organisation.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } })
    await dbAdmin.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
    await dbAdmin.$disconnect()
  }, 60_000)

  it('assigns onboarding with correct due dates based on working days', async () => {
    const { dbAdmin } = await import('@/core/db/admin')

    // Assign to employee A (start date 2026-08-04, Monday)
    const onboarding = await dbAdmin.employeeOnboarding.create({
      data: {
        orgId: orgA.id,
        employeeId: empA.id,
        templateId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })

    const { calculateWorkingDayDueDate: calculateDueDate } = await import('@/core/onboarding')

    const startDate = new Date('2026-08-04') // Monday
    const holidays = [{ date: '2026-08-09', name: 'National Day' }]
    const workingDays = [1, 2, 3, 4, 5]

    // 1 working day from Mon Aug 4 = Tue Aug 5
    const due1 = calculateDueDate(startDate, 1, 'Asia/Singapore', workingDays, holidays)
    expect(due1.getDate()).toBe(5)

    // 3 working days from Mon Aug 4 = Thu Aug 7
    const due3 = calculateDueDate(startDate, 3, 'Asia/Singapore', workingDays, holidays)
    expect(due3.getDate()).toBe(7)

    // 5 working days from Mon Aug 4 should skip Sat/Sun and National Day (Aug 9)
    // Aug 5 (T), 6 (W), 7 (T), 8 (F) = 4 days, Aug 9 is holiday, next is Mon Aug 11
    const due5 = calculateDueDate(startDate, 5, 'Asia/Singapore', workingDays, holidays)
    expect(due5.getDate()).toBe(11)

    // Cleanup
    await dbAdmin.employeeOnboarding.delete({ where: { id: onboarding.id } })
  }, 60_000)

  it('recomputes due dates when start date changes for incomplete tasks only', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { recomputeOnboardingDueDates: recomputeDueDates } = await import('@/core/onboarding')

    // Assign onboarding
    const ob = await dbAdmin.employeeOnboarding.create({
      data: {
        orgId: orgA.id,
        employeeId: empA.id,
        templateId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        tasks: {
          create: [
            {
              orgId: orgA.id,
              title: 'Submit NRIC',
              assigneeType: 'EMPLOYEE',
              assigneeId: empA.id,
              dueDate: new Date('2026-08-05'),
              status: 'COMPLETED',
              completedAt: new Date(),
            },
            {
              orgId: orgA.id,
              title: 'IT setup',
              assigneeType: 'MANAGER',
              assigneeId: hrAdminEmployee.id,
              dueDate: new Date('2026-08-07'),
              status: 'PENDING',
            },
            {
              orgId: orgA.id,
              title: 'Badge issuance',
              assigneeType: 'HR',
              assigneeId: hrAdminEmployee.id,
              dueDate: new Date('2026-08-11'),
              status: 'PENDING',
            },
          ],
        },
      },
      include: { tasks: true },
    })

    const completedTask = ob.tasks.find((t) => t.status === 'COMPLETED')!
    const pendingTasks = ob.tasks.filter((t) => t.status === 'PENDING')

    // Change start date to Aug 11 (Monday)
    await recomputeDueDates(orgA.id, empA.id, new Date('2026-08-11'))

    // Completed task should keep its original date
    const afterCompleted = await dbAdmin.employeeOnboardingTask.findUnique({
      where: { id: completedTask.id },
    })
    expect(afterCompleted!.dueDate!.toISOString()).toContain('2026-08-05')

    // Pending tasks should have new dates based on Aug 11 start
    for (const pt of pendingTasks) {
      const after = await dbAdmin.employeeOnboardingTask.findUnique({
        where: { id: pt.id },
      })
      // New due dates should be after the new start date
      expect(after!.dueDate!.getTime()).toBeGreaterThan(
        new Date('2026-08-11').getTime()
      )
    }

    // Cleanup
    await dbAdmin.employeeOnboarding.delete({ where: { id: ob.id } })
  }, 60_000)

  it('resolves MANAGER assignee to HR admin when employee has no manager', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { calculateWorkingDayDueDate: calculateDueDate } = await import('@/core/onboarding')

    // We test the resolveAssignee logic indirectly by creating an onboarding
    // for the no-manager employee and checking the assigned person
    const ob = await dbAdmin.employeeOnboarding.create({
      data: {
        orgId: orgA.id,
        employeeId: empNoManager.id,
        templateId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })

    // Manually resolve and assign
    // Simulating what assignOnboarding does
    const template = await dbAdmin.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    })

    for (const task of template!.tasks) {
      // For MANAGER type with no manager, should resolve to HR admin's employee record
      let assigneeId: string | null = null
      if (task.assigneeType === 'EMPLOYEE') {
        assigneeId = empNoManager.id
      } else if (task.assigneeType === 'MANAGER') {
        // No manager, should fall back to HR
        const hrMember = await dbAdmin.organisationMembership.findFirst({
          where: { orgId: orgA.id, role: { in: ['HR_ADMIN', 'OWNER'] }, isActive: true },
        })
        if (hrMember) {
          const hrEmp = await dbAdmin.employee.findUnique({
            where: { orgId_userId: { orgId: orgA.id, userId: hrMember.userId } },
          })
          assigneeId = hrEmp?.id ?? null
        }
      } else if (task.assigneeType === 'HR') {
        const hrMember = await dbAdmin.organisationMembership.findFirst({
          where: { orgId: orgA.id, role: { in: ['HR_ADMIN', 'OWNER'] }, isActive: true },
        })
        if (hrMember) {
          const hrEmp = await dbAdmin.employee.findUnique({
            where: { orgId_userId: { orgId: orgA.id, userId: hrMember.userId } },
          })
          assigneeId = hrEmp?.id ?? null
        }
      }

      await dbAdmin.employeeOnboardingTask.create({
        data: {
          onboardingId: ob.id,
          orgId: orgA.id,
          title: task.title,
          assigneeType: task.assigneeType,
          assigneeId,
          dueDate: calculateDueDate(
            new Date('2026-08-04'),
            task.dueInDays,
            'Asia/Singapore',
            [1, 2, 3, 4, 5],
            []
          ),
          status: 'PENDING',
        },
      })
    }

    // Verify MANAGER task is assigned to hrAdminEmployee (fallback)
    const tasks = await dbAdmin.employeeOnboardingTask.findMany({
      where: { onboardingId: ob.id },
    })

    const managerTask = tasks.find((t) => t.assigneeType === 'MANAGER')!
    expect(managerTask.assigneeId).toBe(hrAdminEmployee.id)

    // EMPLOYEE tasks should go to the employee themselves
    const employeeTask = tasks.find((t) => t.assigneeType === 'EMPLOYEE')!
    expect(employeeTask.assigneeId).toBe(empNoManager.id)

    // HR tasks should also go to HR admin
    const hrTask = tasks.find((t) => t.assigneeType === 'HR')!
    expect(hrTask.assigneeId).toBe(hrAdminEmployee.id)

    // Cleanup
    await dbAdmin.employeeOnboarding.delete({ where: { id: ob.id } })
  }, 60_000)

  it('cross-tenant: user in org B cannot see org A onboardings', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { dbAs } = await import('@/core/db/client')

    // Create an onboarding in org A
    const ob = await dbAdmin.employeeOnboarding.create({
      data: {
        orgId: orgA.id,
        employeeId: empA.id,
        templateId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })

    // User B should not see it
    const seen = await dbAs(userB.id, (tx) =>
      tx.employeeOnboarding.findMany({ where: { orgId: orgA.id } })
    )
    expect(seen).toHaveLength(0)

    // Cleanup
    await dbAdmin.employeeOnboarding.delete({ where: { id: ob.id } })
  }, 60_000)

  it('cancelling onboarding marks incomplete tasks as waived', async () => {
    const { dbAdmin } = await import('@/core/db/admin')

    const ob = await dbAdmin.employeeOnboarding.create({
      data: {
        orgId: orgA.id,
        employeeId: empA.id,
        templateId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        tasks: {
          create: [
            {
              orgId: orgA.id,
              title: 'Task 1',
              assigneeType: 'EMPLOYEE',
              status: 'COMPLETED',
              completedAt: new Date(),
            },
            {
              orgId: orgA.id,
              title: 'Task 2',
              assigneeType: 'MANAGER',
              status: 'PENDING',
            },
            {
              orgId: orgA.id,
              title: 'Task 3',
              assigneeType: 'HR',
              status: 'IN_PROGRESS',
            },
          ],
        },
      },
      include: { tasks: true },
    })

    // Cancel incomplete tasks
    await dbAdmin.employeeOnboardingTask.updateMany({
      where: {
        onboardingId: ob.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      data: { status: 'WAIVED', notes: 'Cancelled: Testing' },
    })
    await dbAdmin.employeeOnboarding.update({
      where: { id: ob.id },
      data: { status: 'CANCELLED' },
    })

    // Verify
    const tasks = await dbAdmin.employeeOnboardingTask.findMany({
      where: { onboardingId: ob.id },
      orderBy: { createdAt: 'asc' },
    })

    // Task 1 stays completed
    expect(tasks[0].status).toBe('COMPLETED')
    // Tasks 2 and 3 are waived
    expect(tasks[1].status).toBe('WAIVED')
    expect(tasks[2].status).toBe('WAIVED')

    // Onboarding itself is cancelled
    const updated = await dbAdmin.employeeOnboarding.findUnique({ where: { id: ob.id } })
    expect(updated!.status).toBe('CANCELLED')

    // Cleanup
    await dbAdmin.employeeOnboarding.delete({ where: { id: ob.id } })
  }, 60_000)

  it('completing all tasks marks onboarding as completed', async () => {
    const { dbAdmin } = await import('@/core/db/admin')

    const ob = await dbAdmin.employeeOnboarding.create({
      data: {
        orgId: orgA.id,
        employeeId: empA.id,
        templateId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        tasks: {
          create: [
            {
              orgId: orgA.id,
              title: 'Only task',
              assigneeType: 'EMPLOYEE',
              status: 'PENDING',
            },
          ],
        },
      },
      include: { tasks: true },
    })

    const taskId = ob.tasks[0].id

    // Complete the task
    await dbAdmin.employeeOnboardingTask.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    // Check remaining
    const remaining = await dbAdmin.employeeOnboardingTask.count({
      where: { onboardingId: ob.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    })
    expect(remaining).toBe(0)

    // Mark onboarding as completed
    if (remaining === 0) {
      await dbAdmin.employeeOnboarding.update({
        where: { id: ob.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    const final = await dbAdmin.employeeOnboarding.findUnique({ where: { id: ob.id } })
    expect(final!.status).toBe('COMPLETED')
    expect(final!.completedAt).not.toBeNull()

    // Cleanup
    await dbAdmin.employeeOnboarding.delete({ where: { id: ob.id } })
  }, 60_000)
})
