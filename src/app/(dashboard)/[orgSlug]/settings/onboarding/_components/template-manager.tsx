'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Archive, ClipboardCheck } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Badge,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui'
import { archiveTemplate } from '@/modules/onboarding/actions'
import type { OnboardingTemplateListItem } from '@/modules/onboarding/queries'
import { TemplateForm } from './template-form'

interface TemplateManagerProps {
  orgSlug: string
  templates: OnboardingTemplateListItem[]
  canManage: boolean
}

export function TemplateManager({ orgSlug, templates, canManage }: TemplateManagerProps) {
  const router = useRouter()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const handleArchive = async (templateId: string) => {
    setArchiveError(null)
    const result = await archiveTemplate(orgSlug, templateId)
    if (result.success) {
      setArchivingId(null)
      router.refresh()
    } else {
      setArchiveError(result.error ?? 'Failed to archive template.')
    }
  }

  const activeTemplates = templates.filter((t) => !t.isArchived)
  const archivedTemplates = templates.filter((t) => t.isArchived)

  return (
    <div className="space-y-6">
      {/* Action bar */}
      {canManage && (
        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
      )}

      {/* Active templates */}
      {activeTemplates.length === 0 && archivedTemplates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<ClipboardCheck className="h-10 w-10" />}
              title="No templates yet"
              description="Create an onboarding template to define checklists for new employees."
              action={
                canManage
                  ? { label: 'Create Template', onClick: () => setShowCreateDialog(true) }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeTemplates.map((template) => (
            <Card key={template.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-text truncate">
                      {template.name}
                    </h3>
                    <Badge variant="neutral">
                      {template._count.tasks} {template._count.tasks === 1 ? 'task' : 'tasks'}
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="mt-0.5 text-[12px] text-text-muted line-clamp-1">
                      {template.description}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 ml-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingTemplateId(template.id)}
                      aria-label={`Edit ${template.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setArchivingId(template.id)}
                      aria-label={`Archive ${template.name}`}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Archived templates */}
          {archivedTemplates.length > 0 && (
            <div className="pt-4">
              <h2 className="text-[13px] font-medium text-text-muted mb-2">Archived</h2>
              {archivedTemplates.map((template) => (
                <Card key={template.id} className="opacity-60 mb-2">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-medium text-text truncate">
                          {template.name}
                        </h3>
                        <Badge variant="neutral">Archived</Badge>
                        <Badge variant="neutral">
                          {template._count.tasks} {template._count.tasks === 1 ? 'task' : 'tasks'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create template dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Onboarding Template</DialogTitle>
            <DialogDescription>
              Define a checklist of tasks for new employees.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            orgSlug={orgSlug}
            onSuccess={() => {
              setShowCreateDialog(false)
              router.refresh()
            }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit template dialog */}
      <Dialog
        open={editingTemplateId !== null}
        onOpenChange={(open) => { if (!open) setEditingTemplateId(null) }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the template name and tasks.
            </DialogDescription>
          </DialogHeader>
          {editingTemplateId && (
            <TemplateForm
              orgSlug={orgSlug}
              templateId={editingTemplateId}
              onSuccess={() => {
                setEditingTemplateId(null)
                router.refresh()
              }}
              onCancel={() => setEditingTemplateId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog
        open={archivingId !== null}
        onOpenChange={(open) => { if (!open) { setArchivingId(null); setArchiveError(null) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Template</DialogTitle>
            <DialogDescription>
              Archived templates cannot be assigned to new employees. Existing onboardings using this template will not be affected.
            </DialogDescription>
          </DialogHeader>
          {archiveError && (
            <p className="text-[12px] text-danger">{archiveError}</p>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setArchivingId(null); setArchiveError(null) }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => archivingId && handleArchive(archivingId)}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
