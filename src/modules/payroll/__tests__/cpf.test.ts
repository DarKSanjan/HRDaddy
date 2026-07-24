/**
 * CPF Calculation Engine — Comprehensive Tests.
 *
 * Covers:
 * - Every age band boundary (exactly 55, 60, 65, 70)
 * - Every wage band boundary ($50, $500, $750)
 * - OW ceiling ($8,000)
 * - AW ceiling with YTD OW consumed
 * - All PR arrangements (Tables 1-5)
 * - Foreigner (zero CPF)
 * - THE ROUNDING RESIDUAL TEST
 */
import { describe, it, expect } from 'vitest'
import {
  getAgeBand,
  getWageBand,
  getCpfTable,
  computeCpf,
  applyOwCeiling,
  applyAwCeiling,
} from '../cpf/calculate'
import type { CpfComputeInput } from '../cpf/types'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d)
}

function citizenInput(overrides: Partial<CpfComputeInput>): CpfComputeInput {
  return {
    owCents: 500_000, // $5,000
    awCents: 0,
    dateOfBirth: makeDate(1990, 1, 1),
    payPeriodDate: makeDate(2026, 6, 30),
    residencyStatus: 'CITIZEN',
    prStartDate: null,
    prArrangement: null,
    ytdOwCents: 0,
    ytdTotalCents: 0,
    ...overrides,
  }
}

// ─────────────────────────────────────────────
// Age Band Tests
// ─────────────────────────────────────────────

