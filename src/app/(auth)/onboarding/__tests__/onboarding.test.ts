/**
 * Onboarding wizard tests.
 * Tests schemas, slug validation, reserved words, resume-from-saved-step,
 * and atomicity of the final commit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  RESERVED_SLUGS,
  wizardDataSchema,
} from '../schemas'

// ─────────────────────────────────────────────
// Schema tests
// ─────────────────────────────────────────────

describe('Step 1 schema', () => {
  it('accepts valid input', () => {
    const result = step1Schema.safeParse({
      email: 'test@example.com',
      name: 'John Doe',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = step1Schema.safeParse({
      email: 'not-email',
      name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a credential field, which step 1 must never collect', () => {
    const result = step1Schema.safeParse({
      email: 'test@example.com',
      name: 'John Doe',
      password: 'should-not-be-accepted',
    })
    // Zod strips unknown keys rather than failing, so assert on the output:
    // nothing password-shaped may survive into the persisted progress row.
    expect(result.success).toBe(true)
    expect(result.success && 'password' in result.data).toBe(false)
  })

  it('rejects empty name', () => {
    const result = step1Schema.safeParse({
      email: 'test@example.com',
      name: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('Step 2 schema', () => {
  const valid = {
    legalName: 'Acme Pte Ltd',
    slug: 'acme-pte-ltd',
    companySize: '1-10' as const,
    industry: 'Technology' as const,
    country: 'Singapore',
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    leaveYearStart: '01-01',
    workingDays: [1, 2, 3, 4, 5],
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
  }

  it('accepts valid input', () => {
    const result = step2Schema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects short slug', () => {
    const result = step2Schema.safeParse({ ...valid, slug: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with uppercase', () => {
    const result = step2Schema.safeParse({ ...valid, slug: 'Acme' })
    expect(result.success).toBe(false)
  })

  it('rejects slug starting with a number', () => {
    const result = step2Schema.safeParse({ ...valid, slug: '1acme' })
    expect(result.success).toBe(false)
  })

  it('rejects slug ending with a hyphen', () => {
    const result = step2Schema.safeParse({ ...valid, slug: 'acme-' })
    expect(result.success).toBe(false)
  })

  it('rejects reserved slugs', () => {
    for (const reserved of ['admin', 'api', 'app', 'auth', 'hrdaddy', 'www']) {
      const result = step2Schema.safeParse({ ...valid, slug: reserved })
      expect(result.success).toBe(false)
    }
  })

  it('rejects empty working days array', () => {
    const result = step2Schema.safeParse({ ...valid, workingDays: [] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid leave year format', () => {
    const result = step2Schema.safeParse({ ...valid, leaveYearStart: '2024-01-01' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format', () => {
    const result = step2Schema.safeParse({ ...valid, workingHoursStart: '9AM' })
    expect(result.success).toBe(false)
  })
})

describe('Step 3 schema', () => {
  it('accepts with employees included', () => {
    const result = step3Schema.safeParse({
      modules: ['employees', 'leave', 'attendance'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects without employees module', () => {
    const result = step3Schema.safeParse({
      modules: ['leave', 'attendance'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts employees alone', () => {
    const result = step3Schema.safeParse({
      modules: ['employees'],
    })
    expect(result.success).toBe(true)
  })
})

describe('Step 4 schema', () => {
  it('accepts valid defaults', () => {
    const result = step4Schema.safeParse({
      departments: [{ name: 'Engineering' }],
      jobTitles: [{ title: 'Engineer' }],
      leaveTypes: [{ name: 'Annual Leave', daysPerYear: 14, description: '' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty departments', () => {
    const result = step4Schema.safeParse({
      departments: [],
      jobTitles: [{ title: 'Engineer' }],
      leaveTypes: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty job titles', () => {
    const result = step4Schema.safeParse({
      departments: [{ name: 'Engineering' }],
      jobTitles: [],
      leaveTypes: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative daysPerYear', () => {
    const result = step4Schema.safeParse({
      departments: [{ name: 'Engineering' }],
      jobTitles: [{ title: 'Engineer' }],
      leaveTypes: [{ name: 'Annual', daysPerYear: -1, description: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('allows empty leave types array', () => {
    const result = step4Schema.safeParse({
      departments: [{ name: 'Engineering' }],
      jobTitles: [{ title: 'Engineer' }],
      leaveTypes: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('Step 5 schema', () => {
  it('accepts valid invitations', () => {
    const result = step5Schema.safeParse({
      invitations: [{ email: 'team@company.com', role: 'HR_ADMIN' }],
      skip: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts skip with empty invitations', () => {
    const result = step5Schema.safeParse({
      invitations: [],
      skip: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email in invitations', () => {
    const result = step5Schema.safeParse({
      invitations: [{ email: 'not-email', role: 'EMPLOYEE' }],
      skip: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = step5Schema.safeParse({
      invitations: [{ email: 'test@co.com', role: 'SUPER_ADMIN' }],
      skip: false,
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────
// Reserved slugs
// ─────────────────────────────────────────────

describe('Reserved slugs', () => {
  it('contains expected reserved words', () => {
    expect(RESERVED_SLUGS.has('admin')).toBe(true)
    expect(RESERVED_SLUGS.has('api')).toBe(true)
    expect(RESERVED_SLUGS.has('hrdaddy')).toBe(true)
    expect(RESERVED_SLUGS.has('www')).toBe(true)
    expect(RESERVED_SLUGS.has('login')).toBe(true)
    expect(RESERVED_SLUGS.has('sign-up')).toBe(true)
    expect(RESERVED_SLUGS.has('onboarding')).toBe(true)
  })

  it('does not contain arbitrary words', () => {
    expect(RESERVED_SLUGS.has('acme')).toBe(false)
    expect(RESERVED_SLUGS.has('my-company')).toBe(false)
  })

  it('step2Schema rejects every reserved slug', () => {
    const base = {
      legalName: 'Test Co',
      companySize: '1-10' as const,
      industry: 'Technology' as const,
      country: 'Singapore',
      timezone: 'Asia/Singapore',
      currency: 'SGD',
      leaveYearStart: '01-01',
      workingDays: [1, 2, 3, 4, 5],
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
    }

    for (const slug of RESERVED_SLUGS) {
      const result = step2Schema.safeParse({ ...base, slug })
      expect(result.success).toBe(false)
    }
  })
})

// ─────────────────────────────────────────────
// Wizard data schema (accumulated)
// ─────────────────────────────────────────────

describe('wizardDataSchema', () => {
  it('accepts partial wizard data', () => {
    const result = wizardDataSchema.safeParse({
      step1: { email: 'test@co.com', name: 'Test' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts fully empty object', () => {
    const result = wizardDataSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

// ─────────────────────────────────────────────
// Resume from saved step (service mocks)
// ─────────────────────────────────────────────

vi.mock('@/core/auth', () => ({
  verifySession: vi.fn().mockResolvedValue({
    userId: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
  }),
}))

vi.mock('@/core/org-setup', () => ({
  checkSlugAvailable: vi.fn().mockResolvedValue({ available: true }),
  getOrgSetupProgress: vi.fn(),
  saveOrgSetupProgress: vi.fn(),
  commitOrgSetup: vi.fn(),
}))

vi.mock('@/core/audit', () => ({
  writeAudit: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

describe('Resume from saved step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSetupProgress returns null when no progress exists', async () => {
    const { getOrgSetupProgress } = await import('@/core/org-setup')
    vi.mocked(getOrgSetupProgress).mockResolvedValue(null)

    const { getSetupProgress } = await import('../actions')
    const result = await getSetupProgress()
    expect(result).toBeNull()
  })

  it('getSetupProgress returns saved step and data', async () => {
    const savedData = {
      step1: { email: 'test@example.com', name: 'Test' },
      step2: {
        legalName: 'Acme',
        slug: 'acme',
        companySize: '1-10',
        industry: 'Technology',
        country: 'Singapore',
        timezone: 'Asia/Singapore',
        currency: 'SGD',
        leaveYearStart: '01-01',
        workingDays: [1, 2, 3, 4, 5],
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
      },
    }

    const { getOrgSetupProgress } = await import('@/core/org-setup')
    vi.mocked(getOrgSetupProgress).mockResolvedValue({
      id: 'progress-1',
      userId: 'user-1',
      step: 3,
      data: savedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const { getSetupProgress } = await import('../actions')
    const result = await getSetupProgress()
    expect(result).toEqual({ step: 3, data: savedData })
  })
})

// ─────────────────────────────────────────────
// Atomicity tests (final commit)
// ─────────────────────────────────────────────

describe('Final commit atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completeStep5 returns error when transaction fails', async () => {
    const { getOrgSetupProgress, commitOrgSetup, checkSlugAvailable } = await import(
      '@/core/org-setup'
    )

    vi.mocked(checkSlugAvailable).mockResolvedValue({ available: true })
    vi.mocked(getOrgSetupProgress).mockResolvedValue({
      id: 'progress-1',
      userId: 'user-1',
      step: 5,
      data: {
        step1: { email: 'test@co.com', name: 'Test' },
        step2: {
          legalName: 'Acme',
          slug: 'test-unique-org',
          companySize: '1-10',
          industry: 'Technology',
          country: 'Singapore',
          timezone: 'Asia/Singapore',
          currency: 'SGD',
          leaveYearStart: '01-01',
          workingDays: [1, 2, 3, 4, 5],
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00',
        },
        step3: { modules: ['employees', 'leave'] },
        step4: {
          departments: [{ name: 'Engineering' }],
          jobTitles: [{ title: 'Engineer' }],
          leaveTypes: [{ name: 'Annual', daysPerYear: 14, description: '' }],
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(commitOrgSetup).mockRejectedValue(
      new Error('Unique constraint violation')
    )

    const { completeStep5 } = await import('../actions')

    const fd = new FormData()
    fd.set('invitations', '[]')
    fd.set('skip', 'true')

    const result = await completeStep5(fd)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unique constraint violation')
  })

  it('completeStep5 calls commitOrgSetup with full wizard data', async () => {
    const { getOrgSetupProgress, commitOrgSetup, checkSlugAvailable } = await import(
      '@/core/org-setup'
    )
    const { writeAudit } = await import('@/core/audit')
    const { redirect } = await import('next/navigation')

    vi.mocked(checkSlugAvailable).mockResolvedValue({ available: true })
    vi.mocked(getOrgSetupProgress).mockResolvedValue({
      id: 'progress-1',
      userId: 'user-1',
      step: 5,
      data: {
        step1: { email: 'test@co.com', name: 'Test' },
        step2: {
          legalName: 'Acme',
          slug: 'acme',
          companySize: '1-10',
          industry: 'Technology',
          country: 'Singapore',
          timezone: 'Asia/Singapore',
          currency: 'SGD',
          leaveYearStart: '01-01',
          workingDays: [1, 2, 3, 4, 5],
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00',
        },
        step3: { modules: ['employees'] },
        step4: {
          departments: [{ name: 'Eng' }],
          jobTitles: [{ title: 'Dev' }],
          leaveTypes: [],
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(commitOrgSetup).mockResolvedValue({
      org: { id: 'org-1', name: 'Acme', slug: 'acme' },
    })

    const { completeStep5 } = await import('../actions')

    const fd = new FormData()
    fd.set('invitations', JSON.stringify([{ email: 'bob@co.com', role: 'EMPLOYEE' }]))
    fd.set('skip', 'false')

    await completeStep5(fd)

    // commitOrgSetup was called with the merged data
    expect(vi.mocked(commitOrgSetup)).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        step5: expect.objectContaining({
          invitations: [{ email: 'bob@co.com', role: 'EMPLOYEE' }],
        }),
      })
    )

    // Audit was written
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organisation.created',
        orgId: 'org-1',
      })
    )

    // Redirected to the org slug
    expect(vi.mocked(redirect)).toHaveBeenCalledWith('/acme')
  })
})
