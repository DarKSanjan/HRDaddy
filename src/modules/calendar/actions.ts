'use server'

import '@/modules/register'

import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { getNotificationAdapter } from '@/core/notifications'
import { getEmployeeIdForUser } from '@/core/employees'
import { z } from 'zod'

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  audience: z.enum(['COMPANY', 'DEPARTMENT', 'SPECIFIC_EMPLOYEES']),
  departmentId: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
})

export async function createCalendarEvent(
  orgSlug: string,
  input: z.infer<typeof createEventSchema>
) {
  const { org } = await getOrgContext(orgSlug)
  const { userId, role } = await requirePermission(org.id, 'calendar.event.create')

  const parsed = createEventSchema.parse(input)
  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found' }
  }

  const isAdmin = role === 'OWNER' || role === 'HR_ADMIN'

  if (parsed.audience === 'COMPANY' && !isAdmin) {
    return { success: false, error: 'Only admins can create company-wide events' }
  }

  let departmentId: string | null = null

  if (parsed.audience === 'DEPARTMENT') {
    if (isAdmin) {
      if (!parsed.departmentId) {
        return { success: false, error: 'Department is required for department-scoped events' }
      }
      departmentId = parsed.departmentId
    } else {
      const employee = await dbAs(userId, async (tx) => {
        return tx.employee.findUnique({
          where: { id: employeeId },
          select: { departmentId: true },
        })
      })
      if (!employee?.departmentId) {
        return { success: false, error: 'You must belong to a department to create department events' }
      }
      departmentId = employee.departmentId
    }
  }

  if (parsed.audience === 'SPECIFIC_EMPLOYEES') {
    if (!parsed.employeeIds || parsed.employeeIds.length === 0) {
      return { success: false, error: 'At least one employee must be selected' }
    }
    const validCount = await dbAs(userId, async (tx) => {
      return tx.employee.count({
        where: { id: { in: parsed.employeeIds! }, orgId: org.id },
      })
    })
    if (validCount !== parsed.employeeIds.length) {
      return { success: false, error: 'One or more selected employees do not belong to this organisation' }
    }
  }

  const [y, m, d] = parsed.date.split('-').map(Number)
  const eventDate = new Date(Date.UTC(y, m - 1, d))

  const event = await dbAs(userId, async (tx) => {
    return tx.calendarEvent.create({
      data: {
        orgId: org.id,
        title: parsed.title,
        date: eventDate,
        audience: parsed.audience,
        departmentId,
        createdById: employeeId,
        ...(parsed.audience === 'SPECIFIC_EMPLOYEES' && parsed.employeeIds
          ? {
              recipients: {
                create: parsed.employeeIds.map((eid) => ({ employeeId: eid })),
              },
            }
          : {}),
      },
    })
  })

  const recipientUserIds = await resolveRecipientUserIds(
    userId,
    org.id,
    parsed.audience,
    departmentId,
    parsed.employeeIds
  )

  const notifier = getNotificationAdapter()
  for (const recipientUserId of recipientUserIds) {
    await notifier.send({
      orgId: org.id,
      userId: recipientUserId,
      title: `New event: ${parsed.title}`,
      message: `A new event "${parsed.title}" has been added to the calendar.`,
      link: `/${orgSlug}/calendar`,
    })
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'create',
    targetType: 'calendar_event',
    targetId: event.id,
    after: { title: parsed.title, audience: parsed.audience },
  })

  revalidatePath(`/${orgSlug}/calendar`)
  return { success: true }
}

async function resolveRecipientUserIds(
  userId: string,
  orgId: string,
  audience: string,
  departmentId: string | null,
  employeeIds?: string[]
): Promise<string[]> {
  return dbAs(userId, async (tx) => {
    let employees: { userId: string | null }[] = []

    if (audience === 'COMPANY') {
      employees = await tx.employee.findMany({
        where: { orgId, employmentStatus: 'ACTIVE', userId: { not: null } },
        select: { userId: true },
      })
    } else if (audience === 'DEPARTMENT' && departmentId) {
      employees = await tx.employee.findMany({
        where: { orgId, departmentId, employmentStatus: 'ACTIVE', userId: { not: null } },
        select: { userId: true },
      })
    } else if (audience === 'SPECIFIC_EMPLOYEES' && employeeIds) {
      employees = await tx.employee.findMany({
        where: { id: { in: employeeIds }, userId: { not: null } },
        select: { userId: true },
      })
    }

    return employees.filter((e) => e.userId !== null).map((e) => e.userId!)
  })
}

export async function deleteHolidayAction(orgSlug: string, holidayId: string) {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'calendar.holiday.manage')

  await dbAs(userId, async (tx) => {
    await tx.holiday.delete({ where: { id: holidayId } })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'delete',
    targetType: 'holiday',
    targetId: holidayId,
    after: {},
  })

  revalidatePath(`/${orgSlug}/calendar`)
  return { success: true }
}

export async function createHolidayAction(
  orgSlug: string,
  data: { date: string; name: string }
) {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'calendar.holiday.manage')

  const [y, m, d] = data.date.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))

  const holiday = await dbAs(userId, async (tx) => {
    return tx.holiday.create({
      data: { orgId: org.id, date, name: data.name },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'create',
    targetType: 'holiday',
    targetId: holiday.id,
    after: { date: data.date, name: data.name },
  })

  revalidatePath(`/${orgSlug}/calendar`)
  return { success: true }
}
