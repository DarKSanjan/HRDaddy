import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { PageHeader } from '@/core/ui'
import { getOrgBranding } from '@/core/org/queries'
import { OrgProfilePanel } from './_components/org-profile-panel'
import { SettingsNav } from '../_components/settings-nav'

export const dynamic = 'force-dynamic'

export default async function OrgProfileSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  await requirePermission(org.id, 'department.manage')

  const branding = await getOrgBranding(org.id)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Profile' },
        ]}
        title="Organisation Profile"
        subtitle="Manage your organisation&apos;s display name and branding."
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <OrgProfilePanel
        orgSlug={orgSlug}
        orgName={org.name}
        orgLogoUrl={branding.logoSignedUrl}
      />
    </div>
  )
}