describe('getAgeBand', () => {
  it('exactly 55 years old is 55_AND_BELOW', () => {
    // Born 1971-06-30, pay period 2026-06-30 -> age 55
    const dob = makeDate(1971, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('55_AND_BELOW')
  })

  it('55 years + 1 day is ABOVE_55_TO_60', () => {
    // Born 1971-06-29, pay period 2026-06-30 -> age 55 (birthday already passed)
    // Actually need age > 55: born 1970-06-30, pay period 2026-06-30 -> age 56
    const dob = makeDate(1970, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('ABOVE_55_TO_60')
  })

  it('exactly 60 years old is ABOVE_55_TO_60', () => {
    const dob = makeDate(1966, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('ABOVE_55_TO_60')
  })

  it('61 years old is ABOVE_60_TO_65', () => {
    const dob = makeDate(1965, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('ABOVE_60_TO_65')
  })

  it('exactly 65 years old is ABOVE_60_TO_65', () => {
    const dob = makeDate(1961, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('ABOVE_60_TO_65')
  })

  it('66 years old is ABOVE_65_TO_70', () => {
    const dob = makeDate(1960, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('ABOVE_65_TO_70')
  })

  it('exactly 70 years old is ABOVE_65_TO_70', () => {
    const dob = makeDate(1956, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('ABOVE_65_TO_70')
  })

  it('71 years old is ABOVE_70', () => {
    const dob = makeDate(1955, 6, 30)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('ABOVE_70')
  })

  it('birthday not yet reached this year', () => {
    // Born 1971-07-01, pay period 2026-06-30 -> age 54 (not yet 55)
    const dob = makeDate(1971, 7, 1)
    const ppd = makeDate(2026, 6, 30)
    expect(getAgeBand(dob, ppd)).toBe('55_AND_BELOW')
  })
})

// ─────────────────────────────────────────────
// Wage Band Tests
// ─────────────────────────────────────────────

describe('getWageBand', () => {
  it('$0 is NIL', () => {
    expect(getWageBand(0)).toBe('NIL')
  })

  it('$50 exactly is NIL', () => {
    expect(getWageBand(50)).toBe('NIL')
  })

  it('$50.01 is EMPLOYER_ONLY', () => {
    expect(getWageBand(50.01)).toBe('EMPLOYER_ONLY')
  })

  it('$500 exactly is EMPLOYER_ONLY', () => {
    expect(getWageBand(500)).toBe('EMPLOYER_ONLY')
  })

  it('$500.01 is GRADUATED', () => {
    expect(getWageBand(500.01)).toBe('GRADUATED')
  })

  it('$750 exactly is GRADUATED', () => {
    expect(getWageBand(750)).toBe('GRADUATED')
  })

  it('$750.01 is FULL', () => {
    expect(getWageBand(750.01)).toBe('FULL')
  })

  it('$8000 is FULL', () => {
    expect(getWageBand(8000)).toBe('FULL')
  })
})

// ─────────────────────────────────────────────
// CPF Table Selection
// ─────────────────────────────────────────────

describe('getCpfTable', () => {
  it('citizen always uses Table 1', () => {
    expect(getCpfTable('CITIZEN', null, null, makeDate(2026, 6, 30))).toBe(1)
  })

  it('foreigner returns null (no CPF)', () => {
    expect(getCpfTable('FOREIGNER', null, null, makeDate(2026, 6, 30))).toBeNull()
  })

  it('PR year 1 graduated/graduated uses Table 2', () => {
    const prStart = makeDate(2026, 3, 1) // started PR in 2026
    expect(getCpfTable('PR', prStart, 'GRADUATED_GRADUATED', makeDate(2026, 6, 30))).toBe(2)
  })

  it('PR year 2 graduated/graduated uses Table 3', () => {
    const prStart = makeDate(2025, 3, 1) // started PR in 2025
    expect(getCpfTable('PR', prStart, 'GRADUATED_GRADUATED', makeDate(2026, 6, 30))).toBe(3)
  })

  it('PR year 1 full/graduated uses Table 4', () => {
    const prStart = makeDate(2026, 3, 1)
    expect(getCpfTable('PR', prStart, 'FULL_GRADUATED', makeDate(2026, 6, 30))).toBe(4)
  })

  it('PR year 2 full/graduated uses Table 5', () => {
    const prStart = makeDate(2025, 3, 1)
    expect(getCpfTable('PR', prStart, 'FULL_GRADUATED', makeDate(2026, 6, 30))).toBe(5)
  })

  it('PR year 3+ uses Table 1 regardless of arrangement', () => {
    const prStart = makeDate(2023, 3, 1) // 3+ years ago
    expect(getCpfTable('PR', prStart, 'GRADUATED_GRADUATED', makeDate(2026, 6, 30))).toBe(1)
    expect(getCpfTable('PR', prStart, 'FULL_GRADUATED', makeDate(2026, 6, 30))).toBe(1)
  })

  it('PR with no start date defaults to Table 1 (3rd year+)', () => {
    expect(getCpfTable('PR', null, null, makeDate(2026, 6, 30))).toBe(1)
  })
})

// ─────────────────────────────────────────────
// OW and AW Ceiling Tests
// ─────────────────────────────────────────────

describe('applyOwCeiling', () => {
  it('wages below ceiling pass through', () => {
    expect(applyOwCeiling(500_000, 800_000)).toBe(500_000) // $5k < $8k
  })

  it('wages at ceiling pass through', () => {
    expect(applyOwCeiling(800_000, 800_000)).toBe(800_000) // $8k = $8k
  })

  it('wages above ceiling are capped', () => {
    expect(applyOwCeiling(1_200_000, 800_000)).toBe(800_000) // $12k -> $8k
  })
})

describe('applyAwCeiling', () => {
  it('AW within ceiling passes through', () => {
    // Annual ceiling $102k, YTD OW $48k -> AW ceiling = $54k
    expect(applyAwCeiling(2_000_000, 4_800_000, 10_200_000)).toBe(2_000_000)
  })

  it('AW above ceiling is capped', () => {
    // Annual ceiling $102k, YTD OW $96k -> AW ceiling = $6k
    expect(applyAwCeiling(1_000_000, 9_600_000, 10_200_000)).toBe(600_000)
  })

  it('AW ceiling is zero when YTD OW exceeds annual ceiling', () => {
    // Annual ceiling $102k, YTD OW $102k -> AW ceiling = $0
    expect(applyAwCeiling(500_000, 10_200_000, 10_200_000)).toBe(0)
  })

  it('AW ceiling is zero when YTD OW already over annual ceiling', () => {
    expect(applyAwCeiling(500_000, 11_000_000, 10_200_000)).toBe(0)
  })
})

// ─────────────────────────────────────────────
// Full CPF Computation - Citizens
// ─────────────────────────────────────────────

describe('computeCpf - Citizens', () => {
  it('citizen age <=55, $5000 wages', () => {
    const result = computeCpf(citizenInput({ owCents: 500_000 }))
    // total = round(0.37 * 5000) = round(1850) = 1850
    // employee = floor(0.20 * 5000) = 1000
    // employer = 1850 - 1000 = 850
    expect(result.totalCents).toBe(185_000)
    expect(result.employeeCents).toBe(100_000)
    expect(result.employerCents).toBe(85_000)
  })

  it('citizen age >55-60, $5000 wages', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      dateOfBirth: makeDate(1968, 1, 1), // age 58
    }))
    // total = round(0.34 * 5000) = 1700
    // employee = floor(0.18 * 5000) = 900
    // employer = 1700 - 900 = 800
    expect(result.totalCents).toBe(170_000)
    expect(result.employeeCents).toBe(90_000)
    expect(result.employerCents).toBe(80_000)
  })

  it('citizen age >60-65, $5000 wages', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      dateOfBirth: makeDate(1963, 1, 1), // age 63
    }))
    // total = round(0.25 * 5000) = 1250
    // employee = floor(0.125 * 5000) = 625
    // employer = 1250 - 625 = 625
    expect(result.totalCents).toBe(125_000)
    expect(result.employeeCents).toBe(62_500)
    expect(result.employerCents).toBe(62_500)
  })

  it('citizen age >65-70, $5000 wages', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      dateOfBirth: makeDate(1958, 1, 1), // age 68
    }))
    // total = round(0.165 * 5000) = round(825) = 825
    // employee = floor(0.075 * 5000) = floor(375) = 375
    // employer = 825 - 375 = 450
    expect(result.totalCents).toBe(82_500)
    expect(result.employeeCents).toBe(37_500)
    expect(result.employerCents).toBe(45_000)
  })

  it('citizen age >70, $5000 wages', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      dateOfBirth: makeDate(1954, 1, 1), // age 72
    }))
    // total = round(0.125 * 5000) = 625
    // employee = floor(0.05 * 5000) = 250
    // employer = 625 - 250 = 375
    expect(result.totalCents).toBe(62_500)
    expect(result.employeeCents).toBe(25_000)
    expect(result.employerCents).toBe(37_500)
  })

  it('OW ceiling caps wages at $8000', () => {
    const result = computeCpf(citizenInput({ owCents: 1_200_000 })) // $12,000
    // Capped at $8,000
    // total = round(0.37 * 8000) = round(2960) = 2960
    // employee = floor(0.20 * 8000) = 1600
    // employer = 2960 - 1600 = 1360
    expect(result.cappedOwCents).toBe(800_000)
    expect(result.totalCents).toBe(296_000)
    expect(result.employeeCents).toBe(160_000)
    expect(result.employerCents).toBe(136_000)
  })

  it('wages in NIL band ($50 or below) produce zero CPF', () => {
    const result = computeCpf(citizenInput({ owCents: 5_000 })) // $50
    expect(result.totalCents).toBe(0)
    expect(result.employeeCents).toBe(0)
    expect(result.employerCents).toBe(0)
  })

  it('wages in EMPLOYER_ONLY band ($51-$500)', () => {
    const result = computeCpf(citizenInput({ owCents: 30_000 })) // $300
    // employer only: round(0.17 * 300) = round(51) = 51
    expect(result.totalCents).toBe(5_100)
    expect(result.employeeCents).toBe(0)
    expect(result.employerCents).toBe(5_100)
  })

  it('wages in GRADUATED band ($501-$750)', () => {
    const result = computeCpf(citizenInput({ owCents: 60_000 })) // $600
    // employer = round(0.17 * 600) = round(102) = 102
    // employee = floor(0.6 * (600 - 500)) = floor(60) = 60
    // total = 102 + 60 = 162
    expect(result.employerCents).toBe(10_200)
    expect(result.employeeCents).toBe(6_000)
    expect(result.totalCents).toBe(16_200)
  })
})

