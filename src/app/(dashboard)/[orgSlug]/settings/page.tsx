import { redirect } from 'next/navigation'

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  redirect(`/${orgSlug}/settings/profile`)
}
