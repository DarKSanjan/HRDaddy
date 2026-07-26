/**
 * Payroll compliance provider — unit tests.
 *
 * Tests:
 * - SG provider OT eligibility thresholds
 * - Hourly rate formula accuracy
 * - OW/AW classification timing
 * - Provider registry behavior
 */
import { describe, it, expect } from 'vitest'
import { getComplianceProvider } from '../compliance'
import { sgComplianceProvider, MOM_OT_CAP_HOURS } from '../compliance/sg'

describe('getComplianceProvider', () => {
  it('returns SG provider for "SG"', () => {
    const provider = getComplianceProvider('SG')
    expect(provider.countryCode).toBe('SG')
  })

  it('throws for unsupported country', () => {
    expect(() => getComplianceProvider('US')).toThrow('not supported yet')
  })
})

describe('sgComplianceProvider.isOvertimeEligible', () => {
  it('workman at $4,500/month is eligible', () => {
    expect(sgComplianceProvider.isOvertimeEligible(450_000, true)).toBe(true)
  })

  it('workman above $4,500/month is NOT eligible', () => {
    expect(sgComplianceProvider.isOvertimeEligible(450_001, true)).toBe(false)
  })

  it('non-workman at $2,600/month is eligible', () => {
    expect(sgComplianceProvider.isOvertimeEligible(260_000, false)).toBe(true)
  })

  it('non-workman above $2,600/month is NOT eligible', () => {
    expect(sgComplianceProvider.isOvertimeEligible(260_001, false)).toBe(false)
  })

  it('non-workman at $0 is eligible', () => {
    expect(sgComplianceProvider.isOvertimeEligible(0, false)).toBe(true)
  })
})

describe('sgComplianceProvider.hourlyRateFromMonthlyCents', () => {
  it('computes MOM formula: (12 × monthly) / (52 × 44)', () => {
    // $3,000/month = 300,000 cents
    // Expected: (12 × 300000) / (52 × 44) = 3600000 / 2288 ≈ 1573.43 cents/hour
    const rate = sgComplianceProvider.hourlyRateFromMonthlyCents(300_000)
    expect(rate).toBeCloseTo(1573.43, 0)
  })

  it('computes correctly for $4,500/month', () => {
    // (12 × 450000) / (52 × 44) = 5400000 / 2288 ≈ 2360.14 cents/hour
    const rate = sgComplianceProvider.hourlyRateFromMonthlyCents(450_000)
    expect(rate).toBeCloseTo(2360.14, 0)
  })
})

describe('sgComplianceProvider.classifyWageTiming', () => {
  it('classifies as OW when paid within same month', () => {
    const earnedEnd = new Date(2026, 5, 30) // June 30
    const paidDate = new Date(2026, 5, 30)  // June 30
    expect(sgComplianceProvider.classifyWageTiming(earnedEnd, paidDate)).toBe('OW')
  })

  it('classifies as OW when paid by 14th of following month', () => {
    const earnedEnd = new Date(2026, 5, 30) // June 30
    const paidDate = new Date(2026, 6, 14)  // July 14
    expect(sgComplianceProvider.classifyWageTiming(earnedEnd, paidDate)).toBe('OW')
  })

  it('classifies as AW when paid after 14th of following month', () => {
    const earnedEnd = new Date(2026, 5, 30) // June 30
    const paidDate = new Date(2026, 6, 15)  // July 15
    expect(sgComplianceProvider.classifyWageTiming(earnedEnd, paidDate)).toBe('AW')
  })

  it('handles December→January year boundary', () => {
    const earnedEnd = new Date(2026, 11, 31) // Dec 31
    const paidDate = new Date(2027, 0, 14)   // Jan 14
    expect(sgComplianceProvider.classifyWageTiming(earnedEnd, paidDate)).toBe('OW')
  })

  it('AW for December period paid after Jan 14', () => {
    const earnedEnd = new Date(2026, 11, 31) // Dec 31
    const paidDate = new Date(2027, 0, 15)   // Jan 15
    expect(sgComplianceProvider.classifyWageTiming(earnedEnd, paidDate)).toBe('AW')
  })
})

describe('MOM_OT_CAP_HOURS', () => {
  it('is 72 hours', () => {
    expect(MOM_OT_CAP_HOURS).toBe(72)
  })
})
