/**
 * Performance module — unit tests.
 *
 * Verifies:
 * - computeOverallScore (advanced mode averaging)
 * - getReviewComplexity defaults and reads
 * - canSubmitReviewAs — the real manager-authorization function submitReview calls
 * - suggestNextCycle
 *
 * createCycle's one-review-per-active-employee behavior is a Prisma nested
 * write, not pure logic — it's covered by live end-to-end verification
 * instead of a unit test here (mocking the whole transaction would mostly
 * be testing Prisma, not our code).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────
// computeOverallScore — pure function, no mocks needed
// ─────────────────────────────────────────────

import { computeOverallScore } from '@/modules/performance/utils'

describe('computeOverallScore', () => {
  it('rounds the average of scores to nearest integer', () => {
    // All 3s → 3
    expect(computeOverallScore([3, 3, 3, 3, 3, 3])).toBe(3)
  })

  it('handles mixed scores — rounds down at .49', () => {
    // (3+3+3+3+3+2) = 17/6 = 2.833 → rounds to 3
    expect(computeOverallScore([3, 3, 3, 3, 3, 2])).toBe(3)
  })

  it('handles mixed scores — rounds up at .5', () => {
    // (4+4+4+3+3+3) = 21/6 = 3.5 → rounds to 4
    expect(computeOverallScore([4, 4, 4, 3, 3, 3])).toBe(4)
  })

  it('handles all 5s → 5', () => {
    expect(computeOverallScore([5, 5, 5, 5, 5, 5])).toBe(5)
  })

  it('handles all 1s → 1', () => {
    expect(computeOverallScore([1, 1, 1, 1, 1, 1])).toBe(1)
  })

  it('handles uneven spread — (5+5+5+5+1+1) = 22/6 = 3.67 → 4', () => {
    expect(computeOverallScore([5, 5, 5, 5, 1, 1])).toBe(4)
  })

  it('handles (4+3+2+5+4+3) = 21/6 = 3.5 → 4', () => {
    expect(computeOverallScore([4, 3, 2, 5, 4, 3])).toBe(4)
  })

  it('handles (2+2+2+2+2+1) = 11/6 = 1.83 → 2', () => {
    expect(computeOverallScore([2, 2, 2, 2, 2, 1])).toBe(2)
  })

  it('returns 0 for empty array', () => {
    expect(computeOverallScore([])).toBe(0)
  })
})

// ─────────────────────────────────────────────
// getReviewComplexity
// ─────────────────────────────────────────────

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    organisationModule: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

// eslint-disable-next-line no-restricted-imports -- test mock setup requires direct reference
import { dbAdmin } from '@/core/db/admin'
import { getReviewComplexity, setReviewComplexity } from '@/core/performance-settings'

const mockFindUnique = vi.mocked(dbAdmin.organisationModule.findUnique)
const mockUpsert = vi.mocked(dbAdmin.organisationModule.upsert)

describe('getReviewComplexity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "simple" when no OrganisationModule row exists (default)', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getReviewComplexity('org-1')
    expect(result).toBe('simple')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { orgId_moduleId: { orgId: 'org-1', moduleId: 'performance' } },
      select: { settings: true },
    })
  })

  it('returns "simple" when row exists but settings is empty JSON', async () => {
    mockFindUnique.mockResolvedValue({ settings: {} } as never)

    const result = await getReviewComplexity('org-1')
    expect(result).toBe('simple')
  })

  it('reads "advanced" from settings JSON', async () => {
    mockFindUnique.mockResolvedValue({
      settings: { reviewComplexity: 'advanced' },
    } as never)

    const result = await getReviewComplexity('org-1')
    expect(result).toBe('advanced')
  })

  it('reads "simple" explicitly from settings JSON', async () => {
    mockFindUnique.mockResolvedValue({
      settings: { reviewComplexity: 'simple' },
    } as never)

    const result = await getReviewComplexity('org-1')
    expect(result).toBe('simple')
  })
})

describe('setReviewComplexity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts with the new complexity value', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({} as never)

    await setReviewComplexity('org-1', 'advanced')

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { orgId_moduleId: { orgId: 'org-1', moduleId: 'performance' } },
      update: { settings: { reviewComplexity: 'advanced' } },
      create: {
        orgId: 'org-1',
        moduleId: 'performance',
        enabled: true,
        settings: { reviewComplexity: 'advanced' },
      },
    })
  })

  it('preserves existing settings keys when updating', async () => {
    mockFindUnique.mockResolvedValue({
      settings: { otherSetting: 'value', reviewComplexity: 'simple' },
    } as never)
    mockUpsert.mockResolvedValue({} as never)

    await setReviewComplexity('org-1', 'advanced')

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { settings: { otherSetting: 'value', reviewComplexity: 'advanced' } },
      })
    )
  })
})

// ─────────────────────────────────────────────
// suggestNextCycle
// ─────────────────────────────────────────────

import { suggestNextCycle } from '@/modules/performance/utils'
import type { CycleItemBase } from '@/modules/performance/utils'

describe('suggestNextCycle', () => {
  it('suggests Q3 2026 when previous cycle ended Jun 30 2026', () => {
    const cycles: CycleItemBase[] = [
      {
        id: 'cycle-1',
        name: 'Q2 2026',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-06-30'),
        status: 'CLOSED',
        createdAt: new Date('2026-04-01'),
        totalReviews: 5,
        submittedReviews: 5,
      },
    ]
    const result = suggestNextCycle(cycles)
    expect(result.name).toBe('Q3 2026')
    expect(result.startDate.getMonth()).toBe(6) // July (0-indexed)
    expect(result.endDate.getMonth()).toBe(8) // September
  })

  it('suggests based on today when no cycles exist', () => {
    const result = suggestNextCycle([])
    const now = new Date()
    const quarter = Math.floor(now.getMonth() / 3) + 1
    expect(result.name).toBe(`Q${quarter} ${now.getFullYear()}`)
  })
})

// ─────────────────────────────────────────────
// canSubmitReviewAs — the real function submitReview calls to authorize
// ─────────────────────────────────────────────

import { canSubmitReviewAs } from '@/modules/performance/utils'

describe('canSubmitReviewAs', () => {
  it('allows OWNER to submit for anyone, regardless of managerId', () => {
    expect(canSubmitReviewAs('OWNER', 'owner-emp', 'someone-elses-manager-id')).toBe(true)
    expect(canSubmitReviewAs('OWNER', 'owner-emp', null)).toBe(true)
  })

  it('allows HR_ADMIN to submit for anyone, regardless of managerId', () => {
    expect(canSubmitReviewAs('HR_ADMIN', 'hr-emp', 'someone-elses-manager-id')).toBe(true)
  })

  it('allows MANAGER to submit for their own direct report', () => {
    expect(canSubmitReviewAs('MANAGER', 'manager-emp-1', 'manager-emp-1')).toBe(true)
  })

  it('rejects MANAGER submitting for an employee who is not their direct report', () => {
    expect(canSubmitReviewAs('MANAGER', 'manager-emp-1', 'manager-emp-2')).toBe(false)
  })

  it('rejects MANAGER with no employee record of their own', () => {
    expect(canSubmitReviewAs('MANAGER', null, 'manager-emp-1')).toBe(false)
  })

  it('rejects MANAGER when the employee has no manager set', () => {
    expect(canSubmitReviewAs('MANAGER', 'manager-emp-1', null)).toBe(false)
  })

  it('rejects EMPLOYEE role outright', () => {
    expect(canSubmitReviewAs('EMPLOYEE', 'some-emp', 'some-emp')).toBe(false)
  })
})
