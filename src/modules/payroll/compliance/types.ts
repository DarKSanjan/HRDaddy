/**
 * Payroll compliance provider interface.
 *
 * This is the "seam" for multi-country support — each country implements this
 * interface, and the payroll engine calls through it rather than hardcoding
 * SG-specific logic. Currently only Singapore is implemented.
 */
import type { CpfComputeInput, CpfResult } from '../cpf/types'

export interface PayrollComplianceProvider {
  countryCode: string

  /** Statutory contribution engine (CPF for SG). */
  computeStatutoryContribution(input: CpfComputeInput): CpfResult

  /**
   * Is this employee within scope for statutory OT pay?
   * For SG: MOM Part IV thresholds — workmen ≤$4,500/month, others ≤$2,600/month.
   */
  isOvertimeEligible(basicMonthlyCents: number, isWorkman: boolean): boolean

  /**
   * MOM-prescribed hourly rate derivation from monthly basic salary.
   * Formula: (12 × monthly basic) / (52 × 44)
   */
  hourlyRateFromMonthlyCents(monthlyCents: number): number

  /**
   * OW vs AW classification for a wage component.
   * OW if paid by the 14th of the month following the period it was earned in;
   * otherwise AW.
   *
   * Edge case note: OT paid late (after 14th of following month) should be
   * reclassified as AW. Full remediation flow is out of scope for M12 — flagged
   * here for future implementation.
   */
  classifyWageTiming(earnedPeriodEnd: Date, paidDate: Date): 'OW' | 'AW'
}
