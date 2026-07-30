/**
 * Payroll compliance provider interface.
 *
 * This is the "seam" for multi-country support — each country implements this
 * interface, and the payroll engine calls through it rather than hardcoding
 * country-specific logic. Currently only Singapore is implemented.
 *
 * The generic engine (actions.ts) builds a StatutoryContributionContext from
 * raw employee/wage/period data using country-neutral field names. Each
 * provider maps that context into whatever internal shape its statutory scheme
 * requires (e.g. SG maps to CpfComputeInput, MY would map to EpfInput, etc).
 */

// ─────────────────────────────────────────────
// Generic statutory contribution types
// ─────────────────────────────────────────────

/**
 * Country-agnostic context that the payroll engine builds and passes to
 * the compliance provider. Contains raw employee and wage data — the
 * provider is responsible for interpreting these in its own statutory context.
 */
export interface StatutoryContributionContext {
  employee: {
    dateOfBirth: Date
    /** Country-specific status string — SG uses 'CITIZEN' | 'PR' | 'FOREIGNER'. */
    residencyStatus: string | null
    /** Date permanent residency began (SG-specific concept; null for other countries). */
    prStartDate: Date | null
    /** PR contribution arrangement (SG-specific; null for other countries). */
    prArrangement: string | null
  }
  /** Gross regular wages for this period (cents). Excludes bonuses. */
  grossWageCents: number
  /** Bonus / additional wages for this period (cents). */
  bonusWageCents: number
  /** End date of the pay period (determines applicable rates/age). */
  payPeriodEndDate: Date
  /** Year-to-date figures for ceiling/cap calculations. */
  yearToDate: {
    /** YTD regular wages already subject to statutory contributions (cents). */
    regularWageCents: number
    /** YTD total wages (regular + bonus) already subject to statutory contributions (cents). */
    totalWageCents: number
  }
}

/**
 * Country-agnostic result from statutory contribution computation.
 * The payroll engine uses only these fields for net pay and record persistence.
 */
export interface StatutoryContributionResult {
  totalCents: number
  employeeCents: number
  employerCents: number
  /**
   * Provider-specific detail values the engine persists to country-flavored
   * DB columns. Keys are provider-defined; the engine reads specific known
   * keys (e.g. 'cappedRegularWageCents') without branching on country code.
   *
   * For SG: { cappedRegularWageCents, cappedBonusWageCents }
   */
  details: Record<string, number>
}

// ─────────────────────────────────────────────
// Provider interface
// ─────────────────────────────────────────────

export interface PayrollComplianceProvider {
  countryCode: string

  /**
   * Compute statutory contributions (CPF for SG, EPF for MY, etc).
   * The provider maps the generic context into its own internal input shape.
   */
  computeStatutoryContribution(ctx: StatutoryContributionContext): StatutoryContributionResult

  /**
   * Is this employee within scope for statutory OT pay?
   * For SG: MOM Part IV thresholds — workmen ≤$4,500/month, others ≤$2,600/month.
   */
  isOvertimeEligible(basicMonthlyCents: number, isWorkman: boolean): boolean

  /**
   * Statutory hourly rate derivation from monthly basic salary.
   * Formula: (12 × monthly basic) / (52 × 44) for SG.
   */
  hourlyRateFromMonthlyCents(monthlyCents: number): number

  /**
   * Classify a wage component's timing (e.g. OW vs AW for SG).
   * Returns a string — the engine does not interpret the value; it's used
   * by the provider's own computeStatutoryContribution logic.
   */
  classifyWageTiming(earnedPeriodEnd: Date, paidDate: Date): 'OW' | 'AW'
}
