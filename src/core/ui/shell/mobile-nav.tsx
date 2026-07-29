'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavEntry } from '@/core/modules'

interface MobileNavProps {
  orgSlug: string
  orgName: string
  navEntries: NavEntry[]
  canManageSettings?: boolean
}

/**
 * Mobile navigation: hamburger + slide-over sheet.
 * Shown below md breakpoint.
 * Uses key-based remount to close on route change.
 */
function MobileNav({ orgSlug, orgName, navEntries, canManageSettings }: MobileNavProps) {
  const pathname = usePathname()

  // Remount inner state on path change by using pathname as key
  return (
    <MobileNavInner
      key={pathname}
      orgSlug={orgSlug}
      orgName={orgName}
      navEntries={navEntries}
      canManageSettings={canManageSettings}
      pathname={pathname}
    />
  )
}

function MobileNavInner({
  orgSlug,
  orgName,
  navEntries,
  canManageSettings,
  pathname,
}: MobileNavProps & { pathname: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      {/* Hamburger button — rendered in header on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:bg-surface-hover md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Slide-over sheet */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <div className="absolute inset-y-0 left-0 w-[280px] bg-bg border-r border-border flex flex-col">
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-[14px] font-semibold text-text">{orgName}</span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:bg-surface-hover"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Mobile navigation">
              <ul className="space-y-0.5">
                {navEntries.map((entry) => {
                  const href = `/${orgSlug}${entry.href}`
                  const sectionActive = pathname === href || pathname.startsWith(`${href}/`)
                  const childActive = entry.children?.some((child) => {
                    const childHref = `/${orgSlug}${child.href}`
                    return pathname === childHref || pathname.startsWith(`${childHref}/`)
                  }) ?? false
                  const parentIsLeaf = sectionActive && !childActive
                  const expanded = sectionActive && !!entry.children?.length

                  return (
                    <li key={entry.href}>
                      <Link
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[14px] font-medium transition-colors min-h-[44px]',
                          parentIsLeaf
                            ? 'bg-accent-50 text-accent-700'
                            : childActive
                              ? 'font-semibold text-text'
                              : 'text-text-muted hover:bg-surface-hover hover:text-text'
                        )}
                        aria-current={parentIsLeaf ? 'page' : undefined}
                      >
                        {entry.label}
                      </Link>
                      {expanded && entry.children && (
                        <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-3">
                          {entry.children.map((child) => {
                            const childHref = `/${orgSlug}${child.href}`
                            const active = pathname === childHref || pathname.startsWith(`${childHref}/`)
                            return (
                              <li key={child.href}>
                                <Link
                                  href={childHref}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors min-h-[40px]',
                                    active
                                      ? 'bg-accent-50 text-accent-700 font-semibold'
                                      : 'text-text-muted hover:bg-surface-hover hover:text-text'
                                  )}
                                  aria-current={active ? 'page' : undefined}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
                {canManageSettings && (
                  <li>
                    <Link
                      href={`/${orgSlug}/settings`}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[14px] font-medium transition-colors min-h-[44px]',
                        pathname.startsWith(`/${orgSlug}/settings`)
                          ? 'bg-accent-50 text-accent-700'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text'
                      )}
                      aria-current={pathname.startsWith(`/${orgSlug}/settings`) ? 'page' : undefined}
                    >
                      <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Settings
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}

export { MobileNav }
