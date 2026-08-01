import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, CardHeader, CardTitle, PageHeader, EmptyState } from '@/core/ui'
import { getAuditLog, listAuditActors } from '@/core/audit/queries'
import { SettingsNav } from '../_components/settings-nav'
import { AuditLogTable } from './_components/audit-log-table'
import { AuditLogFilterBar } from './_components/audit-log-filter-bar'
import { ScrollText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawSearch = await searchParams

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('employees', enabledModules)
  await requirePermission(org.id, 'audit.view')

  const page = Math.max(1, Number(rawSearch.page) || 1)
  const actorId = typeof rawSearch.actorId === 'string' ? rawSearch.actorId : undefined
  const action = typeof rawSearch.action === 'string' ? rawSearch.action : undefined
  const from = typeof rawSearch.from === 'string' && rawSearch.from ? new Date(rawSearch.from) : undefined
  const to = typeof rawSearch.to === 'string' && rawSearch.to ? new Date(`${rawSearch.to}T23:59:59.999Z`) : undefined

  const [{ entries, total }, actors] = await Promise.all([
    getAuditLog(session.userId, org.id, { actorId, action, from, to }, page, PAGE_SIZE),
    listAuditActors(session.userId, org.id),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Audit Log' },
        ]}
        title="Audit Log"
        subtitle="Every recorded data change and authentication event for this organisation."
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditLogFilterBar
            orgSlug={orgSlug}
            actors={actors}
            currentActorId={actorId}
            currentAction={action}
            currentFrom={rawSearch.from as string | undefined}
            currentTo={rawSearch.to as string | undefined}
          />

          {entries.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-8 w-8" aria-hidden="true" />}
              title="No activity found"
              description="No audit log entries match the current filters."
            />
          ) : (
            <AuditLogTable
              entries={entries}
              orgSlug={orgSlug}
              currentPage={page}
              totalPages={totalPages}
              total={total}
              actorId={actorId}
              action={action}
              from={rawSearch.from as string | undefined}
              to={rawSearch.to as string | undefined}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
