import { verifySession, getOrgContext } from '@/core/auth'
import { resolveNav } from '@/core/modules'
import { AppShell } from '@/core/ui/shell'
import { getOrgBranding } from '@/core/org/queries'
import { getUserNotifications } from '@/core/notifications/queries'

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

  // Fetch org logo and notifications in parallel (independent queries)
  const [branding, { notifications, unreadCount }] = await Promise.all([
    getOrgBranding(org.id),
    getUserNotifications(session.userId, org.id),
  ])

  return (
    <AppShell
      orgSlug={org.slug}
      orgName={org.name}
      orgLogo={branding.logoSignedUrl}
      userName={session.name}
      userEmail={session.email}
      navEntries={navEntries}
      notifications={notifications}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  )
}
