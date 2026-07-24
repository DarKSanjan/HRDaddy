/**
 * CPF rate fixture selector.
 * Selects the applicable rate table based on pay-period date.
 * When multiple fixtures exist, selects the one with the latest effectiveFrom
 * that is <= the pay-period date.
 */
import type { CpfRateFixture } from '../cpf/types'
import { CPF_RATES_2026_01_01 } from './cpf-2026-01-01'

const FIXTURES: CpfRateFixture[] = [
  CPF_RATES_2026_01_01,
]

/**
 * Get the applicable CPF rate fixture for a given pay-period date.
 * Returns the fixture with the latest effectiveFrom that is on or before the date.
 * Throws if no applicable fixture is found.
 */
export function getCpfRateFixture(payPeriodDate: Date): CpfRateFixture {
  const dateStr = payPeriodDate.toISOString().slice(0, 10)

  const applicable = FIXTURES
    .filter((f) => f.effectiveFrom <= dateStr)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))

  if (applicable.length === 0) {
    throw new Error(
      `No CPF rate fixture found for pay-period date ${dateStr}. ` +
      `Earliest available fixture is effective from ${FIXTURES[0]?.effectiveFrom ?? 'none'}.`
    )
  }

  return applicable[0]
}
