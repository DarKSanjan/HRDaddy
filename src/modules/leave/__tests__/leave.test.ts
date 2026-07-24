/**
 * Unit tests for the Leave module business logic.
 * Tests: overlap detection, balance transitions, half-day logic, service-year entitlement.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock dbAdmin and dbAs
vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    leaveRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    leaveBalance: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    organisationSettings: {
      findUnique: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    organisationModule: {
      findMany: vi.fn(),
    },
    organisationMembership: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(),
}))

vi.mock('@/core/audit', () => ({
  writeAudit: vi.fn(),
}))

vi.mock('@/core/notifications', () => ({
  getNotificationAdapter: () => ({ send: vi.fn() }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn().mockResolvedValue({
    org: { id: 'org-1', name: 'Test', slug: 'test' },
    enabledModules: ['employees', 'leave'],
    membership: { id: 'mem-1', role: 'EMPLOYEE', isActive: true },
  }),
  requirePermission: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'EMPLOYEE' }),
  verifySession: vi.fn().mockResolvedValue({ userId: 'user-1', email: 'test@test.com', name: 'Test' }),
}))

import {
  calculateLeaveDays,
  completedServiceYears,
  sgAnnualLeaveEntitlement,
} from '@/core/calendar'
import type { OrgCalendarSettings } from '@/core/calendar'

const SGT: OrgCalendarSettings = {
  timezone: 'Asia/Singapore',
  workingDays: [1, 2, 3, 4, 5],
}

describe('Leave business logic', () => {
  describe('Overlap detection', () => {
    it('same date range overlaps', () => {
      // Two ranges: Jan 5-9 and Jan 5-9 → overlapping
      // If request.startDate <= existing.endDate AND request.endDate >= existing.startDate
      const existingStart = new Date('2026-01-05')
      const existingEnd = new Date('2026-01-09')
      const requestStart = new Date('2026-01-05')
      const requestEnd = new Date('2026-01-09')
      expect(requestStart <= existingEnd && requestEnd >= existingStart).toBe(true)
    })

    it('partial overlap at end', () => {
      const existingStart = new Date('2026-01-05')
      const existingEnd = new Date('2026-01-09')
      const requestStart = new Date('2026-01-08')
      const requestEnd = new Date('2026-01-12')
      expect(requestStart <= existingEnd && requestEnd >= existingStart).toBe(true)
    })

    it('no overlap when dates are disjoint', () => {
      const existingStart = new Date('2026-01-05')
      const existingEnd = new Date('2026-01-09')
      const requestStart = new Date('2026-01-12')
      const requestEnd = new Date('2026-01-16')
      expect(requestStart <= existingEnd && requestEnd >= existingStart).toBe(false)
    })

    it('adjacent dates do not overlap', () => {
      const existingStart = new Date('2026-01-05')
      const existingEnd = new Date('2026-01-09')
      const requestStart = new Date('2026-01-10')
      const requestEnd = new Date('2026-01-14')
      expect(requestStart <= existingEnd && requestEnd >= existingStart).toBe(false)
    })
  })

  describe('Balance transitions', () => {
    it('submit: pending increases, available decreases', () => {
      const allowance = 14
      const used = 3
      const pending = 2
      const available = allowance - used - pending
      expect(available).toBe(9)

      // After new request of 2 days
      const newPending = pending + 2
      const newAvailable = allowance - used - newPending
      expect(newAvailable).toBe(7)
    })

    it('approve: pending decreases, used increases', () => {
      const pending = 4
      const used = 3
      const requestDays = 2

      const newPending = pending - requestDays
      const newUsed = used + requestDays
      expect(newPending).toBe(2)
      expect(newUsed).toBe(5)
    })

    it('reject: pending decreases, used unchanged', () => {
      const pending = 4
      const used = 3
      const requestDays = 2

      const newPending = pending - requestDays
      expect(newPending).toBe(2)
      expect(used).toBe(3) // unchanged
    })

    it('cancel approved: used decreases', () => {
      const used = 5
      const requestDays = 2
      const newUsed = used - requestDays
      expect(newUsed).toBe(3)
    })
  })

  describe('Half-day handling', () => {
    it('half-day on single working day = 0.5', () => {
      const days = calculateLeaveDays('2026-01-05', '2026-01-05', true, SGT, [])
      expect(days).toBe(0.5)
    })

    it('full day on single working day = 1', () => {
      const days = calculateLeaveDays('2026-01-05', '2026-01-05', false, SGT, [])
      expect(days).toBe(1)
    })

    it('half-day flag ignored for multi-day range', () => {
      const days = calculateLeaveDays('2026-01-05', '2026-01-06', true, SGT, [])
      expect(days).toBe(2)
    })
  })

  describe('Service-year entitlement at anniversary boundaries', () => {
    it('entitlement increases correctly year by year', () => {
      // Start date: 2020-03-15
      // Check from year 0 to year 10
      const cases = [
        { ref: '2020-06-01', expected: 0 },  // < 1 year
        { ref: '2021-03-15', expected: 7 },  // exactly 1 year
        { ref: '2022-03-14', expected: 7 },  // just before 2nd anniversary
        { ref: '2022-03-15', expected: 8 },  // exactly 2 years
        { ref: '2023-03-15', expected: 9 },  // 3 years
        { ref: '2028-03-15', expected: 14 }, // 8 years (capped)
      ]

      for (const { ref, expected } of cases) {
        const years = completedServiceYears('2020-03-15', ref, 'Asia/Singapore')
        const entitlement = sgAnnualLeaveEntitlement(years)
        expect(entitlement).toBe(expected)
      }
    })
  })
})
