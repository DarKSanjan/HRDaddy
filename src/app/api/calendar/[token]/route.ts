/**
 * ICS Calendar Feed endpoint.
 *
 * GET /api/calendar/{token}.ics
 *
 * No session required — the token in the URL authenticates the request.
 * Calendar apps (Google, Outlook, Apple) poll this URL with no cookies.
 */
import { generateCalendarFeed } from '@/core/calendar-feed'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params

  // Strip .ics extension if present (URL shape is /api/calendar/{token}.ics)
  const token = rawToken.endsWith('.ics')
    ? rawToken.slice(0, -4)
    : rawToken

  if (!token || token.length < 10) {
    return new Response('Not Found', { status: 404 })
  }

  const result = await generateCalendarFeed(token)

  if (!result) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(result.icsBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="hrdaddy-calendar.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
