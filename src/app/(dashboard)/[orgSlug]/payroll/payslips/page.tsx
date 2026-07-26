import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { getPayslipsForEmployee } from '@/modules/payroll/queries'
import { PdfDownloadButton } from '@/modules/payroll/pdf-download-button'
import { DollarSign, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`
}

export default async function PayslipsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('payroll', enabledModules)

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)
  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <DollarSign className="h-10 w-10 text-text-subtle" aria-hidden="true" />
        <h3 className="mt-4 text-[16px] font-semibold text-text">No employee record</h3>
        <p className="mt-1 max-w-sm text-[13px] text-text-muted">
          You need an employee record to view payslips.
        </p>
      </div>
    )
  }

  const payslips = await getPayslipsForEmployee(session.userId, org.id, employeeId)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumb items={[{ label: 'Payroll', href: `/${orgSlug}/payroll` }, { label: 'My Payslips' }]} />
        <h1 className="text-[20px] font-bold text-text">My Payslips</h1>
      </div>

      <div className="rounded-md border border-border bg-surface-warning/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning shrink-0" aria-hidden="true" />
          <p className="text-[12px] text-text-muted">
            Figures are computed from configured statutory rate tables. This is not tax advice. Verify before filing.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Published Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <div className="py-8 text-center">
              <DollarSign className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No published payslips yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payslips.map((ps) => (
                <div key={ps.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-text">{ps.periodName}</p>
                      <p className="text-[11px] text-text-muted">
                        {ps.periodStart.toLocaleDateString('en-SG')} - {ps.periodEnd.toLocaleDateString('en-SG')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {ps.publishedAt && (
                        <p className="text-[11px] text-text-muted">
                          Published {ps.publishedAt.toLocaleDateString('en-SG')}
                        </p>
                      )}
                      <PdfDownloadButton orgSlug={orgSlug} recordId={ps.id} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] text-text-muted">Gross</p>
                      <p className="text-[14px] font-medium text-text">{formatCurrency(ps.grossAmountCents)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted">CPF (You)</p>
                      <p className="text-[14px] font-medium text-text">{formatCurrency(ps.cpfEmployeeCents ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted">CPF (Employer)</p>
                      <p className="text-[14px] font-medium text-text">{formatCurrency(ps.cpfEmployerCents ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted">Net Pay</p>
                      <p className="text-[14px] font-bold text-text">{formatCurrency(ps.netAmountCents)}</p>
                    </div>
                  </div>

                  {ps.lineItems.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-[11px] font-medium text-text-muted mb-1">Line Items</p>
                      <div className="space-y-1">
                        {ps.lineItems.map((li) => (
                          <div key={li.id} className="flex items-center justify-between text-[12px]">
                            <span className="text-text-muted">{li.name} ({li.type})</span>
                            <span className="text-text">{formatCurrency(li.amountCents)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
