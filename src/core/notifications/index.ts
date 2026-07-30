/**
 * Notification adapter interface and in-app implementation.
 * The composite adapter fans out to both in-app and email.
 */
import { dbAdmin } from '@/core/db/admin'
import { CompositeNotificationAdapter } from './composite-adapter'
import { EmailNotificationAdapter } from './email-adapter'

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

let notificationInstance: NotificationAdapter | null = null

export function getNotificationAdapter(): NotificationAdapter {
  if (!notificationInstance) {
    notificationInstance = new CompositeNotificationAdapter([
      new InAppNotificationAdapter(),
      new EmailNotificationAdapter(),
    ])
  }
  return notificationInstance
}

/**
 * Reset the singleton (for testing).
 */
export function _resetNotificationAdapter(): void {
  notificationInstance = null
}
