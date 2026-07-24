import { verifySession, getOrgContext } from '@/core/auth'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  await verifySession()
  await getOrgContext(orgSlug)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Setup Your Organisation</h1>
      <p className="text-sm text-gray-500">
        {/* TODO(M2) Signup wizard and org setup */}
        Organisation setup coming in M2.
      </p>
    </div>
  )
}
