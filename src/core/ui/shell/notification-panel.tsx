'use client'

import * as React from 'react'
import { Bell, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { markNotificationRead, markAllNotificationsRead } from '@/core/notifications/actions'

interface NotificationItem {
  id: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: Date
}

interface NotificationPanelProps {
  notifications: NotificationItem[]
  unreadCount: number
  orgSlug: string
}

export function NotificationPanel({ notifications, unreadCount, orgSlug }: NotificationPanelProps) {
  const [open, setOpen] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const router = useRouter()

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(orgSlug, id)
    router.refresh()
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(orgSlug)
    router.refresh()
    setOpen(false)
  }

  const handleClickNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      await markNotificationRead(orgSlug, item.id)
    }
    if (item.link) {
      router.push(item.link)
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-80 rounded-[var(--radius-md)] border border-border bg-surface shadow-lg"
          role="menu"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-[14px] font-semibold text-text">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[12px] font-medium text-accent-500 hover:text-accent-600"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-6 w-6 text-text-subtle" aria-hidden="true" />
                <p className="mt-2 text-[13px] text-text-muted">No notifications yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleClickNotification(item)}
                      className={[
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover',
                        !item.isRead ? 'bg-accent-50/50' : '',
                      ].join(' ')}
                      role="menuitem"
                    >
                      <div className="flex-1 min-w-0">
                        <p className={[
                          'text-[13px] text-text',
                          !item.isRead ? 'font-semibold' : '',
                        ].join(' ')}>
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-text-muted line-clamp-2">
                          {item.message}
                        </p>
                        <p className="mt-1 text-[11px] text-text-subtle">
                          {formatRelativeTime(new Date(item.createdAt))}
                        </p>
                      </div>
                      {!item.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkRead(item.id)
                          }}
                          className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-surface-hover hover:text-accent-500"
                          aria-label="Mark as read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}