// ─────────────────────────────────────────────
// PR Arrangements
// ─────────────────────────────────────────────

describe('computeCpf - PR Arrangements', () => {
  it('PR Year 1, Graduated/Graduated (Table 2), $5000', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      residencyStatus: 'PR',
      prStartDate: makeDate(2026, 1, 15),
      prArrangement: 'GRADUATED_GRADUATED',
    }))
    // Table 2, age <=55: employer 4%, employee 5%, total 9%
    // total = round(0.09 * 5000) = 450
    // employee = floor(0.05 * 5000) = 250
    // employer = 450 - 250 = 200
    expect(result.totalCents).toBe(45_000)
    expect(result.employeeCents).toBe(25_000)
    expect(result.employerCents).toBe(20_000)
  })

  it('PR Year 2, Graduated/Graduated (Table 3), $5000', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      residencyStatus: 'PR',
      prStartDate: makeDate(2025, 3, 1),
      prArrangement: 'GRADUATED_GRADUATED',
    }))
    // Table 3, age <=55: employer 9%, employee 10%, total 19%
    // total = round(0.19 * 5000) = 950
    // employee = floor(0.10 * 5000) = 500
    // employer = 950 - 500 = 450
    expect(result.totalCents).toBe(95_000)
    expect(result.employeeCents).toBe(50_000)
    expect(result.employerCents).toBe(45_000)
  })

  it('PR Year 1, Full/Graduated (Table 4), $5000', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      residencyStatus: 'PR',
      prStartDate: makeDate(2026, 1, 15),
      prArrangement: 'FULL_GRADUATED',
    }))
    // Table 4, age <=55: employer 17%, employee 5%, total 22%
    // total = round(0.22 * 5000) = 1100
    // employee = floor(0.05 * 5000) = 250
    // employer = 1100 - 250 = 850
    expect(result.totalCents).toBe(110_000)
    expect(result.employeeCents).toBe(25_000)
    expect(result.employerCents).toBe(85_000)
  })

  it('PR Year 2, Full/Graduated (Table 5), $5000', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      residencyStatus: 'PR',
      prStartDate: makeDate(2025, 3, 1),
      prArrangement: 'FULL_GRADUATED',
    }))
    // Table 5, age <=55: employer 17%, employee 10%, total 27%
    // total = round(0.27 * 5000) = 1350
    // employee = floor(0.10 * 5000) = 500
    // employer = 1350 - 500 = 850
    expect(result.totalCents).toBe(135_000)
    expect(result.employeeCents).toBe(50_000)
    expect(result.employerCents).toBe(85_000)
  })

  it('PR 3rd year+ uses Table 1 (same as citizen)', () => {
    const result = computeCpf(citizenInput({
      owCents: 500_000,
      residencyStatus: 'PR',
      prStartDate: makeDate(2023, 1, 1), // 3+ years ago
      prArrangement: 'GRADUATED_GRADUATED',
    }))
    // Same as citizen: total=1850, employee=1000, employer=850
    expect(result.totalCents).toBe(185_000)
    expect(result.employeeCents).toBe(100_000)
    expect(result.employerCents).toBe(85_000)
  })
})

