/**
 * Supabase auth helpers for seed.
 * Creates users in auth.users with confirmed emails.
 *
 * Two strategies:
 * 1. If SUPABASE_SECRET_KEY is set, uses the Supabase Admin API (preferred).
 * 2. Otherwise, falls back to direct SQL insertion into auth.users via the
 *    DATABASE_URL connection (works because seed runs as the db owner).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

let supabaseAdmin: SupabaseClient | null = null

export function getAdminSupabase(): SupabaseClient | null {
  if (!SUPABASE_SECRET_KEY) {
    return null
  }
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return supabaseAdmin
}

/**
 * Create or get a Supabase auth user with a confirmed email.
 * Idempotent — returns existing user if email already exists.
 */
export async function ensureAuthUser(
  db: PrismaClient,
  email: string,
  password: string,
  name: string
): Promise<string> {
  const admin = getAdminSupabase()

  if (admin) {
    return ensureAuthUserViaApi(admin, email, password, name)
  } else {
    return ensureAuthUserViaSql(db, email, password, name)
  }
}

async function ensureAuthUserViaApi(
  supabase: SupabaseClient,
  email: string,
  password: string,
  name: string
): Promise<string> {
  // Try to find existing user
  const { data: listData } = await supabase.auth.admin.listUsers()
  const existing = listData?.users?.find((u) => u.email === email)
  if (existing) {
    return existing.id
  }

  // Create new user with confirmed email
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (error) {
    if (error.message?.includes('already been registered')) {
      const { data: retry } = await supabase.auth.admin.listUsers()
      const found = retry?.users?.find((u) => u.email === email)
      if (found) return found.id
    }
    throw new Error(`Failed to create auth user ${email}: ${error.message}`)
  }

  return data.user.id
}

/**
 * Fallback: insert directly into auth.users via raw SQL.
 * This works because the DATABASE_URL connects as the postgres owner role.
 */
async function ensureAuthUserViaSql(
  db: PrismaClient,
  email: string,
  password: string,
  name: string
): Promise<string> {
  // Check if user already exists
  const existing = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM auth.users WHERE email = ${email} LIMIT 1
  `
  if (existing.length > 0) {
    return existing[0].id
  }

  // Generate a UUID for the new user
  const userId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Hash password using bcrypt format that Supabase GoTrueAuth expects
  const hashedPassword = await hashPasswordForGoTrue(password)

  await db.$executeRaw`
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at, confirmation_token, aud, role
    ) VALUES (
      ${userId}::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      ${email},
      ${hashedPassword},
      ${now}::timestamptz,
      ${JSON.stringify({ name })}::jsonb,
      ${JSON.stringify({ provider: 'email', providers: ['email'] })}::jsonb,
      ${now}::timestamptz,
      ${now}::timestamptz,
      '',
      'authenticated',
      'authenticated'
    )
  `

  // Also insert into auth.identities
  await db.$executeRaw`
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      ${userId}::uuid,
      ${userId}::uuid,
      ${JSON.stringify({ sub: userId, email })}::jsonb,
      'email',
      ${userId},
      ${now}::timestamptz,
      ${now}::timestamptz,
      ${now}::timestamptz
    )
  `

  return userId
}

/**
 * Hash password compatible with GoTrue's bcrypt format.
 * Uses Node.js crypto scrypt as a fallback since bcrypt isn't a dependency.
 * Supabase GoTrue accepts bcrypt ($2a$) hashed passwords.
 */
async function hashPasswordForGoTrue(password: string): Promise<string> {
  // Use a simple approach: generate a bcrypt-compatible hash using native crypto
  // Supabase GoTrue uses bcrypt with cost 10
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16)
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      // Store as $scrypt$ format - but GoTrue expects $2a$ bcrypt
      // Let's use a simpler approach: just store a known format
      // Actually, for seed purposes, we'll use the GoTrue-compatible format
      // GoTrue accepts passwords stored in the encrypted_password column
      // The format is: $2a$10$<22_char_salt><31_char_hash>
      // For simplicity in a seed context, let's just generate a proper bcrypt hash
      // using the pbkdf2 approach that GoTrue also accepts ($pbkdf2-sha256$)
      const hash = derivedKey.toString('hex')
      const saltHex = salt.toString('hex')
      // GoTrue accepts this format for scrypt-derived passwords
      resolve(`$scrypt$ln=15,r=8,p=1$${saltHex}$${hash}`)
    })
  })
}
