/**
 * Independent verification of the CPF calculator.
 *
 * Written against the published CPF Board tables rather than against the
 * implementation, so it does not inherit whatever assumptions the calculator
 * made. Expected figures below are worked by hand from
 * docs/reference/statutory/singapore/CPF-contribution-rates-2026-01-01.pdf.
 *
 * This module produces figures real companies file on. A test suite written by
 * the same pass that wrote the code is not sufficient evidence on its own.
 */
import { describe, it, expect } from 'vitest'
import { computeCpf } from '@/modules/payroll/cpf/calculate'
import type { ResidencyStatus, PrArrangement } from '@/modules/payroll/cpf/types'

const PERIOD = new Date('2026-03-31T00:00:00.000Z')

/** Date of birth giving exactly `age` at the pay-period date. */
function dobForAge(age: number): Date {
  const d = new Date(PERIOD)
  d.setUTCFullYear(d.getUTCFullYear() - age)
  d.setUTCDate(d.getUTCDate() - 1) // safely past the birthday
  return d
}

function compute(
  age: number,
  ordinaryWage: number,
  opts: {
    additionalWage?: number
    residencyStatus?: ResidencyStatus
    prArrangement?: PrArrangement | null
    prStartDate?: Date | null
    ytdOwCents?: number
  } = {}
) {
  return computeCpf({
    owCents: Math.round(ordinaryWage * 100),
    awCents: Math.round((opts.additionalWage ?? 0) * 100),
    dateOfBirth: dobForAge(age),
    payPeriodDate: PERIOD,
    residencyStatus: opts.residencyStatus ?? 'CITIZEN',
    prStartDate: opts.prStartDate ?? null,
    prArrangement: opts.prArrangement ?? null,
    ytdOwCents: opts.ytdOwCents ?? 0,
    ytdTotalCents: opts.ytdOwCents ?? 0,
  })
}

const citizen = (age: number, ow: number, aw = 0) =>
  compute(age, ow, { additionalWage: aw })

const dollars = (cents: number) => cents / 100

describe('CPF — Table 1, age 55 and below (17% employer / 20% employee)', () => {
  it('$5,000: total 1850, employee 1000, employer 850', () => {
    const r = citizen(30, 5000)
    expect(dollars(r.totalCents)).toBe(1850)
    expect(dollars(r.employeeCents)).toBe(1000)
    expect(dollars(r.employerCents)).toBe(850)
  })

  it('caps Ordinary Wages at the $8,000 ceiling', () => {
    // $10,000 earns CPF on $8,000 only: 37% = 2960, 20% = 1600.
    // These are the published maxima on OW for this band.
    const r = citizen(30, 10_000)
    expect(dollars(r.totalCents)).toBe(2960)
    expect(dollars(r.employeeCents)).toBe(1600)
    expect(dollars(r.employerCents)).toBe(1360)
  })

  it('pays nothing at or below $50', () => {
    expect(citizen(30, 50).totalCents).toBe(0)
    expect(citizen(30, 50).employeeCents).toBe(0)
  })

  it('charges the employer only between $50 and $500', () => {
    // 17% of total wages, no employee share.
    const r = citizen(30, 400)
    expect(dollars(r.totalCents)).toBe(68)
    expect(dollars(r.employeeCents)).toBe(0)
    expect(dollars(r.employerCents)).toBe(68)
  })

  it('phases the employee share in between $500 and $750', () => {
    // total = 17%(TW) + 0.6(TW-500); employee = 0.6(TW-500)
    // At $600: 102 + 60 = 162 total, 60 employee, 102 employer.
    const r = citizen(30, 600)
    expect(dollars(r.totalCents)).toBe(162)
    expect(dollars(r.employeeCents)).toBe(60)
    expect(dollars(r.employerCents)).toBe(102)
  })
})

describe('CPF — age band boundaries', () => {
  // Bands are "55 and below", "above 55 to 60", "above 60 to 65",
  // "above 65 to 70", "above 70". Exactly 55 therefore sits in the FIRST band.
  it('treats exactly 55 as the 55-and-below band', () => {
    expect(dollars(citizen(55, 5000).totalCents)).toBe(1850) // 37%
  })

  it('moves to 34% above 55', () => {
    expect(dollars(citizen(56, 5000).totalCents)).toBe(1700) // 34%
    expect(dollars(citizen(56, 5000).employeeCents)).toBe(900) // 18%
  })

  it('exactly 60 is still the 55-60 band', () => {
    expect(dollars(citizen(60, 5000).totalCents)).toBe(1700)
  })

  it('moves to 25% above 60', () => {
    expect(dollars(citizen(61, 5000).totalCents)).toBe(1250) // 25%
    expect(dollars(citizen(61, 5000).employeeCents)).toBe(625) // 12.5%
  })

  it('moves to 16.5% above 65', () => {
    expect(dollars(citizen(66, 5000).totalCents)).toBe(825) // 16.5%
    expect(dollars(citizen(66, 5000).employeeCents)).toBe(375) // 7.5%
  })

  it('moves to 12.5% above 70', () => {
    expect(dollars(citizen(71, 5000).totalCents)).toBe(625) // 12.5%
    expect(dollars(citizen(71, 5000).employeeCents)).toBe(250) // 5%
  })
})