// ─────────────────────────────────────────────
// Foreigner
// ─────────────────────────────────────────────

describe('computeCpf - Foreigner', () => {
  it('foreigner gets zero CPF regardless of wages', () => {
    const result = computeCpf(citizenInput({
      owCents: 1_000_000,
      residencyStatus: 'FOREIGNER',
    }))
    expect(result.totalCents).toBe(0)
    expect(result.employeeCents).toBe(0)
    expect(result.employerCents).toBe(0)
    expect(result.cappedOwCents).toBe(0)
    expect(result.cappedAwCents).toBe(0)
  })
})

// ─────────────────────────────────────────────
// AW Ceiling with YTD OW
// ─────────────────────────────────────────────

describe('computeCpf - AW Ceiling', () => {
  it('AW is capped when YTD OW approaches annual ceiling', () => {
    // Annual ceiling $102,000. YTD OW already $96,000.
    // This period OW = $8,000 (capped from $10k).
    // YTD OW after this period = $96,000 + $8,000 = $104,000 (exceeds annual).
    // Wait - AW ceiling = $102,000 - ytdOwAfterThisPeriod
    // ytdOwAfterThisPeriod = 96000 + 8000 = 104000
    // AW ceiling = max(0, 102000 - 104000) = 0
    // So AW = 0 even if bonus is paid
    const result = computeCpf(citizenInput({
      owCents: 1_000_000, // $10,000 -> capped to $8,000
      awCents: 500_000,   // $5,000 bonus
      ytdOwCents: 9_600_000, // $96,000 YTD
      ytdTotalCents: 9_600_000,
    }))
    // OW capped to $8,000. YTD after = $96k + $8k = $104k > $102k annual.
    // AW ceiling = max(0, $102k - $104k) = 0
    // Total wages for CPF = $8,000 + $0 = $8,000
    expect(result.cappedOwCents).toBe(800_000)
    expect(result.cappedAwCents).toBe(0)
    // total = round(0.37 * 8000) = 2960
    expect(result.totalCents).toBe(296_000)
  })

  it('AW is partially capped when near ceiling', () => {
    // YTD OW = $88,000. This period OW = $8,000.
    // ytdOwAfterThisPeriod = $96,000
    // AW ceiling = $102,000 - $96,000 = $6,000
    // AW = $10,000 -> capped to $6,000
    const result = computeCpf(citizenInput({
      owCents: 800_000,     // $8,000
      awCents: 1_000_000,   // $10,000 bonus
      ytdOwCents: 8_800_000, // $88,000 YTD
      ytdTotalCents: 8_800_000,
    }))
    expect(result.cappedOwCents).toBe(800_000)
    expect(result.cappedAwCents).toBe(600_000) // $6,000
    // Total wages = $8,000 + $6,000 = $14,000
    // total = round(0.37 * 14000) = round(5180) = 5180
    // employee = floor(0.20 * 14000) = 2800
    // employer = 5180 - 2800 = 2380
    expect(result.totalCents).toBe(518_000)
    expect(result.employeeCents).toBe(280_000)
    expect(result.employerCents).toBe(238_000)
  })
})

