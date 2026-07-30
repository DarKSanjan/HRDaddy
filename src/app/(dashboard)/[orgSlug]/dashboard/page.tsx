import { verifySession, getOrgContext } from '@/core/auth'
import { resolveWidgets, applyLayout } from '@/core/dashboard'
import type { SavedLayout } from '@/core/dashboard'
import { resolveDashboardContext } from '@/core/dashboard/context'
import { WidgetShell } from '@/core/dashboard/grid'
import { CustomizableDashboard } from '@/core/dashboard/customizable-dashboard'
import { getDashboardLayout } from '@/core/dashboard/layout-actions'
import { PageHeader } from '@/core/ui'
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

  const dashCtx = await resolveDashboardContext(org.id, session.userId, membership.role)
  const permittedWidgets = resolveWidgets(membership.role, enabledModules)

  // Fetch user's saved layout
  const layoutResult = await getDashboardLayout(orgSlug)
  const savedLayout: SavedLayout | null = layoutResult.layout

  // Apply layout ordering/hiding (defense-in-depth: drops unpermitted widget IDs)
  const orderedWidgets = applyLayout(permittedWidgets, savedLayout)

  // Determine hidden widgets (in layout, permitted, but marked hidden)
  const hiddenWidgetIds = new Set<string>()
  if (savedLayout?.widgets) {
    const permittedIds = new Set(permittedWidgets.map((w) => w.id))
    for (const entry of savedLayout.widgets) {
      if (entry.hidden && permittedIds.has(entry.id)) {
        hiddenWidgetIds.add(entry.id)
      }
    }
  }
  const hiddenWidgets = permittedWidgets
    .filter((w) => hiddenWidgetIds.has(w.id))
    .map((w) => ({ id: w.id, title: w.title, description: w.description, moduleId: w.moduleId, size: w.size }))

  const widgetProps = {
    orgId: org.id,
    orgSlug: org.slug,
    orgTimezone: dashCtx.orgTimezone,
    userId: session.userId,
    role: membership.role,
    employeeId: dashCtx.employeeId,
    managedEmployeeIds: dashCtx.managedEmployeeIds,
  }

  // Pre-render each widget's content server-side (widgets are server components)
  const visibleWidgets = orderedWidgets.map((widget) => {
    const Widget = widget.component
    return {
      id: widget.id,
      title: widget.title,
      description: widget.description,
      moduleId: widget.moduleId,
      size: widget.size,
      content: (
        <WidgetShell key={widget.id} id={widget.id} size={widget.size}>
          <Widget {...widgetProps} />
        </WidgetShell>
      ),
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Dashboard' }]}
        title="Dashboard"
        subtitle={`Welcome back, ${session.name}`}
      />
      <CustomizableDashboard
        orgSlug={orgSlug}
        visibleWidgets={visibleWidgets}
        hiddenWidgets={hiddenWidgets}
        hasLayout={savedLayout !== null}
      />
    </div>
  )
}
