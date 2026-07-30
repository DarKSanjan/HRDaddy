/**
 * Email notification adapter using Resend.
 *
 * Fails silently if RESEND_API_KEY is unset or the send fails — email is
 * optional infrastructure, not a hard dependency.
 */
import { Resend } from 'resend'
import { dbAdmin } from '@/core/db/admin'
import { buildSubject, buildHtmlBody } from './email-templates'
import type { NotificationAdapter, NotificationPayload } from './index'
import { getAppBaseUrl } from '@/lib/utils'

export class EmailNotificationAdapter implements NotificationAdapter {
  private getClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return null
    return new Resend(apiKey)
  }

  async send(payload: NotificationPayload): Promise<void> {
    const client = this.getClient()
    if (!client) {
      console.warn(
        '[EmailNotificationAdapter] RESEND_API_KEY is not set — skipping email.'
      )
      return
    }

    try {
      const user = await dbAdmin.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, name: true, emailNotificationsEnabled: true },
      })

      if (!user) {
        console.warn(
          `[EmailNotificationAdapter] User ${payload.userId} not found — skipping email.`
        )
        return
      }

      if (!user.emailNotificationsEnabled) {
        return
      }

      const appUrl = getAppBaseUrl()
      const absoluteLink = payload.link
        ? payload.link.startsWith('http')
          ? payload.link
          : `${appUrl.replace(/\/$/, '')}${payload.link}`
        : undefined

      const from = process.env.EMAIL_FROM || 'HRDaddy <notifications@hrdaddy.app>'

      const { error } = await client.emails.send({
        from,
        to: user.email,
        subject: buildSubject(payload.title),
        html: buildHtmlBody({
          title: payload.title,
          message: payload.message,
          link: absoluteLink,
          recipientName: user.name,
        }),
      })

      if (error) {
        console.error(
          '[EmailNotificationAdapter] Resend error:',
          error.message
        )
      }
    } catch (err) {
      // Never throw — mirror the event bus philosophy
      console.error(
        '[EmailNotificationAdapter] Failed to send email:',
        err instanceof Error ? err.message : err
      )
    }
  }
}
