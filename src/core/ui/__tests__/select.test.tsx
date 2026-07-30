import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from '../select'

describe('Select', () => {
  it('renders an accessible <select> element', () => {
    render(
      <Select aria-label="Test select">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    )
    expect(screen.getByLabelText('Test select')).toBeInTheDocument()
    expect(screen.getByLabelText('Test select').tagName).toBe('SELECT')
  })

  it('forwards className', () => {
    render(
      <Select className="custom-class" aria-label="Styled">
        <option>X</option>
      </Select>
    )
    expect(screen.getByLabelText('Styled')).toHaveClass('custom-class')
  })

  it('forwards disabled prop', () => {
    render(
      <Select disabled aria-label="Disabled select">
        <option>X</option>
      </Select>
    )
    expect(screen.getByLabelText('Disabled select')).toBeDisabled()
  })

  it('forwards value and calls onChange', () => {
    const onChange = vi.fn()
    render(
      <Select value="a" onChange={onChange} aria-label="Controlled">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    )
    fireEvent.change(screen.getByLabelText('Controlled'), {
      target: { value: 'b' },
    })
    expect(onChange).toHaveBeenCalled()
  })

  it('applies focus-visible ring classes', () => {
    render(
      <Select aria-label="Focus test">
        <option>X</option>
      </Select>
    )
    const el = screen.getByLabelText('Focus test')
    expect(el.className).toContain('focus-visible:ring-2')
    expect(el.className).toContain('focus-visible:ring-accent-500')
  })
})
