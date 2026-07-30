import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { PageHeader } from '@/core/ui'
import { listCategories } from '@/modules/documents/queries'
import { SettingsNav } from '../_components/settings-nav'
import { CategoryManager } from './_components/category-manager'

export const dynamic = 'force-dynamic'

export default async function DocumentsSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('documents', enabledModules)

  const canManage = hasPermission(membership.role, enabledModules, 'document.category.manage')

  // Must have manage permission to access this settings page
  if (!canManage) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  const categories = await listCategories(session.userId, org.id)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Documents' },
        ]}
        title="Document Categories"
        subtitle="Manage document categories for organising employee files. Categories flagged as sensitive require elevated permissions to access."
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <CategoryManager
        orgSlug={orgSlug}
        categories={JSON.parse(JSON.stringify(categories))}
        canManage={canManage}
      />
    </div>
  )
}
