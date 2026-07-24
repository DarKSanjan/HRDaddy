/**
 * CPF calculation types for Singapore payroll.
 */

export type AgeBand = '55_AND_BELOW' | 'ABOVE_55_TO_60' | 'ABOVE_60_TO_65' | 'ABOVE_65_TO_70' | 'ABOVE_70'

export type WageBand = 'NIL' | 'EMPLOYER_ONLY' | 'GRADUATED' | 'FULL'

export type CpfTableNumber = 1 | 2 | 3 | 4 | 5

export type ResidencyStatus = 'CITIZEN' | 'PR' | 'FOREIGNER'

export type PrArrangement = 'GRADUATED_GRADUATED' | 'FULL_GRADUATED'

export interface CpfAgeBandRates {
  ageBand: AgeBand
  employerRate: number
  employeeRate: number
  totalRate: number
  /** Graduated employee k-factor for wage band $500-$750 */
  graduatedK: number
}

export interface CpfRateTable {
  tableNumber: CpfTableNumber
  description: string
  bands: CpfAgeBandRates[]
}

export interface CpfRateFixture {
  effectiveFrom: string
  sourceUrl: string
  sourceSha256: string
  owCeilingCentsPerMonth: number
  annualCeilingCents: number
  tables: CpfRateTable[]
}

export interface CpfComputeInput {
  /** Ordinary wages in cents */
  owCents: number
  /** Additional wages in cents (bonus etc.) */
  awCents: number
  /** Employee date of birth */
  dateOfBirth: Date
  /** Pay period end date (determines age and rate fixture) */
  payPeriodDate: Date
  /** Residency status */
  residencyStatus: ResidencyStatus
  /** Date PR status began (null for citizens/foreigners) */
  prStartDate: Date | null
  /** PR arrangement (null for citizens/foreigners/PR 3rd year+) */
  prArrangement: PrArrangement | null
  /** Year-to-date OW already subject to CPF (cents) */
  ytdOwCents: number
  /** Year-to-date total wages (OW+AW) already subject to CPF (cents) */
  ytdTotalCents: number
}

export interface CpfResult {
  totalCents: number
  employeeCents: number
  employerCents: number
  /** Capped OW used this period (cents) */
  cappedOwCents: number
  /** Capped AW used this period (cents) */
  cappedAwCents: number
}
