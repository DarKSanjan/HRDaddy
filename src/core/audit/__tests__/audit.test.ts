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

  it('writes via write_audit_log() through the supplied transaction client, not a direct insert', async () => {
    const auditModule = await import('@/core/audit')
    const executeRaw = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn().mockResolvedValue({})
    const tx = { $executeRaw: executeRaw, auditLog: { create } }

    await auditModule.writeAudit(
      {
        orgId: 'org-1',
        actorId: 'user-1',
        action: 'employee.updated',
        targetType: 'employee',
        targetId: 'employee-1',
        after: { name: 'New Name' },
      },
      tx as never
    )

    expect(executeRaw).toHaveBeenCalledTimes(1)
    // Prisma's tagged-template raw query — first arg is the strings array,
    // rest are the interpolated params in order.
    const [strings, ...params] = executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    expect(strings.join('?')).toContain('write_audit_log')
    expect(params).toEqual(['org-1', 'employee.updated', 'employee', 'employee-1', null, JSON.stringify({ name: 'New Name' }), null])
    expect(create).not.toHaveBeenCalled()
  })

  it('falls back to a direct insert when no transaction is supplied', async () => {
    const dbAdminModule = await import('@/core/db/admin')
    const auditModule = await import('@/core/audit')

    await auditModule.writeAudit({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'cron.run',
      targetType: 'system',
      targetId: 'job-1',
    })

    expect(dbAdminModule.dbAdmin.auditLog.create).toHaveBeenCalledWith({
      data: {
        orgId: 'org-1',
        actorId: 'user-1',
        action: 'cron.run',
        targetType: 'system',
        targetId: 'job-1',
        before: undefined,
        after: undefined,
        metadata: undefined,
      },
    })
  })
})
