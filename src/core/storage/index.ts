/**
 * Storage adapter interface and Supabase implementation.
 *
 * Object keys follow org/{orgId}/employee/{employeeId}/{uuid}. The bucket is
 * private; access is always via short-lived signed URLs.
 *
 * Deliberately built on the *caller's* session rather than a service-role key.
 * Storage RLS policies scope objects by the org prefix, so a compromised
 * request cannot reach another tenant's files even if an application-level
 * permission check were bypassed. Holding a service-role key here would defeat
 * that: it bypasses every storage policy, and it would have to sit in the
 * environment of a process that also serves user requests.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/core/auth/supabase-server'

export interface StorageAdapter {
  upload(key: string, file: Buffer | Uint8Array, contentType: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export const BUCKET = 'employee-documents'
const DEFAULT_SIGNED_URL_EXPIRY = 60 // seconds

export class SupabaseStorageAdapter implements StorageAdapter {
  constructor(private readonly client: SupabaseClient) {}

  async upload(
    key: string,
    file: Buffer | Uint8Array,
    contentType: string
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(key, file, { contentType, upsert: false })

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`)
    }
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(key, expiresInSeconds)

    if (error || !data?.signedUrl) {
      throw new Error(`Storage signed URL failed: ${error?.message}`)
    }
    return data.signedUrl
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.storage.from(BUCKET).remove([key])
    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`)
    }
  }

  async exists(key: string): Promise<boolean> {
    const parts = key.split('/')
    const fileName = parts.pop()!
    const folder = parts.join('/')

    const { data, error } = await this.client.storage
      .from(BUCKET)
      .list(folder, { search: fileName, limit: 1 })

    if (error) return false
    return data.some((f) => f.name === fileName)
  }
}

/**
 * Storage scoped to the current request's user. Storage RLS applies.
 * This is what feature code uses.
 */
export async function getStorage(): Promise<StorageAdapter> {
  const client = await createSupabaseServer()
  return new SupabaseStorageAdapter(client)
}

/**
 * Storage without a user session, for background jobs and cleanup sweeps that
 * legitimately run outside a request. Requires SUPABASE_SECRET_KEY, which is
 * optional — if it is absent, this throws rather than silently degrading, and
 * nothing in the request path calls it.
 */
export function getStorageUnscoped(): StorageAdapter {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not configured. It is only needed for background ' +
        'jobs; request-path code should use getStorage() instead.'
    )
  }
  return new SupabaseStorageAdapter(
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret)
  )
}

/**
 * Build a storage key following the org/{orgId}/employee/{employeeId}/{uuid}
 * convention. The org prefix is what the storage RLS policy matches on.
 */
export function buildStorageKey(
  orgId: string,
  employeeId: string,
  fileId: string
): string {
  return `org/${orgId}/employee/${employeeId}/${fileId}`
}
