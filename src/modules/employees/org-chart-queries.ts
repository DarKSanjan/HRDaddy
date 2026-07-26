/**
 * Org chart query — build reporting-line tree.
 */
import { dbAs } from '@/core/db/client'

export interface OrgChartNode {
  id: string
  firstName: string
  lastName: string
  jobTitle: string | null
  department: string | null
  directReports: OrgChartNode[]
}

/**
 * Fetch all employees and build the reporting-line tree.
 * Returns top-level nodes (employees with no manager).
 */
export async function getOrgChart(
  userId: string,
  orgId: string
): Promise<OrgChartNode[]> {
  return dbAs(userId, async (tx) => {
    const employees = await tx.employee.findMany({
      where: { orgId, employmentStatus: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        managerId: true,
        jobTitle: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    // Build a lookup map
    const map = new Map<string, OrgChartNode & { managerId: string | null }>()
    for (const emp of employees) {
      map.set(emp.id, {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        jobTitle: emp.jobTitle?.name ?? null,
        department: emp.department?.name ?? null,
        managerId: emp.managerId,
        directReports: [],
      })
    }

    // Link children to parents
    const roots: OrgChartNode[] = []
    for (const node of map.values()) {
      if (node.managerId && map.has(node.managerId)) {
        map.get(node.managerId)!.directReports.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  })
}
