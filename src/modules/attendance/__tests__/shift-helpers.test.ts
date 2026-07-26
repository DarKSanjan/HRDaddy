/**
 * Shift helpers — unit tests.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveShift,
  computeShiftMetrics,
  parseTimeToMinutes,
} from '../shift-helpers'

describe('parseTimeToMinutes', () => {
  it('parses "09:00" to 540', () => {
    expect(parseTimeToMinutes('09:00')).toBe(540)
  })

  it('parses "17:00" to 1020', () => {
    expect(parseTimeToMinutes('17:00')).toBe(1020)
  })

  it('parses "00:00" to 0', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0)
  })

  it('parses "23:59" to 1439', () => {
    expect(parseTimeToMinutes('23:59')).toBe(1439)
  })
})

describe('resolveShift', () => {
  it('returns employee shift when set', () => {
    const result = resolveShift({
      employeeShift: {
        startMinutes: 600,
        endMinutes: 1080,
        standardMinutesPerDay: 480,
        overtimeMultiplier: 1.5,
        restDayMultiplier: 2.0,
      },
      employmentTypeShift: {
        startMinutes: 540,
        endMinutes: 1020,
        standardMinutesPerDay: 480,
        overtimeMultiplier: 1.5,
        restDayMultiplier: 2.0,
      },
      orgWorkingHoursStart: '09:00',
      orgWorkingHoursEnd: '17:00',
    })
    expect(result.startMinutes).toBe(600) // 10:00
  })

  it('falls back to employment type shift', () => {
    const result = resolveShift({
      employeeShift: null,
      employmentTypeShift: {
        startMinutes: 600,
        endMinutes: 1080,
        standardMinutesPerDay: 480,
        overtimeMultiplier: 1.5,
        restDayMultiplier: 2.0,
      },
      orgWorkingHoursStart: '09:00',
      orgWorkingHoursEnd: '17:00',
    })
    expect(result.startMinutes).toBe(600)
  })

  it('falls back to org working hours', () => {
    const result = resolveShift({
      employeeShift: null,
      employmentTypeShift: null,
      orgWorkingHoursStart: '08:30',
      orgWorkingHoursEnd: '17:30',
    })
    expect(result.startMinutes).toBe(510) // 8*60+30
    expect(result.endMinutes).toBe(1050)  // 17*60+30
    expect(result.standardMinutesPerDay).toBe(540) // 9 hours
  })
})

describe('computeShiftMetrics', () => {
  const defaultShift = {
    startMinutes: 540,  // 09:00
    endMinutes: 1020,   // 17:00
    standardMinutesPerDay: 480,
    overtimeMultiplier: 1.5,
    restDayMultiplier: 2.0,
  }
  const workingDays = [1, 2, 3, 4, 5] // Mon-Fri

  it('computes late minutes when clocking in after shift start', () => {
    // Clock in at 09:30 on a Monday (local SGT time)
    // 09:30 SGT = 01:30 UTC
    const clockIn = new Date('2026-07-20T01:30:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T09:30:00.000Z'), // 17:30 SGT
      durationMinutes: 480,
      dayOfWeek: 1, // Monday
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.lateMinutes).toBe(30)
  })

  it('lateMinutes is 0 when on time', () => {
    // Clock in at 09:00 SGT = 01:00 UTC
    const clockIn = new Date('2026-07-20T01:00:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T09:00:00.000Z'), // 17:00 SGT
      durationMinutes: 480,
      dayOfWeek: 1,
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.lateMinutes).toBe(0)
  })

  it('computes overtime when working beyond standard', () => {
    // Clock in at 09:00 SGT = 01:00 UTC
    const clockIn = new Date('2026-07-20T01:00:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T11:00:00.000Z'), // 19:00 SGT
      durationMinutes: 600, // 10 hours
      dayOfWeek: 1,
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.overtimeMinutes).toBe(120) // 2 hours OT
    expect(result.undertimeMinutes).toBe(0)
  })

  it('computes undertime when working less than standard', () => {
    // Clock in at 09:00 SGT = 01:00 UTC
    const clockIn = new Date('2026-07-20T01:00:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T08:00:00.000Z'), // 16:00 SGT
      durationMinutes: 420, // 7 hours
      dayOfWeek: 1,
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.undertimeMinutes).toBe(60)
    expect(result.overtimeMinutes).toBe(0)
  })

  it('identifies rest days correctly', () => {
    // Sunday clock-in at 09:00 SGT = 01:00 UTC
    const clockIn = new Date('2026-07-19T01:00:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-19T09:00:00.000Z'),
      durationMinutes: 480,
      dayOfWeek: 0, // Sunday
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.isRestDay).toBe(true)
  })

  it('weekday is not a rest day', () => {
    const clockIn = new Date('2026-07-20T01:00:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T09:00:00.000Z'),
      durationMinutes: 480,
      dayOfWeek: 1, // Monday
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.isRestDay).toBe(false)
  })

  it('returns zeroes when not clocked out', () => {
    // Clock in at 09:30 SGT = 01:30 UTC
    const clockIn = new Date('2026-07-20T01:30:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: null,
      durationMinutes: null,
      dayOfWeek: 1,
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.lateMinutes).toBe(30)
    expect(result.undertimeMinutes).toBe(0)
    expect(result.overtimeMinutes).toBe(0)
  })

  it('correctly converts UTC timestamp to org timezone for late calculation (timezone-critical)', () => {
    // THE KEY TEST: proves the timezone fix works.
    // Employee clocks in at 09:15 Singapore time (shift starts at 09:00 = 540 minutes).
    // Stored as UTC: 01:15 UTC (Singapore is UTC+8).
    //
    // BUGGY behaviour (old code): getHours() on raw Date in UTC process = 1,
    //   clockInMinutes = 1*60+15 = 75, lateMinutes = max(0, 75-540) = 0 ← WRONG!
    //
    // CORRECT behaviour (fixed): TZDate in Asia/Singapore gives hours=9,
    //   clockInMinutes = 9*60+15 = 555, lateMinutes = max(0, 555-540) = 15 ← CORRECT!
    const clockIn = new Date('2026-07-20T01:15:00.000Z') // 09:15 SGT
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T09:15:00.000Z'), // 17:15 SGT
      durationMinutes: 480,
      dayOfWeek: 1, // Monday
      workingDays,
      timezone: 'Asia/Singapore',
    })
    expect(result.lateMinutes).toBe(15)
  })

  it('works correctly with UTC timezone (no offset)', () => {
    // Clock in at 09:30 UTC, org is in UTC — should be 30 min late
    const clockIn = new Date('2026-07-20T09:30:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T17:30:00.000Z'),
      durationMinutes: 480,
      dayOfWeek: 1,
      workingDays,
      timezone: 'UTC',
    })
    expect(result.lateMinutes).toBe(30)
  })

  it('works correctly with negative UTC offset (America/New_York)', () => {
    // 09:15 New York (EDT, UTC-4) = 13:15 UTC
    // Shift starts at 540 (09:00). Should be 15 min late.
    const clockIn = new Date('2026-07-20T13:15:00.000Z')
    const result = computeShiftMetrics({
      shift: defaultShift,
      clockIn,
      clockOut: new Date('2026-07-20T21:15:00.000Z'), // 17:15 ET
      durationMinutes: 480,
      dayOfWeek: 1,
      workingDays,
      timezone: 'America/New_York',
    })
    expect(result.lateMinutes).toBe(15)
  })
})
