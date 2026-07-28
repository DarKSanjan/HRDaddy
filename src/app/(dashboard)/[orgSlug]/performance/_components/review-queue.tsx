'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/core/ui'
import { submitReview, publishReview } from '@/modules/performance/actions'
import { getRatingLabel } from '@/modules/performance/labels'
import { DonutChart } from '@/core/ui/charts/donut-chart'
import { BarChart } from '@/core/ui/charts/bar-chart'
import type { ReviewItem, AutoMetrics } from '@/modules/performance/queries'
import type { ReviewComplexity } from '@/modules/performance/settings'
import type { PerformanceCompetency } from '@prisma/client'

interface ReviewQueueProps {
  orgSlug: string
  cycleId: string
  cycleName: string
  reviews: ReviewItem[]
  complexity: ReviewComplexity
  canPublish: boolean
  autoMetricsMap?: Record<string, AutoMetrics>
}

const COMPETENCIES: Array<{ key: PerformanceCompetency; label: string }> = [
  { key: 'JOB_KNOWLEDGE', label: 'Job Knowledge' },
  { key: 'QUALITY_OF_WORK', label: 'Quality of Work' },
  { key: 'COMMUNICATION', label: 'Communication' },
  { key: 'TEAMWORK', label: 'Teamwork' },
  { key: 'INITIATIVE', label: 'Initiative' },
  { key: 'RELIABILITY', label: 'Reliability' },
]

const STATUS_VARIANTS: Record<string, 'warning' | 'info' | 'success'> = {
  PENDING: 'warning',
  SUBMITTED: 'info',
  PUBLISHED: 'success',
}

