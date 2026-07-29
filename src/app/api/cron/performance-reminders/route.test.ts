import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/modules/performance/reminders', () => ({
  sendPerformanceReminders: vi.fn(async () => ({ notified: 3 })),
}))

import { GET } from './route'
import { sendPerformanceReminders } from '@/modules/performance/reminders'

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/performance-reminders', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/performance-reminders', () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret
  })

  it('fails closed with 500 when CRON_SECRET is not configured, even with a matching literal header', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeRequest('Bearer undefined'))
    expect(res.status).toBe(500)
    expect(sendPerformanceReminders).not.toHaveBeenCalled()
  })

  it('rejects a request with no authorization header', async () => {
    process.env.CRON_SECRET = 'test-secret'
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(sendPerformanceReminders).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong bearer token', async () => {
    process.env.CRON_SECRET = 'test-secret'
    const res = await GET(makeRequest('Bearer wrong-token'))
    expect(res.status).toBe(401)
    expect(sendPerformanceReminders).not.toHaveBeenCalled()
  })

  it('runs reminders and returns the result for a correct bearer token', async () => {
    process.env.CRON_SECRET = 'test-secret'
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notified: 3 })
    expect(sendPerformanceReminders).toHaveBeenCalledTimes(1)
  })
})
