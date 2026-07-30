'use server'

/**
 * Calendar feed token management actions.
 * Self-service — every employee manages their own feed link.
 */
import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { verifySession, getOrgContext } from '@/core/auth'
import { getEmployeeIdForUser } from '@/core/employees'
import { dbAdmin } from '@/core/db/admin'
import { getAppBaseUrl } from '@/lib/utils'

export interface CalendarFeedActionResult {
  success: boolean
  error?: string
  feedUrl?: string
}

/**
 * Get or create a calendar feed token for the current user's employee record.
 * Returns the full feed URL.
 */
export async function getOrCreateCalendarFeedToken(
  orgSlug: string
): Promise<CalendarFeedActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)
  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const employee = await dbAdmin.employee.findUnique({
    where: { id: employeeId },
    select: { calendarFeedToken: true },
  })

  let token = employee?.calendarFeedToken

  if (!token) {
    token = crypto.randomBytes(24).toString('hex')
    await dbAdmin.employee.update({
      where: { id: employeeId },
      data: { calendarFeedToken: token },
    })
  }

  const baseUrl = getAppBaseUrl()
  const feedUrl = `${baseUrl}/api/calendar/${token}.ics`

  return { success: true, feedUrl }
}

/**
 * Regenerate the calendar feed token (invalidates the old URL).
 */
export async function regenerateCalendarFeedToken(
  orgSlug: string
): Promise<CalendarFeedActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)
  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const token = crypto.randomBytes(24).toString('hex')
  await dbAdmin.employee.update({
    where: { id: employeeId },
    data: { calendarFeedToken: token },
  })

  const baseUrl = getAppBaseUrl()
  const feedUrl = `${baseUrl}/api/calendar/${token}.ics`

  revalidatePath(`/${orgSlug}/leave`)

  return { success: true, feedUrl }
}
