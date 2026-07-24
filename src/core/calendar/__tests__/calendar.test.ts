/**
 * Tests for the working-day calendar service.
 * Covers: working-day counting, service-year entitlement, timezone correctness,
 * DST boundaries for non-SG timezones.
 */
import { describe, it, expect } from 'vitest'
import {
  isWorkingDay,
  countWorkingDays,
  calculateLeaveDays,
  completedServiceYears,
  sgAnnualLeaveEntitlement,
  proRatedEntitlement,
  getLocalDateForTimestamp,
} from '../index'
import type { OrgCalendarSettings, PublicHoliday } from '../index'

const SGT: OrgCalendarSettings = {
  timezone: 'Asia/Singapore',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
}

const SGT_HOLIDAYS: PublicHoliday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
]

const US_EASTERN: OrgCalendarSettings = {
  timezone: 'America/New_York',
  workingDays: [1, 2, 3, 4, 5],
}

describe('isWorkingDay', () => {
  it('returns true for a Monday', () => {
    // 2026-01-05 is a Monday
    expect(isWorkingDay('2026-01-05', SGT, [])).toBe(true)
  })

  it('returns false for a Saturday', () => {
    // 2026-01-03 is a Saturday
    expect(isWorkingDay('2026-01-03', SGT, [])).toBe(false)
  })

  it('returns false for a Sunday', () => {
    // 2026-01-04 is a Sunday
    expect(isWorkingDay('2026-01-04', SGT, [])).toBe(false)
  })

  it('returns false for a public holiday on a weekday', () => {
    // 2026-01-01 is a Thursday (New Year)
    expect(isWorkingDay('2026-01-01', SGT, SGT_HOLIDAYS)).toBe(false)
  })

  it('respects custom working days (Sun-Thu)', () => {
    const settings: OrgCalendarSettings = {
      timezone: 'Asia/Singapore',
      workingDays: [7, 1, 2, 3, 4], // Sun-Thu
    }
    // 2026-01-02 is Friday — not a working day
    expect(isWorkingDay('2026-01-02', settings, [])).toBe(false)
    // 2026-01-04 is Sunday — is a working day
    expect(isWorkingDay('2026-01-04', settings, [])).toBe(true)
  })
})

describe('countWorkingDays', () => {
  it('counts 5 working days in a Mon-Fri week', () => {
    // 2026-01-05 (Mon) to 2026-01-09 (Fri)
    expect(countWorkingDays('2026-01-05', '2026-01-09', SGT, [])).toBe(5)
  })

  it('excludes weekends from a full week', () => {
    // 2026-01-05 (Mon) to 2026-01-11 (Sun) = 5 working days
    expect(countWorkingDays('2026-01-05', '2026-01-11', SGT, [])).toBe(5)
  })

  it('excludes public holidays', () => {
    // 2026-08-07 (Fri) to 2026-08-11 (Tue) — Mon 10 = holiday on Sun doesn't matter
    // Actually Aug 9 is Sunday in 2026? Let's check: 2026-08-09 is a Sunday.
    // Use a weekday holiday: 2026-01-01 (Thu)
    // 2025-12-29 (Mon) to 2026-01-02 (Fri) = 5 days, minus 1 holiday (Jan 1) = 4
    expect(countWorkingDays('2025-12-29', '2026-01-02', SGT, SGT_HOLIDAYS)).toBe(4)
  })

  it('returns 0 when start is after end', () => {
    expect(countWorkingDays('2026-01-10', '2026-01-05', SGT, [])).toBe(0)
  })

  it('returns 1 for a single working day', () => {
    expect(countWorkingDays('2026-01-05', '2026-01-05', SGT, [])).toBe(1)
  })

  it('returns 0 for a single weekend day', () => {
    expect(countWorkingDays('2026-01-03', '2026-01-03', SGT, [])).toBe(0)
  })
})

describe('calculateLeaveDays', () => {
  it('returns 0.5 for a half-day on a single working day', () => {
    expect(calculateLeaveDays('2026-01-05', '2026-01-05', true, SGT, [])).toBe(0.5)
  })

  it('returns working days for multi-day range even with half-day flag', () => {
    // half-day flag is ignored for multi-day ranges
    expect(calculateLeaveDays('2026-01-05', '2026-01-06', true, SGT, [])).toBe(2)
  })

  it('excludes weekends and holidays from leave calculation', () => {
    // Two weeks with a holiday
    expect(calculateLeaveDays('2025-12-29', '2026-01-09', false, SGT, SGT_HOLIDAYS)).toBe(9)
  })
})

