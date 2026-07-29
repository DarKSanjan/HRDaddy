import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { getEmployeeIdForUser } from '@/core/employees'
import {
  listOnboardings,
  listTemplates,
  getMyOnboardingTasks,
} from '@/modules/onboarding/queries'
import { listEmployees } from '@/modules/employees/queries'
import { OnboardingAdmin } from './_components/onboarding-admin'
import { OnboardingEmployee } from './_components/onboarding-employee'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('onboarding', enabledModules)

  const canViewAll = hasPermission(membership.role, enabledModules, 'onboarding.view_all')

  if (canViewAll) {
    // HR/Owner: see all onboardings org-wide
    const { onboardings, total } = await listOnboardings(session.userId, org.id, {})
    const templates = await listTemplates(session.userId, org.id, false)
    const { employees } = await listEmployees(session.userId, org.id, {
      status: 'ACTIVE',
      pageSize: 200,
    })

    return (
      <OnboardingAdmin
        orgSlug={orgSlug}
        onboardings={JSON.parse(JSON.stringify(onboardings))}
        total={total}
        templates={JSON.parse(JSON.stringify(templates))}
        employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))}
      />
    )
  }

  // Regular employee: see only their own onboarding tasks
  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  if (!employeeId) {
    // User has no employee record in this org
    return (
      <OnboardingEmployee
        orgSlug={orgSlug}
        hasOnboarding={false}
        tasks={{ asEmployee: [], asAssignee: [] }}
      />
    )
  }

  // Not gated on "do I have my own active onboarding" — a manager or HR
  // contact can have tasks assigned to them (asAssignee) on a report's
  // onboarding without ever having an onboarding record of their own.
  const tasks = await getMyOnboardingTasks(session.userId, org.id, employeeId)
  const hasOnboarding = tasks.asEmployee.length > 0 || tasks.asAssignee.length > 0

  return (
    <OnboardingEmployee
      orgSlug={orgSlug}
      hasOnboarding={hasOnboarding}
      tasks={JSON.parse(JSON.stringify(tasks))}
    />
  )
}
