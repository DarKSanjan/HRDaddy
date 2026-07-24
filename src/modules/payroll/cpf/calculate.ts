/**
 * CPF Calculation Engine — Pure functions, no DB access.
 *
 * Computation order (prescribed by CPF Board):
 *   1. total = round_half_up(rate_total x wages) -> nearest dollar
 *   2. employee = floor(rate_employee x wages) -> drop cents
 *   3. employer = total - employee -> RESIDUAL (never computed independently)
 *
 * All internal calculations are in dollars (divide cents by 100),
 * then convert results back to cents.
 */
import type {
  AgeBand,
  WageBand,
  CpfTableNumber,
  CpfComputeInput,
  CpfResult,
  CpfAgeBandRates,
  ResidencyStatus,
  PrArrangement,
} from './types'
import { getCpfRateFixture } from '../rates'

// ─────────────────────────────────────────────
// Age Band Determination
// ─────────────────────────────────────────────

/**
 * Determine the CPF age band based on employee's age at the pay-period date.
 * Age is determined by completed years as of the last day of the pay period month.
 */
export function getAgeBand(dateOfBirth: Date, payPeriodDate: Date): AgeBand {
  const age = computeAge(dateOfBirth, payPeriodDate)

  if (age <= 55) return '55_AND_BELOW'
  if (age <= 60) return 'ABOVE_55_TO_60'
  if (age <= 65) return 'ABOVE_60_TO_65'
  if (age <= 70) return 'ABOVE_65_TO_70'
  return 'ABOVE_70'
}

/**
 * Compute completed years of age.
 */
function computeAge(dateOfBirth: Date, referenceDate: Date): number {
  const birthYear = dateOfBirth.getFullYear()
  const birthMonth = dateOfBirth.getMonth()
  const birthDay = dateOfBirth.getDate()

  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth()
  const refDay = referenceDate.getDate()

  let age = refYear - birthYear
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age--
  }
  return age
}

// ─────────────────────────────────────────────
// Wage Band Determination
// ─────────────────────────────────────────────

/**
 * Determine the wage band based on total wages in dollars.
 */
export function getWageBand(totalWagesDollars: number): WageBand {
  if (totalWagesDollars <= 50) return 'NIL'
  if (totalWagesDollars <= 500) return 'EMPLOYER_ONLY'
  if (totalWagesDollars <= 750) return 'GRADUATED'
  return 'FULL'
}

// ─────────────────────────────────────────────
// Table Selection
// ─────────────────────────────────────────────

/**
 * Determine which CPF contribution table to use.
 * - Citizens and PR 3rd year+: Table 1
 * - PR Year 1, Graduated/Graduated: Table 2
 * - PR Year 2, Graduated/Graduated: Table 3
 * - PR Year 1, Full/Graduated: Table 4
 * - PR Year 2, Full/Graduated: Table 5
 * - Foreigners: no table (return null)
 */
export function getCpfTable(
  residencyStatus: ResidencyStatus,
  prStartDate: Date | null,
  prArrangement: PrArrangement | null,
  payPeriodDate: Date
): CpfTableNumber | null {
  if (residencyStatus === 'FOREIGNER') return null
  if (residencyStatus === 'CITIZEN') return 1

  // PR status
  if (!prStartDate) return 1 // If no PR start date, assume 3rd year+

  const prYear = getPrYear(prStartDate, payPeriodDate)

  if (prYear >= 3) return 1

  if (prYear === 1) {
    if (prArrangement === 'FULL_GRADUATED') return 4
    return 2 // default to graduated/graduated
  }

  if (prYear === 2) {
    if (prArrangement === 'FULL_GRADUATED') return 5
    return 3 // default to graduated/graduated
  }

  return 1
}

/**
 * Determine which PR year the employee is in.
 * Year 1 = from PR start date to the end of the same calendar year.
 * Year 2 = the following calendar year.
 * Year 3+ = from the second calendar year onward.
 *
 * Actually, CPF defines PR year based on the calendar year:
 * - Year 1: the calendar year in which PR status began
 * - Year 2: the next calendar year
 * - Year 3+: from the third calendar year onward
 */
function getPrYear(prStartDate: Date, payPeriodDate: Date): number {
  const prStartYear = prStartDate.getFullYear()
  const payYear = payPeriodDate.getFullYear()

  const diff = payYear - prStartYear
  if (diff <= 0) return 1
  if (diff === 1) return 2
  return 3
}

// ─────────────────────────────────────────────
// OW and AW Ceilings
// ─────────────────────────────────────────────

/**
 * Apply the OW ceiling ($8,000/month).
 * Returns the capped OW in cents for this period.
 */
export function applyOwCeiling(owCents: number, owCeilingCents: number): number {
  return Math.min(owCents, owCeilingCents)
}

/**
 * Apply the AW ceiling.
 * AW ceiling = Annual ceiling - YTD OW subject to CPF.
 * Returns the capped AW in cents for this period.
 */
