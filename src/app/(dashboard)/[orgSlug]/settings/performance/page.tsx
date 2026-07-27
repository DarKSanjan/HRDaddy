import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb } from '@/core/ui'
import { getReviewComplexity } from '@/modules/performance/settings'
import { PerformanceSettingsPanel } from './_components/performance-settings-panel'
import { SettingsNav } from '../_components/settings-nav'

export const dynamic = 'force-dynamic'

export default async function PerformanceSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('performance', enabledModules)
  await requirePermission(org.id, 'department.manage')

  const currentComplexity = await getReviewComplexity(org.id)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Performance' },
        ]}
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <h1 className="text-[20px] font-bold text-text">Performance Settings</h1>
      <p className="text-[13px] text-text-muted">
        Configure how performance reviews work for your organisation.
      </p>

      <PerformanceSettingsPanel
        orgSlug={orgSlug}
        currentComplexity={currentComplexity}
      />
    </div>
  )
}
