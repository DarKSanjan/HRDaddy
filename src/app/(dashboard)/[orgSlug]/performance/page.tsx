import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { getReviewComplexity } from '@/modules/performance/settings'
import { listCycles, getCycleReviews } from '@/modules/performance/queries'
import { CycleManager } from './_components/cycle-manager'
import { ReviewQueue } from './_components/review-queue'

export const dynamic = 'force-dynamic'

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('performance', enabledModules)

  const canManageCycles = hasPermission(membership.role, enabledModules, 'performance.cycle.manage')
  const canSubmitReviews = hasPermission(membership.role, enabledModules, 'performance.review.submit')
  const canViewAll = hasPermission(membership.role, enabledModules, 'performance.review.view_all')

  const cycles = await listCycles(session.userId, org.id)
  const complexity = await getReviewComplexity(org.id)

  // Get the active cycle's reviews for the review queue
  const activeCycle = cycles.find((c) => c.status === 'ACTIVE')
  let reviewQueue: Awaited<ReturnType<typeof getCycleReviews>> = []

  if (activeCycle && canSubmitReviews) {
    const callerEmployeeId = await getEmployeeIdForUser(org.id, session.userId)
    // Managers see only their direct reports; admins see all
    const filterByManager = canViewAll ? null : callerEmployeeId
    reviewQueue = await getCycleReviews(
      session.userId,
      org.id,
      activeCycle.id,
      filterByManager
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Performance' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text">Performance Reviews</h1>
          <p className="text-[13px] text-text-muted">
            Manage review cycles and submit evaluations for your team.
          </p>
        </div>
      </div>

      {canManageCycles && (
        <CycleManager
          orgSlug={orgSlug}
          cycles={cycles}
          canPublish={canManageCycles}
        />
      )}

      {canSubmitReviews && activeCycle && (
        <ReviewQueue
          orgSlug={orgSlug}
          cycleId={activeCycle.id}
          cycleName={activeCycle.name}
          reviews={reviewQueue}
          complexity={complexity}
          canPublish={canManageCycles}
        />
      )}

      {!canManageCycles && !canSubmitReviews && (
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-[13px] text-text-muted">
            Your performance reviews will appear on your employee profile once published.
          </p>
        </div>
      )}
    </div>
  )
}
