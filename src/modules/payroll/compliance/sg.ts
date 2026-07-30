/**
 * Singapore payroll compliance provider.
 *
 * Encodes:
 * - MOM Employment Act Part IV overtime thresholds and formulas
 * - CPF Board OW/AW classification rules
 *
 * This file is the ONLY place that should know the numbers:
 *   4500, 2600, 1.5, 72, 44, 52, 14
 *
 * Sources:
 * - MOM overtime pay guidance (mom.gov.sg)
 * - CPF Board OW/AW guidance (ask.gov.sg/cpf)
 */
import type { PayrollComplianceProvider, StatutoryContributionContext, StatutoryContributionResult } from './types'
import type { CpfComputeInput, ResidencyStatus, PrArrangement } from '../cpf/types'
import { computeCpf } from '../cpf/calculate'

/**
 * MOM Employment Act Part IV thresholds (monthly basic salary in cents):
 * - Workmen: ≤$4,500/month
 * - Non-workmen: ≤$2,600/month
 */
const WORKMAN_THRESHOLD_CENTS = 450_000
const NON_WORKMAN_THRESHOLD_CENTS = 260_000

/**
 * MOM-prescribed hourly rate formula constants:
 * hourlyRate = (12 × monthlyBasic) / (52 × 44)
 */
const MONTHS_PER_YEAR = 12
const WEEKS_PER_YEAR = 52
const STANDARD_HOURS_PER_WEEK = 44

/**
 * MOM statutory OT cap: 72 hours per month.
 * Exposed for external checks (the payroll engine flags when exceeded).
 */
export const MOM_OT_CAP_HOURS = 72

/**
 * CPF OW/AW deadline: wages must be paid by the 14th of the following month
 * to classify as OW.
 */
const OW_DEADLINE_DAY = 14

export const sgComplianceProvider: PayrollComplianceProvider = {
  countryCode: 'SG',

  computeStatutoryContribution(ctx: StatutoryContributionContext): StatutoryContributionResult {
    // Map generic context → SG-specific CpfComputeInput
    const cpfInput: CpfComputeInput = {
      owCents: ctx.grossWageCents,
      awCents: ctx.bonusWageCents,
      dateOfBirth: ctx.employee.dateOfBirth,
      payPeriodDate: ctx.payPeriodEndDate,
      residencyStatus: (ctx.employee.residencyStatus ?? 'CITIZEN') as ResidencyStatus,
      prStartDate: ctx.employee.prStartDate ?? null,
      prArrangement: (ctx.employee.prArrangement ?? null) as PrArrangement | null,
      ytdOwCents: ctx.yearToDate.regularWageCents,
      ytdTotalCents: ctx.yearToDate.totalWageCents,
    }

    const cpfResult = computeCpf(cpfInput)

    // Map CpfResult → generic StatutoryContributionResult
    return {
      totalCents: cpfResult.totalCents,
      employeeCents: cpfResult.employeeCents,
      employerCents: cpfResult.employerCents,
      details: {
        cappedRegularWageCents: cpfResult.cappedOwCents,
        cappedBonusWageCents: cpfResult.cappedAwCents,
      },
    }
  },

  isOvertimeEligible(basicMonthlyCents: number, isWorkman: boolean): boolean {
    const threshold = isWorkman ? WORKMAN_THRESHOLD_CENTS : NON_WORKMAN_THRESHOLD_CENTS
    return basicMonthlyCents <= threshold
  },

  hourlyRateFromMonthlyCents(monthlyCents: number): number {
    // (12 × monthly basic salary) / (52 × 44) — result in cents
    return (MONTHS_PER_YEAR * monthlyCents) / (WEEKS_PER_YEAR * STANDARD_HOURS_PER_WEEK)
  },

  classifyWageTiming(earnedPeriodEnd: Date, paidDate: Date): 'OW' | 'AW' {
    // OW if paid by 14th of the month following the earned period end
    const deadlineMonth = earnedPeriodEnd.getMonth() + 1
    const deadlineYear =
      deadlineMonth > 11
        ? earnedPeriodEnd.getFullYear() + 1
        : earnedPeriodEnd.getFullYear()
    const deadlineDate = new Date(deadlineYear, deadlineMonth % 12, OW_DEADLINE_DAY, 23, 59, 59, 999)

    return paidDate <= deadlineDate ? 'OW' : 'AW'
  },
}
