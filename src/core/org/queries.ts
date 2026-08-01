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
    } catch (err) {
      // Most likely a stale key (the object was deleted out from under the
      // DB row), but logging it means a genuine failure is actually
      // diagnosable instead of silently falling back to the placeholder icon.
      console.error('getOrgBranding: failed to sign logo URL', err)
    }
  }

  return {
    brandLogoUrl: settings?.brandLogoUrl ?? null,
    brandPrimaryColor: settings?.brandPrimaryColor ?? null,
    logoSignedUrl,
  }
}
