import { verifySession, getOrgContext } from '@/core/auth'
import { resolveNav } from '@/core/modules'
import { AppShell } from '@/core/ui/shell'
import { getOrgBranding } from '@/core/org/queries'

export default async function OrgDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const session = await verifySession()
  const { orgSlug } = await params
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)

  // Resolve nav from module registry — no hardcoded navigation
  const navEntries = resolveNav(membership.role, enabledModules)

  // Fetch org logo
  const branding = await getOrgBranding(org.id)

  return (
    <AppShell
      orgSlug={org.slug}
      orgName={org.name}
      orgLogo={branding.logoSignedUrl}
      userName={session.name}
      userEmail={session.email}
      navEntries={navEntries}
    >
      {children}
    </AppShell>
  )
}
