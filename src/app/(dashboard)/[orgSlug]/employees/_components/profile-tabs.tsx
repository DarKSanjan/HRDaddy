'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PersonalTab } from './personal-tab'
import { EmploymentTab } from './employment-tab'
import { ActivityTab } from './activity-tab'
import type { EmployeeProfile } from '@/modules/employees/queries'
import type { OrgRole } from '@prisma/client'

interface ProfileTabsProps {
  employee: EmployeeProfile
  orgSlug: string
  activeTab: string
  viewerRole: OrgRole
}

const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'documents', label: 'Documents' },
  { id: 'leave', label: 'Leave' },
  { id: 'activity', label: 'Activity' },
]

export function ProfileTabs({
  employee,
  orgSlug,
  activeTab,
  viewerRole,
}: ProfileTabsProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="flex gap-6" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                'border-b-2 pb-3 pt-1 text-[13px] font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-accent-500 text-text'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border'
              )}
              onClick={() =>
                router.push(`/${orgSlug}/employees/${employee.id}?tab=${tab.id}`)
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'personal' && (
          <PersonalTab employee={employee} />
        )}
        {activeTab === 'employment' && (
          <EmploymentTab employee={employee} viewerRole={viewerRole} />
        )}
        {activeTab === 'documents' && (
          <div className="rounded-[var(--radius-sm)] border border-border bg-surface p-6">
            <p className="text-[13px] text-text-muted">
              Documents module coming soon.
            </p>
          </div>
        )}
        {activeTab === 'leave' && (
          <div className="rounded-[var(--radius-sm)] border border-border bg-surface p-6">
            <p className="text-[13px] text-text-muted">
              Leave management coming soon.
            </p>
          </div>
        )}
        {activeTab === 'activity' && (
          <ActivityTab
            employeeId={employee.id}
            orgSlug={orgSlug}
          />
        )}
      </div>
    </div>
  )
}
