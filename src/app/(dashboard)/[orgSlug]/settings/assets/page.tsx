import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb } from '@/core/ui'
import { listAssetCategories } from '@/modules/assets/queries'
import { SettingsNav } from '../_components/settings-nav'
import { AssetCategoryManager } from './_components/asset-category-manager'

export const dynamic = 'force-dynamic'

export default async function AssetSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('assets', enabledModules)

  const canManage = hasPermission(membership.role, enabledModules, 'asset.manage')

  if (!canManage) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  const categories = await listAssetCategories(session.userId, org.id)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Assets' },
        ]}
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <h1 className="text-[20px] font-bold text-text">Asset Categories</h1>
      <p className="text-[13px] text-text-muted">
        Manage asset categories for organising company assets.
      </p>

      <AssetCategoryManager
        orgSlug={orgSlug}
        categories={JSON.parse(JSON.stringify(categories))}
        canManage={canManage}
      />
    </div>
  )
}
