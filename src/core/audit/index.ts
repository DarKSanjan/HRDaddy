/**
 * Audit service — append-only.
 * Exposes no update or delete path.
 */
import { Prisma } from '@prisma/client'
import { dbAdmin } from '@/core/db/admin'

export interface AuditEntry {
  orgId: string
  actorId: string
  action: string
  targetType: string
  targetId: string
  before?: unknown
  after?: unknown
  metadata?: unknown
}

/**
 * Write an audit log entry. This is append-only — no update or delete.
 * Passing the active transaction keeps the audit row atomic with its mutation.
 */
export async function writeAudit(
  entry: AuditEntry,
  tx?: Prisma.TransactionClient
): Promise<void> {
  await (tx ?? dbAdmin).auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      before: entry.before as object | undefined,
      after: entry.after as object | undefined,
      metadata: entry.metadata as object | undefined,
    },
  })
}
