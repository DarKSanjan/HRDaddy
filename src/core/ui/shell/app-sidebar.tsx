'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Settings,
  LayoutDashboard,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/core/ui/logo'
import type { NavEntry } from '@/core/modules'

// ─────────────────────────────────────────────
// Icon mapping: string → Lucide component
// ─────────────────────────────────────────────
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Settings,
  CreditCard,
}

function getIcon(name?: string): LucideIcon | null {
  if (!name) return null
  return iconMap[name] ?? null
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface AppSidebarProps {
  orgSlug: string
  orgName: string
  orgLogo?: string | null
  navEntries: NavEntry[]
  version?: string
}

// ─────────────────────────────────────────────
// Sidebar state via useSyncExternalStore
// ─────────────────────────────────────────────
const STORAGE_KEY = 'hrdaddy-sidebar-collapsed'

function getCollapsedSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function getServerSnapshot(): boolean {
  return false
}

function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

export function AppSidebar({ orgSlug, orgName, orgLogo, navEntries, version = '0.1.0' }: AppSidebarProps) {
  const pathname = usePathname()
  const collapsed = React.useSyncExternalStore(subscribeToStorage, getCollapsedSnapshot, getServerSnapshot)

  const toggleCollapse = () => {
    const next = !collapsed
    localStorage.setItem(STORAGE_KEY, String(next))
    // Dispatch storage event to trigger re-render
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }

  // Settings entry (always at bottom)
  const mainNav = navEntries.filter((e) => e.label !== 'Settings')
  const settingsEntry = navEntries.find((e) => e.label === 'Settings')

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-bg transition-[width] duration-[160ms] ease-out',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'
      )}
    >
      {/* Org switcher area */}
      <div className="flex h-14 items-center border-b border-border px-3">
        <Link
          href={`/${orgSlug}/dashboard`}
          className={cn(
            'flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors hover:bg-surface-hover',
            collapsed && 'justify-center px-0'
          )}
        >
          {orgLogo ? (
            <img src={orgLogo} alt="" className="h-6 w-6 rounded-[var(--radius-xs)]" aria-hidden="true" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-xs)] bg-accent-100 text-[11px] font-bold text-accent-700">
              {orgName.charAt(0).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <span className="text-[13px] font-semibold text-text truncate max-w-[140px]">
              {orgName}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {mainNav.map((entry) => {
            const href = `/${orgSlug}${entry.href}`
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            const Icon = getIcon(entry.icon)

            return (
              <li key={entry.href}>
                <Link
                  href={href}
                  className={cn(
                    'relative flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] transition-colors',
                    'min-h-[36px] touch-target',
                    isActive
                      ? 'bg-accent-50 font-semibold text-accent-700'
                      : 'font-medium text-text-muted hover:bg-surface-hover hover:text-text',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? entry.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Accent left-rail for active item */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent-500"
                      aria-hidden="true"
                    />
                  )}
                  {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  {!collapsed && <span className="truncate">{entry.label}</span>}
                  {!collapsed && entry.badge && (
                    <span className="ml-auto rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 tabular-nums">
                      {entry.badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 py-2 space-y-0.5">
        {/* Settings */}
        {settingsEntry && (
          <Link
            href={`/${orgSlug}${settingsEntry.href}`}
            className={cn(
              'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text',
              'min-h-[36px] touch-target',
              pathname.startsWith(`/${orgSlug}${settingsEntry.href}`) && 'bg-accent-50 text-accent-700',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Settings</span>}
          </Link>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-muted',
            'min-h-[36px] touch-target',
            collapsed && 'justify-center px-0'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* HR Daddy brand mark */}
        <div className={cn(
          'flex items-center px-2.5 py-1',
          collapsed && 'justify-center px-0'
        )}>
          <Logo size={16} showText={!collapsed} version={!collapsed ? version : undefined} />
        </div>
      </div>
    </aside>
  )
}
