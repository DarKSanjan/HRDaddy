import { cookies } from 'next/headers'
import { db } from './db'

const SESSION_COOKIE_NAME = 'hrdaddy_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

export interface SessionPayload {
  userId: string
  email: string
  name: string
}

/**
 * Encrypt session payload to a token string.
 * Uses a simple base64-encoded JSON with HMAC signature.
 * In production, replace with a proper JWT or encrypted cookie library.
 */
async function encrypt(payload: SessionPayload): Promise<string> {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')

  const data = JSON.stringify(payload)
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  )

  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const token = Buffer.from(`${data}.${sigHex}`).toString('base64url')
  return token
}

/**
 * Decrypt and verify a session token.
 */
async function decrypt(token: string): Promise<SessionPayload | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const lastDotIndex = decoded.lastIndexOf('.')
    if (lastDotIndex === -1) return null

    const data = decoded.slice(0, lastDotIndex)
    const sigHex = decoded.slice(lastDotIndex + 1)

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const sigBytes = new Uint8Array(
      sigHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    )

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(data)
    )

    if (!valid) return null

    return JSON.parse(data) as SessionPayload
  } catch {
    return null
  }
}

/**
 * Create a session and set the cookie.
 */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encrypt(payload)
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

/**
 * Get the current session from the cookie.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null
  return decrypt(token)
}

/**
 * Destroy the session by deleting the cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Get the full user record from the session.
 */
export async function getSessionUser() {
  const session = await getSession()
  if (!session) return null

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
    },
  })

  if (!user || !user.isActive) return null
  return user
}
