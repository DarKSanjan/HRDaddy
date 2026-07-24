import { redirect } from 'next/navigation'
import { getOrgContext } from '@/core/auth'

/**
 * Organisation root. The setup wizard redirects here after creating an
 * organisation, and it is the natural URL to type or bookmark, so it needs to
 * resolve rather than 404. getOrgContext validates membership first — an
 * unknown slug and a slug the caller has no access to are both notFound(), so
 * this does not reveal which organisations exist.
 */
export default async function OrgRootPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  await getOrgContext(orgSlug)
  redirect(`/${orgSlug}/dashboard`)
}
