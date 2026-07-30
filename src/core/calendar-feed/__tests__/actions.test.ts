import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifySession = vi.fn()
const mockGetOrgContext = vi.fn()
const mockGetEmployeeIdForUser = vi.fn()
const mockEmployeeCount = vi.fn()
const mockCalendarFeedTokenFindUnique = vi.fn()
const mockCalendarFeedTokenCreate = vi.fn()
const mockCalendarFeedTokenUpsert = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/core/auth', () => ({
  verifySession: () => mockVerifySession(),
  getOrgContext: (slug: string) => mockGetOrgContext(slug),
}))

vi.mock('@/core/employees', () => ({
  getEmployeeIdForUser: (...args: unknown[]) => mockGetEmployeeIdForUser(...args),
}))

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    employee: {
      count: (...args: unknown[]) => mockEmployeeCount(...args),
    },
    calendarFeedToken: {
      findUnique: (...args: unknown[]) => mockCalendarFeedTokenFindUnique(...args),
      create: (...args: unknown[]) => mockCalendarFeedTokenCreate(...args),
      upsert: (...args: unknown[]) => mockCalendarFeedTokenUpsert(...args),
    },
  },
}))

vi.mock('@/lib/utils', () => ({
  getAppBaseUrl: () => 'http://localhost:3000',
}))

import { getOrCreateCalendarFeedToken, regenerateCalendarFeedToken } from '@/core/calendar-feed/actions'

function setupDefaultMocks(role = 'EMPLOYEE' as string) {
  mockVerifySession.mockResolvedValue({ userId: 'user-1', email: 'test@example.com' })
  mockGetOrgContext.mockResolvedValue({
    org: { id: 'org-1', name: 'Acme', slug: 'acme' },
    membership: { id: 'mem-1', role, isActive: true },
    enabledModules: ['calendar'],
  })
  mockGetEmployeeIdForUser.mockResolvedValue('emp-1')
}

describe('Calendar feed actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrCreateCalendarFeedToken', () => {
    it('TEAM token creation is rejected with 0 direct reports', async () => {
      setupDefaultMocks('MANAGER')
      mockEmployeeCount.mockResolvedValue(0)

      const result = await getOrCreateCalendarFeedToken('acme', 'TEAM')

      expect(result.success).toBe(false)
      expect(result.error).toContain('direct report')
    })

    it('TEAM token creation is allowed with ≥1 direct reports', async () => {
      setupDefaultMocks('MANAGER')
      mockEmployeeCount.mockResolvedValue(3)
      mockCalendarFeedTokenFindUnique.mockResolvedValue(null)
      mockCalendarFeedTokenCreate.mockResolvedValue({})

      const result = await getOrCreateCalendarFeedToken('acme', 'TEAM')

      expect(result.success).toBe(true)
      expect(result.feedUrl).toContain('/api/calendar/')
      expect(result.feedUrl).toContain('.ics')
    })

    it('COMPANY token creation is rejected for MANAGER role', async () => {
      setupDefaultMocks('MANAGER')

      const result = await getOrCreateCalendarFeedToken('acme', 'COMPANY')

      expect(result.success).toBe(false)
      expect(result.error).toContain('owners and HR admins')
    })

    it('COMPANY token creation is rejected for EMPLOYEE role', async () => {
      setupDefaultMocks('EMPLOYEE')

      const result = await getOrCreateCalendarFeedToken('acme', 'COMPANY')

      expect(result.success).toBe(false)
      expect(result.error).toContain('owners and HR admins')
    })

    it('COMPANY token creation is allowed for OWNER', async () => {
      setupDefaultMocks('OWNER')
      mockCalendarFeedTokenFindUnique.mockResolvedValue(null)
      mockCalendarFeedTokenCreate.mockResolvedValue({})

      const result = await getOrCreateCalendarFeedToken('acme', 'COMPANY')

      expect(result.success).toBe(true)
      expect(result.feedUrl).toContain('/api/calendar/')
    })

    it('COMPANY token creation is allowed for HR_ADMIN', async () => {
      setupDefaultMocks('HR_ADMIN')
      mockCalendarFeedTokenFindUnique.mockResolvedValue(null)
      mockCalendarFeedTokenCreate.mockResolvedValue({})

      const result = await getOrCreateCalendarFeedToken('acme', 'COMPANY')

      expect(result.success).toBe(true)
      expect(result.feedUrl).toContain('/api/calendar/')
    })

    it('PERSONAL token creation requires no special checks', async () => {
      setupDefaultMocks('EMPLOYEE')
      mockCalendarFeedTokenFindUnique.mockResolvedValue(null)
      mockCalendarFeedTokenCreate.mockResolvedValue({})

      const result = await getOrCreateCalendarFeedToken('acme', 'PERSONAL')

      expect(result.success).toBe(true)
      expect(mockEmployeeCount).not.toHaveBeenCalled()
    })

    it('returns existing token if already created', async () => {
      setupDefaultMocks('EMPLOYEE')
      mockCalendarFeedTokenFindUnique.mockResolvedValue({ token: 'existing-token-abc' })

      const result = await getOrCreateCalendarFeedToken('acme', 'PERSONAL')

      expect(result.success).toBe(true)
      expect(result.feedUrl).toContain('existing-token-abc')
      expect(mockCalendarFeedTokenCreate).not.toHaveBeenCalled()
    })
  })

  describe('regenerateCalendarFeedToken', () => {
    it('regenerating one scope does not affect another scopes token', async () => {
      setupDefaultMocks('OWNER')
      mockCalendarFeedTokenUpsert.mockResolvedValue({})

      const result1 = await regenerateCalendarFeedToken('acme', 'PERSONAL')
      expect(result1.success).toBe(true)

      const upsertCall = mockCalendarFeedTokenUpsert.mock.calls[0][0]
      expect(upsertCall.where.employeeId_scope).toEqual({
        employeeId: 'emp-1',
        scope: 'PERSONAL',
      })
    })

    it('TEAM regeneration is rejected with 0 direct reports', async () => {
      setupDefaultMocks('MANAGER')
      mockEmployeeCount.mockResolvedValue(0)

      const result = await regenerateCalendarFeedToken('acme', 'TEAM')

      expect(result.success).toBe(false)
      expect(result.error).toContain('direct report')
      expect(mockCalendarFeedTokenUpsert).not.toHaveBeenCalled()
    })

    it('COMPANY regeneration is rejected for non-admin', async () => {
      setupDefaultMocks('EMPLOYEE')

      const result = await regenerateCalendarFeedToken('acme', 'COMPANY')

      expect(result.success).toBe(false)
      expect(result.error).toContain('owners and HR admins')
      expect(mockCalendarFeedTokenUpsert).not.toHaveBeenCalled()
    })
  })
})
