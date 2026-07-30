import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { PageHeader } from '@/core/ui'
import { AssetImportWizard } from './_components/asset-import-wizard'

export const dynamic = 'force-dynamic'

export default async function ImportAssetsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('assets', enabledModules)
  await requirePermission(org.id, 'asset.manage')

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Assets', href: `/${orgSlug}/assets` },
          { label: 'Asset Register', href: `/${orgSlug}/assets/register` },
          { label: 'Import' },
        ]}
        title="Import Assets"
        subtitle="Upload a CSV file to bulk-import assets into your register."
      />

      <AssetImportWizard orgSlug={orgSlug} />
    </div>
  )
}
