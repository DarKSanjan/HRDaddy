/**
 * Compliance provider registry.
 *
 * Adding a new country means:
 * 1. Write a new file (e.g. ./my.ts) implementing PayrollComplianceProvider
 * 2. Add one case to the switch below
 *
 * No other file in the payroll engine needs to change.
 */
import type { PayrollComplianceProvider } from './types'
import { sgComplianceProvider } from './sg'

export type { PayrollComplianceProvider } from './types'

/**
 * Get the compliance provider for a given country code.
 * Throws a clear error for unsupported countries.
 */
export function getComplianceProvider(countryCode: string): PayrollComplianceProvider {
  switch (countryCode) {
    case 'SG':
      return sgComplianceProvider
    default:
      throw new Error(
        `Payroll compliance for country "${countryCode}" is not supported yet. ` +
        `To add support, implement PayrollComplianceProvider in src/modules/payroll/compliance/ ` +
        `and register it in the getComplianceProvider switch.`
      )
  }
}
