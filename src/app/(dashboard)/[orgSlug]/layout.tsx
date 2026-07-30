// Registration barrel — populates the module/permission registries as an
// import-time side effect. This layout wraps every org route, so importing
// it here (rather than relying on one page, e.g. dashboard, to pull it in)
// guarantees the registry is populated before ANY child route renders,
// regardless of which route a fresh Lambda instance happens to serve first.
// Previously only dashboard/page.tsx imported this, so a cold instance whose
// first request was /employees or /employees/org-chart saw an empty
// manifests/permissions registry — moduleGuard() and hasPermission() both
// read from it, and both fail closed (notFound()) on empty, which is why
// those routes intermittently 404'd while dashboard never did.
import '@/modules/register'

import { verifySession, getOrgContext } from '@/core/auth'
import { resolveNav } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { AppShell } from '@/core/ui/shell'
import { getOrgBranding } from '@/core/org/queries'
import { getUserNotifications } from '@/core/notifications/queries'
import { getStorageUsedBytes, FREE_PLAN_STORAGE_LIMIT_BYTES } from '@/core/documents'

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

  // Compute Settings visibility (same permission all settings sub-pages require)
  const canManageSettings = hasPermission(membership.role, enabledModules, 'department.manage')

  // Fetch org logo, notifications, and storage in parallel (independent queries)
  const [branding, { notifications, unreadCount }, storageUsedBytes] = await Promise.all([
    getOrgBranding(org.id),
    getUserNotifications(session.userId, org.id),
    getStorageUsedBytes(org.id),
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
      storageUsedBytes={storageUsedBytes}
      storageLimitBytes={FREE_PLAN_STORAGE_LIMIT_BYTES}
      canManageSettings={canManageSettings}
    >
      {children}
    </AppShell>
  )
}
