import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb } from '@/core/ui'
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
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Documents' },
        ]}
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <h1 className="text-[20px] font-bold text-text">Document Categories</h1>
      <p className="text-[13px] text-text-muted">
        Manage document categories for organising employee files. Categories flagged as sensitive
        require elevated permissions to access.
      </p>

      <CategoryManager
        orgSlug={orgSlug}
        categories={JSON.parse(JSON.stringify(categories))}
        canManage={canManage}
      />
    </div>
  )
}
