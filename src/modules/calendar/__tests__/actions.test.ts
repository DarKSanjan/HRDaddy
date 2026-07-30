/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/modules/register', () => ({}))
vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn(),
  requirePermission: vi.fn(),
  verifySession: vi.fn(),
}))
vi.mock('@/core/db', () => ({
  dbAs: vi.fn(),
}))
vi.mock('@/core/audit', () => ({
  writeAudit: vi.fn(),
}))
vi.mock('@/core/notifications', () => ({
  getNotificationAdapter: vi.fn(),
}))
vi.mock('@/core/employees', () => ({
  getEmployeeIdForUser: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getOrgContext, requirePermission } from '@/core/auth'
import { dbAs } from '@/core/db'
import { getNotificationAdapter } from '@/core/notifications'
import { getEmployeeIdForUser } from '@/core/employees'
import { createCalendarEvent } from '../actions'

const mockedGetOrgContext = vi.mocked(getOrgContext)
const mockedRequirePermission = vi.mocked(requirePermission)
const mockedDbAs = vi.mocked(dbAs)
const mockedGetEmployeeIdForUser = vi.mocked(getEmployeeIdForUser)
const mockedGetNotificationAdapter = vi.mocked(getNotificationAdapter)

describe('calendar event actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetOrgContext.mockResolvedValue({
      org: { id: 'org1', name: 'Test', slug: 'test' },
      enabledModules: ['employees', 'calendar'],
      membership: { id: 'm1', role: 'MANAGER', isActive: true },
    } as any)
    mockedGetEmployeeIdForUser.mockResolvedValue('emp1')
  })

  it('rejects COMPANY audience from a manager', async () => {
    mockedRequirePermission.mockResolvedValue({ userId: 'u1', role: 'MANAGER' })

    const result = await createCalendarEvent('test', {
      title: 'All-Hands',
      date: '2026-03-15',
      audience: 'COMPANY',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Only admins')
  })

  it('forces manager department for DEPARTMENT audience', async () => {
    mockedRequirePermission.mockResolvedValue({ userId: 'u1', role: 'MANAGER' })
    mockedDbAs.mockImplementation(async (_uid, fn) => {
      const mockTx = {
        employee: {
          findUnique: vi.fn().mockResolvedValue({ departmentId: 'dept-forced' }),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
        calendarEvent: {
          create: vi.fn().mockResolvedValue({ id: 'ev1' }),
        },
      }
      return fn(mockTx as any)
    })
    const mockNotifier = { send: vi.fn().mockResolvedValue(undefined) }
    mockedGetNotificationAdapter.mockReturnValue(mockNotifier as any)

    const result = await createCalendarEvent('test', {
      title: 'Team Standup',
      date: '2026-03-15',
      audience: 'DEPARTMENT',
      departmentId: 'dept-hacker-supplied',
    })

    expect(result.success).toBe(true)
  })

  it('rejects SPECIFIC_EMPLOYEES with employee from different org', async () => {
    mockedRequirePermission.mockResolvedValue({ userId: 'u1', role: 'OWNER' })
    mockedDbAs.mockImplementation(async (_uid, fn) => {
      const mockTx = {
        employee: {
          count: vi.fn().mockResolvedValue(0),
          findUnique: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        calendarEvent: {
          create: vi.fn().mockResolvedValue({ id: 'ev1' }),
        },
      }
      return fn(mockTx as any)
    })

    const result = await createCalendarEvent('test', {
      title: 'Meeting',
      date: '2026-03-15',
      audience: 'SPECIFIC_EMPLOYEES',
      employeeIds: ['foreign-emp-id'],
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('do not belong')
  })

  it('sends exactly one notification per resolved recipient', async () => {
    mockedRequirePermission.mockResolvedValue({ userId: 'u1', role: 'OWNER' })
    const mockSend = vi.fn().mockResolvedValue(undefined)
    mockedGetNotificationAdapter.mockReturnValue({ send: mockSend } as any)

    let callCount = 0
    mockedDbAs.mockImplementation(async (_uid, fn) => {
      callCount++
      if (callCount === 1) {
        const mockTx = {
          employee: {
            count: vi.fn().mockResolvedValue(2),
            findMany: vi.fn().mockResolvedValue([]),
          },
          calendarEvent: {
            create: vi.fn().mockResolvedValue({ id: 'ev1' }),
          },
        }
        return fn(mockTx as any)
      }
      const mockTx = {
        employee: {
          findMany: vi.fn().mockResolvedValue([
            { userId: 'user-a' },
            { userId: 'user-b' },
            { userId: 'user-c' },
          ]),
        },
      }
      return fn(mockTx as any)
    })

    await createCalendarEvent('test', {
      title: 'All-Hands',
      date: '2026-03-15',
      audience: 'COMPANY',
    })

    expect(mockSend).toHaveBeenCalledTimes(3)
    expect(mockSend.mock.calls[0][0].userId).toBe('user-a')
    expect(mockSend.mock.calls[1][0].userId).toBe('user-b')
    expect(mockSend.mock.calls[2][0].userId).toBe('user-c')
  })
})
