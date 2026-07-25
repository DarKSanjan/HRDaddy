'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button, Input, FormField, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { Upload, Trash2, Building2 } from 'lucide-react'
import { updateOrgName, uploadOrgLogo, removeOrgLogo } from '@/modules/employees/org-profile-actions'

interface OrgProfilePanelProps {
  orgSlug: string
  orgName: string
  orgLogoUrl: string | null
}

export function OrgProfilePanel({ orgSlug, orgName, orgLogoUrl }: OrgProfilePanelProps) {
  const router = useRouter()
  const [name, setName] = useState(orgName)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleNameSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    const result = await updateOrgName(orgSlug, name)
    if (result.success) {
      setSuccessMsg('Organisation name updated.')
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to update name')
    }
    setSaving(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccessMsg(null)
    const fd = new FormData()
    fd.set('logo', file)
    const result = await uploadOrgLogo(orgSlug, fd)
    if (result.success) {
      setSuccessMsg('Logo uploaded.')
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to upload logo')
    }
    setUploading(false)
    // Reset input
    e.target.value = ''
  }

  const handleLogoRemove = async () => {
    setUploading(true)
    setError(null)
    setSuccessMsg(null)
    const result = await removeOrgLogo(orgSlug)
    if (result.success) {
      setSuccessMsg('Logo removed.')
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to remove logo')
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger" role="alert">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-[var(--radius-sm)] border border-success/20 bg-success/5 p-3 text-[13px] text-success" role="status">
          {successMsg}
        </div>
      )}

      {/* Organisation Name */}
      <Card>
        <CardHeader>
          <CardTitle>Organisation Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Display Name" htmlFor="orgName">
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </FormField>
          <Button onClick={handleNameSave} loading={saving} disabled={name.trim() === orgName}>
            Save Name
          </Button>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {orgLogoUrl ? (
              <Image
                src={orgLogoUrl}
                alt="Organisation logo"
                width={64}
                height={64}
                className="h-16 w-16 rounded-[var(--radius-md)] border border-border object-contain"
                unoptimized
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-md)] border border-border bg-accent-50">
                <Building2 className="h-8 w-8 text-accent-700" aria-hidden="true" />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-[13px] text-text-muted">
                Upload a PNG, JPEG, WebP, or SVG file (max 2MB).
              </p>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="sr-only"
                    disabled={uploading}
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-[13px] font-medium text-text-muted hover:bg-surface-hover transition-colors">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {uploading ? 'Uploading...' : 'Upload'}
                  </span>
                </label>
                {orgLogoUrl && (
                  <Button variant="ghost" size="sm" onClick={handleLogoRemove} disabled={uploading}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
