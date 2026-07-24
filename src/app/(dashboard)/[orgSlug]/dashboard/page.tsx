import { verifySession, getOrgContext } from '@/core/auth'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-text">Dashboard</h1>
        <p className="text-[13px] text-text-muted">
          Welcome back, {session.name}. Organisation: {org.name}
        </p>
      </div>
      {/* TODO(M1b) Dashboard widgets assembled from module manifests */}
    </div>
  )
}
