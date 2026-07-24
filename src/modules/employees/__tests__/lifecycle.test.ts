import { describe, it, expect } from 'vitest'
import {
  validateTransition,
  getAllowedTransitions,
  requiresReason,
  requiresReassignment,
} from '../lifecycle'
import type { EmploymentStatus } from '@prisma/client'

describe('Employee Lifecycle', () => {
  describe('validateTransition', () => {
    const validCases: [EmploymentStatus, EmploymentStatus][] = [
      ['DRAFT', 'INVITED'],
      ['DRAFT', 'ACTIVE'],
      ['INVITED', 'ACTIVE'],
      ['ACTIVE', 'SUSPENDED'],
      ['ACTIVE', 'DEACTIVATED'],
      ['SUSPENDED', 'ACTIVE'],
      ['SUSPENDED', 'DEACTIVATED'],
      ['DEACTIVATED', 'ARCHIVED'],
    ]

    it.each(validCases)(
      'allows %s → %s',
      (from, to) => {
        const result = validateTransition(from, to)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }
    )

    const invalidCases: [EmploymentStatus, EmploymentStatus][] = [
      ['DRAFT', 'SUSPENDED'],
      ['DRAFT', 'DEACTIVATED'],
      ['DRAFT', 'ARCHIVED'],
      ['INVITED', 'SUSPENDED'],
      ['INVITED', 'DEACTIVATED'],
      ['INVITED', 'ARCHIVED'],
      ['INVITED', 'DRAFT'],
      ['ACTIVE', 'DRAFT'],
      ['ACTIVE', 'INVITED'],
      ['ACTIVE', 'ARCHIVED'],
      ['SUSPENDED', 'DRAFT'],
      ['SUSPENDED', 'INVITED'],
      ['SUSPENDED', 'ARCHIVED'],
      ['DEACTIVATED', 'DRAFT'],
      ['DEACTIVATED', 'ACTIVE'],
      ['DEACTIVATED', 'SUSPENDED'],
      ['ARCHIVED', 'DRAFT'],
      ['ARCHIVED', 'ACTIVE'],
      ['ARCHIVED', 'INVITED'],
      ['ARCHIVED', 'SUSPENDED'],
      ['ARCHIVED', 'DEACTIVATED'],
    ]

    it.each(invalidCases)(
      'rejects %s → %s',
      (from, to) => {
        const result = validateTransition(from, to)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }
    )

    it('rejects self-transitions', () => {
      const statuses: EmploymentStatus[] = [
        'DRAFT', 'INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'ARCHIVED',
      ]
      for (const status of statuses) {
        const result = validateTransition(status, status)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('already')
      }
    })
  })

  describe('getAllowedTransitions', () => {
    it('returns valid next states for DRAFT', () => {
      expect(getAllowedTransitions('DRAFT')).toEqual(['INVITED', 'ACTIVE'])
    })

    it('returns valid next states for ACTIVE', () => {
      expect(getAllowedTransitions('ACTIVE')).toEqual(['SUSPENDED', 'DEACTIVATED'])
    })

    it('returns empty array for ARCHIVED', () => {
      expect(getAllowedTransitions('ARCHIVED')).toEqual([])
    })
  })

  describe('requiresReason', () => {
    it('requires reason for DEACTIVATED', () => {
      expect(requiresReason('DEACTIVATED')).toBe(true)
    })

    it('requires reason for SUSPENDED', () => {
      expect(requiresReason('SUSPENDED')).toBe(true)
    })

    it('does not require reason for ACTIVE', () => {
      expect(requiresReason('ACTIVE')).toBe(false)
    })
  })

  describe('requiresReassignment', () => {
    it('requires reassignment only for DEACTIVATED', () => {
      expect(requiresReassignment('DEACTIVATED')).toBe(true)
      expect(requiresReassignment('SUSPENDED')).toBe(false)
      expect(requiresReassignment('ACTIVE')).toBe(false)
      expect(requiresReassignment('ARCHIVED')).toBe(false)
    })
  })
})
