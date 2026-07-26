import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb } from '@/core/ui'
import { getShiftTemplates } from '@/modules/employees/queries'
import { ShiftTemplatesPanel } from './_components/shift-templates-panel'
import { SettingsNav } from '../_components/settings-nav'

export const dynamic = 'force-dynamic'

export default async function ShiftSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('employees', enabledModules)
  await requirePermission(org.id, 'department.manage')

  const shiftTemplates = await getShiftTemplates(session.userId, org.id, true)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Shift Templates' },
        ]}
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <h1 className="text-[20px] font-bold text-text">Shift Templates</h1>
      <p className="text-[13px] text-text-muted">
        Define shift timings for different roles. Assign a default shift to employment types, or override per employee.
      </p>

      <ShiftTemplatesPanel
        orgSlug={orgSlug}
        shiftTemplates={shiftTemplates}
      />
    </div>
  )
}