export function applyAwCeiling(
  awCents: number,
  ytdOwCents: number,
  annualCeilingCents: number
): number {
  const awCeiling = Math.max(0, annualCeilingCents - ytdOwCents)
  return Math.min(awCents, awCeiling)
}

// ─────────────────────────────────────────────
// Core CPF Computation
// ─────────────────────────────────────────────

/**
 * Compute CPF contributions for a single employee for a single pay period.
 * Returns zero contributions for foreigners.
 */
export function computeCpf(input: CpfComputeInput): CpfResult {
  const zeroResult: CpfResult = {
    totalCents: 0,
    employeeCents: 0,
    employerCents: 0,
    cappedOwCents: 0,
    cappedAwCents: 0,
  }

  // Foreigners have no CPF
  if (input.residencyStatus === 'FOREIGNER') return zeroResult

  const fixture = getCpfRateFixture(input.payPeriodDate)
  const tableNumber = getCpfTable(
    input.residencyStatus,
    input.prStartDate,
    input.prArrangement,
    input.payPeriodDate
  )

  if (tableNumber === null) return zeroResult

  const table = fixture.tables.find((t) => t.tableNumber === tableNumber)
  if (!table) {
    throw new Error(`CPF rate table ${tableNumber} not found in fixture effective ${fixture.effectiveFrom}`)
  }

  const ageBand = getAgeBand(input.dateOfBirth, input.payPeriodDate)
  const rates = table.bands.find((b) => b.ageBand === ageBand)
  if (!rates) {
    throw new Error(`No rates found for age band ${ageBand} in table ${tableNumber}`)
  }

  // Apply OW ceiling
  const cappedOwCents = applyOwCeiling(input.owCents, fixture.owCeilingCentsPerMonth)

  // Apply AW ceiling: annual ceiling - YTD OW (including this period's capped OW)
  const ytdOwAfterThisPeriod = input.ytdOwCents + cappedOwCents
  const cappedAwCents = applyAwCeiling(input.awCents, ytdOwAfterThisPeriod, fixture.annualCeilingCents)

  // Total wages subject to CPF
  const totalWagesCents = cappedOwCents + cappedAwCents

  if (totalWagesCents <= 0) return zeroResult

  // Convert to dollars for computation
  const totalWagesDollars = totalWagesCents / 100

  // Determine wage band
  const wageBand = getWageBand(totalWagesDollars)

  if (wageBand === 'NIL') return zeroResult

  // Compute contributions based on wage band
  const result = computeForWageBand(totalWagesDollars, wageBand, rates)

  return {
    totalCents: result.totalCents,
    employeeCents: result.employeeCents,
    employerCents: result.employerCents,
    cappedOwCents,
    cappedAwCents,
  }
}

/**
 * Compute CPF based on wage band using prescribed rounding:
 *   total = round_half_up(rate x wages) -> Math.round()
 *   employee = floor(rate x wages) -> Math.floor()
 *   employer = total - employee (RESIDUAL)
 */
function computeForWageBand(
  totalWagesDollars: number,
  wageBand: WageBand,
  rates: CpfAgeBandRates
): { totalCents: number; employeeCents: number; employerCents: number } {
  switch (wageBand) {
    case 'NIL':
      return { totalCents: 0, employeeCents: 0, employerCents: 0 }

    case 'EMPLOYER_ONLY': {
      // Only employer contributes; employee share is zero
      const totalDollars = Math.round(rates.employerRate * totalWagesDollars)
      return {
        totalCents: totalDollars * 100,
        employeeCents: 0,
        employerCents: totalDollars * 100,
      }
    }

    case 'GRADUATED': {
      // Employer: full employer rate x TW
      // Employee: graduated k x (TW - 500)
      // Total = employer + employee (both computed independently for this band)
      const employerDollars = Math.round(rates.employerRate * totalWagesDollars)
      const employeeDollars = Math.floor(rates.graduatedK * (totalWagesDollars - 500))
      const totalDollars = employerDollars + employeeDollars
      return {
        totalCents: totalDollars * 100,
        employeeCents: employeeDollars * 100,
        employerCents: employerDollars * 100,
      }
    }

    case 'FULL': {
      // Prescribed computation order:
      // 1. total = round(totalRate x wages)
      // 2. employee = floor(employeeRate x wages)
      // 3. employer = total - employee (RESIDUAL)
      const totalDollars = Math.round(rates.totalRate * totalWagesDollars)
      const employeeDollars = Math.floor(rates.employeeRate * totalWagesDollars)
      const employerDollars = totalDollars - employeeDollars
      return {
        totalCents: totalDollars * 100,
        employeeCents: employeeDollars * 100,
        employerCents: employerDollars * 100,
      }
    }

    default:
      return { totalCents: 0, employeeCents: 0, employerCents: 0 }
  }
}
