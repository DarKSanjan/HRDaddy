import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb } from '@/core/ui'
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
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Expenses' },
        ]}
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <h1 className="text-[20px] font-bold text-text">Expense Categories</h1>
      <p className="text-[13px] text-text-muted">
        Manage expense categories for organising employee expense claims.
      </p>

      <ExpenseCategoryManager
        orgSlug={orgSlug}
        categories={JSON.parse(JSON.stringify(categories))}
        canManage={canManage}
      />
    </div>
  )
}
