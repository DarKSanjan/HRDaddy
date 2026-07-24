/**
 * Reporting lines — cycle detection for manager assignment.
 *
 * When assigning manager B to employee A, we must ensure that A is not
 * already an ancestor of B in the reporting chain. Otherwise: A→B→...→A.
 */

export interface ReportingNode {
  id: string
  managerId: string | null
}

/**
 * Detect if assigning `managerId` to `employeeId` would create a cycle.
 *
 * Strategy: walk UP from `managerId` through the chain. If we encounter
 * `employeeId`, there's a cycle.
 *
 * @param employeeId The employee who would get a new manager
 * @param managerId The proposed manager
 * @param getManager A function that returns the managerId for a given employee
 * @returns true if a cycle would be created
 */
export async function wouldCreateCycle(
  employeeId: string,
  managerId: string,
  getManager: (id: string) => Promise<string | null>
): Promise<boolean> {
  // Self-assignment is always a cycle
  if (employeeId === managerId) {
    return true
  }

  const visited = new Set<string>()
  let current: string | null = managerId

  while (current !== null) {
    // If we reach the employee being assigned, it's a cycle
    if (current === employeeId) {
      return true
    }

    // Guard against infinite loops from corrupt data
    if (visited.has(current)) {
      return true
    }
    visited.add(current)

    current = await getManager(current)
  }

  return false
}

/**
 * Synchronous variant for when the full reporting tree is in memory.
 * Useful in tests or batch operations.
 */
export function wouldCreateCycleSync(
  employeeId: string,
  managerId: string,
  nodes: ReportingNode[]
): boolean {
  if (employeeId === managerId) {
    return true
  }

  const nodeMap = new Map<string, string | null>()
  for (const node of nodes) {
    nodeMap.set(node.id, node.managerId)
  }

  const visited = new Set<string>()
  let current: string | null = managerId

  while (current !== null) {
    if (current === employeeId) {
      return true
    }
    if (visited.has(current)) {
      return true
    }
    visited.add(current)
    current = nodeMap.get(current) ?? null
  }

  return false
}
