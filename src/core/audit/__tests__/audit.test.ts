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
})
