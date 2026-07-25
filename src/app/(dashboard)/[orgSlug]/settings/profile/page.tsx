import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { Breadcrumb } from '@/core/ui'
import { getOrgBranding } from '@/core/org/queries'
import { OrgProfilePanel } from './_components/org-profile-panel'

export const dynamic = 'force-dynamic'

export default async function OrgProfileSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  await verifySession()
  const { org } = await getOrgContext(orgSlug)
  await requirePermission(org.id, 'department.manage')

  const branding = await getOrgBranding(org.id)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Profile' },
        ]}
      />

      <h1 className="text-[20px] font-bold text-text">Organisation Profile</h1>
      <p className="text-[13px] text-text-muted">
        Manage your organisation&apos;s display name and branding.
      </p>

      <OrgProfilePanel
        orgSlug={orgSlug}
        orgName={org.name}
        orgLogoUrl={branding.logoSignedUrl}
      />
    </div>
  )
}
