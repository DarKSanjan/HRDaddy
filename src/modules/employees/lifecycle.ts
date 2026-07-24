/**
 * Employee lifecycle — status transition validation.
 *
 * Valid transitions:
 *   DRAFT → INVITED, ACTIVE
 *   INVITED → ACTIVE
 *   ACTIVE → SUSPENDED, DEACTIVATED
 *   SUSPENDED → ACTIVE, DEACTIVATED
 *   DEACTIVATED → ARCHIVED
 */
import type { EmploymentStatus } from '@prisma/client'

const VALID_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
  DRAFT: ['INVITED', 'ACTIVE'],
  INVITED: ['ACTIVE'],
  ACTIVE: ['SUSPENDED', 'DEACTIVATED'],
  SUSPENDED: ['ACTIVE', 'DEACTIVATED'],
  DEACTIVATED: ['ARCHIVED'],
  ARCHIVED: [],
}

export interface TransitionResult {
  valid: boolean
  error?: string
}

/**
 * Validate whether a status transition is allowed.
 */
export function validateTransition(
  from: EmploymentStatus,
  to: EmploymentStatus
): TransitionResult {
  if (from === to) {
    return { valid: false, error: `Employee is already ${from}` }
  }

  const allowed = VALID_TRANSITIONS[from]
  if (!allowed || !allowed.includes(to)) {
    return {
      valid: false,
      error: `Cannot transition from ${from} to ${to}. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
    }
  }

  return { valid: true }
}

/**
 * Check if deactivation requires direct report reassignment.
 */
export function requiresReassignment(to: EmploymentStatus): boolean {
  return to === 'DEACTIVATED'
}

/**
 * Check if a reason is required for the transition.
 */
export function requiresReason(to: EmploymentStatus): boolean {
  return to === 'DEACTIVATED' || to === 'SUSPENDED'
}

/**
 * Get allowed next statuses for a given status.
 */
export function getAllowedTransitions(from: EmploymentStatus): EmploymentStatus[] {
  return VALID_TRANSITIONS[from] ?? []
}
