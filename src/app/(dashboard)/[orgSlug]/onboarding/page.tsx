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
      <h1 className="text-[20px] font-bold text-text">Setup Your Organisation</h1>
      <p className="text-[13px] text-text-muted">
        Organisation setup coming in M2.
      </p>
    </div>
  )
}
