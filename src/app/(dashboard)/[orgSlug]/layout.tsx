import { verifySession, getOrgContext } from '@/core/auth'
import { resolveNav } from '@/core/modules'
import { AppShell } from '@/core/ui/shell'

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

  return (
    <AppShell
      orgSlug={org.slug}
      orgName={org.name}
      userName={session.name}
      userEmail={session.email}
      navEntries={navEntries}
    >
      {children}
    </AppShell>
  )
}
