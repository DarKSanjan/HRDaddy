/**
 * dbAs tests.
 *
 * dbAs is the boundary that keeps tenant isolation honest, so these tests care
 * about three things: the claims are installed before any caller query runs,
 * the user id is carried into them, and a failed role switch aborts rather than
 * silently running with RLS bypassed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const callOrder: string[] = []
let currentRole = 'app_user'

/** Reassembles a Prisma tagged-template call into inspectable SQL. */
function render(strings: TemplateStringsArray, values: unknown[]): string {
  return strings.reduce(
    (acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ''),
    ''
  )
}

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw: async (
          strings: TemplateStringsArray,
          ...values: unknown[]
        ) => {
          callOrder.push(render(strings, values))
          return 1
        },
        $queryRaw: async (
          strings: TemplateStringsArray,
          ...values: unknown[]
        ) => {
          callOrder.push(render(strings, values))
          return [{ current_role: currentRole }]
        },
      }
      return fn(tx)
    },
  },
}))

describe('dbAs', () => {
  beforeEach(() => {
    callOrder.length = 0
    currentRole = 'app_user'
  })

  it('installs claims and switches role before the callback runs', async () => {
    const { dbAs } = await import('@/core/db/client')

    const result = await dbAs('test-user-id', async () => {
      callOrder.push('user_query')
      return 'result'
    })

    expect(result).toBe('result')

    // The single combined statement must appear before the user query
    const setupAt = callOrder.findIndex(
      (s) => s.includes('request.jwt.claims') && s.includes("set_config('role'")
    )
    const queryAt = callOrder.indexOf('user_query')

    expect(setupAt).toBeGreaterThanOrEqual(0)
    expect(queryAt).toBeGreaterThan(setupAt)
  })

  it('carries the user id into the JWT claims', async () => {
    const { dbAs } = await import('@/core/db/client')

    await dbAs('my-uuid-123', async () => 'ok')

    expect(callOrder.some((s) => s.includes('my-uuid-123'))).toBe(true)
  })

  it('sets claims through set_config rather than interpolated SET LOCAL', async () => {
    const { dbAs } = await import('@/core/db/client')

    await dbAs("bobby'; DROP TABLE users; --", async () => 'ok')

    // Parameterised binding means no raw SET LOCAL statement is ever built.
    expect(callOrder.some((s) => /SET\s+LOCAL\s+request\.jwt/i.test(s))).toBe(
      false
    )
    expect(callOrder.some((s) => s.includes('set_config'))).toBe(true)
  })

  it('refuses to run the callback when the role switch did not take effect', async () => {
    const { dbAs, RlsScopeError } = await import('@/core/db/client')

    currentRole = 'postgres' // table owner — would bypass RLS entirely

    const callback = vi.fn()

    await expect(dbAs('test-user-id', callback)).rejects.toThrow(RlsScopeError)
    expect(callback).not.toHaveBeenCalled()
  })

  it('collapses setup into a single round trip', async () => {
    const { dbAs } = await import('@/core/db/client')

    await dbAs('test-user-id', async () => 'ok')

    // Before the user callback, there should be exactly ONE setup statement
    // that contains both set_config calls and current_user
    const setupStatements = callOrder.filter(
      (s) => s.includes('set_config') && s.includes('current_user')
    )
    expect(setupStatements.length).toBe(1)
  })
})
