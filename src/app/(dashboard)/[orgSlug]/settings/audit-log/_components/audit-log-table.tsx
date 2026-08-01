import type { AuditLogEntry } from '@/core/audit/queries'

interface AuditLogTableProps {
  entries: AuditLogEntry[]
  orgSlug: string
  currentPage: number
  totalPages: number
  total: number
  actorId?: string
  action?: string
  from?: string
  to?: string
}

function pageHref(
  orgSlug: string,
  page: number,
  filters: { actorId?: string; action?: string; from?: string; to?: string }
): string {
  const params = new URLSearchParams()
  if (filters.actorId) params.set('actorId', filters.actorId)
  if (filters.action) params.set('action', filters.action)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  params.set('page', String(page))
  return `/${orgSlug}/settings/audit-log?${params.toString()}`
}

function hasDetail(value: unknown): boolean {
  return value !== null && value !== undefined
}

export function AuditLogTable({
  entries,
  orgSlug,
  currentPage,
  totalPages,
  total,
  actorId,
  action,
  from,
  to,
}: AuditLogTableProps) {
  const filters = { actorId, action, from, to }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-3 py-2 font-medium">Timestamp</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                  {entry.createdAt.toLocaleString('en-SG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2 text-text font-medium whitespace-nowrap">
                  {entry.actorName}
                </td>
                <td className="px-3 py-2 text-text whitespace-nowrap">{entry.action}</td>
                <td className="px-3 py-2 text-text-muted">
                  {entry.targetType}
                  {entry.targetId ? ` · ${entry.targetId}` : ''}
                </td>
                <td className="px-3 py-2">
                  {hasDetail(entry.before) || hasDetail(entry.after) || hasDetail(entry.metadata) ? (
                    <details>
                      <summary className="cursor-pointer text-[12px] text-accent-500">
                        View
                      </summary>
                      <pre className="mt-2 max-w-md overflow-x-auto rounded-md bg-surface-hover p-2 text-[11px] text-text-muted">
                        {JSON.stringify(
                          { before: entry.before, after: entry.after, metadata: entry.metadata },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[12px] text-text-muted">
          <p>
            Page {currentPage} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <a
                href={pageHref(orgSlug, currentPage - 1, filters)}
                className="rounded-md border border-border px-2 py-1 hover:bg-surface-hover"
              >
                Previous
              </a>
            )}
            {currentPage < totalPages && (
              <a
                href={pageHref(orgSlug, currentPage + 1, filters)}
                className="rounded-md border border-border px-2 py-1 hover:bg-surface-hover"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </>
  )
}
