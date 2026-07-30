import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { listAllAssetRequests } from '@/modules/assets/queries'
import { assetRequestListParamsSchema } from '@/modules/assets/schemas'
import { AssetRequestsTable } from './_components/asset-requests-table'
import { FileQuestion } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AssetRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawSearch = await searchParams

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('assets', enabledModules)
  await requirePermission(org.id, 'asset.assign')

  const listParams = assetRequestListParamsSchema.parse({
    status: rawSearch.status,
    page: rawSearch.page,
    pageSize: rawSearch.pageSize,
  })

  const { requests, total } = await listAllAssetRequests(
    session.userId,
    org.id,
    listParams
  )

  const totalPages = Math.ceil(total / listParams.pageSize)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumb
          items={[
            { label: 'Assets', href: `/${orgSlug}/assets` },
            { label: 'Asset Requests' },
          ]}
        />
        <h1 className="text-[20px] font-bold text-text">Asset Requests</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="py-8 text-center">
              <FileQuestion className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No asset requests found.</p>
            </div>
          ) : (
            <AssetRequestsTable
              requests={requests}
              total={total}
              currentPage={listParams.page}
              totalPages={totalPages}
              orgSlug={orgSlug}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
