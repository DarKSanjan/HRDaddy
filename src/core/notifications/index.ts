/**
 * Notification adapter interface and in-app implementation.
 * Email is a later swap — define the seam, do not build the sender.
 */
import { dbAdmin } from '@/core/db/admin'

export interface NotificationPayload {
  orgId: string
  userId: string
  title: string
  message: string
  link?: string
}

export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<void>
}

/**
 * In-app notification implementation — writes to the Notification table.
 */
export class InAppNotificationAdapter implements NotificationAdapter {
  async send(payload: NotificationPayload): Promise<void> {
    await dbAdmin.notification.create({
      data: {
        orgId: payload.orgId,
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        link: payload.link,
      },
    })
  }
}

// TODO(M2) Email notification adapter — define the seam here

let notificationInstance: NotificationAdapter | null = null

export function getNotificationAdapter(): NotificationAdapter {
  if (!notificationInstance) {
    notificationInstance = new InAppNotificationAdapter()
  }
  return notificationInstance
}
