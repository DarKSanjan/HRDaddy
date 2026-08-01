import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, CardHeader, CardTitle, Button, PageHeader } from '@/core/ui'
import { getPayrollRecords } from '@/modules/payroll/queries'
import {
  submitForReview,
  approvePayroll,
  publishPayroll,
  markAsPaid,
  reopenPayroll,
} from '@/modules/payroll/actions'
import { PdfDownloadButton } from '@/modules/payroll/pdf-download-button'
import { ProcessPayrollForm } from './_components/process-payroll-form'
import { DollarSign, AlertTriangle } from 'lucide-react'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PUBLISHED: 'bg-green-100 text-green-800',
    PAID: 'bg-emerald-100 text-emerald-800',
    ARCHIVED: 'bg-gray-100 text-gray-500',
    REOPENED: 'bg-orange-100 text-orange-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

export default async function PayrollPeriodPage({
  params,
}: {
  params: Promise<{ orgSlug: string; periodId: string }>
}) {
  const { orgSlug, periodId } = await params

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('payroll', enabledModules)
  await requirePermission(org.id, 'payroll.view_all')

  const { period, records } = await getPayrollRecords(session.userId, org.id, periodId)
  if (!period) notFound()

  const totalGross = records.reduce((s, r) => s + r.grossAmountCents, 0)
  const totalNet = records.reduce((s, r) => s + r.netAmountCents, 0)
  const totalCpf = records.reduce((s, r) => s + (r.cpfTotalCents ?? 0), 0)

  async function handleSubmitReview(formData: FormData) {
    'use server'
    await submitForReview(orgSlug, formData)
  }
  async function handleApprove(formData: FormData) {
    'use server'
    await approvePayroll(orgSlug, formData)
  }
  async function handlePublish(formData: FormData) {
    'use server'
    await publishPayroll(orgSlug, formData)
  }
  async function handleMarkPaid(formData: FormData) {
    'use server'
    await markAsPaid(orgSlug, formData)
  }
  async function handleReopen(formData: FormData) {
    'use server'
    await reopenPayroll(orgSlug, formData)
  }

  const isDraftOrReopened = period.status === 'DRAFT' || period.status === 'REOPENED'

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Payroll', href: `/${orgSlug}/payroll` }, { label: period.name }]}
        title={period.name}
        actions={
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(period.status)}`}>
            {period.status.replace('_', ' ')}
          </span>
        }
      />

      <div className="rounded-md border border-border bg-surface-warning/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning shrink-0" aria-hidden="true" />
          <p className="text-[12px] text-text-muted">
            Figures are computed from configured statutory rate tables. This is not tax advice. Verify before filing.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-text-muted">Records</p>
            <p className="text-[20px] font-bold text-text">{records.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-text-muted">Total Gross</p>
            <p className="text-[20px] font-bold text-text">{formatCurrency(totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-text-muted">Total CPF</p>
            <p className="text-[20px] font-bold text-text">{formatCurrency(totalCpf)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-text-muted">Total Net</p>
            <p className="text-[20px] font-bold text-text">{formatCurrency(totalNet)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {isDraftOrReopened && (
          <ProcessPayrollForm orgSlug={orgSlug} periodId={periodId} />
        )}
        {isDraftOrReopened && records.length > 0 && (
          <form action={handleSubmitReview}>
            <input type="hidden" name="periodId" value={periodId} />
            <Button type="submit" size="md" variant="secondary">Submit for Review</Button>
          </form>
        )}
        {period.status === 'UNDER_REVIEW' && (
          <form action={handleApprove}>
            <input type="hidden" name="periodId" value={periodId} />
            <Button type="submit" size="md">Approve</Button>
          </form>
        )}
        {period.status === 'APPROVED' && (
          <form action={handlePublish}>
            <input type="hidden" name="periodId" value={periodId} />
            <Button type="submit" size="md">Publish Payslips</Button>
          </form>
        )}
        {period.status === 'PUBLISHED' && (
          <form action={handleMarkPaid}>
            <input type="hidden" name="periodId" value={periodId} />
            <Button type="submit" size="md">Mark as Paid</Button>
          </form>
        )}
        {(period.status === 'PUBLISHED' || period.status === 'PAID') && (
          <form action={handleReopen}>
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="reason" value="Correction required" />
            <Button type="submit" size="md" variant="danger">Reopen</Button>
          </form>
        )}
        {records.length > 0 && (
          <PdfDownloadButton orgSlug={orgSlug} periodId={periodId} label="Download All Payslips (PDF)" />
        )}
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="py-8 text-center">
              <DollarSign className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">
                No records yet. Process payroll to compute CPF contributions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="pb-2 pr-4 font-medium">Employee</th>
                    <th className="pb-2 pr-4 font-medium text-right">Gross</th>
                    <th className="pb-2 pr-4 font-medium text-right">CPF (Employee)</th>
                    <th className="pb-2 pr-4 font-medium text-right">CPF (Employer)</th>
                    <th className="pb-2 pr-4 font-medium text-right">CPF Total</th>
                    <th className="pb-2 pr-4 font-medium text-right">Net</th>
                    <th className="pb-2 font-medium text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {r.employeeFirstName} {r.employeeLastName}
                      </td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(r.grossAmountCents)}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(r.cpfEmployeeCents ?? 0)}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(r.cpfEmployerCents ?? 0)}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(r.cpfTotalCents ?? 0)}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(r.netAmountCents)}</td>
                      <td className="py-3 text-right">
                        <PdfDownloadButton orgSlug={orgSlug} recordId={r.id} label="PDF" size="sm" variant="ghost" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
