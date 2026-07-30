import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Badge, PageHeader } from '@/core/ui'
import { getAssetDetail, getAssetAssignmentHistory, listActiveAssetCategories } from '@/modules/assets/queries'
import { AssetAssignmentHistoryTable } from '../_components/asset-assignment-history'
import { EditAssetDialog } from '../_components/edit-asset-dialog'
import type { AssetStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

function statusVariant(status: AssetStatus): 'default' | 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  switch (status) {
    case 'AVAILABLE': return 'success'
    case 'ASSIGNED': return 'info'
    case 'IN_MAINTENANCE': return 'warning'
    case 'RETIRED': return 'neutral'
    case 'LOST': return 'danger'
    default: return 'neutral'
  }
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; assetId: string }>
}) {
  const { orgSlug, assetId } = await params

  const session = await verifySession()
  const { org, enabledModules, membership } = await getOrgContext(orgSlug)
  moduleGuard('assets', enabledModules)
  await requirePermission(org.id, 'asset.view_all')

  const asset = await getAssetDetail(session.userId, org.id, assetId)
  if (!asset) notFound()

  const assignments = await getAssetAssignmentHistory(session.userId, org.id, assetId)

  const canManage = hasPermission(membership.role, enabledModules, 'asset.manage')
  let categories: { id: string; name: string }[] = []
  if (canManage) {
    categories = await listActiveAssetCategories(session.userId, org.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Assets', href: `/${orgSlug}/assets` },
          { label: 'Register', href: `/${orgSlug}/assets/register` },
          { label: asset.name },
        ]}
        title={asset.name}
        actions={
          <>
            <Badge variant={statusVariant(asset.status)}>{asset.status.replace('_', ' ')}</Badge>
            {canManage && (
              <EditAssetDialog
                orgSlug={orgSlug}
                asset={JSON.parse(JSON.stringify(asset))}
                categories={categories}
              />
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-[13px]">
            <div>
              <dt className="text-text-muted">Asset Tag</dt>
              <dd className="mt-1 text-text font-medium">{asset.assetTag}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Category</dt>
              <dd className="mt-1 text-text">{asset.categoryName}</dd>
            </div>
            {asset.purchaseDate && (
              <div>
                <dt className="text-text-muted">Purchase Date</dt>
                <dd className="mt-1 text-text">
                  {new Date(asset.purchaseDate).toLocaleDateString('en-SG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            )}
            {asset.purchaseValueCents != null && (
              <div>
                <dt className="text-text-muted">Purchase Value</dt>
                <dd className="mt-1 text-text">${(asset.purchaseValueCents / 100).toFixed(2)}</dd>
              </div>
            )}
            {asset.notes && (
              <div className="sm:col-span-2">
                <dt className="text-text-muted">Notes</dt>
                <dd className="mt-1 text-text whitespace-pre-wrap">{asset.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-text-muted">No assignment history.</p>
          ) : (
            <AssetAssignmentHistoryTable assignments={JSON.parse(JSON.stringify(assignments))} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
