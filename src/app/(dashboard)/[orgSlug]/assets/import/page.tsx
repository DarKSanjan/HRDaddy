import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb } from '@/core/ui'
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
      <Breadcrumb
        items={[
          { label: 'Assets', href: `/${orgSlug}/assets` },
          { label: 'Asset Register', href: `/${orgSlug}/assets/register` },
          { label: 'Import' },
        ]}
      />

      <div className="space-y-1">
        <h1 className="text-[20px] font-bold text-text">Import Assets</h1>
        <p className="text-[13px] text-text-muted">
          Upload a CSV file to bulk-import assets into your register.
        </p>
      </div>

      <AssetImportWizard orgSlug={orgSlug} />
    </div>
  )
}
