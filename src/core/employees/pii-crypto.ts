import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export const PII_ENCRYPTION_PREFIX = 'enc:v1:'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

function decodeBase64(value: string, description: string): Buffer {
  const unpadded = value.replace(/=+$/, '')
  const padding = '='.repeat((4 - (unpadded.length % 4)) % 4)

  if (
    !unpadded ||
    !/^[A-Za-z0-9+/]+$/.test(unpadded) ||
    unpadded.length % 4 === 1 ||
    (value !== unpadded && value !== `${unpadded}${padding}`)
  ) {
    throw new Error(`${description} must be valid base64`)
  }

  const decoded = Buffer.from(`${unpadded}${padding}`, 'base64')
  if (decoded.toString('base64') !== `${unpadded}${padding}`) {
    throw new Error(`${description} must be valid base64`)
  }

  return decoded
}

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.EMPLOYEE_PII_ENCRYPTION_KEY
  if (!encodedKey) {
    throw new Error(
      'EMPLOYEE_PII_ENCRYPTION_KEY is required and must be a base64-encoded 32-byte key'
    )
  }

  const key = decodeBase64(encodedKey, 'EMPLOYEE_PII_ENCRYPTION_KEY')
  if (key.length !== KEY_LENGTH) {
    throw new Error('EMPLOYEE_PII_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }

  return key
}

export function encryptPII(plain: string | null | undefined): string | null {
  if (!plain) return null

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // GCM provides authenticated encryption, unlike unauthenticated CBC. The version
  // prefix allows future algorithm/key rotations and legacy dual-read migration.
  return `${PII_ENCRYPTION_PREFIX}${Buffer.concat([iv, authTag, ciphertext]).toString('base64')}`
}

export function decryptPII(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith(PII_ENCRYPTION_PREFIX)) {
    // Legacy dual-read path for rows written before encryption was added —
    // still returned as-is, but no longer silently. Run
    // scripts/encrypt-existing-pii.ts to migrate rows still triggering this.
    console.warn('decryptPII: read a legacy plaintext value (not enc:v1:-prefixed)')
    return value
  }

  const payload = decodeBase64(value.slice(PII_ENCRYPTION_PREFIX.length), 'Encrypted employee PII')
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted employee PII payload is malformed')
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
