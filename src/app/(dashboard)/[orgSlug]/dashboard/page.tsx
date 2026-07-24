/**
 * Dashboard page — the most-loaded page in the product.
 *
 * Assembles from widgets declared in module manifests, filtered by the
 * org's enabled modules and the viewer's permissions.
 */
import { verifySession, getOrgContext } from '@/core/auth'
import { resolveWidgets } from '@/core/dashboard'
import { resolveDashboardContext } from '@/core/dashboard/context'
import { DashboardGrid, WidgetShell } from '@/core/dashboard/grid'

// Side-effect import: populates the widget registry
import '@/core/dashboard/register-widgets'
// Side-effect import: populates the module registry
import '@/modules/register'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)

  // Resolve dashboard context (timezone, employee, managed reports)
  const dashCtx = await resolveDashboardContext(org.id, session.userId, membership.role)

  // Resolve which widgets to show for this viewer
  const widgets = resolveWidgets(membership.role, enabledModules)

  const widgetProps = {
    orgId: org.id,
    orgSlug: org.slug,
    orgTimezone: dashCtx.orgTimezone,
    userId: session.userId,
    role: membership.role,
    employeeId: dashCtx.employeeId,
    managedEmployeeIds: dashCtx.managedEmployeeIds,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-text">Dashboard</h1>
        <p className="text-[13px] text-text-muted">
          Welcome back, {session.name}
        </p>
      </div>

      <DashboardGrid>
        {widgets.map((widget) => {
          const Widget = widget.component
          return (
            <WidgetShell key={widget.id} id={widget.id} size={widget.size}>
              <Widget {...widgetProps} />
            </WidgetShell>
          )
        })}
      </DashboardGrid>
    </div>
  )
}
