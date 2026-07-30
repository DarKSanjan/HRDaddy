import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb, Button, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { listAssets, listActiveAssetCategories, listActiveEmployees } from '@/modules/assets/queries'
import { assetListParamsSchema } from '@/modules/assets/schemas'
import { AssetRegisterTable } from '../_components/asset-register-table'
import { CreateAssetDialog } from '../_components/create-asset-dialog'
import { ClipboardList, Upload } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AssetRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawSearchParams = await searchParams

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('assets', enabledModules)
  await requirePermission(org.id, 'asset.view_all')

  const listParams = assetListParamsSchema.safeParse({
    status: rawSearchParams.status as string | undefined,
    categoryId: rawSearchParams.categoryId as string | undefined,
    search: rawSearchParams.search as string | undefined,
    page: rawSearchParams.page as string | undefined,
    pageSize: rawSearchParams.pageSize as string | undefined,
  })
  const validParams = listParams.success ? listParams.data : { page: 1, pageSize: 20 }

  // Sequential fetches to avoid connection contention (see lesson #1)
  const { assets, total } = await listAssets(session.userId, org.id, validParams)
  const categories = await listActiveAssetCategories(session.userId, org.id)
  const employees = await listActiveEmployees(session.userId, org.id)

  const currentPage = validParams.page
  const pageSize = validParams.pageSize
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumb items={[{ label: 'Assets', href: `/${orgSlug}/assets` }, { label: 'Register' }]} />
          <h1 className="text-[20px] font-bold text-text">Asset Register</h1>
        </div>
        <CreateAssetDialog orgSlug={orgSlug} categories={categories} />
      </div>

      <div className="flex justify-end">
        <Link href={`/${orgSlug}/assets/import`}>
          <Button variant="ghost" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 && !validParams.status && !validParams.categoryId && !validParams.search ? (
            <div className="py-8 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No assets yet. Add your first asset above.</p>
            </div>
          ) : (
            <AssetRegisterTable
              assets={JSON.parse(JSON.stringify(assets))}
              total={total}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              orgSlug={orgSlug}
              employees={employees}
              categories={categories}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
