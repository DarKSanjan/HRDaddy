/**
 * Core documents service — functions needing dbAdmin access.
 * Located in src/core/ to satisfy the ESLint boundary rule.
 */
import { dbAdmin } from '@/core/db/admin'
import { getNotificationAdapter } from '@/core/notifications'
import { emit } from '@/core/events'

export interface DocumentExpiryJobResult {
  processed: number
  notified: number
  errors: string[]
}

/**
 * Check all organisations for documents expiring within `withinDays`.
 * Sends a notification to the HR admin or owner for each expiring document.
 */
export async function runDocumentExpiryCheck(
  withinDays: number = 30
): Promise<DocumentExpiryJobResult> {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + withinDays)

  const expiringDocs = await dbAdmin.employeeDocument.findMany({
    where: {
      isArchived: false,
      expiresAt: { lte: deadline, not: null },
    },
    select: {
      id: true,
      fileName: true,
      expiresAt: true,
      orgId: true,
      employeeId: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  })

  const notifications = getNotificationAdapter()
  const errors: string[] = []
  let notified = 0

  for (const doc of expiringDocs) {
    try {
      const admin = await dbAdmin.organisationMembership.findFirst({
        where: {
          orgId: doc.orgId,
          role: { in: ['HR_ADMIN', 'OWNER'] },
          isActive: true,
        },
        select: { userId: true },
      })

      if (admin) {
        const daysLeft = Math.ceil(
          (doc.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        const expiredAlready = daysLeft <= 0

        await notifications.send({
          orgId: doc.orgId,
          userId: admin.userId,
          title: expiredAlready ? 'Document expired' : 'Document expiring soon',
          message: expiredAlready
            ? `"${doc.fileName}" for ${doc.employee.firstName} ${doc.employee.lastName} has expired.`
            : `"${doc.fileName}" for ${doc.employee.firstName} ${doc.employee.lastName} expires in ${daysLeft} day(s).`,
          link: `/documents`,
        })

        await emit(
          'document.expiring',
          { documentId: doc.id, employeeId: doc.employeeId, daysLeft },
          { orgId: doc.orgId, userId: admin.userId }
        )
        notified++
      }
    } catch (err) {
      errors.push(`${doc.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  return { processed: expiringDocs.length, notified, errors }
}