describe('CPF — rounding order', () => {
  it('derives the employer share as a residual, not independently', () => {
    // $1,234.56 is chosen because the two methods disagree:
    //   total    = 0.37 x 1234.56 = 456.7872 -> round half up -> 457
    //   employee = 0.20 x 1234.56 = 246.912  -> floor          -> 246
    //   employer = 457 - 246                                    = 211
    // Computing the employer share independently would give
    //   0.17 x 1234.56 = 209.8752 -> 210, which is a dollar short.
    const r = citizen(30, 1234.56)
    expect(dollars(r.totalCents)).toBe(457)
    expect(dollars(r.employeeCents)).toBe(246)
    expect(dollars(r.employerCents)).toBe(211)
    expect(r.employerCents).toBe(r.totalCents - r.employeeCents)
  })

  it('always reconciles: employer + employee equals total', () => {
    for (const wage of [751, 900, 1234.56, 3333.33, 4999.99, 7999.99, 8000, 12_345]) {
      for (const age of [30, 57, 62, 67, 75]) {
        const r = citizen(age, wage)
        expect(r.employerCents + r.employeeCents).toBe(r.totalCents)
      }
    }
  })
})

describe('CPF — residency', () => {
  it('charges nothing for a foreigner on a work pass', () => {
    const r = compute(30, 5000, { residencyStatus: 'FOREIGNER' })
    expect(r.totalCents).toBe(0)
    expect(r.employeeCents).toBe(0)
    expect(r.employerCents).toBe(0)
  })

  it('uses graduated rates for a first-year PR', () => {
    // Table 2, 55 and below, above $750: 9% total, 5% employee.
    const r = compute(30, 5000, {
      residencyStatus: 'PR',
      prArrangement: 'GRADUATED_GRADUATED',
      prStartDate: new Date('2026-01-01T00:00:00.000Z'), // 1st year of PR
    })
    expect(dollars(r.totalCents)).toBe(450) // 9% of 5000
    expect(dollars(r.employeeCents)).toBe(250) // 5% of 5000
    expect(dollars(r.employerCents)).toBe(200)
  })

  it('uses second-year graduated rates for a second-year PR', () => {
    // Table 3, 55 and below, above $750: 24% total, 15% employee.
    const r = compute(30, 5000, {
      residencyStatus: 'PR',
      prArrangement: 'GRADUATED_GRADUATED',
      prStartDate: new Date('2025-01-01T00:00:00.000Z'), // 2nd year of PR
    })
    expect(dollars(r.totalCents)).toBe(1200) // 24% of 5000
    expect(dollars(r.employeeCents)).toBe(750) // 15% of 5000
    expect(dollars(r.employerCents)).toBe(450)
  })
})

describe('CPF — Additional Wage ceiling', () => {
  it('limits AW by $102,000 minus OW already subject to CPF', () => {
    // OW of 8,000/month for 11 months = 88,000 already counted.
    // AW room = 102,000 - 88,000 = 14,000. A 20,000 bonus is capped at 14,000.
    const r = compute(30, 8000, {
      additionalWage: 20_000,
      ytdOwCents: 8_800_000,
    })
    // The annual OW total includes the current month: 88,000 + 8,000 = 96,000.
    // Room is therefore 102,000 - 96,000 = 6,000, not 14,000.
    // Subject to CPF: OW 8,000 + AW 6,000 = 14,000 at 37% = 5,180.
    expect(dollars(r.totalCents)).toBe(5180)
    expect(r.employerCents + r.employeeCents).toBe(r.totalCents)
  })
})

describe('CPF — PR year is counted by anniversary, not calendar year', () => {
  it('keeps a December PR grant on first-year rates the following January', () => {
    // Granted 2025-12-01. At 2026-03-31 the first anniversary has not passed,
    // so first-year graduated rates still apply (Table 2: 9% total, 5% employee).
    // Counting by calendar year would have moved them to year 2 in January,
    // roughly eleven months early and onto materially higher rates.
    const r = compute(30, 5000, {
      residencyStatus: 'PR',
      prArrangement: 'GRADUATED_GRADUATED',
      prStartDate: new Date('2025-12-01T00:00:00.000Z'),
    })
    expect(dollars(r.totalCents)).toBe(450)
    expect(dollars(r.employeeCents)).toBe(250)
  })

  it('moves to second-year rates only once the first anniversary passes', () => {
    // Granted 2025-01-15; first anniversary passed, second has not.
    // Table 3: 24% total, 15% employee.
    const r = compute(30, 5000, {
      residencyStatus: 'PR',
      prArrangement: 'GRADUATED_GRADUATED',
      prStartDate: new Date('2025-01-15T00:00:00.000Z'),
    })
    expect(dollars(r.totalCents)).toBe(1200)
    expect(dollars(r.employeeCents)).toBe(750)
    expect(dollars(r.employerCents)).toBe(450)
  })

  it('reaches full rates from the third year', () => {
    const r = compute(30, 5000, {
      residencyStatus: 'PR',
      prArrangement: 'GRADUATED_GRADUATED',
      prStartDate: new Date('2020-01-01T00:00:00.000Z'),
    })
    expect(dollars(r.totalCents)).toBe(1850) // Table 1, 37%
  })

  it('applies full-employer/graduated-employee second-year rates', () => {
    // Table 5, 55 and below: 32% total, 15% employee, 17% employer.
    const r = compute(30, 5000, {
      residencyStatus: 'PR',
      prArrangement: 'FULL_GRADUATED',
      prStartDate: new Date('2025-01-15T00:00:00.000Z'),
    })
    expect(dollars(r.totalCents)).toBe(1600)
    expect(dollars(r.employeeCents)).toBe(750)
    expect(dollars(r.employerCents)).toBe(850)
  })
})
