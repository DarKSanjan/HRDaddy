'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Settings,
  LayoutDashboard,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  GitBranch,
  DollarSign,
  ClipboardCheck,
  TrendingUp,
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
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Settings,
  CreditCard,
  GitBranch,
  DollarSign,
  ClipboardCheck,
  TrendingUp,
}

/**
 * Renders a nav icon by name. Declared as a stable component (not created
 * during render) to satisfy React 19's static-components lint rule.
 */
function NavIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null
  const IconCmp = iconMap[name]
  if (!IconCmp) return null
  return <IconCmp className={className} aria-hidden="true" />
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
  storageUsedBytes?: number
  storageLimitBytes?: number
  canManageSettings?: boolean
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

// ─────────────────────────────────────────────
// Active-state helpers
// ─────────────────────────────────────────────

function matchesPath(pathname: string, href: string, orgSlug: string): boolean {
  const fullHref = `/${orgSlug}${href}`
  return pathname === fullHref || pathname.startsWith(`${fullHref}/`)
}

function hasActiveChild(pathname: string, entry: NavEntry, orgSlug: string): boolean {
  if (!entry.children) return false
  return entry.children.some((child) => matchesPath(pathname, child.href, orgSlug))
}

// ─────────────────────────────────────────────
// Nav item components
// ─────────────────────────────────────────────

interface NavItemProps {
  entry: NavEntry
  orgSlug: string
  pathname: string
  collapsed: boolean
}

