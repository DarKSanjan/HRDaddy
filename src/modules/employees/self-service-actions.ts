'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

/**
 * Employee self-service actions — employees editing their own low-risk
 * personal information (contact details, emergency contact).
 * Separate from employee.edit (admin editing anyone).
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission, verifySession } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { z } from 'zod'
import type { ActionResult } from './actions'

const selfEditSchema = z.object({
  personalEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  emergencyContactName: z.string().max(100).optional().or(z.literal('')),
  emergencyContactPhone: z.string().max(30).optional().or(z.literal('')),
})

/**
 * Employee edits their own contact/emergency info.
 */
export async function updateOwnProfile(
  orgSlug: string,
  employeeId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'employee.edit_own')

  // Verify the employee belongs to this user
  const employee = await dbAs(userId, async (tx) => {
    return tx.employee.findUnique({
      where: {
        orgId_userId: { orgId: org.id, userId: session.userId },
        id: employeeId,
      },
      select: { id: true, personalEmail: true, phone: true, address: true },
    })
  })

  if (!employee) {
    return { success: false, error: 'You can only edit your own profile' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = selfEditSchema.safeParse(raw)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const input = parsed.data
  const updateData: Record<string, unknown> = {}
  if (input.personalEmail !== undefined) updateData.personalEmail = input.personalEmail || null
  if (input.phone !== undefined) updateData.phone = input.phone || null
  if (input.address !== undefined) updateData.address = input.address || null

  await dbAs(userId, async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: updateData,
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'employee.self_updated',
      targetType: 'employee',
      targetId: employeeId,
      before: { personalEmail: employee.personalEmail, phone: employee.phone, address: employee.address },
      after: updateData,
    }, tx)
  })

  revalidatePath(`/${orgSlug}/employees/${employeeId}`)
  return { success: true }
}
