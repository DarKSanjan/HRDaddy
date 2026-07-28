import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb } from '@/core/ui'
import { getOrgChart } from '@/modules/employees/org-chart-queries'
import { OrgChartFlow } from './_components/org-chart-flow'
import { GitBranch } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OrgChartPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('employees', enabledModules)

  if (!hasPermission(membership.role, enabledModules, 'employee.view_all')) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  const tree = await getOrgChart(session.userId, org.id, enabledModules)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumb
          items={[
            { label: 'Employees', href: `/${orgSlug}/employees` },
            { label: 'Org Chart' },
          ]}
        />
        <h1 className="text-[20px] font-bold text-text">Organisation Chart</h1>
      </div>

      {tree.length === 0 ? (
        <div className="py-12 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
          <p className="mt-2 text-[13px] text-text-muted">
            No employees found. Add employees to see the reporting structure.
          </p>
        </div>
      ) : (
        <OrgChartFlow nodes={tree} orgSlug={orgSlug} />
      )}
    </div>
  )
}
