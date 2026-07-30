import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb } from '@/core/ui'
import { ImportWizard } from './_components/import-wizard'

export const dynamic = 'force-dynamic'

export default async function ImportEmployeesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('employees', enabledModules)
  await requirePermission(org.id, 'employee.create')

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Employees', href: `/${orgSlug}/employees` },
          { label: 'Import' },
        ]}
      />

      <div className="space-y-1">
        <h1 className="text-[20px] font-bold text-text">Import Employees</h1>
        <p className="text-[13px] text-text-muted">
          Upload a CSV file to bulk-import employees into your organisation.
        </p>
      </div>

      <ImportWizard orgSlug={orgSlug} />
    </div>
  )
}
