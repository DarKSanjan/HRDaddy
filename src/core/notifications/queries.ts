/**
 * Notification queries — fetch user notifications.
 */
import { dbAdmin } from '@/core/db/admin'

export interface NotificationItem {
  id: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: Date
}

/**
 * Get recent notifications for a user in an org.
 * Returns the 20 most recent, unread first.
 */
export async function getUserNotifications(
  userId: string,
  orgId: string
): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  const notifications = await dbAdmin.notification.findMany({
    where: { userId, orgId },
    select: {
      id: true,
      title: true,
      message: true,
      link: true,
      isRead: true,
      createdAt: true,
    },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  })

  const unreadCount = await dbAdmin.notification.count({
    where: { userId, orgId, isRead: false },
  })

  return { notifications, unreadCount }
}
