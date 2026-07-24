'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock,
  FileText,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrgRole } from '@prisma/client'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: OrgRole[]
}

function getNavItems(orgSlug: string): NavItem[] {
  return [
    {
      label: 'Dashboard',
      href: `/${orgSlug}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      label: 'Employees',
      href: `/${orgSlug}/employees`,
      icon: Users,
      roles: ['OWNER', 'HR_ADMIN', 'MANAGER'],
    },
    {
      label: 'Leave',
      href: `/${orgSlug}/leave`,
      icon: CalendarDays,
    },
    {
      label: 'Attendance',
      href: `/${orgSlug}/attendance`,
      icon: Clock,
    },
    {
      label: 'Documents',
      href: `/${orgSlug}/documents`,
      icon: FileText,
    },
    {
      label: 'Settings',
      href: `/${orgSlug}/settings`,
      icon: Settings,
      roles: ['OWNER', 'HR_ADMIN'],
    },
  ]
}

interface SidebarProps {
  orgSlug: string
  orgName: string
  role: OrgRole
}

export function Sidebar({ orgSlug, orgName, role }: SidebarProps) {
  const pathname = usePathname()
  const navItems = getNavItems(orgSlug)

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-gray-50">
      <div className="flex h-16 items-center border-b px-6">
        <Link href={`/${orgSlug}/dashboard`} className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">{orgName}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
