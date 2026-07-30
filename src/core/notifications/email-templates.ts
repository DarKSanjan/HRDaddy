/**
 * Simple HTML email templates for notification emails.
 * No heavy dependencies — just inline HTML strings.
 */

export interface EmailTemplateData {
  title: string
  message: string
  link?: string
  recipientName: string
}

/**
 * Generates the email subject from the notification title.
 */
export function buildSubject(title: string): string {
  return title
}

/**
 * Generates a clean, readable HTML email body.
 */
export function buildHtmlBody(data: EmailTemplateData): string {
  const ctaButton = data.link
    ? `
      <tr>
        <td style="padding: 24px 0 0 0;">
          <a
            href="${escapeHtml(data.link)}"
            style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;"
          >
            View Details
          </a>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(data.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 24px 0 24px;">
              <p style="margin: 0; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">
                HRDaddy
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 16px 24px 24px 24px;">
              <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #18181b;">
                ${escapeHtml(data.title)}
              </h1>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #3f3f46;">
                Hi ${escapeHtml(data.recipientName)},
              </p>
              <p style="margin: 12px 0 0 0; font-size: 14px; line-height: 1.6; color: #3f3f46;">
                ${escapeHtml(data.message)}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0">${ctaButton}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                You're receiving this because you have email notifications enabled. You can disable them in your account settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
