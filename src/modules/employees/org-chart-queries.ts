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
  avgTeamScore: number | null
  directReports: OrgChartNode[]
}

/**
 * Fetch all employees and build the reporting-line tree.
 * Returns top-level nodes (employees with no manager).
 * When performance module is enabled, computes avgTeamScore for managers
 * based on the latest closed cycle.
 */
export async function getOrgChart(
  userId: string,
  orgId: string,
  enabledModules: string[] = []
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

    // Compute team scores if performance module is enabled
    const teamScores = new Map<string, number>()

    if (enabledModules.includes('performance')) {
      // Find the latest closed cycle
      const latestClosed = await tx.performanceCycle.findFirst({
        where: { orgId, status: 'CLOSED' },
        orderBy: { endDate: 'desc' },
        select: { id: true },
      })

      if (latestClosed) {
        // Fetch all published reviews for that cycle
        const reviews = await tx.performanceReview.findMany({
          where: {
            orgId,
            cycleId: latestClosed.id,
            status: 'PUBLISHED',
            overallScore: { not: null },
          },
          select: {
            employeeId: true,
            overallScore: true,
          },
        })

        // Build employee→manager lookup
        const empManagerMap = new Map<string, string | null>()
        for (const emp of employees) {
          empManagerMap.set(emp.id, emp.managerId)
        }

        // Group scores by managerId
        const managerScores = new Map<string, number[]>()
        for (const r of reviews) {
          const mgr = empManagerMap.get(r.employeeId)
          if (!mgr) continue
          if (!managerScores.has(mgr)) {
            managerScores.set(mgr, [])
          }
          managerScores.get(mgr)!.push(r.overallScore!)
        }

        for (const [mgrId, scores] of managerScores) {
          const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          teamScores.set(mgrId, avg)
        }
      }
    }

    // Build a lookup map
    const map = new Map<string, OrgChartNode & { managerId: string | null }>()
    for (const emp of employees) {
      map.set(emp.id, {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        jobTitle: emp.jobTitle?.name ?? null,
        department: emp.department?.name ?? null,
        avgTeamScore: teamScores.get(emp.id) ?? null,
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
