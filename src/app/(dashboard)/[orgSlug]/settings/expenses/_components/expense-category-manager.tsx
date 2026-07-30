'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, FolderOpen, Archive } from 'lucide-react'
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
import { createExpenseCategory, updateExpenseCategory } from '@/modules/expenses/actions'

interface CategoryItem {
  id: string
  name: string
  isArchived: boolean
  createdAt: string
  _count: { claims: number }
}

interface ExpenseCategoryManagerProps {
  orgSlug: string
  categories: CategoryItem[]
  canManage: boolean
}

export function ExpenseCategoryManager({ orgSlug, categories, canManage }: ExpenseCategoryManagerProps) {
  const router = useRouter()

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({})

  // Edit dialog state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({})

  const resetCreate = () => {
    setCreateName('')
    setCreateError(null)
    setCreateFieldErrors({})
  }

  const resetEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditError(null)
    setEditFieldErrors({})
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSaving(true)
    setCreateError(null)
    setCreateFieldErrors({})

    const result = await createExpenseCategory(orgSlug, { name: createName })

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

    const result = await updateExpenseCategory(orgSlug, {
      categoryId: editingId,
      name: editName,
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

  const handleArchiveToggle = async (categoryId: string, isArchived: boolean) => {
    await updateExpenseCategory(orgSlug, { categoryId, isArchived: !isArchived })
    router.refresh()
  }

  const activeCategories = categories.filter((c) => !c.isArchived)
  const archivedCategories = categories.filter((c) => c.isArchived)

  return (
    <div className="space-y-4">
      {canManage && (
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      )}

      {activeCategories.length === 0 && archivedCategories.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No expense categories"
          description="Create a category to start organising expense claims."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {activeCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-[14px] font-medium text-text">{cat.name}</span>
                    <span className="ml-2 text-[12px] text-text-muted">
                      ({cat._count.claims} claim{cat._count.claims !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(cat.id)
                          setEditName(cat.name)
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleArchiveToggle(cat.id, cat.isArchived)}
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {archivedCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-4 py-3 opacity-60">
                  <div>
                    <span className="text-[14px] font-medium text-text">{cat.name}</span>
                    <Badge variant="neutral" className="ml-2">Archived</Badge>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchiveToggle(cat.id, cat.isArchived)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { resetCreate(); setShowCreate(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Expense Category</DialogTitle>
            <DialogDescription>Create a new category for expense claims.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormField label="Category Name" htmlFor="create-category-name" error={createFieldErrors.name}>
              <Input
                id="create-category-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Travel, Meals, Office Supplies"
                required
              />
            </FormField>
            {createError && <p className="text-[13px] text-danger">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { resetCreate(); setShowCreate(false) }}>Cancel</Button>
              <Button type="submit" disabled={createSaving}>
                {createSaving ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={(v) => { if (!v) resetEdit() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update the expense category name.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <FormField label="Category Name" htmlFor="edit-category-name" error={editFieldErrors.name}>
              <Input
                id="edit-category-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </FormField>
            {editError && <p className="text-[13px] text-danger">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={resetEdit}>Cancel</Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
