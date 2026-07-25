/**
 * Organisation queries — fetching org settings/branding data.
 * Lives in core/ so it can use dbAdmin legitimately.
 */
import 'server-only'
import { dbAdmin } from '@/core/db/admin'
import { getStorage } from '@/core/storage'

export interface OrgBranding {
  brandLogoUrl: string | null
  brandPrimaryColor: string | null
  logoSignedUrl: string | null
}

/**
 * Get org branding (logo URL, primary color).
 * Returns a signed URL for the logo if one is configured.
 */
export async function getOrgBranding(orgId: string): Promise<OrgBranding> {
  const settings = await dbAdmin.organisationSettings.findUnique({
    where: { orgId },
    select: { brandLogoUrl: true, brandPrimaryColor: true },
  })

  let logoSignedUrl: string | null = null
  if (settings?.brandLogoUrl) {
    try {
      const storage = await getStorage()
      logoSignedUrl = await storage.getSignedUrl(settings.brandLogoUrl, 3600)
    } catch {
      // Stale key; ignore
    }
  }

  return {
    brandLogoUrl: settings?.brandLogoUrl ?? null,
    brandPrimaryColor: settings?.brandPrimaryColor ?? null,
    logoSignedUrl,
  }
}
