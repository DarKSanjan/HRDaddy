/**
 * Cross-tenant isolation, against the live database.
 *
 * Skipped unless RUN_DB_TESTS=1:
 *   set -a; . ./.env; set +a; RUN_DB_TESTS=1 npx vitest run <this file>
 *
 * This file exists because tenant isolation is the one property that must not
 * be taken on trust. It is enforced twice — application checks and Postgres
 * RLS — and the point of these tests is to attack each layer, including with
 * the application layer deliberately bypassed, so a regression in either one
 * fails here rather than in production.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'

const RUN = process.env.RUN_DB_TESTS === '1'

const sfx = randomUUID().slice(0, 8)
const orgA = { id: randomUUID(), slug: `itest-a-${sfx}`, name: 'Org A' }
const orgB = { id: randomUUID(), slug: `itest-b-${sfx}`, name: 'Org B' }
const userA = { id: randomUUID(), email: `a-${sfx}@example.test`, name: 'User A' }
const userB = { id: randomUUID(), email: `b-${sfx}@example.test`, name: 'User B' }
const empA = { id: randomUUID(), name: 'Alice InA' }
const empB = { id: randomUUID(), name: 'Bob InB' }

describe.runIf(RUN)('employees — cross-tenant isolation (live database)', () => {
  beforeAll(async () => {
    const { dbAdmin } = await import('@/core/db/admin')

    for (const u of [userA, userB]) {
      await dbAdmin.user.create({ data: { id: u.id, email: u.email, name: u.name } })
    }
    for (const [org, user, emp] of [
      [orgA, userA, empA],
      [orgB, userB, empB],
    ] as const) {
      await dbAdmin.organisation.create({ data: { id: org.id, name: org.name, slug: org.slug } })
      await dbAdmin.organisationMembership.create({
        data: { userId: user.id, orgId: org.id, role: 'OWNER', isActive: true },
      })
      await dbAdmin.employee.create({
        data: {
          id: emp.id,
          orgId: org.id,
          firstName: emp.name.split(' ')[0],
          lastName: emp.name.split(' ')[1],
          workEmail: `${emp.id}@example.test`,
          employmentStatus: 'ACTIVE',
          nationalId: 'S1234567D', // sensitive
        },
      })
    }
  }, 60_000)

  afterAll(async () => {
    if (!RUN) return
    const { dbAdmin } = await import('@/core/db/admin')
    await dbAdmin.organisation.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } })
    await dbAdmin.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
    await dbAdmin.$disconnect()
  }, 60_000)

  it('a member sees only their own organisation employees', async () => {
    const { dbAs } = await import('@/core/db/client')

    const seenByA = await dbAs(userA.id, (tx) => tx.employee.findMany())
    const ids = seenByA.map((e) => e.id)

    expect(ids).toContain(empA.id)
    expect(ids).not.toContain(empB.id)
  }, 60_000)

  it('reading another organisation employee by id returns nothing', async () => {
    const { dbAs } = await import('@/core/db/client')

    // A direct lookup by a known id is the IDOR case: guessing the id must not
    // be enough, because the row is invisible regardless of how it is asked for.
    const stolen = await dbAs(userA.id, (tx) =>
      tx.employee.findUnique({ where: { id: empB.id } })
    )

    expect(stolen).toBeNull()
  }, 60_000)

  it('updating another organisation employee affects no rows', async () => {
    const { dbAs } = await import('@/core/db/client')
    const { dbAdmin } = await import('@/core/db/admin')

    const result = await dbAs(userA.id, (tx) =>
      tx.employee.updateMany({
        where: { id: empB.id },
        data: { firstName: 'Hijacked' },
      })
    )
    expect(result.count).toBe(0)

    const untouched = await dbAdmin.employee.findUnique({ where: { id: empB.id } })
    expect(untouched?.firstName).toBe('Bob')
  }, 60_000)

  it('deleting another organisation employee affects no rows', async () => {
    const { dbAs } = await import('@/core/db/client')
    const { dbAdmin } = await import('@/core/db/admin')

    const result = await dbAs(userA.id, (tx) =>
      tx.employee.deleteMany({ where: { id: empB.id } })
    )
    expect(result.count).toBe(0)

    expect(await dbAdmin.employee.count({ where: { id: empB.id } })).toBe(1)
  }, 60_000)

  it('organisations themselves are not enumerable across tenants', async () => {
    const { dbAs } = await import('@/core/db/client')

    const orgs = await dbAs(userA.id, (tx) => tx.organisation.findMany())
    const slugs = orgs.map((o) => o.slug)

    expect(slugs).toContain(orgA.slug)
    expect(slugs).not.toContain(orgB.slug)
  }, 60_000)

  it('a deactivated membership loses access entirely', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { dbAs } = await import('@/core/db/client')

    await dbAdmin.organisationMembership.updateMany({
      where: { userId: userA.id, orgId: orgA.id },
      data: { isActive: false },
    })

    try {
      const seen = await dbAs(userA.id, (tx) => tx.employee.findMany())
      expect(seen).toHaveLength(0)
    } finally {
      await dbAdmin.organisationMembership.updateMany({
        where: { userId: userA.id, orgId: orgA.id },
        data: { isActive: true },
      })
    }
  }, 60_000)

  it('a user with no membership at all sees nothing', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { dbAs } = await import('@/core/db/client')

    const stranger = randomUUID()
    await dbAdmin.user.create({
      data: { id: stranger, email: `s-${sfx}@example.test`, name: 'Stranger' },
    })

    try {
      const seen = await dbAs(stranger, (tx) => tx.employee.findMany())
      expect(seen).toHaveLength(0)
    } finally {
      await dbAdmin.user.delete({ where: { id: stranger } })
    }
  }, 60_000)

  it('audit rows are tenant-scoped', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { dbAs } = await import('@/core/db/client')

    await dbAdmin.auditLog.create({
      data: {
        orgId: orgB.id,
        actorId: userB.id,
        action: 'employee.create',
        targetType: 'employee',
        targetId: empB.id,
      },
    })

    const seenByA = await dbAs(userA.id, (tx) =>
      tx.auditLog.findMany({ where: { orgId: orgB.id } })
    )
    expect(seenByA).toHaveLength(0)
  }, 60_000)

  it('audit rows cannot be mutated through the RLS-scoped client', async () => {
    const { dbAdmin } = await import('@/core/db/admin')
    const { dbAs } = await import('@/core/db/client')

    const row = await dbAdmin.auditLog.create({
      data: {
        orgId: orgA.id,
        actorId: userA.id,
        action: 'employee.update',
        targetType: 'employee',
        targetId: empA.id,
      },
    })

    // UPDATE and DELETE are revoked from `authenticated` in 00001, so this must
    // fail at the database rather than merely being avoided by convention.
    await expect(
      dbAs(userA.id, (tx) =>
        tx.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } })
      )
    ).rejects.toThrow()

    const after = await dbAdmin.auditLog.findUnique({ where: { id: row.id } })
    expect(after?.action).toBe('employee.update')
  }, 60_000)
})
