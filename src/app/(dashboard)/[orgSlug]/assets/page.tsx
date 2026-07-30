import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { listMyAssets } from '@/modules/assets/queries'
import { Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('assets', enabledModules)

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)
  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Package className="h-10 w-10 text-text-subtle" aria-hidden="true" />
        <h3 className="mt-4 text-[16px] font-semibold text-text">No employee record</h3>
        <p className="mt-1 max-w-sm text-[13px] text-text-muted">
          You need an employee record to view your assigned assets.
        </p>
      </div>
    )
  }

  const myAssets = await listMyAssets(session.userId, org.id, employeeId)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumb items={[{ label: 'Assets' }]} />
        <h1 className="text-[20px] font-bold text-text">My Assets</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currently Assigned to Me</CardTitle>
        </CardHeader>
        <CardContent>
          {myAssets.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No assets currently assigned to you.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="px-3 py-2 font-medium">Asset</th>
                    <th className="px-3 py-2 font-medium">Tag</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Assigned Date</th>
                  </tr>
                </thead>
                <tbody>
                  {myAssets.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-text font-medium">{item.assetName}</td>
                      <td className="px-3 py-2 text-text-muted">{item.assetTag}</td>
                      <td className="px-3 py-2 text-text">{item.categoryName}</td>
                      <td className="px-3 py-2 text-text">
                        {new Date(item.assignedAt).toLocaleDateString('en-SG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
