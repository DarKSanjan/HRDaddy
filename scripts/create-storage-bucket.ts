/**
 * Manual, one-time operational bootstrap. Creates the `employee-documents`
 * storage bucket, which nothing else creates automatically — Supabase's
 * hosted project setup doesn't include it, and the self-hosted stack starts
 * with an empty storage.buckets table. Idempotent, safe to re-run. Requires
 * SUPABASE_SECRET_KEY (service role) and NEXT_PUBLIC_SUPABASE_URL.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { BUCKET } from '../src/core/storage'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must both be set.')
  }

  const client = createClient(url, secret)

  const { data: existing, error: listError } = await client.storage.listBuckets()
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`)
  }

  if (existing.some((b) => b.id === BUCKET)) {
    console.log(`Bucket "${BUCKET}" already exists — nothing to do.`)
    return
  }

  const { error: createError } = await client.storage.createBucket(BUCKET, { public: false })
  if (createError) {
    throw new Error(`Failed to create bucket "${BUCKET}": ${createError.message}`)
  }

  console.log(`Created private bucket "${BUCKET}".`)
}

main().catch((error) => {
  console.error('Storage bucket bootstrap failed:', error)
  process.exitCode = 1
})
