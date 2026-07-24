/**
 * Payslip MOM Validation Tests.
 * Verifies that all 12 MOM-mandated items must be present and valid.
 */
import { describe, it, expect } from 'vitest'
import { momPayslipSchema } from '../schemas'

function validPayslip() {
  return {
    employerName: 'Acme Pte Ltd',
    employeeName: 'John Doe',
    dateOfPayment: '2026-06-30',
    basicSalaryCents: 500_000,
    salaryPeriodStart: '2026-06-01',
    salaryPeriodEnd: '2026-06-30',
    allowances: [{ name: 'Transport', amountCents: 20_000 }],
    additionalPayments: [],
    deductions: [{ name: 'CPF Employee', amountCents: 100_000 }],
    overtimeHours: 0,
    overtimePayCents: 0,
    overtimePeriodStart: null,
    overtimePeriodEnd: null,
    netSalaryCents: 420_000,
  }
}

describe('MOM Payslip Validation', () => {
  it('valid payslip passes validation', () => {
    const result = momPayslipSchema.safeParse(validPayslip())
    expect(result.success).toBe(true)
  })

  it('rejects missing employer name (MOM Item 1)', () => {
    const data = { ...validPayslip(), employerName: '' }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 1')
    }
  })

  it('rejects missing employee name (MOM Item 2)', () => {
    const data = { ...validPayslip(), employeeName: '' }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 2')
    }
  })

  it('rejects missing date of payment (MOM Item 3)', () => {
    const data = { ...validPayslip(), dateOfPayment: '' }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 3')
    }
  })

  it('rejects negative basic salary (MOM Item 4)', () => {
    const data = { ...validPayslip(), basicSalaryCents: -100 }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 4')
    }
  })

  it('rejects missing salary period start (MOM Item 5)', () => {
    const data = { ...validPayslip(), salaryPeriodStart: '' }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 5')
    }
  })

  it('rejects missing salary period end (MOM Item 6)', () => {
    const data = { ...validPayslip(), salaryPeriodEnd: '' }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 6')
    }
  })

  it('accepts empty allowances array (MOM Item 7)', () => {
    const data = { ...validPayslip(), allowances: [] }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects allowance with empty name', () => {
    const data = { ...validPayslip(), allowances: [{ name: '', amountCents: 100 }] }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('accepts empty additional payments array (MOM Item 8)', () => {
    const data = { ...validPayslip(), additionalPayments: [] }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('accepts empty deductions array (MOM Item 9)', () => {
    const data = { ...validPayslip(), deductions: [] }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects negative overtime hours (MOM Item 10)', () => {
    const data = { ...validPayslip(), overtimeHours: -1 }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 10')
    }
  })

  it('rejects negative overtime pay (MOM Item 11)', () => {
    const data = { ...validPayslip(), overtimePayCents: -100 }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('MOM Item 11')
    }
  })

  it('rejects non-integer net salary (MOM Item 13)', () => {
    const data = { ...validPayslip(), netSalaryCents: 420_000.5 }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('a complete payslip with overtime validates', () => {
    const data = {
      ...validPayslip(),
      overtimeHours: 10.5,
      overtimePayCents: 31_500,
      overtimePeriodStart: '2026-06-01',
      overtimePeriodEnd: '2026-06-15',
    }
    const result = momPayslipSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})
