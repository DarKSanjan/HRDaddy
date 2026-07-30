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

/** Free plan storage limit — placeholder until billing system exists */
export const FREE_PLAN_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024 // 1 GB

/**
 * Get total storage used by an organisation (sum of all employee document file sizes).
 * Payslip PDFs are generated on-demand and never stored, so they don't count.
 *
 * Org-wide aggregate, not scoped to any one employee's own records, so it doesn't
 * need dbAs()'s per-request RLS transaction — that would cost a pooled connection
 * and a semaphore slot on every single page load (this runs from the root org
 * layout, wrapping every route). dbAdmin with a manual orgId filter is equivalent
 * here since the query never varied by caller identity in the first place.
 */
export async function getStorageUsedBytes(orgId: string): Promise<number> {
  const aggregate = await dbAdmin.employeeDocument.aggregate({
    where: { orgId, isArchived: false },
    _sum: { fileSize: true },
  })
  return aggregate._sum.fileSize ?? 0
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
