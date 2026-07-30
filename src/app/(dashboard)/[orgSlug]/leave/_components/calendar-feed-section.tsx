'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui'
import { Rss, Copy, Check, RefreshCw } from 'lucide-react'

interface CalendarFeedSectionProps {
  orgSlug: string
}

export function CalendarFeedSection({ orgSlug }: CalendarFeedSectionProps) {
  const [feedUrl, setFeedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const handleGenerateUrl = async () => {
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
      // Fallback for non-secure contexts
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rss className="h-4 w-4" />
          Calendar Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!feedUrl ? (
          <>
            <p className="text-[13px] text-text-muted">
              Subscribe to your leave calendar in Google Calendar, Outlook, or Apple Calendar.
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={handleGenerateUrl}
              loading={loading}
            >
              Generate Subscription URL
            </Button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-text-muted">
              Add this URL in Google Calendar under Settings → Add calendar → From URL — or the
              equivalent in Outlook/Apple Calendar.
            </p>

            {/* URL display with copy */}
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-[var(--radius-sm)] border border-border bg-surface-hover px-3 py-2 text-[12px] text-text">
                {feedUrl}
              </code>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleCopy}
                aria-label="Copy URL"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Regenerate link */}
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
              <span className="text-[11px] text-text-muted">
                (invalidates the current URL)
              </span>
            </div>
          </>
        )}

        {error && (
          <p className="text-[12px] text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Regenerate confirmation dialog */}
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
      </CardContent>
    </Card>
  )
}
