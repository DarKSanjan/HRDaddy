import { describe, it, expect } from 'vitest'
import { wouldCreateCycle, wouldCreateCycleSync, type ReportingNode } from '../reporting-lines'

describe('Reporting Lines — Cycle Detection', () => {
  describe('wouldCreateCycleSync', () => {
    it('detects self-assignment as a cycle', () => {
      const nodes: ReportingNode[] = [
        { id: 'A', managerId: null },
      ]
      expect(wouldCreateCycleSync('A', 'A', nodes)).toBe(true)
    })

    it('detects direct cycle (A→B→A)', () => {
      const nodes: ReportingNode[] = [
        { id: 'A', managerId: null },
        { id: 'B', managerId: 'A' },
      ]
      // Assigning A's manager to B would create B→A and B.managerId is already A
      // Actually: if we assign managerId=B to employee A:
      // A.manager = B, B.manager = A → cycle
      expect(wouldCreateCycleSync('A', 'B', nodes)).toBe(true)
    })

    it('detects transitive cycle (A→B→C→A)', () => {
      const nodes: ReportingNode[] = [
        { id: 'A', managerId: null },
        { id: 'B', managerId: 'A' },
        { id: 'C', managerId: 'B' },
      ]
      // Assigning A's manager to C: walk up from C: C→B→A → hit A, cycle!
      expect(wouldCreateCycleSync('A', 'C', nodes)).toBe(true)
    })

    it('detects deep transitive cycle', () => {
      const nodes: ReportingNode[] = [
        { id: 'A', managerId: null },
        { id: 'B', managerId: 'A' },
        { id: 'C', managerId: 'B' },
        { id: 'D', managerId: 'C' },
        { id: 'E', managerId: 'D' },
      ]
      // Assigning A's manager to E: walk E→D→C→B→A → cycle
      expect(wouldCreateCycleSync('A', 'E', nodes)).toBe(true)
    })

    it('allows valid assignment (no cycle)', () => {
      const nodes: ReportingNode[] = [
        { id: 'A', managerId: null },
        { id: 'B', managerId: null },
        { id: 'C', managerId: 'A' },
      ]
      // Assigning B's manager to A: walk A→null. No cycle.
      expect(wouldCreateCycleSync('B', 'A', nodes)).toBe(false)
    })

    it('allows valid sibling assignment', () => {
      const nodes: ReportingNode[] = [
        { id: 'A', managerId: 'X' },
        { id: 'B', managerId: 'X' },
        { id: 'X', managerId: null },
      ]
      // Assigning A's manager to B: walk B→X→null. No cycle.
      expect(wouldCreateCycleSync('A', 'B', nodes)).toBe(false)
    })

    it('handles nodes not in the map gracefully', () => {
      const nodes: ReportingNode[] = [
        { id: 'A', managerId: null },
        { id: 'B', managerId: 'Z' }, // Z not in map
      ]
      // Walk from B: B.managerId=Z, Z not in map → null. No cycle.
      expect(wouldCreateCycleSync('A', 'B', nodes)).toBe(false)
    })
  })

  describe('wouldCreateCycle (async)', () => {
    it('detects self-assignment', async () => {
      const getManager = async () => null
      expect(await wouldCreateCycle('A', 'A', getManager)).toBe(true)
    })

    it('detects direct cycle', async () => {
      const chain: Record<string, string | null> = { A: null, B: 'A' }
      const getManager = async (id: string) => chain[id] ?? null
      expect(await wouldCreateCycle('A', 'B', getManager)).toBe(true)
    })

    it('detects transitive cycle', async () => {
      const chain: Record<string, string | null> = { A: null, B: 'A', C: 'B' }
      const getManager = async (id: string) => chain[id] ?? null
      expect(await wouldCreateCycle('A', 'C', getManager)).toBe(true)
    })

    it('allows valid assignment', async () => {
      const chain: Record<string, string | null> = { A: null, B: null, C: 'A' }
      const getManager = async (id: string) => chain[id] ?? null
      expect(await wouldCreateCycle('B', 'A', getManager)).toBe(false)
    })

    it('handles corrupt data (pre-existing cycle) without infinite loop', async () => {
      // Corrupt: A→B→C→A (already cyclic)
      const chain: Record<string, string | null> = { A: 'C', B: 'A', C: 'B' }
      const getManager = async (id: string) => chain[id] ?? null
      // Should terminate due to visited set
      const result = await wouldCreateCycle('X', 'A', getManager)
      // Since X is never in the cycle A→C→B→A, the visited set will detect the repeat
      expect(result).toBe(true) // visited guard triggers
    })
  })
})
