import { dbAs } from '@/core/db/client'
import { SG_HOLIDAYS_2026, SG_HOLIDAYS_2027 } from '@/core/calendar/holidays-sg'

export async function seedCalendarForOrg(orgId: string, userId?: string) {
  const effectiveUserId = userId ?? 'system'
  const fixtures = [...SG_HOLIDAYS_2026.holidays, ...SG_HOLIDAYS_2027.holidays]

  for (const h of fixtures) {
    const [y, m, d] = h.date.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))

    await dbAs(effectiveUserId, async (tx) => {
      const existing = await tx.holiday.findFirst({
        where: { orgId, date, name: h.name },
      })
      if (!existing) {
        await tx.holiday.create({
          data: { orgId, date, name: h.name },
        })
      }
    })
  }
}
