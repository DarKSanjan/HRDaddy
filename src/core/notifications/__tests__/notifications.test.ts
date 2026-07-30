/**
 * Unit tests for the notification adapters.
 *
 * Mirrors the event-bus test pattern: handlers fire, a throwing handler
 * does not break other adapters.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NotificationAdapter, NotificationPayload } from '@/core/notifications'
import { CompositeNotificationAdapter } from '@/core/notifications/composite-adapter'
import { EmailNotificationAdapter } from '@/core/notifications/email-adapter'

// ── Mocks ────────────────────────────────────────────────

const mockSend = vi.fn()

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}))

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend }
  },
}))

const { dbAdmin } = await import('@/core/db/admin')

const basePayload: NotificationPayload = {
  orgId: 'org-1',
  userId: 'user-1',
  title: 'Test Title',
  message: 'Test message body',
  link: '/dashboard',
}

// ── CompositeNotificationAdapter ─────────────────────────

describe('CompositeNotificationAdapter', () => {
  it('fans out to all sub-adapters', async () => {
    const adapter1: NotificationAdapter = { send: vi.fn().mockResolvedValue(undefined) }
    const adapter2: NotificationAdapter = { send: vi.fn().mockResolvedValue(undefined) }

    const composite = new CompositeNotificationAdapter([adapter1, adapter2])
    await composite.send(basePayload)

    expect(adapter1.send).toHaveBeenCalledWith(basePayload)
    expect(adapter2.send).toHaveBeenCalledWith(basePayload)
  })

  it('does not throw if a sub-adapter throws', async () => {
    const failingAdapter: NotificationAdapter = {
      send: vi.fn().mockRejectedValue(new Error('Adapter exploded')),
    }
    const successAdapter: NotificationAdapter = {
      send: vi.fn().mockResolvedValue(undefined),
    }

    const composite = new CompositeNotificationAdapter([failingAdapter, successAdapter])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(composite.send(basePayload)).resolves.toBeUndefined()
    expect(successAdapter.send).toHaveBeenCalledWith(basePayload)
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})

// ── EmailNotificationAdapter ─────────────────────────────

describe('EmailNotificationAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.hrdaddy.com'
  })

  it('does not throw when RESEND_API_KEY is missing', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const adapter = new EmailNotificationAdapter()

    await expect(adapter.send(basePayload)).resolves.toBeUndefined()
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('RESEND_API_KEY is not set')
    )

    consoleWarn.mockRestore()
  })

  it('respects emailNotificationsEnabled = false and does not send', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    mockSend.mockResolvedValue({ data: { id: 'x' }, error: null })

    vi.mocked(dbAdmin.user.findUnique).mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User',
      emailNotificationsEnabled: false,
    } as never)

    const adapter = new EmailNotificationAdapter()
    await adapter.send(basePayload)

    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends email when preference is enabled and API key is set', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    mockSend.mockResolvedValue({ data: { id: 'x' }, error: null })

    vi.mocked(dbAdmin.user.findUnique).mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User',
      emailNotificationsEnabled: true,
    } as never)

    const adapter = new EmailNotificationAdapter()
    await adapter.send(basePayload)

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test Title',
      })
    )
  })

  it('builds absolute link from relative payload.link', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    mockSend.mockResolvedValue({ data: { id: 'x' }, error: null })

    vi.mocked(dbAdmin.user.findUnique).mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User',
      emailNotificationsEnabled: true,
    } as never)

    const adapter = new EmailNotificationAdapter()
    await adapter.send(basePayload)

    const htmlArg = mockSend.mock.calls[0][0].html as string
    expect(htmlArg).toContain('https://app.hrdaddy.com/dashboard')
  })

  it('does not throw when Resend returns an error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key', name: 'validation_error' },
    })

    vi.mocked(dbAdmin.user.findUnique).mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User',
      emailNotificationsEnabled: true,
    } as never)

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = new EmailNotificationAdapter()

    await expect(adapter.send(basePayload)).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})
