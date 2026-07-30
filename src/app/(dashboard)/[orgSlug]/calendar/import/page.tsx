import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { PageHeader } from '@/core/ui'
import { HolidayImportWizard } from './_components/holiday-import-wizard'

export const dynamic = 'force-dynamic'

export default async function ImportHolidaysPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('calendar', enabledModules)
  await requirePermission(org.id, 'calendar.holiday.manage')

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Calendar', href: `/${orgSlug}/calendar` },
          { label: 'Import Holidays' },
        ]}
        title="Import Holidays"
        subtitle="Upload a CSV file to bulk-import public holidays."
      />

      <HolidayImportWizard orgSlug={orgSlug} />
    </div>
  )
}
