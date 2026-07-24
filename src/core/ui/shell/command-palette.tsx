'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import type { NavEntry } from '@/core/modules'

interface CommandPaletteProps {
  orgSlug: string
  navEntries: NavEntry[]
  open: boolean
  onClose: () => void
}

/**
 * Command palette — ⌘K / Ctrl+K. Navigate to any permitted page.
 * Fuzzy match, keyboard-only operable.
 * Uses key-based remount so state resets each time it opens.
 */
function CommandPalette({ orgSlug, navEntries, open, onClose }: CommandPaletteProps) {
  if (!open) return null
  return (
    <CommandPaletteInner
      key={String(open)}
      orgSlug={orgSlug}
      navEntries={navEntries}
      onClose={onClose}
    />
  )
}

function CommandPaletteInner({
  orgSlug,
  navEntries,
  onClose,
}: Omit<CommandPaletteProps, 'open'>) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    if (!query.trim()) return navEntries
    const lower = query.toLowerCase()
    return navEntries.filter((e) =>
      e.label.toLowerCase().includes(lower)
    )
  }, [query, navEntries])

  // Focus input on mount
  React.useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timeout)
  }, [])

  // Close on Escape
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      navigate(filtered[selectedIndex])
    }
  }

  function navigate(entry: NavEntry) {
    router.push(`/${orgSlug}${entry.href}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
      role="presentation"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" aria-hidden="true" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg rounded-[var(--radius-lg)] border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Input */}
        <div className="flex items-center border-b border-border px-3">
          <Search className="h-4 w-4 text-text-subtle shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent py-3 px-2 text-[14px] text-text placeholder:text-text-subtle outline-none"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search"
            aria-activedescendant={filtered[selectedIndex] ? `cmd-${selectedIndex}` : undefined}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
          />
        </div>

        {/* Results */}
        <ul
          id="cmd-list"
          role="listbox"
          className="max-h-[300px] overflow-y-auto p-1"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-[13px] text-text-muted">
              No results found.
            </li>
          )}
          {filtered.map((entry, i) => (
            <li
              key={entry.href}
              id={`cmd-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              className={cn(
                'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] cursor-pointer transition-colors',
                i === selectedIndex
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-text-muted hover:bg-surface-hover'
              )}
              onClick={() => navigate(entry)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="font-medium">{entry.label}</span>
              <span className="ml-auto text-[11px] text-text-subtle">{entry.href}</span>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-text-subtle">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

export { CommandPalette }
