/**
 * Organisation mutation helpers — lives in core/ so it can use dbAdmin.
 */
import 'server-only'
import { dbAdmin } from '@/core/db/admin'

/**
 * Update organisation name.
 */
export async function updateOrgNameDb(orgId: string, name: string): Promise<void> {
  await dbAdmin.organisation.update({
    where: { id: orgId },
    data: { name },
  })
}

/**
 * Upsert org logo key in settings.
 */
export async function setOrgLogoKey(orgId: string, key: string | null): Promise<void> {
  await dbAdmin.organisationSettings.upsert({
    where: { orgId },
    update: { brandLogoUrl: key },
    create: { orgId, brandLogoUrl: key },
  })
}

/**
 * Get the current org logo key.
 */
export async function getOrgLogoKey(orgId: string): Promise<string | null> {
  const settings = await dbAdmin.organisationSettings.findUnique({
    where: { orgId },
    select: { brandLogoUrl: true },
  })
  return settings?.brandLogoUrl ?? null
}
