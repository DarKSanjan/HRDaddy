import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { getEmployeeIdForUser } from '@/core/employees'
import {
  getRootFolders,
  getEmployeeFolders,
  getCategoryFoldersForEmployee,
  getDocumentsForCategory,
  getPayrollSubfolders,
  getPayrollPeriodFolders,
  getPayrollEmployeesInPeriod,
  getPayrollEmployeeFolders,
  getPayrollPeriodsForEmployee,
} from '@/modules/documents/explorer-queries'
import type { ExplorerEntry } from '@/modules/documents/explorer-queries'
import { DocumentExplorer } from './_components/document-explorer'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawParams = await searchParams

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('documents', enabledModules)

  const canViewAll = hasPermission(membership.role, enabledModules, 'document.view_all')
  const canViewPayrollAll = hasPermission(membership.role, enabledModules, 'payroll.view_all')

  // Get the viewer's employee ID for self-scoping
  const selfEmployeeId = await getEmployeeIdForUser(org.id, session.userId)

  // Parse path — segments separated by /
  const rawPath = (rawParams.path as string) || '/'
  const segments = rawPath.split('/').filter(Boolean)

  // Determine if this is a self-only view (non-admin can only see their own)
  const selfOnly = !canViewAll
  const payrollSelfOnly = !canViewPayrollAll

  // Resolve the current folder view
  let entries: ExplorerEntry[] = []
  const breadcrumbs: Array<{ label: string; path: string }> = [
    { label: 'Documents', path: '/' },
  ]
  let basePath = ''

  if (segments.length === 0) {
    // Root: show Employee Documents and Payroll folders
    entries = getRootFolders()
    basePath = ''
  } else if (segments[0] === 'employee-documents') {
    breadcrumbs.push({ label: 'Employee Documents', path: '/employee-documents' })
    basePath = '/employee-documents'

    if (segments.length === 1) {
      // Employee Documents root: show employees
      entries = await getEmployeeFolders(
        session.userId,
        org.id,
        selfOnly ? selfEmployeeId : null
      )
    } else if (segments.length === 2) {
      // Employee Documents → Employee: show categories
      const employeeId = segments[1]
      // Permission check: non-admin can only see own
      if (selfOnly && employeeId !== selfEmployeeId) {
        entries = []
      } else {
        // Get employee name for breadcrumb
        const employeeFolders = await getEmployeeFolders(
          session.userId,
          org.id,
          selfOnly ? selfEmployeeId : null
        )
        const empFolder = employeeFolders.find((f) => f.id === employeeId)
        if (empFolder) {
          breadcrumbs.push({ label: empFolder.name, path: `/employee-documents/${employeeId}` })
        }
        entries = await getCategoryFoldersForEmployee(
          session.userId,
          org.id,
          employeeId,
          !canViewAll
        )
        basePath = `/employee-documents/${employeeId}`
      }
    } else if (segments.length === 3) {
      // Employee Documents → Employee → Category: show files
      const employeeId = segments[1]
      const categoryId = segments[2]

      if (selfOnly && employeeId !== selfEmployeeId) {
        entries = []
      } else {
        // Get employee name for breadcrumb
        const employeeFolders = await getEmployeeFolders(
          session.userId,
          org.id,
          selfOnly ? selfEmployeeId : null
        )
        const empFolder = employeeFolders.find((f) => f.id === employeeId)
        if (empFolder) {
          breadcrumbs.push({ label: empFolder.name, path: `/employee-documents/${employeeId}` })
        }

        // Get category name for breadcrumb
        const categories = await getCategoryFoldersForEmployee(
          session.userId,
          org.id,
          employeeId,
          !canViewAll
        )
        const catFolder = categories.find((c) => c.id === categoryId)
        if (catFolder) {
          breadcrumbs.push({
            label: catFolder.name,
            path: `/employee-documents/${employeeId}/${categoryId}`,
          })
        }

        entries = await getDocumentsForCategory(
          session.userId,
          org.id,
          employeeId,
          categoryId,
          !canViewAll
        )
        basePath = `/employee-documents/${employeeId}/${categoryId}`
      }
    }
  } else if (segments[0] === 'payroll') {
    breadcrumbs.push({ label: 'Payroll', path: '/payroll' })
    basePath = '/payroll'

    if (segments.length === 1) {
      // Payroll root: show By Month / By Employee
      entries = getPayrollSubfolders()
    } else if (segments[1] === 'by-month') {
      breadcrumbs.push({ label: 'By Month', path: '/payroll/by-month' })
      basePath = '/payroll/by-month'

      if (segments.length === 2) {
        // By Month: list periods
        entries = await getPayrollPeriodFolders(session.userId, org.id)
      } else if (segments.length === 3) {
        // By Month → Period: list employees
        const periodId = segments[2]
        const periods = await getPayrollPeriodFolders(session.userId, org.id)
        const periodFolder = periods.find((p) => p.id === periodId)
        if (periodFolder) {
          breadcrumbs.push({
            label: periodFolder.name,
            path: `/payroll/by-month/${periodId}`,
          })
        }
        entries = await getPayrollEmployeesInPeriod(
          session.userId,
          org.id,
          periodId,
          payrollSelfOnly ? selfEmployeeId : null
        )
        basePath = `/payroll/by-month/${periodId}`
      }
    } else if (segments[1] === 'by-employee') {
      breadcrumbs.push({ label: 'By Employee', path: '/payroll/by-employee' })
      basePath = '/payroll/by-employee'

      if (segments.length === 2) {
        // By Employee: list employees
        entries = await getPayrollEmployeeFolders(
          session.userId,
          org.id,
          payrollSelfOnly ? selfEmployeeId : null
        )
      } else if (segments.length === 3) {
        // By Employee → Employee: list periods as virtual files
        const employeeId = segments[2]

        if (payrollSelfOnly && employeeId !== selfEmployeeId) {
          entries = []
        } else {
          const employeeFolders = await getPayrollEmployeeFolders(
            session.userId,
            org.id,
            payrollSelfOnly ? selfEmployeeId : null
          )
          const empFolder = employeeFolders.find((f) => f.id === employeeId)
          if (empFolder) {
            breadcrumbs.push({
              label: empFolder.name,
              path: `/payroll/by-employee/${employeeId}`,
            })
          }
          entries = await getPayrollPeriodsForEmployee(
            session.userId,
            org.id,
            employeeId
          )
          basePath = `/payroll/by-employee/${employeeId}`
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-text">Documents</h1>
        <p className="text-[13px] text-text-muted">
          Browse employee documents and payroll records
        </p>
      </div>

      <DocumentExplorer
        orgSlug={orgSlug}
        entries={entries}
        breadcrumbs={breadcrumbs}
        basePath={basePath}
      />
    </div>
  )
}
