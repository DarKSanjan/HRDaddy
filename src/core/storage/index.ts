/**
 * Storage adapter interface and Supabase implementation.
 * Object keys follow org/{orgId}/employee/{employeeId}/{uuid}.
 * No object is ever public.
 */
import { createClient } from '@supabase/supabase-js'

export interface StorageAdapter {
  upload(key: string, file: Buffer | Uint8Array, contentType: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

const BUCKET = 'employee-documents'
const DEFAULT_SIGNED_URL_EXPIRY = 60 // seconds

/**
 * Supabase Storage implementation against a private bucket.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  private client

  constructor() {
    this.client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
  }

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
    // List the exact path to check existence
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
 * Build a storage key following the org/{orgId}/employee/{employeeId}/{uuid} convention.
 */
export function buildStorageKey(
  orgId: string,
  employeeId: string,
  fileId: string
): string {
  return `org/${orgId}/employee/${employeeId}/${fileId}`
}

// Singleton instance
let storageInstance: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    storageInstance = new SupabaseStorageAdapter()
  }
  return storageInstance
}
