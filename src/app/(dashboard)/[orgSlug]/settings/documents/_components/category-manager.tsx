'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, FolderOpen, ShieldAlert } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Badge,
  EmptyState,
  FormField,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui'
import { createCategory, updateCategory } from '@/modules/documents/actions'

interface CategoryItem {
  id: string
  name: string
  isSensitive: boolean
  createdAt: string
  _count: { documents: number }
}

interface CategoryManagerProps {
  orgSlug: string
  categories: CategoryItem[]
  canManage: boolean
}

export function CategoryManager({ orgSlug, categories, canManage }: CategoryManagerProps) {
  const router = useRouter()

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSensitive, setCreateSensitive] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({})

  // Edit dialog state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSensitive, setEditSensitive] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({})

  const resetCreate = () => {
    setCreateName('')
    setCreateSensitive(false)
    setCreateError(null)
    setCreateFieldErrors({})
  }

  const resetEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditSensitive(false)
    setEditError(null)
    setEditFieldErrors({})
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSaving(true)
    setCreateError(null)
    setCreateFieldErrors({})

    const result = await createCategory(orgSlug, {
      name: createName,
      isSensitive: createSensitive,
    })

    if (result.success) {
      resetCreate()
      setShowCreate(false)
      router.refresh()
    } else if (result.fieldErrors) {
      setCreateFieldErrors(result.fieldErrors)
    } else {
      setCreateError(result.error ?? 'Failed to create category.')
    }
    setCreateSaving(false)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setEditSaving(true)
    setEditError(null)
    setEditFieldErrors({})

    const result = await updateCategory(orgSlug, {
      categoryId: editingId,
      name: editName,
      isSensitive: editSensitive,
    })

    if (result.success) {
      resetEdit()
      router.refresh()
    } else if (result.fieldErrors) {
      setEditFieldErrors(result.fieldErrors)
    } else {
      setEditError(result.error ?? 'Failed to update category.')
    }
    setEditSaving(false)
  }

  const openEdit = (cat: CategoryItem) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditSensitive(cat.isSensitive)
    setEditError(null)
    setEditFieldErrors({})
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      {canManage && (
        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create Category
          </Button>
        </div>
      )}

      {/* Category list */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<FolderOpen className="h-10 w-10" />}
              title="No document categories"
              description="Create categories to organise employee documents (e.g. Contracts, ID, Certifications)."
              action={
                canManage
                  ? { label: 'Create Category', onClick: () => setShowCreate(true) }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-text truncate">
                      {cat.name}
                    </h3>
                    {cat.isSensitive && (
                      <Badge variant="danger">
                        <ShieldAlert className="h-3 w-3 mr-0.5" />
                        Sensitive
                      </Badge>
                    )}
                    <Badge variant="neutral">
                      {cat._count.documents} {cat._count.documents === 1 ? 'doc' : 'docs'}
                    </Badge>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 ml-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(cat)}
                      aria-label={`Edit ${cat.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(v) => {
          if (!v) resetCreate()
          setShowCreate(v)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Document Category</DialogTitle>
            <DialogDescription>
              Categories organise employee documents. Sensitive categories require elevated
              permissions to view.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <FormField
              label="Name"
              htmlFor="cat-name"
              required
              error={createFieldErrors.name}
            >
              <Input
                id="cat-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Contracts, ID Documents, Certifications"
                maxLength={100}
                required
              />
            </FormField>

            <div className="flex items-center gap-2">
              <input
                id="cat-sensitive"
                type="checkbox"
                checked={createSensitive}
                onChange={(e) => setCreateSensitive(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent-500 focus:ring-accent-500"
              />
              <label htmlFor="cat-sensitive" className="text-[13px] text-text">
                Mark as sensitive (requires view_all permission to access)
              </label>
            </div>

            {createError && (
              <p className="text-[12px] text-danger" role="alert">{createError}</p>
            )}

            <DialogFooter>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  resetCreate()
                  setShowCreate(false)
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" loading={createSaving}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(v) => {
          if (!v) resetEdit()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category name or sensitivity flag.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <FormField
              label="Name"
              htmlFor="edit-cat-name"
              required
              error={editFieldErrors.name}
            >
              <Input
                id="edit-cat-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
                required
              />
            </FormField>

            <div className="flex items-center gap-2">
              <input
                id="edit-cat-sensitive"
                type="checkbox"
                checked={editSensitive}
                onChange={(e) => setEditSensitive(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent-500 focus:ring-accent-500"
              />
              <label htmlFor="edit-cat-sensitive" className="text-[13px] text-text">
                Mark as sensitive
              </label>
            </div>

            {editError && (
              <p className="text-[12px] text-danger" role="alert">{editError}</p>
            )}

            <DialogFooter>
              <Button variant="secondary" size="md" onClick={resetEdit}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" loading={editSaving}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
