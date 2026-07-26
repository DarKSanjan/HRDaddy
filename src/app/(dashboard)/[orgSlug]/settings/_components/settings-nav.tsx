'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SettingsNavProps {
  orgSlug: string
  enabledModules: string[]
}

const TABS: Array<{ slug: string; label: string; requiresModule?: string }> = [
  { slug: 'profile', label: 'Profile' },
  { slug: 'organisation', label: 'Organisation', requiresModule: 'employees' },
  { slug: 'shifts', label: 'Shifts', requiresModule: 'employees' },
  { slug: 'payroll', label: 'Payroll', requiresModule: 'payroll' },
]

export function SettingsNav({ orgSlug, enabledModules }: SettingsNavProps) {
  const pathname = usePathname()
  const visibleTabs = TABS.filter(
    (tab) => !tab.requiresModule || enabledModules.includes(tab.requiresModule)
  )

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Settings sections">
      {visibleTabs.map((tab) => {
        const href = `/${orgSlug}/settings/${tab.slug}`
        const active = pathname === href
        return (
          <Link
            key={tab.slug}
            href={href}
            className={cn(
              'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-accent-500 text-text'
                : 'border-transparent text-text-muted hover:text-text hover:border-border'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
