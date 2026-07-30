'use client'

import { Badge } from '@/core/ui'

interface AssignmentItem {
  id: string
  employeeFirstName: string
  employeeLastName: string
  assignedAt: string
  assignedByFirstName: string
  assignedByLastName: string
  returnedAt: string | null
  returnedByFirstName: string | null
  returnedByLastName: string | null
  conditionAtAssignment: string | null
  conditionAtReturn: string | null
  notes: string | null
}

interface AssetAssignmentHistoryTableProps {
  assignments: AssignmentItem[]
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function AssetAssignmentHistoryTable({ assignments }: AssetAssignmentHistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="px-3 py-2 font-medium">Employee</th>
            <th className="px-3 py-2 font-medium">Assigned</th>
            <th className="px-3 py-2 font-medium">Assigned By</th>
            <th className="px-3 py-2 font-medium">Returned</th>
            <th className="px-3 py-2 font-medium">Condition (Out)</th>
            <th className="px-3 py-2 font-medium">Condition (Return)</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 text-text font-medium">
                {a.employeeFirstName} {a.employeeLastName}
              </td>
              <td className="px-3 py-2 text-text">{formatDate(a.assignedAt)}</td>
              <td className="px-3 py-2 text-text-muted">
                {a.assignedByFirstName} {a.assignedByLastName}
              </td>
              <td className="px-3 py-2 text-text">
                {a.returnedAt ? formatDate(a.returnedAt) : '—'}
              </td>
              <td className="px-3 py-2 text-text-muted">{a.conditionAtAssignment || '—'}</td>
              <td className="px-3 py-2 text-text-muted">{a.conditionAtReturn || '—'}</td>
              <td className="px-3 py-2">
                {a.returnedAt ? (
                  <Badge variant="neutral">Returned</Badge>
                ) : (
                  <Badge variant="info">Active</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
