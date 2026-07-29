/**
 * Regression coverage: updateEmployee's Zod schema accepts managerId (it's
 * inherited from createEmployeeSchema), the edit form submits it, but the
 * updateData construction never copied it over — the Manager field on the
 * employee edit form silently did nothing on save, reporting success while
 * changing every other field but leaving managerId untouched. Fixed by
 * adding the same manager-exists + cycle-detection checks assignManager
 * already had, then actually including managerId in the Prisma update.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const EMPLOYEE_ID = 'clemployee000000000000001'
const NEW_MANAGER_ID = 'clmanager0000000000000001'

const mockEmployee = {
  id: EMPLOYEE_ID,
  workEmail: 'test@example.com',
  managerId: 'clmanager0000000000000000',
}

const findFirst = vi.fn()
const update = vi.fn<(args: { where: { id: string }; data: Record<string, unknown> }) => Promise<object>>(
  async () => ({})
)

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({ employee: { findFirst, update } })
  ),
}))

vi.mock('@/core/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/core/events', () => ({ emit: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn(async () => ({
    org: { id: 'org-1', name: 'Test', slug: 'test' },
    enabledModules: ['employees'],
    membership: { id: 'mem-1', role: 'OWNER', isActive: true },
  })),
  requirePermission: vi.fn(async () => ({ userId: 'user-1', role: 'OWNER' })),
}))

vi.mock('../reporting-lines', () => ({
  wouldCreateCycle: vi.fn(async () => false),
}))

import { updateEmployee } from '../actions'
import { wouldCreateCycle } from '../reporting-lines'

describe('updateEmployee — managerId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findFirst.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === EMPLOYEE_ID) return mockEmployee
      if (args.where.id === NEW_MANAGER_ID) return { id: NEW_MANAGER_ID }
      return null
    })
  })

  it('actually persists a manager change, not just validates it', async () => {
    const formData = new FormData()
    formData.set('employeeId', EMPLOYEE_ID)
    formData.set('managerId', NEW_MANAGER_ID)

    const result = await updateEmployee('test', formData)

    expect(result.success).toBe(true)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EMPLOYEE_ID },
        data: expect.objectContaining({ managerId: NEW_MANAGER_ID }),
      })
    )
  })

  it('rejects a manager change that would create a reporting cycle, and does not save', async () => {
    vi.mocked(wouldCreateCycle).mockResolvedValueOnce(true)

    const formData = new FormData()
    formData.set('employeeId', EMPLOYEE_ID)
    formData.set('managerId', NEW_MANAGER_ID)

    const result = await updateEmployee('test', formData)

    expect(result.success).toBe(false)
    expect(result.fieldErrors?.managerId).toMatch(/circular/i)
    expect(update).not.toHaveBeenCalled()
  })

  it('clears the manager when managerId is submitted empty', async () => {
    const formData = new FormData()
    formData.set('employeeId', EMPLOYEE_ID)
    formData.set('managerId', '')

    const result = await updateEmployee('test', formData)

    expect(result.success).toBe(true)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ managerId: null }),
      })
    )
  })

  it('leaves managerId untouched when the field is not submitted at all', async () => {
    const formData = new FormData()
    formData.set('employeeId', EMPLOYEE_ID)
    formData.set('firstName', 'Updated')

    const result = await updateEmployee('test', formData)

    expect(result.success).toBe(true)
    expect(update.mock.calls[0]?.[0].data).not.toHaveProperty('managerId')
  })
})
