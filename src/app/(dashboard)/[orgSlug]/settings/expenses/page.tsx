import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { PageHeader } from '@/core/ui'
import { listExpenseCategories } from '@/modules/expenses/queries'
import { SettingsNav } from '../_components/settings-nav'
import { ExpenseCategoryManager } from './_components/expense-category-manager'

export const dynamic = 'force-dynamic'

export default async function ExpenseSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('expenses', enabledModules)

  const canManage = hasPermission(membership.role, enabledModules, 'expense.category.manage')

  if (!canManage) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  const categories = await listExpenseCategories(session.userId, org.id)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Expenses' },
        ]}
        title="Expense Categories"
        subtitle="Manage expense categories for organising employee expense claims."
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <ExpenseCategoryManager
        orgSlug={orgSlug}
        categories={JSON.parse(JSON.stringify(categories))}
        canManage={canManage}
      />
    </div>
  )
}
