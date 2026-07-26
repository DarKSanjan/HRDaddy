'use server'

/**
 * Organisation profile actions — edit org name and logo.
 * Uses the same storage abstraction as documents.
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { writeAudit } from '@/core/audit'
import { getStorage } from '@/core/storage'
import { updateOrgNameDb, setOrgLogoKey, getOrgLogoKey } from '@/core/org/mutations'

export interface OrgProfileResult {
  success: boolean
  error?: string
}

/**
 * Update organisation display name.
 */
export async function updateOrgName(
  orgSlug: string,
  name: string
): Promise<OrgProfileResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Organisation name is required' }
  }

  if (name.trim().length > 100) {
    return { success: false, error: 'Organisation name must be 100 characters or fewer' }
  }

  const before = { name: org.name }

  await updateOrgNameDb(org.id, name.trim())

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'org.name_updated',
    targetType: 'organisation',
    targetId: org.id,
    before,
    after: { name: name.trim() },
  })

  revalidatePath(`/${orgSlug}`, 'layout')
  return { success: true }
}

/**
 * Upload organisation logo. Stores to Supabase Storage under
 * org/{orgId}/branding/logo. Updates OrganisationSettings.brandLogoUrl.
 */
export async function uploadOrgLogo(
  orgSlug: string,
  formData: FormData
): Promise<OrgProfileResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: 'Logo must be PNG, JPEG, WebP, or SVG' }
  }

  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: 'Logo must be 2MB or smaller' }
  }

  const storage = await getStorage()
  const key = `org/${org.id}/branding/logo`

  // Upload (overwrite existing)
  const buffer = new Uint8Array(await file.arrayBuffer())

  // Try to delete existing first (ignore errors)
  try { await storage.delete(key) } catch { /* ignore */ }

  await storage.upload(key, buffer, file.type)

  // Store the key in settings (we generate fresh signed URLs on read)
  await setOrgLogoKey(org.id, key)

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'org.logo_updated',
    targetType: 'organisation',
    targetId: org.id,
  })

  revalidatePath(`/${orgSlug}`, 'layout')
  return { success: true }
}

/**
 * Remove organisation logo.
 */
export async function removeOrgLogo(
  orgSlug: string
): Promise<OrgProfileResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  const currentKey = await getOrgLogoKey(org.id)

  if (currentKey) {
    const storage = await getStorage()
    try { await storage.delete(currentKey) } catch { /* ignore */ }
  }

  await setOrgLogoKey(org.id, null)

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'org.logo_removed',
    targetType: 'organisation',
    targetId: org.id,
  })

  revalidatePath(`/${orgSlug}`, 'layout')
  return { success: true }
}
