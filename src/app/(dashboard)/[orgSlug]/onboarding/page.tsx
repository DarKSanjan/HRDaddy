import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySession, getOrgBySlug, getOrgMembership } from '@/lib/dal'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Users, Building, Calendar } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()

  const org = await getOrgBySlug(orgSlug)
  if (!org) redirect('/sign-in')

  const membership = await getOrgMembership(session.userId, org.id)
  if (!membership || !membership.isActive) redirect('/sign-in')

  if (!hasPermission(membership.role, PERMISSIONS.ORG_MANAGE_SETTINGS)) {
    redirect(`/${orgSlug}/dashboard`)
  }

  // Check current onboarding state
  const [settings, departmentCount, employeeCount] = await Promise.all([
    db.organisationSettings.findUnique({ where: { orgId: org.id } }),
    db.department.count({ where: { orgId: org.id } }),
    db.employee.count({ where: { orgId: org.id } }),
  ])

  const hasWorkingDays = settings?.workingDays !== null
  const hasDepartment = departmentCount > 0
  const hasEmployee = employeeCount > 0

  const steps = [
    {
      title: 'Configure Working Days',
      description: 'Set up your organisation\'s working schedule',
      icon: Calendar,
      completed: hasWorkingDays,
      href: `/${orgSlug}/settings`,
    },
    {
      title: 'Create First Department',
      description: 'Organise your team into departments',
      icon: Building,
      completed: hasDepartment,
      href: `/${orgSlug}/settings`,
    },
    {
      title: 'Add First Employee',
      description: 'Add your first team member to the system',
      icon: Users,
      completed: hasEmployee,
      href: `/${orgSlug}/employees/new`,
    },
  ]

  const allComplete = steps.every((s) => s.completed)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Setup Your Organisation</h1>
        <p className="text-sm text-gray-500">
          Complete these steps to get started with HR Daddy
        </p>
      </div>

      {allComplete ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              All set!
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Your organisation is ready to go.
            </p>
            <Link href={`/${orgSlug}/dashboard`}>
              <Button className="mt-4">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {steps.map((step, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
                {!step.completed && (
                  <Link href={step.href}>
                    <Button size="sm" variant="outline">
                      Start
                    </Button>
                  </Link>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
