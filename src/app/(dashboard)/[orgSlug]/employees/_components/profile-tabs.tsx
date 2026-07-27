'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PersonalTab } from './personal-tab'
import { EmploymentTab } from './employment-tab'
import { ActivityTab } from './activity-tab'
import { EmployeeDocumentsTab } from './documents-tab'
import { EmployeeLeaveTab } from './leave-tab'
import { PerformanceTab } from './performance-tab'
import type { EmployeeProfile } from '@/modules/employees/queries'
import type { ReviewItem, AutoMetrics } from '@/modules/performance/queries'
import type { ReviewComplexity } from '@/modules/performance/settings'
import type { OrgRole } from '@prisma/client'

interface ProfileTabsProps {
  employee: EmployeeProfile
  orgSlug: string
  activeTab: string
  viewerRole: OrgRole
  canEdit: boolean
  departments?: { id: string; name: string }[]
  jobTitles?: { id: string; name: string }[]
  locations?: { id: string; name: string }[]
  employmentTypes?: { id: string; name: string }[]
  managers?: { id: string; firstName: string; lastName: string }[]
  shiftTemplates?: { id: string; name: string }[]
  documentsEnabled: boolean
  leaveEnabled: boolean
  performanceEnabled: boolean
  isSimplePayroll?: boolean
  reviewHistory?: ReviewItem[]
  autoMetrics?: AutoMetrics | null
  reviewComplexity?: ReviewComplexity
}

const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'documents', label: 'Documents' },
  { id: 'leave', label: 'Leave' },
  { id: 'performance', label: 'Performance' },
  { id: 'activity', label: 'Activity' },
]

export function ProfileTabs({
  employee,
  orgSlug,
  activeTab,
  viewerRole,
  canEdit,
  departments,
  jobTitles,
  locations,
  employmentTypes,
  managers,
  shiftTemplates,
  documentsEnabled,
  leaveEnabled,
  performanceEnabled,
  isSimplePayroll,
  reviewHistory,
  autoMetrics,
  reviewComplexity,
}: ProfileTabsProps) {
  const router = useRouter()

  // Filter tabs based on enabled modules
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === 'documents' && !documentsEnabled) return false
    if (tab.id === 'leave' && !leaveEnabled) return false
    if (tab.id === 'performance' && !performanceEnabled) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="flex gap-6" role="tablist">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                'border-b-2 pb-3 pt-1 text-[13px] font-medium transition-colors',
                'min-h-[44px] touch-target',
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
          <PersonalTab employee={employee} orgSlug={orgSlug} canEdit={canEdit} />
        )}
        {activeTab === 'employment' && (
          <EmploymentTab
            employee={employee}
            orgSlug={orgSlug}
            viewerRole={viewerRole}
            canEdit={canEdit}
            departments={departments}
            jobTitles={jobTitles}
            locations={locations}
            employmentTypes={employmentTypes}
            managers={managers}
            shiftTemplates={shiftTemplates}
            isSimplePayroll={isSimplePayroll}
          />
        )}
        {activeTab === 'documents' && documentsEnabled && (
          <EmployeeDocumentsTab employeeId={employee.id} orgSlug={orgSlug} />
        )}
        {activeTab === 'leave' && leaveEnabled && (
          <EmployeeLeaveTab employeeId={employee.id} orgSlug={orgSlug} />
        )}
        {activeTab === 'performance' && performanceEnabled && (
          <PerformanceTab
            employeeId={employee.id}
            orgSlug={orgSlug}
            reviewHistory={reviewHistory ?? []}
            autoMetrics={autoMetrics ?? null}
            reviewComplexity={reviewComplexity ?? 'simple'}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab employeeId={employee.id} orgSlug={orgSlug} />
        )}
      </div>
    </div>
  )
}
