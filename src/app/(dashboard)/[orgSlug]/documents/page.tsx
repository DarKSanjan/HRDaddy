import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb, Badge, Card, CardContent } from '@/core/ui'
import { listDocuments, listCategories } from '@/modules/documents/queries'
import { hasPermission } from '@/core/permissions'
import { FileText } from 'lucide-react'

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

  // Parse filter params
  const employeeId = rawParams.employeeId as string | undefined
  const categoryId = rawParams.categoryId as string | undefined
  const search = rawParams.search as string | undefined
  const page = rawParams.page ? Number(rawParams.page) : 1

  const [{ documents, total }, categories] = await Promise.all([
    listDocuments(session.userId, org.id, {
      employeeId,
      categoryId,
      search,
      page,
      pageSize: 20,
    }, { viewAll: canViewAll, excludeSensitive: !canViewAll }),
    listCategories(session.userId, org.id),
  ])

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Documents' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text">Documents</h1>
          <p className="text-[13px] text-text-muted">
            {total} document{total !== 1 ? 's' : ''} in your organisation
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <a
            key={cat.id}
            href={`/${orgSlug}/documents?categoryId=${cat.id}`}
            className={
              categoryId === cat.id
                ? 'rounded-[var(--radius-sm)] bg-accent-50 px-2.5 py-1 text-[12px] font-medium text-accent-700'
                : 'rounded-[var(--radius-sm)] border border-border px-2.5 py-1 text-[12px] font-medium text-text-muted hover:bg-surface-hover'
            }
          >
            {cat.name} ({cat._count.documents})
          </a>
        ))}
        {categoryId && (
          <a
            href={`/${orgSlug}/documents`}
            className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] font-medium text-text-muted hover:text-text"
          >
            Clear filter
          </a>
        )}
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-text-subtle" aria-hidden="true" />
            <p className="mt-3 text-[13px] text-text-muted">
              No documents found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-[12px] font-medium text-text-muted">File Name</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-muted hidden sm:table-cell">Employee</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-muted hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-muted hidden lg:table-cell">Expires</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-muted">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-text-subtle shrink-0" aria-hidden="true" />
                        <span className="text-[13px] font-medium text-text truncate max-w-[200px]">
                          {doc.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-muted hidden sm:table-cell">
                      {doc.employee.firstName} {doc.employee.lastName}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant={doc.category.isSensitive ? 'warning' : 'neutral'}>
                        {doc.category.name}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-muted hidden lg:table-cell">
                      {doc.expiresAt
                        ? new Date(doc.expiresAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-muted">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/${orgSlug}/documents?page=${page - 1}${categoryId ? `&categoryId=${categoryId}` : ''}`}
                className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted hover:bg-surface-hover"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/${orgSlug}/documents?page=${page + 1}${categoryId ? `&categoryId=${categoryId}` : ''}`}
                className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted hover:bg-surface-hover"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
