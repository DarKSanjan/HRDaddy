import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/core/db/client', () => ({
  dbAs: vi.fn(),
}))
vi.mock('@/core/permissions', () => ({
  hasPermission: vi.fn(),
}))

import { dbAs } from '@/core/db/client'
import { hasPermission } from '@/core/permissions'
import { getImportantDatesForViewer } from '../queries'

const mockedDbAs = vi.mocked(dbAs)
const mockedHasPermission = vi.mocked(hasPermission)

describe('important dates permission scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero performance entries for user without performance permission', async () => {
    mockedHasPermission.mockReturnValue(false)

    const result = await getImportantDatesForViewer(
      'user1',
      'org1',
      'EMPLOYEE',
      ['employees', 'calendar'],
      new Date('2026-01-01'),
      new Date('2026-12-31')
    )

    expect(result.filter((e) => e.type === 'performance')).toHaveLength(0)
    expect(result.filter((e) => e.type === 'payroll')).toHaveLength(0)
  })

  it('fetches performance cycles when user has performance.review.submit', async () => {
    mockedHasPermission.mockImplementation((_role, _modules, key) => {
      return key === 'performance.review.submit' || key === 'performance.cycle.manage'
    })

    mockedDbAs.mockResolvedValue([
      { name: 'Q1 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
    ])

    const result = await getImportantDatesForViewer(
      'user1',
      'org1',
      'MANAGER',
      ['employees', 'calendar', 'performance'],
      new Date('2026-01-01'),
      new Date('2026-12-31')
    )

    expect(mockedDbAs).toHaveBeenCalled()
    expect(result.some((e) => e.type === 'performance')).toBe(true)
  })
})
