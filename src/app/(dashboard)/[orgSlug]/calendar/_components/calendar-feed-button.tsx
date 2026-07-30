'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui'
import { Rss, Copy, Check, RefreshCw } from 'lucide-react'

interface CalendarFeedButtonProps {
  orgSlug: string
}

export function CalendarFeedButton({ orgSlug }: CalendarFeedButtonProps) {
  const [open, setOpen] = useState(false)
  const [feedUrl, setFeedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const handleOpen = async () => {
    setOpen(true)
    if (feedUrl) return
    setLoading(true)
    setError(null)
    try {
      const { getOrCreateCalendarFeedToken } = await import('@/core/calendar-feed/actions')
      const result = await getOrCreateCalendarFeedToken(orgSlug)
      if (result.success && result.feedUrl) {
        setFeedUrl(result.feedUrl)
      } else {
        setError(result.error ?? 'Failed to generate feed URL.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = feedUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setError(null)
    try {
      const { regenerateCalendarFeedToken } = await import('@/core/calendar-feed/actions')
      const result = await regenerateCalendarFeedToken(orgSlug)
      if (result.success && result.feedUrl) {
        setFeedUrl(result.feedUrl)
        setRegenerateOpen(false)
      } else {
        setError(result.error ?? 'Failed to regenerate feed URL.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        <Rss className="h-3.5 w-3.5" />
        Subscribe
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calendar Feed</DialogTitle>
            <DialogDescription>
              Subscribe to your calendar (holidays + leave) in Google Calendar, Outlook, or Apple Calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {loading ? (
              <p className="text-[13px] text-text-muted">Generating your link…</p>
            ) : feedUrl ? (
              <>
                <p className="text-[12px] text-text-muted">
                  Add this URL under Settings → Add calendar → From URL — or the equivalent in
                  Outlook/Apple Calendar.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-[var(--radius-sm)] border border-border bg-surface-hover px-3 py-2 text-[12px] text-text">
                    {feedUrl}
                  </code>
                  <Button variant="secondary" size="icon" onClick={handleCopy} aria-label="Copy URL">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRegenerateOpen(true)}
                    className="text-[12px]"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Regenerate link
                  </Button>
                  <span className="text-[11px] text-text-muted">(invalidates the current URL)</span>
                </div>
              </>
            ) : null}

            {error && (
              <p className="text-[12px] text-danger" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" size="md" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate confirmation — nested dialog, opened from within the feed dialog */}
      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Calendar Link</DialogTitle>
            <DialogDescription>
              This will invalidate your current subscription URL. Any calendar app using the old
              URL will stop receiving updates. You&apos;ll need to re-add the new URL in your
              calendar app.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="secondary" size="md" onClick={() => setRegenerateOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={handleRegenerate} loading={regenerating}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
