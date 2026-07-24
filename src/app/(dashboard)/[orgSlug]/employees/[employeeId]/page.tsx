import { verifySession, getOrgContext } from '@/core/auth'

export const dynamic = 'force-dynamic'

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string; employeeId: string }>
}) {
  const { orgSlug } = await params
  await verifySession()
  await getOrgContext(orgSlug)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Employee Profile</h1>
      <p className="text-sm text-gray-500">
        {/* TODO(M3) Employee profile UI */}
        Employee profile coming in M3.
      </p>
    </div>
  )
}
