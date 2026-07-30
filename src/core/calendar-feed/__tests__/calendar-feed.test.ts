import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCalendarFeedTokenFindUnique = vi.fn()
const mockLeaveRequestFindMany = vi.fn()
const mockHolidayFindMany = vi.fn()
const mockOrganisationFindUnique = vi.fn()

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    calendarFeedToken: {
      findUnique: (...args: unknown[]) => mockCalendarFeedTokenFindUnique(...args),
    },
    leaveRequest: {
      findMany: (...args: unknown[]) => mockLeaveRequestFindMany(...args),
    },
    holiday: {
      findMany: (...args: unknown[]) => mockHolidayFindMany(...args),
    },
    organisation: {
      findUnique: (...args: unknown[]) => mockOrganisationFindUnique(...args),
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
    it('returns null when token does not match any feed token', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue(null)

      const result = await generateCalendarFeed('nonexistent-token')

      expect(result).toBeNull()
      expect(mockCalendarFeedTokenFindUnique).toHaveBeenCalledWith({
        where: { token: 'nonexistent-token' },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, orgId: true },
          },
        },
      })
    })

    it('PERSONAL scope generates ICS with own leave events and holidays', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'PERSONAL',
        employee: { id: 'emp-1', firstName: 'Alice', lastName: 'Tan', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([
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

      const result = await generateCalendarFeed('personal-token-abc')

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

    it('PERSONAL scope event titles are NOT name-prefixed', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'PERSONAL',
        employee: { id: 'emp-1', firstName: 'Alice', lastName: 'Tan', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([
        {
          id: 'lr-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-02'),
          isHalfDay: false,
          halfDayPeriod: null,
          leaveType: { name: 'Annual Leave' },
        },
      ])

      mockHolidayFindMany.mockResolvedValue([])

      const result = await generateCalendarFeed('personal-token')
      const ics = result!.icsBody

      expect(ics).toContain('Annual Leave')
      expect(ics).not.toContain('Alice Tan — Annual Leave')
    })

    it('TEAM scope only includes direct reports leave, not the managers own', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'TEAM',
        employee: { id: 'manager-1', firstName: 'Bob', lastName: 'Lee', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([
        {
          id: 'lr-report-1',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-02'),
          isHalfDay: false,
          halfDayPeriod: null,
          leaveType: { name: 'Annual Leave' },
          employee: { firstName: 'Charlie', lastName: 'Wong' },
        },
      ])

      mockHolidayFindMany.mockResolvedValue([])

      const result = await generateCalendarFeed('team-token')

      expect(result).not.toBeNull()
      const ics = result!.icsBody

      expect(ics).toContain('Charlie Wong — Annual Leave')

      const leaveCall = mockLeaveRequestFindMany.mock.calls[0][0]
      expect(leaveCall.where.employee).toEqual({ managerId: 'manager-1' })
    })

    it('TEAM scope event titles are name-prefixed', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'TEAM',
        employee: { id: 'manager-1', firstName: 'Bob', lastName: 'Lee', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([
        {
          id: 'lr-1',
          startDate: new Date('2026-04-10'),
          endDate: new Date('2026-04-10'),
          isHalfDay: true,
          halfDayPeriod: 'PM',
          leaveType: { name: 'Sick Leave' },
          employee: { firstName: 'Dana', lastName: 'Lim' },
        },
      ])

      mockHolidayFindMany.mockResolvedValue([])

      const result = await generateCalendarFeed('team-token-2')
      const ics = result!.icsBody

      expect(ics).toContain('Dana Lim — Sick Leave (half day')
    })

    it('COMPANY scope includes all org-wide leave', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'COMPANY',
        employee: { id: 'admin-1', firstName: 'Eve', lastName: 'Ng', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([
        {
          id: 'lr-a',
          startDate: new Date('2026-07-01'),
          endDate: new Date('2026-07-03'),
          isHalfDay: false,
          halfDayPeriod: null,
          leaveType: { name: 'Annual Leave' },
          employee: { firstName: 'Frank', lastName: 'Chia' },
        },
        {
          id: 'lr-b',
          startDate: new Date('2026-07-10'),
          endDate: new Date('2026-07-10'),
          isHalfDay: false,
          halfDayPeriod: null,
          leaveType: { name: 'Annual Leave' },
          employee: { firstName: 'Grace', lastName: 'Ho' },
        },
      ])

      mockHolidayFindMany.mockResolvedValue([])
      mockOrganisationFindUnique.mockResolvedValue({ name: 'Acme Corp' })

      const result = await generateCalendarFeed('company-token')
      const ics = result!.icsBody

      expect(ics).toContain('Frank Chia — Annual Leave')
      expect(ics).toContain('Grace Ho — Annual Leave')
      expect(ics).toContain('Acme Corp')
      expect(ics).toContain('HRDaddy Calendar')

      const leaveCall = mockLeaveRequestFindMany.mock.calls[0][0]
      expect(leaveCall.where.orgId).toBe('org-1')
      expect(leaveCall.where.employee).toBeUndefined()
      expect(leaveCall.where.employeeId).toBeUndefined()
    })

    it('COMPANY scope event titles are name-prefixed', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'COMPANY',
        employee: { id: 'admin-1', firstName: 'Eve', lastName: 'Ng', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([
        {
          id: 'lr-x',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-01'),
          isHalfDay: false,
          halfDayPeriod: null,
          leaveType: { name: 'Compassionate Leave' },
          employee: { firstName: 'Hank', lastName: 'Teo' },
        },
      ])

      mockHolidayFindMany.mockResolvedValue([])
      mockOrganisationFindUnique.mockResolvedValue({ name: 'Acme Corp' })

      const result = await generateCalendarFeed('company-token-2')
      const ics = result!.icsBody

      expect(ics).toContain('Hank Teo — Compassionate Leave')
    })

    it('includes correct number of VEVENTs', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'PERSONAL',
        employee: { id: 'emp-1', firstName: 'Bob', lastName: 'Lee', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([
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
      expect(veventCount).toBe(4)
    })

    it('generates ICS with no leave requests but still includes holidays', async () => {
      mockCalendarFeedTokenFindUnique.mockResolvedValue({
        scope: 'PERSONAL',
        employee: { id: 'emp-1', firstName: 'Charlie', lastName: 'Wong', orgId: 'org-1' },
      })

      mockLeaveRequestFindMany.mockResolvedValue([])

      mockHolidayFindMany.mockResolvedValue([
        { date: new Date('2026-01-01'), name: "New Year's Day" },
        { date: new Date('2026-08-09'), name: 'National Day' },
      ])

      const result = await generateCalendarFeed('token-empty')
      expect(result).not.toBeNull()

      const ics = result!.icsBody
      const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length
      expect(veventCount).toBe(2)
    })
  })
})
