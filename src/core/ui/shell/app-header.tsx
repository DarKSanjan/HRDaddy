'use client'

import * as React from 'react'
import { Bell, Search, Moon, Sun, Monitor, LogOut } from 'lucide-react'
import { Avatar } from '@/core/ui/avatar'
import { Breadcrumb, type BreadcrumbItem } from '@/core/ui/breadcrumb'

interface AppHeaderProps {
  userName: string
  userEmail: string
  breadcrumbs?: BreadcrumbItem[]
  onSignOut: () => void
  onCommandPalette?: () => void
}

type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'hrdaddy-theme'

function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return 'system'
  return (localStorage.getItem(THEME_KEY) as Theme) || 'system'
}

function getThemeServerSnapshot(): Theme {
  return 'system'
}

function subscribeTheme(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function applyTheme(t: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (t === 'light') root.classList.add('light')
  else if (t === 'dark') root.classList.add('dark')
}

function AppHeader({
  userName,
  userEmail,
  breadcrumbs = [],
  onSignOut,
  onCommandPalette,
}: AppHeaderProps) {
  const theme = React.useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Apply theme class on mount and changes
  React.useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Handle keyboard shortcut for command palette
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onCommandPalette?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCommandPalette])

  // Close menu on click outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [profileOpen])

  function cycleTheme() {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY }))
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-bg px-4">
      {/* Left: breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} />}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Command palette trigger */}
        <button
          onClick={onCommandPalette}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-2.5 py-1 text-[12px] text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-muted"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline-flex h-4 items-center rounded border border-border px-1 text-[10px] font-medium text-text-subtle">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Profile menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] px-1.5 transition-colors hover:bg-surface-hover"
            aria-expanded={profileOpen}
            aria-haspopup="true"
            aria-label="Profile menu"
          >
            <Avatar fallback={userName} size="sm" />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-10 z-50 w-56 rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-lg"
              role="menu"
              aria-label="User menu"
            >
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-[13px] font-medium text-text">{userName}</p>
                <p className="text-[12px] text-text-muted truncate">{userEmail}</p>
              </div>

              <button
                onClick={cycleTheme}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-xs)] px-3 py-1.5 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                role="menuitem"
              >
                <ThemeIcon className="h-4 w-4" aria-hidden="true" />
                Theme: {theme}
              </button>

              <button
                onClick={() => {
                  setProfileOpen(false)
                  onSignOut()
                }}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-xs)] px-3 py-1.5 text-[13px] text-danger transition-colors hover:bg-surface-hover"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export { AppHeader }
export type { AppHeaderProps }
