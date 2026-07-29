import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb } from '@/core/ui'
import { listTemplates } from '@/modules/onboarding/queries'
import { SettingsNav } from '../_components/settings-nav'
import { TemplateManager } from './_components/template-manager'

export const dynamic = 'force-dynamic'

export default async function OnboardingSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('onboarding', enabledModules)

  const canManage = hasPermission(membership.role, enabledModules, 'onboarding.template.manage')
  const canView = hasPermission(membership.role, enabledModules, 'onboarding.template.view')

  // Must have at least view permission
  if (!canManage && !canView) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  const templates = await listTemplates(session.userId, org.id, canManage)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Onboarding' },
        ]}
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <h1 className="text-[20px] font-bold text-text">Onboarding Templates</h1>
      <p className="text-[13px] text-text-muted">
        Manage checklist templates assigned to new employees during onboarding.
      </p>

      <TemplateManager
        orgSlug={orgSlug}
        templates={JSON.parse(JSON.stringify(templates))}
        canManage={canManage}
      />
    </div>
  )
}
