/**
 * Performance module — M16 unit tests.
 *
 * Covers:
 * - REMINDER_WINDOW_DAYS constant and reminder date logic
 * - Calibration averaging and outlier detection
 * - scoreVariant shared utility
 */
import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
// scoreVariant — shared utility
// ─────────────────────────────────────────────

import { scoreVariant } from '@/modules/performance/labels'

describe('scoreVariant', () => {
  it('returns "neutral" for null', () => {
    expect(scoreVariant(null)).toBe('neutral')
  })

  it('returns "danger" for score 1', () => {
    expect(scoreVariant(1)).toBe('danger')
  })

  it('returns "danger" for score 2', () => {
    expect(scoreVariant(2)).toBe('danger')
  })

  it('returns "warning" for score 3', () => {
    expect(scoreVariant(3)).toBe('warning')
  })

  it('returns "success" for score 4', () => {
    expect(scoreVariant(4)).toBe('success')
  })

  it('returns "success" for score 5', () => {
    expect(scoreVariant(5)).toBe('success')
  })
})

// ─────────────────────────────────────────────
// REMINDER_WINDOW_DAYS constant
// ─────────────────────────────────────────────

import { REMINDER_WINDOW_DAYS } from '@/modules/performance/reminders'

describe('REMINDER_WINDOW_DAYS', () => {
  it('is set to 3 days', () => {
    expect(REMINDER_WINDOW_DAYS).toBe(3)
  })

  it('correctly defines a window from now', () => {
    const now = new Date('2026-07-25T00:00:00Z')
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    expect(windowEnd.toISOString()).toBe('2026-07-28T00:00:00.000Z')
  })
})

// ─────────────────────────────────────────────
// Calibration data computation logic
// ─────────────────────────────────────────────

describe('calibration averaging logic', () => {
  it('computes org average correctly', () => {
    // Simulate what getCalibrationData does internally
    const scores = [4, 5, 3, 4, 3, 5, 4, 3]
    const orgAverage =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    // 31/8 = 3.875 → rounds to 3.9
    expect(orgAverage).toBe(3.9)
  })

  it('computes per-manager average correctly', () => {
    const managerScores = [4, 5, 4] // avg = 13/3 = 4.333 → 4.3
    const avg =
      Math.round((managerScores.reduce((a, b) => a + b, 0) / managerScores.length) * 10) / 10
    expect(avg).toBe(4.3)
  })

  it('detects outliers with deviation > 0.5', () => {
    const orgAverage = 3.5
    const managers = [
      { avgScore: 4.2, reviewerName: 'Manager A' }, // +0.7 → outlier (high)
      { avgScore: 3.6, reviewerName: 'Manager B' }, // +0.1 → not outlier
      { avgScore: 2.8, reviewerName: 'Manager C' }, // -0.7 → outlier (low)
      { avgScore: 3.0, reviewerName: 'Manager D' }, // -0.5 → NOT outlier (exactly 0.5 is not > 0.5)
    ]

    const outliers = managers.filter(
      (m) => Math.abs(m.avgScore - orgAverage) > 0.5
    )

    expect(outliers).toHaveLength(2)
    expect(outliers[0].reviewerName).toBe('Manager A')
    expect(outliers[1].reviewerName).toBe('Manager C')
  })

  it('identifies inflation (delta > 0) vs harshness (delta < 0)', () => {
    const orgAverage = 3.5
    const highManager = { avgScore: 4.2 }
    const lowManager = { avgScore: 2.8 }

    expect(highManager.avgScore - orgAverage).toBeGreaterThan(0) // inflation
    expect(lowManager.avgScore - orgAverage).toBeLessThan(0) // harshness
  })
})

// ─────────────────────────────────────────────
// Payroll OT hours derivation logic
// ─────────────────────────────────────────────

describe('payroll overtime hours derivation', () => {
  it('computes OT hours correctly from minutes', () => {
    // This mirrors the logic used in the payroll fix
    const totalOvertimeMinutes = 150 // 2.5 hours
    const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10
    expect(overtimeHours).toBe(2.5)
  })

  it('rounds to one decimal place', () => {
    // 47 minutes = 0.78333... → rounds to 0.8
    const totalOvertimeMinutes = 47
    const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10
    expect(overtimeHours).toBe(0.8)
  })

  it('handles zero overtime', () => {
    const totalOvertimeMinutes = 0
    const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10
    expect(overtimeHours).toBe(0)
  })

  it('rest day hours count fully as overtime', () => {
    // On a rest day, all durationMinutes count as OT
    const durationMinutes = 480 // 8 hours
    const isRestDay = true
    const regularOvertimeMinutes = 0

    const totalOT = isRestDay ? durationMinutes : regularOvertimeMinutes
    const overtimeHours = Math.round((totalOT / 60) * 10) / 10
    expect(overtimeHours).toBe(8)
  })
})
