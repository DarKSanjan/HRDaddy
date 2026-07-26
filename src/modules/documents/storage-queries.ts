/**
 * Storage usage queries for the organisation.
 * Computes total bytes used across EmployeeDocument records.
 */
import 'server-only'
import { dbAs } from '@/core/db'

/** Free plan storage limit — placeholder until billing system exists */
export const FREE_PLAN_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024 // 1 GB

/**
 * Get total storage used by an organisation (sum of all employee document file sizes).
 * Payslip PDFs are generated on-demand and never stored, so they don't count.
 */
export async function getStorageUsedBytes(userId: string, orgId: string): Promise<number> {
  const result = await dbAs(userId, async (tx) => {
    const aggregate = await tx.employeeDocument.aggregate({
      where: { orgId, isArchived: false },
      _sum: { fileSize: true },
    })
    return aggregate._sum.fileSize ?? 0
  })
  return result
}
