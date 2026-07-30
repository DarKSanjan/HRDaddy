'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { verifySession, getOrgContext } from '@/core/auth'
import { getEmployeeIdForUser } from '@/core/employees'
import { dbAdmin } from '@/core/db/admin'
import { getAppBaseUrl } from '@/lib/utils'
import type { CalendarFeedScope } from '@prisma/client'

export interface CalendarFeedActionResult {
  success: boolean
  error?: string
  feedUrl?: string
}

export async function getOrCreateCalendarFeedToken(
  orgSlug: string,
  scope: 'PERSONAL' | 'TEAM' | 'COMPANY'
): Promise<CalendarFeedActionResult> {
  const session = await verifySession()
  const { org, membership } = await getOrgContext(orgSlug)
  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  if (scope === 'TEAM') {
    const reportCount = await dbAdmin.employee.count({
      where: { orgId: org.id, managerId: employeeId, employmentStatus: 'ACTIVE' },
    })
    if (reportCount === 0) {
      return { success: false, error: 'You need at least one direct report to subscribe to a team calendar.' }
    }
  }

  if (scope === 'COMPANY') {
    const isAdmin = membership.role === 'OWNER' || membership.role === 'HR_ADMIN'
    if (!isAdmin) {
      return { success: false, error: 'Only owners and HR admins can subscribe to the company-wide calendar.' }
    }
  }

  const existing = await dbAdmin.calendarFeedToken.findUnique({
    where: { employeeId_scope: { employeeId, scope: scope as CalendarFeedScope } },
    select: { token: true },
  })

  let token = existing?.token

  if (!token) {
    token = crypto.randomBytes(24).toString('hex')
    await dbAdmin.calendarFeedToken.create({
      data: {
        orgId: org.id,
        employeeId,
        scope: scope as CalendarFeedScope,
        token,
      },
    })
  }

  const baseUrl = getAppBaseUrl()
  const feedUrl = `${baseUrl}/api/calendar/${token}.ics`

  return { success: true, feedUrl }
}

export async function regenerateCalendarFeedToken(
  orgSlug: string,
  scope: 'PERSONAL' | 'TEAM' | 'COMPANY'
): Promise<CalendarFeedActionResult> {
  const session = await verifySession()
  const { org, membership } = await getOrgContext(orgSlug)
  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  if (scope === 'TEAM') {
    const reportCount = await dbAdmin.employee.count({
      where: { orgId: org.id, managerId: employeeId, employmentStatus: 'ACTIVE' },
    })
    if (reportCount === 0) {
      return { success: false, error: 'You need at least one direct report to subscribe to a team calendar.' }
    }
  }

  if (scope === 'COMPANY') {
    const isAdmin = membership.role === 'OWNER' || membership.role === 'HR_ADMIN'
    if (!isAdmin) {
      return { success: false, error: 'Only owners and HR admins can subscribe to the company-wide calendar.' }
    }
  }

  const token = crypto.randomBytes(24).toString('hex')

  await dbAdmin.calendarFeedToken.upsert({
    where: { employeeId_scope: { employeeId, scope: scope as CalendarFeedScope } },
    update: { token },
    create: {
      orgId: org.id,
      employeeId,
      scope: scope as CalendarFeedScope,
      token,
    },
  })

  const baseUrl = getAppBaseUrl()
  const feedUrl = `${baseUrl}/api/calendar/${token}.ics`

  revalidatePath(`/${orgSlug}/calendar`)

  return { success: true, feedUrl }
}