describe('completedServiceYears', () => {
  it('returns 0 before first anniversary', () => {
    expect(completedServiceYears('2025-03-01', '2026-02-28', 'Asia/Singapore')).toBe(0)
  })

  it('returns 1 on first anniversary', () => {
    expect(completedServiceYears('2025-03-01', '2026-03-01', 'Asia/Singapore')).toBe(1)
  })

  it('returns 1 the day after first anniversary', () => {
    expect(completedServiceYears('2025-03-01', '2026-03-02', 'Asia/Singapore')).toBe(1)
  })

  it('returns 2 after second anniversary', () => {
    expect(completedServiceYears('2024-01-15', '2026-01-15', 'Asia/Singapore')).toBe(2)
  })

  it('returns 0 if start is after reference', () => {
    expect(completedServiceYears('2027-01-01', '2026-06-01', 'Asia/Singapore')).toBe(0)
  })
})

describe('sgAnnualLeaveEntitlement', () => {
  it('returns 0 for less than 1 year', () => {
    expect(sgAnnualLeaveEntitlement(0)).toBe(0)
  })

  it('returns 7 after 1 year', () => {
    expect(sgAnnualLeaveEntitlement(1)).toBe(7)
  })

  it('returns 8 after 2 years', () => {
    expect(sgAnnualLeaveEntitlement(2)).toBe(8)
  })

  it('returns 14 after 8+ years (capped)', () => {
    expect(sgAnnualLeaveEntitlement(8)).toBe(14)
    expect(sgAnnualLeaveEntitlement(10)).toBe(14)
    expect(sgAnnualLeaveEntitlement(20)).toBe(14)
  })

  it('increments correctly year by year', () => {
    const expected = [0, 7, 8, 9, 10, 11, 12, 13, 14, 14, 14]
    for (let i = 0; i <= 10; i++) {
      expect(sgAnnualLeaveEntitlement(i)).toBe(expected[i])
    }
  })
})

describe('proRatedEntitlement', () => {
  it('returns full entitlement for 12 months', () => {
    expect(proRatedEntitlement(14, 12)).toBe(14)
  })

  it('returns half for 6 months', () => {
    expect(proRatedEntitlement(14, 6)).toBe(7)
  })

  it('returns 0 for 0 months', () => {
    expect(proRatedEntitlement(14, 0)).toBe(0)
  })

  it('rounds to 1 decimal place', () => {
    // 7 * 5 / 12 = 2.916... → 2.9
    expect(proRatedEntitlement(7, 5)).toBe(2.9)
  })
})

describe('timezone correctness', () => {
  it('handles DST transition for US Eastern timezone', () => {
    // Spring forward: March 8, 2026 at 2am
    // A date range crossing DST should still count days correctly
    const holidays: PublicHoliday[] = []
    const count = countWorkingDays('2026-03-06', '2026-03-13', US_EASTERN, holidays)
    // Fri Mar 6 to Fri Mar 13 = 6 working days (6,9,10,11,12,13)
    expect(count).toBe(6)
  })

  it('resolves clock-in at 23:30 SGT to correct local date', () => {
    // 2026-01-05 23:30 SGT = 2026-01-05 15:30 UTC
    const utcTimestamp = new Date('2026-01-05T15:30:00Z')
    const localDate = getLocalDateForTimestamp(utcTimestamp, 'Asia/Singapore')
    expect(localDate).toBe('2026-01-05')
  })

  it('resolves a timestamp just after midnight UTC to previous day in SG', () => {
    // 2026-01-05 00:30 UTC = 2026-01-05 08:30 SGT (same day)
    const utcTimestamp = new Date('2026-01-05T00:30:00Z')
    const localDate = getLocalDateForTimestamp(utcTimestamp, 'Asia/Singapore')
    expect(localDate).toBe('2026-01-05')
  })

  it('resolves UTC midnight to correct local date in negative offset', () => {
    // 2026-01-06 00:00 UTC = 2026-01-05 19:00 EST (previous day)
    const utcTimestamp = new Date('2026-01-06T00:00:00Z')
    const localDate = getLocalDateForTimestamp(utcTimestamp, 'America/New_York')
    expect(localDate).toBe('2026-01-05')
  })
})

describe('service-year leave spanning anniversary', () => {
  it('entitlement increases at anniversary boundary', () => {
    // Employee started 2024-06-15
    // On 2026-06-14 they have 1 completed year → 7 days
    // On 2026-06-15 they have 2 completed years → 8 days
    expect(completedServiceYears('2024-06-15', '2026-06-14', 'Asia/Singapore')).toBe(1)
    expect(completedServiceYears('2024-06-15', '2026-06-15', 'Asia/Singapore')).toBe(2)

    expect(sgAnnualLeaveEntitlement(1)).toBe(7)
    expect(sgAnnualLeaveEntitlement(2)).toBe(8)
  })
})
