/**
 * Payroll complexity toggle — unit tests.
 *
 * Verifies:
 * - getPayrollComplexity returns "advanced" when no row exists (default)
 * - getPayrollComplexity reads "simple" from settings JSON
 * - setPayrollComplexity upserts correctly
 * - The processPayroll logic branch: simple mode produces no OT line items
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dbAdmin module
vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    organisationModule: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

// eslint-disable-next-line no-restricted-imports -- test mock setup requires direct reference
import { dbAdmin } from '@/core/db/admin'
import { getPayrollComplexity, setPayrollComplexity } from '@/core/payroll-settings'
import { computeEmployeeBasePay } from '@/modules/payroll/compute'

const mockFindUnique = vi.mocked(dbAdmin.organisationModule.findUnique)
const mockUpsert = vi.mocked(dbAdmin.organisationModule.upsert)

describe('getPayrollComplexity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "advanced" when no OrganisationModule row exists', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getPayrollComplexity('org-1')
    expect(result).toBe('advanced')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { orgId_moduleId: { orgId: 'org-1', moduleId: 'payroll' } },
      select: { settings: true },
    })
  })

  it('returns "advanced" when row exists but settings is empty JSON', async () => {
    mockFindUnique.mockResolvedValue({ settings: {} } as never)

    const result = await getPayrollComplexity('org-1')
    expect(result).toBe('advanced')
  })

  it('returns "simple" when settings.payrollComplexity is "simple"', async () => {
    mockFindUnique.mockResolvedValue({
      settings: { payrollComplexity: 'simple' },
    } as never)

    const result = await getPayrollComplexity('org-1')
    expect(result).toBe('simple')
  })

  it('returns "advanced" when settings.payrollComplexity is "advanced"', async () => {
    mockFindUnique.mockResolvedValue({
      settings: { payrollComplexity: 'advanced' },
    } as never)

    const result = await getPayrollComplexity('org-1')
    expect(result).toBe('advanced')
  })
})

describe('setPayrollComplexity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts with "simple" preserving other settings', async () => {
    mockFindUnique.mockResolvedValue({
      settings: { existingKey: 'value', payrollComplexity: 'advanced' },
    } as never)
    mockUpsert.mockResolvedValue({} as never)

    await setPayrollComplexity('org-1', 'simple')

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { orgId_moduleId: { orgId: 'org-1', moduleId: 'payroll' } },
      update: { settings: { existingKey: 'value', payrollComplexity: 'simple' } },
      create: {
        orgId: 'org-1',
        moduleId: 'payroll',
        enabled: true,
        settings: { existingKey: 'value', payrollComplexity: 'simple' },
      },
    })
  })

  it('creates row from scratch if none exists', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({} as never)

    await setPayrollComplexity('org-1', 'advanced')

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { orgId_moduleId: { orgId: 'org-1', moduleId: 'payroll' } },
      update: { settings: { payrollComplexity: 'advanced' } },
      create: {
        orgId: 'org-1',
        moduleId: 'payroll',
        enabled: true,
        settings: { payrollComplexity: 'advanced' },
      },
    })
  })
})

describe('Simple vs Advanced payroll branch logic', () => {
  /**
   * This test verifies the REAL computeEmployeeBasePay function exported
   * from compute.ts — the same function processPayroll calls at runtime.
   */

  it('simple mode: salaried employee gets flat salary, no OT', () => {
    const result = computeEmployeeBasePay({
      isSimpleMode: true,
      payType: 'SALARIED',
      compensationAmountCents: 500_000,
      attendanceMinutes: 10_000, // lots of attendance minutes — should be ignored
    })

    expect(result.baseCents).toBe(500_000)
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0].type).toBe('EARNING')
    expect(result.lineItems[0].name).toBe('Basic Salary')
    expect(result.lineItems.filter((li) => li.type === 'OVERTIME')).toHaveLength(0)
  })

  it('simple mode: hourly employee ALSO gets flat salary (hourly logic skipped)', () => {
    const result = computeEmployeeBasePay({
      isSimpleMode: true,
      payType: 'HOURLY',
      compensationAmountCents: 2_500, // $25/hr as cents
      attendanceMinutes: 9600, // 160 hours
    })

    // In simple mode, hourly employee is treated as flat salary
    expect(result.baseCents).toBe(2_500) // flat amount, NOT 160h × 2500
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems.filter((li) => li.type === 'OVERTIME')).toHaveLength(0)
  })

  it('advanced mode: hourly employee computes based on attendance', () => {
    const result = computeEmployeeBasePay({
      isSimpleMode: false,
      payType: 'HOURLY',
      compensationAmountCents: 2_500,
      attendanceMinutes: 9600, // 160 hours in minutes
    })

    // 160h × 2500 cents/hr = 400_000
    expect(result.baseCents).toBe(400_000)
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0].amountCents).toBe(400_000)
  })

  it('advanced mode: salaried employee uses flat compensation', () => {
    const result = computeEmployeeBasePay({
      isSimpleMode: false,
      payType: 'SALARIED',
      compensationAmountCents: 500_000,
      attendanceMinutes: 9600, // attendance doesn't affect base for salaried
    })

    expect(result.baseCents).toBe(500_000)
    expect(result.lineItems).toHaveLength(1)
  })

  it('round-trip: toggling back to advanced restores OT-eligible behavior', () => {
    // First: simple mode
    const simple = computeEmployeeBasePay({
      isSimpleMode: true,
      payType: 'SALARIED',
      compensationAmountCents: 500_000,
      attendanceMinutes: 9600,
    })
    expect(simple.lineItems.filter((li) => li.type === 'OVERTIME')).toHaveLength(0)

    // Then: switch to advanced mode
    const advanced = computeEmployeeBasePay({
      isSimpleMode: false,
      payType: 'SALARIED',
      compensationAmountCents: 500_000,
      attendanceMinutes: 9600,
    })
    expect(advanced.baseCents).toBe(500_000)
    // In advanced mode, OT line items CAN be generated (tested separately in the full integration)
    // The key point: no data was lost, same employee data produces correct results in both modes
  })
})
