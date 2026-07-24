/**
 * CPF contribution rate tables effective 1 January 2026.
 * Source: CPF Board contribution rate tables.
 *
 * All rates are expressed as decimals (e.g. 0.17 = 17%).
 * The `graduatedK` is the employee contribution multiplier for wage band $500-$750.
 */
import type { CpfRateFixture } from '../cpf/types'

export const CPF_RATES_2026_01_01: CpfRateFixture = {
  effectiveFrom: '2026-01-01',
  sourceUrl: 'https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay',
  sourceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  owCeilingCentsPerMonth: 800_000, // $8,000
  annualCeilingCents: 10_200_000, // $102,000

  tables: [
    // ─────────────────────────────────────────────
    // Table 1: Citizens & PR 3rd year+
    // ─────────────────────────────────────────────
    {
      tableNumber: 1,
      description: 'Singapore Citizens and SPR (3rd year onwards)',
      bands: [
        { ageBand: '55_AND_BELOW', employerRate: 0.17, employeeRate: 0.20, totalRate: 0.37, graduatedK: 0.6 },
        { ageBand: 'ABOVE_55_TO_60', employerRate: 0.16, employeeRate: 0.18, totalRate: 0.34, graduatedK: 0.54 },
        { ageBand: 'ABOVE_60_TO_65', employerRate: 0.125, employeeRate: 0.125, totalRate: 0.25, graduatedK: 0.375 },
        { ageBand: 'ABOVE_65_TO_70', employerRate: 0.09, employeeRate: 0.075, totalRate: 0.165, graduatedK: 0.225 },
        { ageBand: 'ABOVE_70', employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125, graduatedK: 0.15 },
      ],
    },

    // ─────────────────────────────────────────────
    // Table 2: PR Year 1, Graduated/Graduated
    // ─────────────────────────────────────────────
    {
      tableNumber: 2,
      description: 'SPR 1st year (Graduated employer, Graduated employee)',
      bands: [
        { ageBand: '55_AND_BELOW', employerRate: 0.04, employeeRate: 0.05, totalRate: 0.09, graduatedK: 0.15 },
        { ageBand: 'ABOVE_55_TO_60', employerRate: 0.04, employeeRate: 0.05, totalRate: 0.09, graduatedK: 0.15 },
        { ageBand: 'ABOVE_60_TO_65', employerRate: 0.035, employeeRate: 0.05, totalRate: 0.085, graduatedK: 0.15 },
        { ageBand: 'ABOVE_65_TO_70', employerRate: 0.035, employeeRate: 0.05, totalRate: 0.085, graduatedK: 0.15 },
        { ageBand: 'ABOVE_70', employerRate: 0.035, employeeRate: 0.05, totalRate: 0.085, graduatedK: 0.15 },
      ],
    },

    // ─────────────────────────────────────────────
    // Table 3: PR Year 2, Graduated/Graduated
    // ─────────────────────────────────────────────
    {
      tableNumber: 3,
      description: 'SPR 2nd year (Graduated employer, Graduated employee)',
      bands: [
        { ageBand: '55_AND_BELOW', employerRate: 0.09, employeeRate: 0.15, totalRate: 0.24, graduatedK: 0.45 },
        { ageBand: 'ABOVE_55_TO_60', employerRate: 0.06, employeeRate: 0.125, totalRate: 0.185, graduatedK: 0.375 },
        { ageBand: 'ABOVE_60_TO_65', employerRate: 0.035, employeeRate: 0.075, totalRate: 0.11, graduatedK: 0.225 },
        { ageBand: 'ABOVE_65_TO_70', employerRate: 0.035, employeeRate: 0.05, totalRate: 0.085, graduatedK: 0.15 },
        { ageBand: 'ABOVE_70', employerRate: 0.035, employeeRate: 0.05, totalRate: 0.085, graduatedK: 0.15 },
      ],
    },

    // ─────────────────────────────────────────────
    // Table 4: PR Year 1, Full employer / Graduated employee
    // ─────────────────────────────────────────────
    {
      tableNumber: 4,
      description: 'SPR 1st year (Full employer, Graduated employee)',
      bands: [
        { ageBand: '55_AND_BELOW', employerRate: 0.17, employeeRate: 0.05, totalRate: 0.22, graduatedK: 0.15 },
        { ageBand: 'ABOVE_55_TO_60', employerRate: 0.16, employeeRate: 0.05, totalRate: 0.21, graduatedK: 0.15 },
        { ageBand: 'ABOVE_60_TO_65', employerRate: 0.125, employeeRate: 0.05, totalRate: 0.175, graduatedK: 0.15 },
        { ageBand: 'ABOVE_65_TO_70', employerRate: 0.09, employeeRate: 0.05, totalRate: 0.14, graduatedK: 0.15 },
        { ageBand: 'ABOVE_70', employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125, graduatedK: 0.15 },
      ],
    },

    // ─────────────────────────────────────────────
    // Table 5: PR Year 2, Full employer / Graduated employee
    // ─────────────────────────────────────────────
    {
      tableNumber: 5,
      description: 'SPR 2nd year (Full employer, Graduated employee)',
      bands: [
        { ageBand: '55_AND_BELOW', employerRate: 0.17, employeeRate: 0.15, totalRate: 0.32, graduatedK: 0.45 },
        { ageBand: 'ABOVE_55_TO_60', employerRate: 0.16, employeeRate: 0.125, totalRate: 0.285, graduatedK: 0.375 },
        { ageBand: 'ABOVE_60_TO_65', employerRate: 0.125, employeeRate: 0.075, totalRate: 0.2, graduatedK: 0.225 },
        { ageBand: 'ABOVE_65_TO_70', employerRate: 0.09, employeeRate: 0.05, totalRate: 0.14, graduatedK: 0.15 },
        { ageBand: 'ABOVE_70', employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125, graduatedK: 0.15 },
      ],
    },
  ],
}
