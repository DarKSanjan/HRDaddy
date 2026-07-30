import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { listTeamPendingExpenseClaims, listAllExpenseClaims } from '@/modules/expenses/queries'
import { expenseListParamsSchema } from '@/modules/expenses/schemas'
import { ExpenseApprovalList } from '../_components/expense-approval-list'
import { ExpenseReimburseList } from '../_components/expense-reimburse-list'
import { ClipboardCheck, Receipt } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ExpenseApprovalsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()
  const { org, enabledModules, membership } = await getOrgContext(orgSlug)
  moduleGuard('expenses', enabledModules)
  await requirePermission(org.id, 'expense.approve')

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)
  const role = membership.role

  let pendingClaims
  if (role === 'MANAGER' && employeeId) {
    pendingClaims = await listTeamPendingExpenseClaims(session.userId, org.id, employeeId)
  } else {
    // Owner or HR_ADMIN sees all pending
    const params = expenseListParamsSchema.parse({ status: 'SUBMITTED', page: 1, pageSize: 50 })
    const result = await listAllExpenseClaims(session.userId, org.id, params)
    pendingClaims = result.claims
  }

  // Approved claims awaiting reimbursement — HR/Owner only, a manager approving
  // their team's claims doesn't also own paying them out.
  const canReimburse = hasPermission(role, enabledModules, 'expense.reimburse')
  let awaitingReimbursement: typeof pendingClaims = []
  if (canReimburse) {
    const params = expenseListParamsSchema.parse({ status: 'APPROVED', page: 1, pageSize: 50 })
    const result = await listAllExpenseClaims(session.userId, org.id, params)
    awaitingReimbursement = result.claims
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumb items={[{ label: 'Expenses', href: `/${orgSlug}/expenses` }, { label: 'Approvals' }]} />
        <h1 className="text-[20px] font-bold text-text">Expense Approvals</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Claims</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingClaims.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No pending expense claims.</p>
            </div>
          ) : (
            <ExpenseApprovalList claims={pendingClaims} orgSlug={orgSlug} />
          )}
        </CardContent>
      </Card>

      {canReimburse && (
        <Card>
          <CardHeader>
            <CardTitle>Awaiting Reimbursement</CardTitle>
          </CardHeader>
          <CardContent>
            {awaitingReimbursement.length === 0 ? (
              <div className="py-8 text-center">
                <Receipt className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
                <p className="mt-2 text-[13px] text-text-muted">No approved claims awaiting reimbursement.</p>
              </div>
            ) : (
              <ExpenseReimburseList claims={awaitingReimbursement} orgSlug={orgSlug} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
