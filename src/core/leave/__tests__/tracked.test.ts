import { describe, it, expect, vi } from 'vitest'

const findFirst = vi.fn()

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    leavePolicy: { findFirst },
  },
}))

describe('isLeaveTypeTracked', () => {
  it('returns true when the org has a LeavePolicy for the leave type', async () => {
    findFirst.mockResolvedValueOnce({ id: 'policy-1' })
    const { isLeaveTypeTracked } = await import('@/core/leave')

    expect(await isLeaveTypeTracked('org-1', 'leave-type-1')).toBe(true)
    expect(findFirst).toHaveBeenCalledWith({
      where: { orgId: 'org-1', leaveTypeId: 'leave-type-1' },
      select: { id: true },
    })
  })

  it('returns false when no policy exists (leave type is intentionally untracked)', async () => {
    findFirst.mockResolvedValueOnce(null)
    const { isLeaveTypeTracked } = await import('@/core/leave')

    expect(await isLeaveTypeTracked('org-1', 'unpaid-leave')).toBe(false)
  })
})
