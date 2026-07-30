/**
 * Unit tests for the calendar-feed core module.
 * Tests: ICS generation, VEVENT count, holiday inclusion, half-day summary text,
 * token-miss returns null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dbAdmin
const mockFindUnique = vi.fn()
const mockFindMany = vi.fn()
const mockHolidayFindMany = vi.fn()

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    employee: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    leaveRequest: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    holiday: {
      findMany: (...args: unknown[]) => mockHolidayFindMany(...args),
    },
  },
}))

import { generateCalendarFeed, formatLeaveSummary } from '@/core/calendar-feed'

describe('Calendar feed module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatLeaveSummary', () => {
    it('returns plain leave type name for full-day leave', () => {
      expect(formatLeaveSummary('Annual Leave', false, null)).toBe('Annual Leave')
    })

    it('includes half day morning notation', () => {
      expect(formatLeaveSummary('Sick Leave', true, 'AM')).toBe(
        'Sick Leave (half day — morning)'
      )
    })

    it('includes half day afternoon notation', () => {
      expect(formatLeaveSummary('Annual Leave', true, 'PM')).toBe(
        'Annual Leave (half day — afternoon)'
      )
    })

    it('handles half day with no period specified', () => {
      expect(formatLeaveSummary('Annual Leave', true, null)).toBe(
        'Annual Leave (half day)'
      )
    })
  })

  describe('generateCalendarFeed', () => {
    it('returns null when token does not match any employee', async () => {
      mockFindUnique.mockResolvedValue(null)

      const result = await generateCalendarFeed('nonexistent-token')

      expect(result).toBeNull()
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { calendarFeedToken: 'nonexistent-token' },
        select: { id: true, firstName: true, lastName: true, orgId: true },
      })
    })

    it('generates valid ICS with leave events and holidays', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'emp-1',
        firstName: 'Alice',
        lastName: 'Tan',
        orgId: 'org-1',
      })

      mockFindMany.mockResolvedValue([
        {
          id: 'lr-1',
          startDate: new Date('2026-03-15'),
          endDate: new Date('2026-03-17'),
          isHalfDay: false,
          halfDayPeriod: null,
          leaveType: { name: 'Annual Leave' },
        },
        {
          id: 'lr-2',
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-05-01'),
          isHalfDay: true,
          halfDayPeriod: 'AM',
          leaveType: { name: 'Sick Leave' },
        },
      ])

      mockHolidayFindMany.mockResolvedValue([
        { date: new Date('2026-01-01'), name: "New Year's Day" },
        { date: new Date('2026-08-09'), name: 'National Day' },
      ])

      const result = await generateCalendarFeed('valid-token-abc')

      expect(result).not.toBeNull()
      expect(result!.employeeName).toBe('Alice Tan')

      const ics = result!.icsBody

      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('END:VCALENDAR')
      expect(ics).toContain('Annual Leave')
      expect(ics).toContain('Sick Leave (half day')
      expect(ics).toContain("New Year's Day")
      expect(ics).toContain('National Day')
      expect(ics).toContain('Alice Tan')
      expect(ics).toContain('HRDaddy Leave & Holidays')
    })

    it('includes correct number of VEVENTs', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'emp-1',
        firstName: 'Bob',
        lastName: 'Lee',
        orgId: 'org-1',
      })

      mockFindMany.mockResolvedValue([
        {
          id: 'lr-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-02'),
          isHalfDay: false,
          halfDayPeriod: null,
          leaveType: { name: 'Annual Leave' },
        },
      ])

      mockHolidayFindMany.mockResolvedValue([
        { date: new Date('2026-01-01'), name: "New Year's Day" },
        { date: new Date('2026-08-09'), name: 'National Day' },
        { date: new Date('2026-12-25'), name: 'Christmas Day' },
      ])

      const result = await generateCalendarFeed('token-xyz')
      expect(result).not.toBeNull()

      const ics = result!.icsBody
      const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length

      // 1 leave request + 3 holidays = 4
      expect(veventCount).toBe(4)
    })

    it('generates ICS with no leave requests but still includes holidays', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'emp-1',
        firstName: 'Charlie',
        lastName: 'Wong',
        orgId: 'org-1',
      })

      mockFindMany.mockResolvedValue([])

      mockHolidayFindMany.mockResolvedValue([
        { date: new Date('2026-01-01'), name: "New Year's Day" },
        { date: new Date('2026-08-09'), name: 'National Day' },
      ])

      const result = await generateCalendarFeed('token-empty')
      expect(result).not.toBeNull()

      const ics = result!.icsBody
      const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length

      // Only 2 holidays
      expect(veventCount).toBe(2)
    })
  })
})
