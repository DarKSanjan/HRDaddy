import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../button'
import { Input } from '../input'
import { Badge } from '../badge'
import { Avatar } from '../avatar'
import { Skeleton } from '../skeleton'
import { Label } from '../label'
import { FormField } from '../form-field'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card'
import { EmptyState } from '../empty-state'
import { Logo } from '../logo'
import { Breadcrumb } from '../breadcrumb'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<Button loading>Submit</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('applies variant classes', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toContain('bg-danger')
  })

  it('applies size classes', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button', { name: 'Small' })
    expect(btn.className).toContain('h-8')
  })
})

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('supports type prop', () => {
    render(<Input type="email" data-testid="email" />)
    expect(screen.getByTestId('email')).toHaveAttribute('type', 'email')
  })
})

describe('Badge', () => {
  it('renders with text', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    render(<Badge variant="success">Done</Badge>)
    const badge = screen.getByText('Done')
    expect(badge.className).toContain('text-success')
  })
})

describe('Avatar', () => {
  it('renders initials fallback', () => {
    render(<Avatar fallback="John Doe" />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('has img role with aria-label', () => {
    render(<Avatar fallback="Jane Smith" />)
    expect(screen.getByRole('img', { name: 'Jane Smith' })).toBeInTheDocument()
  })
})

describe('Skeleton', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Label', () => {
  it('renders label text', () => {
    render(<Label htmlFor="test">Email</Label>)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })
})

describe('FormField', () => {
  it('renders label and input', () => {
    render(
      <FormField label="Name" htmlFor="name">
        <input id="name" />
      </FormField>
    )
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('shows error message with alert role', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Required">
        <input id="email" />
      </FormField>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })

  it('shows hint text', () => {
    render(
      <FormField label="Password" htmlFor="pw" hint="Min 8 chars">
        <input id="pw" />
      </FormField>
    )
    expect(screen.getByText('Min 8 chars')).toBeInTheDocument()
  })

  it('marks required fields with asterisk', () => {
    render(
      <FormField label="Name" htmlFor="name" required>
        <input id="name" />
      </FormField>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders card with content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Desc')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No items" description="Add your first item" />)
    expect(screen.getByText('No items')).toBeInTheDocument()
    expect(screen.getByText('Add your first item')).toBeInTheDocument()
  })

  it('renders action button', () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        action={{ label: 'Add', onClick: () => {} }}
      />
    )
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})

describe('Logo', () => {
  it('renders the wordmark text', () => {
    render(<Logo showText />)
    expect(screen.getByText('HRDaddy')).toBeInTheDocument()
  })

  it('renders version when provided', () => {
    render(<Logo showText version="0.1.0" />)
    expect(screen.getByText('0.1.0')).toBeInTheDocument()
  })

  it('hides text when showText is false', () => {
    render(<Logo showText={false} />)
    expect(screen.queryByText('HRDaddy')).not.toBeInTheDocument()
  })
})

describe('Breadcrumb', () => {
  it('renders breadcrumb items', () => {
    render(
      <Breadcrumb items={[
        { label: 'Home', href: '/' },
        { label: 'Employees', href: '/employees' },
        { label: 'John Doe' },
      ]} />
    )
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('marks last item as current page', () => {
    render(
      <Breadcrumb items={[
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ]} />
    )
    expect(screen.getByText('Current')).toHaveAttribute('aria-current', 'page')
  })

  it('has navigation landmark', () => {
    render(<Breadcrumb items={[{ label: 'Home' }]} />)
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
  })
})
