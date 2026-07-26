/**
 * Pure computation functions extracted from processPayroll for independent testability.
 */

export interface BasePayInput {
  isSimpleMode: boolean
  payType: 'SALARIED' | 'HOURLY'
  compensationAmountCents: number
  attendanceMinutes: number
}

export interface BasePayResult {
  baseCents: number
  lineItems: Array<{ type: string; name: string; amountCents: number }>
}

/**
 * Computes the base pay for a single employee given the payroll complexity mode.
 *
 * - Simple mode: flat salary for all employees regardless of payType.
 * - Advanced mode: branches on payType — hourly employees get hours × rate,
 *   salaried employees get flat compensation.
 *
 * This is the exact logic that runs inside processPayroll, extracted here
 * so it can be unit-tested without DB context.
 */
export function computeEmployeeBasePay(input: BasePayInput): BasePayResult {
  const { isSimpleMode, payType, compensationAmountCents, attendanceMinutes } = input
  const lineItems: Array<{ type: string; name: string; amountCents: number }> = []
  let baseCents: number

  if (isSimpleMode) {
    // Simple mode: flat salary for all, regardless of payType
    baseCents = compensationAmountCents
    lineItems.push({ type: 'EARNING', name: 'Basic Salary', amountCents: baseCents })
  } else {
    // Advanced mode: branch on payType
    if (payType === 'HOURLY') {
      const totalHoursWorked = attendanceMinutes / 60
      baseCents = Math.round(totalHoursWorked * compensationAmountCents)
    } else {
      baseCents = compensationAmountCents
    }
    lineItems.push({ type: 'EARNING', name: 'Basic Salary', amountCents: baseCents })
  }

  return { baseCents, lineItems }
}
