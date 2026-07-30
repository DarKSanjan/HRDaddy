import type { PrismaClient } from '@prisma/client'
import { SG_HOLIDAYS_2026, SG_HOLIDAYS_2027 } from '../src/core/calendar/holidays-sg'

export async function seedCalendar(
  db: PrismaClient,
  orgId: string,
  employeeIdMap: Record<string, string>
) {
  const existing = await db.holiday.findFirst({ where: { orgId } })
  if (existing) {
    console.log('  ↳ Calendar holidays already seeded — skipping')
    return
  }

  const fixtures = [...SG_HOLIDAYS_2026.holidays, ...SG_HOLIDAYS_2027.holidays]

  for (const h of fixtures) {
    const [y, m, d] = h.date.split('-').map(Number)
    await db.holiday.create({
      data: {
        orgId,
        date: new Date(Date.UTC(y, m - 1, d)),
        name: h.name,
      },
    })
  }

  console.log(`  ↳ Seeded ${fixtures.length} holidays`)

  const ownerEmail = Object.keys(employeeIdMap)[0]
  const creatorId = employeeIdMap[ownerEmail]
  if (!creatorId) return

  await db.calendarEvent.create({
    data: {
      orgId,
      title: 'All-Hands Meeting',
      date: new Date(Date.UTC(2026, 2, 15)),
      audience: 'COMPANY',
      createdById: creatorId,
    },
  })

  await db.calendarEvent.create({
    data: {
      orgId,
      title: 'Office Closed for Renovation',
      date: new Date(Date.UTC(2026, 5, 20)),
      audience: 'COMPANY',
      createdById: creatorId,
    },
  })

  console.log('  ↳ Seeded 2 calendar events')
}
