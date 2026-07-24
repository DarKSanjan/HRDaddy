import { verifySession, getOrgContext } from '@/core/auth'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default async function OrgDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const session = await verifySession()
  const { orgSlug } = await params

  const { org, membership } = await getOrgContext(orgSlug)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar orgSlug={org.slug} orgName={org.name} role={membership.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={session.name} userEmail={session.email} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
