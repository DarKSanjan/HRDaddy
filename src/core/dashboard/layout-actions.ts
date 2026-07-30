'use server'

/**
 * Dashboard layout actions — self-service personal layout customization.
 * Every authenticated user can manage their own widget layout without any
 * elevated permission, same reasoning as calendar feed token actions.
 */
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { verifySession, getOrgContext } from '@/core/auth'
import { dbAdmin } from '@/core/db/admin'
import type { SavedLayout } from '@/core/dashboard'

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const layoutWidgetSchema = z.object({
  id: z.string().min(1),
  hidden: z.boolean(),
})

const saveLayoutSchema = z.array(layoutWidgetSchema).max(100)

// ─────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────

export interface LayoutActionResult {
  success: boolean
  error?: string
}

export interface GetLayoutResult {
  success: boolean
  error?: string
  layout: SavedLayout | null
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────

/**
 * Get the caller's saved dashboard layout for an org (or null if none saved).
 */
export async function getDashboardLayout(
  orgSlug: string
): Promise<GetLayoutResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  const row = await dbAdmin.dashboardLayout.findUnique({
    where: { userId_orgId: { userId: session.userId, orgId: org.id } },
    select: { layout: true },
  })

  if (!row) {
    return { success: true, layout: null }
  }

  return { success: true, layout: row.layout as unknown as SavedLayout }
}

/**
 * Upsert the caller's dashboard layout. Self-service — requires only a valid
 * session and org membership, no elevated permission.
 */
export async function saveDashboardLayout(
  orgSlug: string,
  widgets: Array<{ id: string; hidden: boolean }>
): Promise<LayoutActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  const parsed = saveLayoutSchema.safeParse(widgets)
  if (!parsed.success) {
    return { success: false, error: 'Invalid layout data.' }
  }

  const layout: SavedLayout = { widgets: parsed.data }

  await dbAdmin.dashboardLayout.upsert({
    where: { userId_orgId: { userId: session.userId, orgId: org.id } },
    create: {
      userId: session.userId,
      orgId: org.id,
      layout: layout as unknown as Parameters<typeof dbAdmin.dashboardLayout.create>[0]['data']['layout'],
    },
    update: {
      layout: layout as unknown as Parameters<typeof dbAdmin.dashboardLayout.update>[0]['data']['layout'],
    },
  })

  revalidatePath(`/${orgSlug}/dashboard`)

  return { success: true }
}

/**
 * Delete the caller's saved layout, reverting to default order.
 */
export async function resetDashboardLayout(
  orgSlug: string
): Promise<LayoutActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  await dbAdmin.dashboardLayout.deleteMany({
    where: { userId: session.userId, orgId: org.id },
  })

  revalidatePath(`/${orgSlug}/dashboard`)

  return { success: true }
}
