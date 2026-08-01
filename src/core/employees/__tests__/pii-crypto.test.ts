import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptPII, encryptPII } from '../pii-crypto'

const TEST_KEY = Buffer.alloc(32, 7).toString('base64')

describe('employee PII encryption', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trips plaintext through AES-256-GCM', () => {
    vi.stubEnv('EMPLOYEE_PII_ENCRYPTION_KEY', TEST_KEY)

    const encrypted = encryptPII('S1234567A')

    expect(encrypted).toMatch(/^enc:v1:/)
    expect(decryptPII(encrypted)).toBe('S1234567A')
  })

  it.each([null, undefined, ''])('returns null for empty input: %s', (value) => {
    expect(encryptPII(value)).toBeNull()
    expect(decryptPII(value)).toBeNull()
  })

  it('returns legacy plaintext unchanged', () => {
    expect(decryptPII('legacy-national-id')).toBe('legacy-national-id')
  })

  it('uses a fresh random IV for each encryption', () => {
    vi.stubEnv('EMPLOYEE_PII_ENCRYPTION_KEY', TEST_KEY)

    const first = encryptPII('same-value')
    const second = encryptPII('same-value')

    expect(first).not.toBe(second)
    expect(decryptPII(first)).toBe('same-value')
    expect(decryptPII(second)).toBe('same-value')
  })

  it('throws clearly when the encryption key is unset', () => {
    vi.stubEnv('EMPLOYEE_PII_ENCRYPTION_KEY', '')

    expect(() => encryptPII('sensitive-value')).toThrow(/EMPLOYEE_PII_ENCRYPTION_KEY.*required/i)
  })
})
