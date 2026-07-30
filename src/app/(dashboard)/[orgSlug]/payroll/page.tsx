import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/core/ui'
import { hasPermission } from '@/core/permissions'
import { getPayrollPeriods } from '@/modules/payroll/queries'
import { payrollListParamsSchema } from '@/modules/payroll/schemas'
import { DollarSign, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

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

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawSearchParams = await searchParams

  const session = await verifySession()
  const { org, enabledModules, membership } = await getOrgContext(orgSlug)
  moduleGuard('payroll', enabledModules)

  const canViewAll = hasPermission(membership.role, enabledModules, 'payroll.view_all')

  if (!canViewAll) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbItems={[{ label: 'Payroll' }]}
          title="Payroll"
        />
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <DollarSign className="h-10 w-10 text-text-subtle" aria-hidden="true" />
          <h3 className="mt-4 text-[16px] font-semibold text-text">Payroll</h3>
          <p className="mt-1 max-w-sm text-[13px] text-text-muted">
            View your payslips in the{' '}
            <Link href={`/${orgSlug}/payroll/payslips`} className="text-brand underline">
              Payslips
            </Link>{' '}
            section.
          </p>
        </div>
      </div>
    )
  }

  const listParams = payrollListParamsSchema.safeParse({
    status: rawSearchParams.status as string | undefined,
    page: rawSearchParams.page as string | undefined,
    pageSize: rawSearchParams.pageSize as string | undefined,
  })
  const validParams = listParams.success ? listParams.data : { page: 1, pageSize: 20 }

  const { periods, total } = await getPayrollPeriods(session.userId, org.id, validParams)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Payroll' }]}
        title="Payroll Periods"
      />

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
          <CardTitle>Periods</CardTitle>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <div className="py-8 text-center">
              <DollarSign className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No payroll periods found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="pb-2 pr-4 font-medium">Period</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-right">Records</th>
                    <th className="pb-2 pr-4 font-medium text-right">Gross</th>
                    <th className="pb-2 pr-4 font-medium text-right">CPF</th>
                    <th className="pb-2 font-medium text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/${orgSlug}/payroll/${p.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="text-[11px] text-text-muted">
                          {p.startDate.toLocaleDateString('en-SG')} - {p.endDate.toLocaleDateString('en-SG')}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(p.status)}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">{p.recordCount}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(p.totalGrossCents)}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(p.totalCpfCents)}</td>
                      <td className="py-3 text-right">{formatCurrency(p.totalNetCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > validParams.pageSize && (
            <div className="mt-4 flex items-center justify-between text-[12px] text-text-muted">
              <span>Showing {periods.length} of {total}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
