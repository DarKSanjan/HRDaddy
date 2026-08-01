/**
 * Admin audit-log viewer query. RLS (audit_logs_select, 00022) already
 * restricts reads to OWNER/HR_ADMIN — the requirePermission('audit.view')
 * check at the page level is a second, app-side gate on top of that.
 */
import { dbAs } from '@/core/db'

export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  before: unknown
  after: unknown
  metadata: unknown
  createdAt: Date
}

export interface AuditLogFilters {
  actorId?: string
  action?: string
  from?: Date
  to?: Date
}

export async function getAuditLog(
  userId: string,
  orgId: string,
  filters: AuditLogFilters,
  page: number,
  pageSize: number
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: { contains: filters.action } } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      tx.auditLog.findMany({
        where,
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.auditLog.count({ where }),
    ])

    return {
      entries: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorName: r.actor.name,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        before: r.before,
        after: r.after,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
      total,
    }
  })
}

/** Distinct actors for the org, for the filter dropdown. */
export async function listAuditActors(
  userId: string,
  orgId: string
): Promise<Array<{ id: string; name: string }>> {
  return dbAs(userId, async (tx) => {
    const memberships = await tx.organisationMembership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    })
    return memberships.map((m) => ({ id: m.user.id, name: m.user.name }))
  })
}
