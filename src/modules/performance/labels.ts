/**
 * Performance review rating labels — standard 5-point scale.
 */

export const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
}

export function getRatingLabel(score: number | null | undefined): string {
  if (score == null) return '—'
  return RATING_LABELS[score] ?? '—'
}
