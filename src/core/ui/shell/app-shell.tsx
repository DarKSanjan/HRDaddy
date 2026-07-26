'use client'

import * as React from 'react'
import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { CommandPalette } from './command-palette'
import { MobileNav } from './mobile-nav'
import type { NavEntry } from '@/core/modules'
import type { BreadcrumbItem } from '@/core/ui/breadcrumb'

interface AppShellProps {
  orgSlug: string
  orgName: string
  orgLogo?: string | null
  userName: string
  userEmail: string
  navEntries: NavEntry[]
  notifications: { id: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: Date }[]
  unreadCount: number
  breadcrumbs?: BreadcrumbItem[]
  children: React.ReactNode
}

function AppShell({
  orgSlug,
  orgName,
  orgLogo,
  userName,
  userEmail,
  navEntries,
  notifications,
  unreadCount,
  breadcrumbs = [],
  children,
}: AppShellProps) {
  const [cmdOpen, setCmdOpen] = React.useState(false)

  const handleSignOut = React.useCallback(() => {
    // Submit the sign-out form programmatically
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/api/auth/sign-out'
    document.body.appendChild(form)
    form.submit()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AppSidebar
          orgSlug={orgSlug}
          orgName={orgName}
          orgLogo={orgLogo}
          navEntries={navEntries}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <AppHeader
          userName={userName}
          userEmail={userEmail}
          orgSlug={orgSlug}
          notifications={notifications}
          unreadCount={unreadCount}
          breadcrumbs={breadcrumbs}
          onSignOut={handleSignOut}
          onCommandPalette={() => setCmdOpen(true)}
        />

        {/* Mobile nav hamburger in header is handled separately */}
        <div className="md:hidden absolute top-3 left-3 z-40">
          <MobileNav orgSlug={orgSlug} orgName={orgName} navEntries={navEntries} />
        </div>

        <main className="flex-1 overflow-y-auto bg-bg-subtle p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Command palette */}
      <CommandPalette
        orgSlug={orgSlug}
        navEntries={navEntries}
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
      />
    </div>
  )
}

export { AppShell }
export type { AppShellProps }
