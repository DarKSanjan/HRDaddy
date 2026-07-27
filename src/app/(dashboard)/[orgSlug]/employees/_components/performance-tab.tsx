'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/core/ui'
import { getRatingLabel } from '@/modules/performance/labels'
import { submitSelfAssessment } from '@/modules/performance/actions'
import type { ReviewItem, AutoMetrics } from '@/modules/performance/queries'
import type { ReviewComplexity } from '@/modules/performance/settings'

interface PerformanceTabProps {
  employeeId: string
  orgSlug: string
  reviewHistory: ReviewItem[]
  autoMetrics: AutoMetrics | null
  reviewComplexity: ReviewComplexity
}

function scoreVariant(score: number | null): 'danger' | 'warning' | 'success' | 'neutral' {
  if (score == null) return 'neutral'
  if (score <= 2) return 'danger'
  if (score === 3) return 'warning'
  return 'success'
}

const COMPETENCY_LABELS: Record<string, string> = {
  JOB_KNOWLEDGE: 'Job Knowledge',
  QUALITY_OF_WORK: 'Quality of Work',
  COMMUNICATION: 'Communication',
  TEAMWORK: 'Teamwork',
  INITIATIVE: 'Initiative',
  RELIABILITY: 'Reliability',
}

export function PerformanceTab({
  orgSlug,
  reviewHistory,
  autoMetrics,
}: PerformanceTabProps) {
  const router = useRouter()
  const [selfText, setSelfText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find a pending/submitted review for self-assessment
  const selfAssessmentReview = reviewHistory.find(
    (r) => r.status === 'PENDING' || r.status === 'SUBMITTED'
  )

  const publishedReviews = reviewHistory.filter((r) => r.status === 'PUBLISHED')

  const handleSelfAssessment = async () => {
    if (!selfAssessmentReview || !selfText.trim()) return
    setSaving(true)
    setError(null)

    const result = await submitSelfAssessment(orgSlug, selfAssessmentReview.id, selfText.trim())
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to save self-assessment.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Auto-metrics scorecard */}
      {autoMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics (Current Cycle)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetricTile
                label="Attendance"
                value={`${autoMetrics.attendanceReliability}%`}
                sublabel={`${autoMetrics.daysPresent} / ${autoMetrics.expectedWorkdays} days`}
              />
              <MetricTile
                label="Late Arrivals"
                value={String(autoMetrics.lateArrivals)}
                sublabel="this cycle"
              />
              <MetricTile
                label="Leave Taken"
                value={`${autoMetrics.leaveDaysTaken} days`}
                sublabel="approved leave"
              />
              <MetricTile
                label="Hours Worked"
                value={`${autoMetrics.totalHoursWorked}h`}
                sublabel="total tracked"
              />
              <MetricTile
                label="Overtime"
                value={`${autoMetrics.overtimeHours}h`}
                sublabel="beyond standard"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Self-assessment (own profile only, when cycle is open) */}
      {selfAssessmentReview && (
        <Card>
          <CardHeader>
            <CardTitle>Self-Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selfAssessmentReview.selfAssessment && (
              <div className="rounded-lg bg-surface-hover p-3">
                <p className="text-[12px] font-medium text-text-muted mb-1">Your current self-assessment:</p>
                <p className="text-[13px] text-text whitespace-pre-wrap">
                  {selfAssessmentReview.selfAssessment}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <textarea
                value={selfText}
                onChange={(e) => setSelfText(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none"
                placeholder="Reflect on your performance this quarter — strengths, challenges, and goals…"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSelfAssessment}
                  disabled={saving || !selfText.trim()}
                >
                  {saving ? 'Saving…' : 'Save Self-Assessment'}
                </Button>
                {error && <span className="text-[12px] text-danger">{error}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review history */}
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
        </CardHeader>
        <CardContent>
          {publishedReviews.length === 0 ? (
            <p className="text-[13px] text-text-muted">No published reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {publishedReviews.map((review) => (
                <div key={review.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={scoreVariant(review.overallScore)}>
                        {review.overallScore}/5
                      </Badge>
                      <span className="text-[13px] font-medium text-text">
                        {getRatingLabel(review.overallScore)}
                      </span>
                    </div>
                    <div className="text-right">
                      {review.reviewerFirstName && (
                        <p className="text-[11px] text-text-muted">
                          Reviewed by {review.reviewerFirstName} {review.reviewerLastName}
                        </p>
                      )}
                      {review.publishedAt && (
                        <p className="text-[11px] text-text-muted">
                          {new Intl.DateTimeFormat('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }).format(new Date(review.publishedAt))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Competency breakdown (advanced mode) */}
                  {review.competencyScores.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {review.competencyScores.map((cs) => (
                        <div key={cs.competency} className="rounded bg-surface-hover px-2 py-1">
                          <p className="text-[11px] text-text-muted">{COMPETENCY_LABELS[cs.competency]}</p>
                          <p className="text-[13px] font-medium text-text">{cs.score}/5</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {review.strengths && (
                    <div>
                      <p className="text-[11px] font-medium text-text-muted">Strengths</p>
                      <p className="text-[13px] text-text">{review.strengths}</p>
                    </div>
                  )}
                  {review.improvements && (
                    <div>
                      <p className="text-[11px] font-medium text-text-muted">Areas for Improvement</p>
                      <p className="text-[13px] text-text">{review.improvements}</p>
                    </div>
                  )}
                  {review.goals && (
                    <div>
                      <p className="text-[11px] font-medium text-text-muted">Goals</p>
                      <p className="text-[13px] text-text">{review.goals}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricTile({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-medium text-text-muted">{label}</p>
      <p className="text-[18px] font-bold text-text">{value}</p>
      <p className="text-[11px] text-text-muted">{sublabel}</p>
    </div>
  )
}
