/**
 * Unit tests for query-level sensitive field visibility.
 *
 * These tests validate the LOGIC of who can see sensitive fields,
 * independent of the database (mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only (it throws when imported outside RSC)
vi.mock('server-only', () => ({}))

// Mock dbAs to invoke the callback with a mock transaction client
vi.mock('@/core/db', () => ({
  dbAs: vi.fn(),
}))

import { dbAs } from '@/core/db'
import { getEmployeeProfile } from '../queries'

const mockDbAs = vi.mocked(dbAs)

describe('Sensitive Field Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseEmployee = {
    id: 'emp-1',
    orgId: 'org-1',
    userId: 'user-emp',
    firstName: 'Jane',
    lastName: 'Doe',
    workEmail: 'jane@company.com',
    employmentStatus: 'ACTIVE',
    startDate: new Date(),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: null,
    jobTitle: null,
    location: null,
    employmentType: null,
    manager: null,
    directReports: [],
  }

  const sensitiveFields = {
    personalEmail: 'jane@personal.com',
    phone: '555-1234',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'female',
    nationalId: '123-456',
    address: '123 Main St',
    compensationAmountCents: 750000,
    compensationCurrency: 'USD',
  }

  /**
   * getEmployeeProfile makes ONE dbAs call containing TWO findFirst calls:
   * 1. Get employee userId for visibility check
   * 2. Get full profile with conditional select
   *
   * We capture the select from the second call.
   */
  function setupMockWithCapture(employeeUserId: string | null) {
    let capturedSelect: Record<string, unknown> | null = null
    let findFirstCallCount = 0

    mockDbAs.mockImplementation(async (_userId: unknown, fn: unknown) => {
      const callback = fn as (tx: unknown) => Promise<unknown>

      const mockFindFirst = vi.fn().mockImplementation((args: { select?: Record<string, unknown> }) => {
        findFirstCallCount++
        if (findFirstCallCount === 1) {
          // First findFirst: userId lookup
          return Promise.resolve(
            employeeUserId !== null ? { userId: employeeUserId } : null
          )
        }
        // Second findFirst: full profile with select
        capturedSelect = args?.select ?? null
        return Promise.resolve({ ...baseEmployee, ...sensitiveFields })
      })

      return callback({
        employee: { findFirst: mockFindFirst },
      })
    })

    return { getCapturedSelect: () => capturedSelect }
  }

  it('OWNER can see all sensitive fields (select includes them as true)', async () => {
    const { getCapturedSelect } = setupMockWithCapture('user-emp')

    await getEmployeeProfile('admin-user', 'OWNER', 'org-1', 'emp-1')

    const select = getCapturedSelect()
    expect(select).not.toBeNull()
    expect(select!['personalEmail']).toBe(true)
    expect(select!['phone']).toBe(true)
    expect(select!['dateOfBirth']).toBe(true)
    expect(select!['nationalId']).toBe(true)
    expect(select!['address']).toBe(true)
    expect(select!['compensationAmountCents']).toBe(true)
    expect(select!['compensationCurrency']).toBe(true)
  })

  it('HR_ADMIN can see all sensitive fields', async () => {
    const { getCapturedSelect } = setupMockWithCapture('user-emp')

    await getEmployeeProfile('admin-user', 'HR_ADMIN', 'org-1', 'emp-1')

    const select = getCapturedSelect()
    expect(select).not.toBeNull()
    expect(select!['personalEmail']).toBe(true)
    expect(select!['phone']).toBe(true)
    expect(select!['compensationAmountCents']).toBe(true)
  })

  it('employee viewing their OWN profile sees sensitive fields', async () => {
    const { getCapturedSelect } = setupMockWithCapture('user-emp')

    // Viewer userId matches employee userId
    await getEmployeeProfile('user-emp', 'EMPLOYEE', 'org-1', 'emp-1')

    const select = getCapturedSelect()
    expect(select).not.toBeNull()
    expect(select!['personalEmail']).toBe(true)
    expect(select!['phone']).toBe(true)
    expect(select!['dateOfBirth']).toBe(true)
    expect(select!['nationalId']).toBe(true)
    expect(select!['address']).toBe(true)
    expect(select!['compensationAmountCents']).toBe(true)
  })

  it('MANAGER viewing a report does NOT get sensitive fields in select', async () => {
    const { getCapturedSelect } = setupMockWithCapture('user-emp')

    // Viewer is a manager, not the employee themselves
    await getEmployeeProfile('manager-user', 'MANAGER', 'org-1', 'emp-1')

    const select = getCapturedSelect()
    expect(select).not.toBeNull()
    expect(select!['personalEmail']).toBe(false)
    expect(select!['phone']).toBe(false)
    expect(select!['dateOfBirth']).toBe(false)
    expect(select!['nationalId']).toBe(false)
    expect(select!['address']).toBe(false)
    expect(select!['compensationAmountCents']).toBe(false)
    expect(select!['compensationCurrency']).toBe(false)
  })

  it('EMPLOYEE viewing another employee does NOT get sensitive fields', async () => {
    const { getCapturedSelect } = setupMockWithCapture('other-user')

    await getEmployeeProfile('viewer-user', 'EMPLOYEE', 'org-1', 'emp-1')

    const select = getCapturedSelect()
    expect(select).not.toBeNull()
    expect(select!['personalEmail']).toBe(false)
    expect(select!['phone']).toBe(false)
    expect(select!['dateOfBirth']).toBe(false)
    expect(select!['nationalId']).toBe(false)
    expect(select!['address']).toBe(false)
    expect(select!['compensationAmountCents']).toBe(false)
    expect(select!['compensationCurrency']).toBe(false)
  })

  it('returns null for non-existent employee', async () => {
    setupMockWithCapture(null) // first findFirst returns null

    const result = await getEmployeeProfile('admin-user', 'OWNER', 'org-1', 'non-existent')
    expect(result).toBeNull()
  })
})