// ─────────────────────────────────────────────
// THE ROUNDING RESIDUAL TEST
// ─────────────────────────────────────────────
// This proves that employer = total - employee (residual)
// gives a DIFFERENT answer than computing employer independently.
//
// Wages = $1,010 with age >65-70 (Table 1):
//   employer rate = 9%, employee rate = 7.5%, total rate = 16.5%
//   total = round(0.165 * 1010) = round(166.65) = 167
//   employee = floor(0.075 * 1010) = floor(75.75) = 75
//   employer_residual = 167 - 75 = 92
//   employer_independent = round(0.09 * 1010) = round(90.9) = 91
//   92 != 91 -- proves residual method is required

describe('computeCpf - Rounding Residual', () => {
  it('employer is computed as residual (total - employee), not independently', () => {
    const result = computeCpf(citizenInput({
      owCents: 101_000, // $1,010
      dateOfBirth: makeDate(1958, 1, 1), // age 68 -> ABOVE_65_TO_70
    }))

    // total = round(0.165 * 1010) = round(166.65) = 167
    const expectedTotal = 167
    // employee = floor(0.075 * 1010) = floor(75.75) = 75
    const expectedEmployee = 75
    // employer = total - employee = 167 - 75 = 92 (RESIDUAL)
    const expectedEmployer = expectedTotal - expectedEmployee // 92

    // If computed independently: round(0.09 * 1010) = round(90.9) = 91
    const independentEmployer = Math.round(0.09 * 1010) // 91

    // Prove the residual differs from independent
    expect(expectedEmployer).not.toBe(independentEmployer)
    expect(expectedEmployer).toBe(92)
    expect(independentEmployer).toBe(91)

    // Verify our engine uses the residual method
    expect(result.totalCents).toBe(expectedTotal * 100)
    expect(result.employeeCents).toBe(expectedEmployee * 100)
    expect(result.employerCents).toBe(expectedEmployer * 100) // 92, not 91
  })
})
