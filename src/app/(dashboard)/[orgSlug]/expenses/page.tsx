import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/core/ui'
import { getEmployeeIdForUser, getOrgSettings } from '@/core/employees'
import { listOwnExpenseClaims, listActiveExpenseCategories } from '@/modules/expenses/queries'
import { expenseListParamsSchema } from '@/modules/expenses/schemas'
import { ExpenseClaimTable } from './_components/expense-claim-table'
import { SubmitExpenseDialog } from './_components/submit-expense-dialog'
import { Receipt } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawSearchParams = await searchParams

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('expenses', enabledModules)

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)
  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Receipt className="h-10 w-10 text-text-subtle" aria-hidden="true" />
        <h3 className="mt-4 text-[16px] font-semibold text-text">No employee record</h3>
        <p className="mt-1 max-w-sm text-[13px] text-text-muted">
          You need an employee record to access expense management.
        </p>
      </div>
    )
  }

  const listParams = expenseListParamsSchema.safeParse({
    status: rawSearchParams.status as string | undefined,
    categoryId: rawSearchParams.categoryId as string | undefined,
    page: rawSearchParams.page as string | undefined,
    pageSize: rawSearchParams.pageSize as string | undefined,
  })
  const validParams = listParams.success ? listParams.data : { page: 1, pageSize: 20 }

  const settings = await getOrgSettings(org.id)
  const currency = settings?.currency ?? 'SGD'

  const [{ claims, total }, categories] = await Promise.all([
    listOwnExpenseClaims(session.userId, org.id, employeeId, validParams),
    listActiveExpenseCategories(session.userId, org.id),
  ])

  const currentPage = validParams.page
  const pageSize = validParams.pageSize
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Expenses' }]}
        title="Expenses"
        actions={
          <SubmitExpenseDialog
            orgSlug={orgSlug}
            categories={categories}
            defaultCurrency={currency}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>My Expense Claims</CardTitle>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <div className="py-8 text-center">
              <Receipt className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No expense claims yet.</p>
            </div>
          ) : (
            <ExpenseClaimTable
              claims={claims}
              total={total}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              orgSlug={orgSlug}
              showEmployee={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
