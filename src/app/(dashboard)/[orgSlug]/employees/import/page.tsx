import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { PageHeader } from '@/core/ui'
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
      <PageHeader
        breadcrumbItems={[
          { label: 'Employees', href: `/${orgSlug}/employees` },
          { label: 'Import' },
        ]}
        title="Import Employees"
        subtitle="Upload a CSV file to bulk-import employees into your organisation."
      />

      <ImportWizard orgSlug={orgSlug} />
    </div>
  )
}