export function ReviewQueue({
  orgSlug,
  cycleName,
  reviews,
  complexity,
  canPublish,
  autoMetricsMap = {},
}: ReviewQueueProps) {
  const router = useRouter()
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingReviews = reviews.filter((r) => r.status === 'PENDING')
  const submittedReviews = reviews.filter((r) => r.status === 'SUBMITTED')
  const publishedReviews = reviews.filter((r) => r.status === 'PUBLISHED')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeReviewId) return
    setSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await submitReview(orgSlug, activeReviewId, formData)
    if (result.success) {
      setActiveReviewId(null)
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to submit review.')
    }
    setSubmitting(false)
  }

  const handlePublish = async (reviewId: string) => {
    setPublishing(reviewId)
    const result = await publishReview(orgSlug, reviewId)
    if (!result.success) {
      setError(result.error ?? 'Failed to publish review.')
    }
    setPublishing(null)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Cycle: {cycleName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-[12px] text-danger">{error}</p>
        )}

        {/* Pending reviews — write review */}
        {pendingReviews.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[13px] font-medium text-text">Pending Reviews ({pendingReviews.length})</h3>
            {pendingReviews.map((review) => (
              <div key={review.id} className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-text">
                      {review.employeeFirstName} {review.employeeLastName}
                    </span>
                    <Badge variant={STATUS_VARIANTS.PENDING}>Pending</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setActiveReviewId(activeReviewId === review.id ? null : review.id)}
                  >
                    {activeReviewId === review.id ? 'Cancel' : 'Write Review'}
                  </Button>
                </div>

                {activeReviewId === review.id && (
                  <form onSubmit={handleSubmit} className="ml-4 space-y-3 rounded-lg border border-border p-4">
                    {/* Auto-metrics scorecard */}
                    {autoMetricsMap[review.employeeId] && (
                      <AutoMetricsCard metrics={autoMetricsMap[review.employeeId]} />
                    )}

                    {complexity === 'simple' ? (
                      <div className="space-y-1">
                        <label htmlFor="overallScore" className="text-[12px] font-medium text-text-muted">
                          Overall Score (1–5)
                        </label>
                        <select
                          id="overallScore"
                          name="overallScore"
                          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none"
                          required
                        >
                          <option value="">Select…</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n} — {getRatingLabel(n)}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[12px] font-medium text-text-muted">
                          Competency Scores (1–5 each)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {COMPETENCIES.map((comp) => (
                            <div key={comp.key} className="space-y-1">
                              <label
                                htmlFor={`competency_${comp.key}`}
                                className="text-[11px] text-text-muted"
                              >
                                {comp.label}
                              </label>
                              <select
                                id={`competency_${comp.key}`}
                                name={`competency_${comp.key}`}
                                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-text focus:border-accent-500 focus:outline-none"
                                required
                              >
                                <option value="">—</option>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label htmlFor="strengths" className="text-[12px] font-medium text-text-muted">
                        Strengths
                      </label>
                      <textarea
                        id="strengths"
                        name="strengths"
                        rows={2}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none"
                        placeholder="Key strengths demonstrated this quarter…"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="improvements" className="text-[12px] font-medium text-text-muted">
                        Areas for Improvement
                      </label>
                      <textarea
                        id="improvements"
                        name="improvements"
                        rows={2}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none"
                        placeholder="Areas where growth is needed…"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="goals" className="text-[12px] font-medium text-text-muted">
                        Goals for Next Quarter
                      </label>
                      <textarea
                        id="goals"
                        name="goals"
                        rows={2}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none"
                        placeholder="Specific goals and expectations…"
                      />
                    </div>

                    <Button type="submit" size="sm" disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit Review'}
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Submitted reviews — ready to publish */}
        {submittedReviews.length > 0 && canPublish && (
          <div className="space-y-2">
            <h3 className="text-[13px] font-medium text-text">Submitted — Ready to Publish ({submittedReviews.length})</h3>
            {submittedReviews.map((review) => (
              <div key={review.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-text">
                    {review.employeeFirstName} {review.employeeLastName}
                  </span>
                  <Badge variant={STATUS_VARIANTS.SUBMITTED}>Submitted</Badge>
                  <span className="text-[11px] text-text-muted">
                    Score: {review.overallScore}/5 ({getRatingLabel(review.overallScore)})
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handlePublish(review.id)}
                  disabled={publishing === review.id}
                >
                  {publishing === review.id ? 'Publishing…' : 'Publish'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Published reviews */}
        {publishedReviews.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[13px] font-medium text-text">Published ({publishedReviews.length})</h3>
            {publishedReviews.map((review) => (
              <div key={review.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-text">
                    {review.employeeFirstName} {review.employeeLastName}
                  </span>
                  <Badge variant={STATUS_VARIANTS.PUBLISHED}>Published</Badge>
                  <span className="text-[11px] text-text-muted">
                    Score: {review.overallScore}/5
                  </span>
                  {review.acknowledgedAt ? (
                    <Badge variant="success">Acknowledged</Badge>
                  ) : (
                    <Badge variant="neutral">Awaiting acknowledgment</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {reviews.length === 0 && (
          <p className="text-[13px] text-text-muted">No reviews assigned to you for this cycle.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Compact auto-metrics card with mini charts + stat tiles. */
function AutoMetricsCard({ metrics }: { metrics: AutoMetrics }) {
  return (
    <div className="mb-3 rounded-lg bg-surface-hover p-3">
      <p className="text-[11px] font-medium text-text-muted mb-2">
        Performance Metrics (this cycle)
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Attendance donut */}
        <div>
          <DonutChart
            data={[
              { name: 'Present', value: metrics.daysPresent },
              { name: 'Absent', value: Math.max(0, metrics.expectedWorkdays - metrics.daysPresent) },
            ]}
            height={100}
            innerRadius={24}
            outerRadius={38}
            showLegend={false}
            label="Attendance"
            labelValue={`${metrics.attendanceReliability}%`}
          />
        </div>

        {/* Hours bar chart */}
        <div>
          <BarChart
            data={[
              {
                category: 'Hours',
                regular: Math.round((metrics.totalHoursWorked - metrics.overtimeHours) * 10) / 10,
                overtime: metrics.overtimeHours,
              },
            ]}
            xKey="category"
            series={[
              { dataKey: 'regular', name: 'Regular' },
              { dataKey: 'overtime', name: 'OT' },
            ]}
            height={100}
            showGrid={false}
            showLegend
            stacked
          />
        </div>

        {/* Late arrivals — stat tile */}
        <div className="flex flex-col justify-center">
          <p className="text-[14px] font-bold text-text">{metrics.lateArrivals}</p>
          <p className="text-[10px] text-text-muted">Late Arrivals</p>
        </div>

        {/* Leave taken — stat tile */}
        <div className="flex flex-col justify-center">
          <p className="text-[14px] font-bold text-text">{metrics.leaveDaysTaken} days</p>
          <p className="text-[10px] text-text-muted">Leave Taken</p>
        </div>
      </div>
    </div>
  )
}
