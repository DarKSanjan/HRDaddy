/**
 * Audit service tests — exposes no update or delete path.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock the db before importing audit
vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('Audit Service', () => {
  it('exports only writeAudit — no update or delete functions', async () => {
    const auditModule = await import('@/core/audit')
    const exportedKeys = Object.keys(auditModule)
    expect(exportedKeys).toContain('writeAudit')
    expect(exportedKeys).not.toContain('updateAudit')
    expect(exportedKeys).not.toContain('deleteAudit')
    expect(exportedKeys).not.toContain('removeAudit')
    expect(exportedKeys).not.toContain('update')
    expect(exportedKeys).not.toContain('delete')
  })

  it('writeAudit is a function', async () => {
    const auditModule = await import('@/core/audit')
    expect(typeof auditModule.writeAudit).toBe('function')
  })

  it('writes through the supplied transaction client', async () => {
    const auditModule = await import('@/core/audit')
    const create = vi.fn().mockResolvedValue({})
    const tx = { auditLog: { create } }

    await auditModule.writeAudit(
      {
        orgId: 'org-1',
        actorId: 'user-1',
        action: 'employee.updated',
        targetType: 'employee',
        targetId: 'employee-1',
      },
      tx as never
    )

    expect(create).toHaveBeenCalledWith({
      data: {
        orgId: 'org-1',
        actorId: 'user-1',
        action: 'employee.updated',
        targetType: 'employee',
        targetId: 'employee-1',
        before: undefined,
        after: undefined,
        metadata: undefined,
      },
    })
  })
})
