/**
 * Performance review reminders — system-level cron logic.
 * Uses dbAdmin (not dbAs) since this runs outside any user session.
 */
// eslint-disable-next-line no-restricted-imports -- system cron runs without user context; dbAdmin is the correct choice per M16 spec
import { dbAdmin } from '@/core/db/admin'
import { getNotificationAdapter } from '@/core/notifications'

/** Reviews within this many days of cycle end date get a reminder. */
export const REMINDER_WINDOW_DAYS = 3

export async function sendPerformanceReminders(): Promise<{ notified: number }> {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // Find active cycles ending within the reminder window
  const cycles = await dbAdmin.performanceCycle.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now, lte: windowEnd },
    },
    select: {
      id: true,
      name: true,
      endDate: true,
      orgId: true,
      organisation: { select: { slug: true } },
    },
  })

  if (cycles.length === 0) {
    return { notified: 0 }
  }

  const notifier = getNotificationAdapter()
  let totalNotified = 0

  for (const cycle of cycles) {
    // Find pending reviews that haven't been reminded yet
    const pendingReviews = await dbAdmin.performanceReview.findMany({
      where: {
        cycleId: cycle.id,
        orgId: cycle.orgId,
        status: 'PENDING',
        reminderSentAt: null,
      },
      select: {
        id: true,
        employee: {
          select: {
            managerId: true,
            manager: { select: { userId: true } },
          },
        },
      },
    })

    if (pendingReviews.length === 0) continue

    // Group by manager
    const managerGroups = new Map<string, string[]>() // managerUserId → reviewIds
    for (const r of pendingReviews) {
      const managerUserId = r.employee.manager?.userId
      if (!managerUserId) continue
      if (!managerGroups.has(managerUserId)) {
        managerGroups.set(managerUserId, [])
      }
      managerGroups.get(managerUserId)!.push(r.id)
    }

    const endFormatted = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(cycle.endDate)

    const remindedReviewIds: string[] = []

    for (const [managerUserId, reviewIds] of managerGroups) {
      const count = reviewIds.length
      await notifier.send({
        orgId: cycle.orgId,
        userId: managerUserId,
        title: 'Performance review reminder',
        message: `Reminder: ${count} performance review${count === 1 ? '' : 's'} still pending for ${cycle.name} — due ${endFormatted}.`,
        link: `/${cycle.organisation.slug}/performance`,
      })
      remindedReviewIds.push(...reviewIds)
      totalNotified++
    }

    // Mark reminded reviews so they don't get reminded again
    if (remindedReviewIds.length > 0) {
      await dbAdmin.performanceReview.updateMany({
        where: { id: { in: remindedReviewIds } },
        data: { reminderSentAt: new Date() },
      })
    }
  }

  return { notified: totalNotified }
}