function NavItemWithChildren({ entry, orgSlug, pathname, collapsed }: NavItemProps) {
  const sectionActive = matchesPath(pathname, entry.href, orgSlug)
  const childActive = hasActiveChild(pathname, entry, orgSlug)
  // Parent is the actual page only if the section is active but no child claims it
  const parentIsLeaf = sectionActive && !childActive

  // In expanded mode: manual toggle (null = follow URL-based auto-expand)
  const [manualOpen, setManualOpen] = React.useState<boolean | null>(null)
  const expanded = manualOpen ?? sectionActive

  // In collapsed mode: show flyout on hover
  const [flyoutVisible, setFlyoutVisible] = React.useState(false)
  const flyoutTimeout = React.useRef<ReturnType<typeof setTimeout>>(null)

  function showFlyout() {
    if (flyoutTimeout.current) clearTimeout(flyoutTimeout.current)
    setFlyoutVisible(true)
  }

  function hideFlyout() {
    flyoutTimeout.current = setTimeout(() => setFlyoutVisible(false), 150)
  }

  if (collapsed) {
    return (
      <li
        className="relative"
        onMouseEnter={showFlyout}
        onMouseLeave={hideFlyout}
        onFocus={showFlyout}
        onBlur={hideFlyout}
      >
        <Link
          href={`/${orgSlug}${entry.href}`}
          className={cn(
            'relative flex items-center justify-center rounded-[var(--radius-sm)] px-0 py-1.5 transition-colors',
            'min-h-[36px] touch-target',
            parentIsLeaf
              ? 'bg-accent-50 text-accent-700'
              : childActive
                ? 'text-accent-600'
                : 'text-text-muted hover:bg-surface-hover hover:text-text'
          )}
          title={entry.label}
          aria-current={parentIsLeaf ? 'page' : undefined}
        >
          {parentIsLeaf && (
            <span
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent-500"
              aria-hidden="true"
            />
          )}
          {childActive && !parentIsLeaf && (
            <span
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent-200"
              aria-hidden="true"
            />
          )}
          <NavIcon name={entry.icon} className="h-4 w-4 shrink-0" />
        </Link>

        {/* Flyout for children in collapsed mode */}
        {flyoutVisible && entry.children && entry.children.length > 0 && (
          <div
            className="absolute left-full top-0 z-50 ml-1.5 min-w-[160px] rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-lg"
            onMouseEnter={showFlyout}
            onMouseLeave={hideFlyout}
          >
            {/* Parent link in flyout */}
            <Link
              href={`/${orgSlug}${entry.href}`}
              className={cn(
                'flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                parentIsLeaf
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-text hover:bg-surface-hover'
              )}
              aria-current={parentIsLeaf ? 'page' : undefined}
            >
              {entry.label}
            </Link>
            <div className="my-1 h-px bg-border" aria-hidden="true" />
            {entry.children.map((child) => {
              const active = matchesPath(pathname, child.href, orgSlug)
              return (
                <Link
                  key={child.href}
                  href={`/${orgSlug}${child.href}`}
                  className={cn(
                    'flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] transition-colors',
                    active
                      ? 'bg-accent-50 font-semibold text-accent-700'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <NavIcon name={child.icon} className="h-3.5 w-3.5 shrink-0" />
                  {child.label}
                </Link>
              )
            })}
          </div>
        )}
      </li>
    )
  }

  // Expanded mode: inline sub-list
  return (
    <li>
      <div className="relative flex items-center">
        <Link
          href={`/${orgSlug}${entry.href}`}
          className={cn(
            'relative flex flex-1 items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] transition-colors',
            'min-h-[36px] touch-target',
            // Leave space for the chevron button when children exist
            entry.children && entry.children.length > 0 && 'pr-8',
            parentIsLeaf
              ? 'bg-accent-50 font-semibold text-accent-700'
              : childActive
                ? 'font-semibold text-text'
                : 'font-medium text-text-muted hover:bg-surface-hover hover:text-text'
          )}
          aria-current={parentIsLeaf ? 'page' : undefined}
        >
          {/* Active rail for leaf, subdued rail for section-open */}
          {parentIsLeaf && (
            <span
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent-500"
              aria-hidden="true"
            />
          )}
          {childActive && (
            <span
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent-200"
              aria-hidden="true"
            />
          )}
          <NavIcon name={entry.icon} className="h-4 w-4 shrink-0" />
          <span className="truncate">{entry.label}</span>
          {entry.badge && (
            <span className="ml-auto rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 tabular-nums">
              {entry.badge}
            </span>
          )}
        </Link>
        {entry.children && entry.children.length > 0 && (
          <button
            type="button"
            onClick={() => setManualOpen(!expanded)}
            className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-text-subtle hover:bg-surface-hover hover:text-text transition-colors"
            aria-label={expanded ? `Collapse ${entry.label}` : `Expand ${entry.label}`}
          >
            <ChevronRight
              className={cn(
                'h-3 w-3 shrink-0 transition-transform duration-150',
                expanded && 'rotate-90'
              )}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* Children sub-list */}
      {expanded && entry.children && entry.children.length > 0 && (
        <ul className="mt-0.5 ml-[22px] space-y-0.5 border-l border-border pl-2.5">
          {entry.children.map((child) => {
            const active = matchesPath(pathname, child.href, orgSlug)
            return (
              <li key={child.href}>
                <Link
                  href={`/${orgSlug}${child.href}`}
                  className={cn(
                    'flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] transition-colors',
                    'min-h-[32px] touch-target',
                    active
                      ? 'bg-accent-50 font-semibold text-accent-700'
                      : 'font-medium text-text-muted hover:bg-surface-hover hover:text-text'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <NavIcon name={child.icon} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function NavItemSimple({ entry, orgSlug, pathname, collapsed }: NavItemProps) {
  const href = `/${orgSlug}${entry.href}`
  const isActive = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <li>
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
        <NavIcon name={entry.icon} className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{entry.label}</span>}
        {!collapsed && entry.badge && (
          <span className="ml-auto rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 tabular-nums">
            {entry.badge}
          </span>
        )}
      </Link>
    </li>
  )
}

// ─────────────────────────────────────────────
// Storage usage bar
// ─────────────────────────────────────────────

function formatStorageSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function StorageBar({ usedBytes, limitBytes, collapsed }: { usedBytes: number; limitBytes: number; collapsed: boolean }) {
  const percentage = Math.min((usedBytes / limitBytes) * 100, 100)

  if (collapsed) {
    // In collapsed mode, show a tiny vertical bar indicator
    return (
      <div className="flex justify-center px-2 py-1" title={`${formatStorageSize(usedBytes)} of ${formatStorageSize(limitBytes)} used`}>
        <div className="h-6 w-1.5 rounded-full bg-surface-hover overflow-hidden">
          <div
            className="w-full rounded-full bg-accent-500 transition-all"
            style={{ height: `${percentage}%`, marginTop: `${100 - percentage}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="px-2.5 py-1.5">
      <div className="h-1.5 w-full rounded-full bg-surface-hover overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            percentage > 90 ? 'bg-danger' : percentage > 70 ? 'bg-warning' : 'bg-accent-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-text-subtle">
        {formatStorageSize(usedBytes)} of {formatStorageSize(limitBytes)} used
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main sidebar
// ─────────────────────────────────────────────

export function AppSidebar({ orgSlug, orgName, orgLogo, navEntries, version = '0.1.0', storageUsedBytes, storageLimitBytes, canManageSettings }: AppSidebarProps) {
  const pathname = usePathname()
  const collapsed = React.useSyncExternalStore(subscribeToStorage, getCollapsedSnapshot, getServerSnapshot)

  const toggleCollapse = () => {
    const next = !collapsed
    localStorage.setItem(STORAGE_KEY, String(next))
    // Dispatch storage event to trigger re-render
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }

  // Filter out any nav entry labelled 'Settings' from main nav (no longer needed)
  const mainNav = navEntries.filter((e) => e.label !== 'Settings')

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
          {mainNav.map((entry) =>
            entry.children && entry.children.length > 0 ? (
              <NavItemWithChildren
                key={entry.href}
                entry={entry}
                orgSlug={orgSlug}
                pathname={pathname}
                collapsed={collapsed}
              />
            ) : (
              <NavItemSimple
                key={entry.href}
                entry={entry}
                orgSlug={orgSlug}
                pathname={pathname}
                collapsed={collapsed}
              />
            )
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 py-2 space-y-0.5">
        {/* Settings */}
        {canManageSettings && (
          <Link
            href={`/${orgSlug}/settings`}
            className={cn(
              'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text',
              'min-h-[36px] touch-target',
              pathname.startsWith(`/${orgSlug}/settings`) && 'bg-accent-50 text-accent-700',
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

        {/* Storage usage bar */}
        {storageUsedBytes !== undefined && storageLimitBytes !== undefined && (
          <StorageBar
            usedBytes={storageUsedBytes}
            limitBytes={storageLimitBytes}
            collapsed={collapsed}
          />
        )}

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
