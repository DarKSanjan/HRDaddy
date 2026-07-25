'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/core/ui'
import { FileText } from 'lucide-react'
import { fetchEmployeeDocuments } from '@/modules/documents/client-actions'

interface EmployeeDocumentsTabProps {
  employeeId: string
  orgSlug: string
}

interface DocItem {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  expiresAt: string | null
  createdAt: string
  category: { id: string; name: string; isSensitive: boolean }
}

export function EmployeeDocumentsTab({ employeeId, orgSlug }: EmployeeDocumentsTabProps) {
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchEmployeeDocuments(orgSlug, employeeId)
        if (!cancelled && result.success && result.data) {
          setDocuments(result.data.documents as DocItem[])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [orgSlug, employeeId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-[13px] text-text-muted">Loading documents...</p>
        </CardContent>
      </Card>
    )
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-10 w-10 text-text-subtle" aria-hidden="true" />
          <p className="mt-3 text-[13px] text-text-muted">
            No documents uploaded for this employee.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents ({documents.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-[var(--radius-xs)] border border-border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-text-subtle shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text truncate">{doc.fileName}</p>
                <p className="text-[12px] text-text-muted">
                  {(doc.fileSize / 1024).toFixed(0)} KB
                  {doc.expiresAt && (
                    <> &middot; Expires {new Date(doc.expiresAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>
            <Badge variant={doc.category.isSensitive ? 'warning' : 'neutral'}>
              {doc.category.name}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
