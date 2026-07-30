import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { PageHeader } from '../page-header'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(
      <PageHeader
        breadcrumbItems={[{ label: 'Home' }]}
        title="My Title"
      />
    )
    expect(screen.getByText('My Title')).toBeInTheDocument()
    expect(screen.getByText('My Title').tagName).toBe('H1')
  })

  it('renders breadcrumb items', () => {
    render(
      <PageHeader
        breadcrumbItems={[
          { label: 'Settings', href: '/settings' },
          { label: 'Profile' },
        ]}
        title="Profile"
      />
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings')
  })

  it('renders subtitle when provided', () => {
    render(
      <PageHeader
        breadcrumbItems={[{ label: 'Page' }]}
        title="Title"
        subtitle="Some description"
      />
    )
    expect(screen.getByText('Some description')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    const { container } = render(
      <PageHeader
        breadcrumbItems={[{ label: 'Page' }]}
        title="Title"
      />
    )
    expect(container.querySelector('p')).toBeNull()
  })

  it('renders actions when provided', () => {
    render(
      <PageHeader
        breadcrumbItems={[{ label: 'Page' }]}
        title="Title"
        actions={<button type="button">Action</button>}
      />
    )
    expect(screen.getByText('Action')).toBeInTheDocument()
  })
})
