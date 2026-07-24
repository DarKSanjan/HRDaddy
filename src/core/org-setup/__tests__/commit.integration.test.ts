/**
 * Live integration check for commitOrgSetup.
 *
 * Hits the real database, so it is skipped unless RUN_DB_TESTS=1. The unit
 * tests mock Prisma, which is exactly why they could not catch the
 * interactive-transaction timeout that a real round trip to Singapore exposed.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'crypto'

const RUN = process.env.RUN_DB_TESTS === '1'
const slug = `itest-${randomUUID().slice(0, 8)}`

describe.runIf(RUN)('commitOrgSetup (live database)', () => {
  afterAll(async () => {
    if (!RUN) return
    const { dbAdmin } = await import('@/core/db/admin')
    await dbAdmin.organisation.deleteMany({ where: { slug } })
    await dbAdmin.$disconnect()
  })

  it('creates the whole organisation inside the transaction budget', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { commitOrgSetup } = await import('@/core/org-setup')

    // A user row is required for the membership foreign key.
    const userId = randomUUID()
    await dbAdmin.user.create({
      data: { id: userId, email: `${slug}@example.test`, name: 'Integration' },
    })
    await dbAdmin.orgSetupProgress.create({
      data: { userId, step: 5, data: {} },
    })

    const wizardData = {
      step2: {
        legalName: 'Integration Test Pte Ltd',
        slug,
        companySize: '1-10',
        industry: 'Technology',
        country: 'Singapore',
        timezone: 'Asia/Singapore',
        currency: 'SGD',
        leaveYearStart: '01-01',
        workingDays: [1, 2, 3, 4, 5],
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
      },
      step3: {
        modules: ['employees', 'leave', 'attendance', 'onboarding', 'documents', 'payroll'],
      },
      step4: {
        departments: [
          { name: 'Engineering' }, { name: 'Design' }, { name: 'Sales' },
          { name: 'Operations' }, { name: 'Finance' },
        ],
        jobTitles: [
          { title: 'Software Engineer' }, { title: 'Product Designer' },
          { title: 'Account Executive' }, { title: 'Operations Manager' },
          { title: 'Accountant' },
        ],
        leaveTypes: [
          { name: 'Annual Leave', daysPerYear: 14 },
          { name: 'Outpatient Sick Leave', daysPerYear: 14 },
          { name: 'Hospitalisation Leave', daysPerYear: 60 },
          { name: 'Maternity Leave', daysPerYear: 112 },
          { name: 'Paternity Leave', daysPerYear: 28 },
          { name: 'Childcare Leave', daysPerYear: 6 },
        ],
      },
      step5: {
        invitations: [
          { email: 'hr@example.test', role: 'HR_ADMIN' as const },
          { email: 'mgr@example.test', role: 'MANAGER' as const },
        ],
        skip: false,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const started = Date.now()
    const { org } = await commitOrgSetup(userId, wizardData)
    const elapsed = Date.now() - started

    expect(org.slug).toBe(slug)

    const [modules, depts, titles, types, policies, invites, progress] =
      await Promise.all([
        dbAdmin.organisationModule.count({ where: { orgId: org.id } }),
        dbAdmin.department.count({ where: { orgId: org.id } }),
        dbAdmin.jobTitle.count({ where: { orgId: org.id } }),
        dbAdmin.leaveType.count({ where: { orgId: org.id } }),
        dbAdmin.leavePolicy.count({ where: { orgId: org.id } }),
        dbAdmin.invitation.count({ where: { orgId: org.id } }),
        dbAdmin.orgSetupProgress.count({ where: { userId } }),
      ])

    expect(modules).toBe(6)
    expect(depts).toBe(5)
    expect(titles).toBe(5)
    expect(types).toBe(6)
    expect(policies).toBe(6)
    expect(invites).toBe(2)
    expect(progress).toBe(0) // consumed on success

    // The failure this guards against was a 5s timeout.
    expect(elapsed).toBeLessThan(15_000)
    console.log(`commitOrgSetup completed in ${elapsed}ms`)
  }, 60_000)
})
