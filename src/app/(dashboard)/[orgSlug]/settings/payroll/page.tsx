import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { PageHeader } from '@/core/ui'
import { getPayrollComplexity } from '@/modules/payroll/settings'
import { PayrollSettingsPanel } from './_components/payroll-settings-panel'
import { SettingsNav } from '../_components/settings-nav'

export const dynamic = 'force-dynamic'

export default async function PayrollSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('payroll', enabledModules)
  await requirePermission(org.id, 'department.manage')

  const currentComplexity = await getPayrollComplexity(org.id)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Payroll' },
        ]}
        title="Payroll Settings"
        subtitle="Configure how payroll calculations work for your organisation."
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <PayrollSettingsPanel
        orgSlug={orgSlug}
        currentComplexity={currentComplexity}
      />
    </div>
  )
}
