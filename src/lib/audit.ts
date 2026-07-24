import { db } from './db'
import type { Prisma } from '@prisma/client'

export interface CreateAuditLogInput {
  orgId: string
  actorId: string
  action: string
  targetType: string
  targetId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

/**
 * Create an immutable audit log entry.
 * Audit logs are append-only and cannot be modified or deleted through the application.
 */
export async function createAuditLog(input: CreateAuditLogInput) {
  return db.auditLog.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}
