'use server'

/**
 * Notification server actions — mark as read.
 */
import { revalidatePath } from 'next/cache'
import { verifySession, getOrgContext } from '@/core/auth'
import { dbAdmin } from '@/core/db/admin'

export async function markNotificationRead(
  orgSlug: string,
  notificationId: string
): Promise<{ success: boolean }> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  // Ensure the notification belongs to this user
  await dbAdmin.notification.updateMany({
    where: { id: notificationId, userId: session.userId, orgId: org.id },
    data: { isRead: true },
  })

  revalidatePath(`/${orgSlug}`, 'layout')
  return { success: true }
}

export async function markAllNotificationsRead(
  orgSlug: string
): Promise<{ success: boolean }> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  await dbAdmin.notification.updateMany({
    where: { userId: session.userId, orgId: org.id, isRead: false },
    data: { isRead: true },
  })

  revalidatePath(`/${orgSlug}`, 'layout')
  return { success: true }
}
