import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/acme/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock notification actions
vi.mock('@/core/notifications/actions', () => ({
  markNotificationRead: vi.fn(async () => ({ success: true })),
  markAllNotificationsRead: vi.fn(async () => ({ success: true })),
}))

import { AppSidebar } from '../shell/app-sidebar'
import { AppHeader } from '../shell/app-header'
import { CommandPalette } from '../shell/command-palette'
import type { NavEntry } from '@/core/modules'

const mockNav: NavEntry[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Employees', href: '/employees', icon: 'Users', permission: 'employee.view_own' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
]

describe('AppSidebar', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('renders org name', () => {
    render(<AppSidebar orgSlug="acme" orgName="Acme Inc" navEntries={mockNav} />)
    expect(screen.getByText('Acme Inc')).toBeInTheDocument()
  })

  it('renders nav entries', () => {
    render(<AppSidebar orgSlug="acme" orgName="Acme Inc" navEntries={mockNav} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Employees')).toBeInTheDocument()
  })

  it('renders Settings in footer', () => {
    render(<AppSidebar orgSlug="acme" orgName="Acme Inc" navEntries={mockNav} />)
    // Settings is in the footer section
    const links = screen.getAllByText('Settings')
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the HRDaddy wordmark', () => {
    render(<AppSidebar orgSlug="acme" orgName="Acme Inc" navEntries={mockNav} />)
    expect(screen.getByText('HRDaddy')).toBeInTheDocument()
  })

  it('renders version number', () => {
    render(<AppSidebar orgSlug="acme" orgName="Acme Inc" navEntries={mockNav} version="1.0.0" />)
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('has collapse button', () => {
    render(<AppSidebar orgSlug="acme" orgName="Acme Inc" navEntries={mockNav} />)
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument()
  })

  it('marks active nav item', () => {
    render(<AppSidebar orgSlug="acme" orgName="Acme Inc" navEntries={mockNav} />)
    const dashLink = screen.getByRole('link', { name: /Dashboard/i })
    expect(dashLink).toHaveAttribute('aria-current', 'page')
  })
})

describe('AppHeader', () => {
  const defaultHeaderProps = {
    userName: 'John',
    userEmail: 'john@example.com',
    orgSlug: 'acme',
    notifications: [],
    unreadCount: 0,
    onSignOut: () => {},
  }

  it('renders command palette trigger', () => {
    render(<AppHeader {...defaultHeaderProps} />)
    expect(screen.getByLabelText('Open command palette')).toBeInTheDocument()
  })

  it('renders notification bell', () => {
    render(<AppHeader {...defaultHeaderProps} />)
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
  })

  it('renders profile menu button', () => {
    render(<AppHeader {...defaultHeaderProps} />)
    expect(screen.getByLabelText('Profile menu')).toBeInTheDocument()
  })

  it('shows profile dropdown on click', () => {
    render(<AppHeader {...defaultHeaderProps} />)
    fireEvent.click(screen.getByLabelText('Profile menu'))
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('renders breadcrumbs when provided', () => {
    render(
      <AppHeader
        {...defaultHeaderProps}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Page' }]}
      />
    )
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Page')).toBeInTheDocument()
  })
})

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette orgSlug="acme" navEntries={mockNav} open={false} onClose={() => {}} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders search input when open', () => {
    render(
      <CommandPalette orgSlug="acme" navEntries={mockNav} open={true} onClose={() => {}} />
    )
    expect(screen.getByPlaceholderText('Search pages...')).toBeInTheDocument()
  })

  it('renders nav entries as results', () => {
    render(
      <CommandPalette orgSlug="acme" navEntries={mockNav} open={true} onClose={() => {}} />
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Employees')).toBeInTheDocument()
  })

  it('filters results by query', () => {
    render(
      <CommandPalette orgSlug="acme" navEntries={mockNav} open={true} onClose={() => {}} />
    )
    const input = screen.getByPlaceholderText('Search pages...')
    fireEvent.change(input, { target: { value: 'emp' } })
    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})
