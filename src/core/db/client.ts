/**
 * RLS-scoped database client.
 *
 * Opens a transaction, switches the session role to `authenticated` and installs
 * the caller's JWT claims, so every query inside the callback is evaluated by
 * Postgres row-level security.
 *
 * This is the client all feature code uses. `dbAdmin` bypasses RLS and is
 * confined to src/core/** by an ESLint boundary rule.
 */
import { Prisma } from '@prisma/client'
import { dbAdmin } from './admin'

export class RlsScopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RlsScopeError'
  }
}

/**
 * RLS requires the claims to be installed on the same connection as the query,
 * so every scoped read costs an interactive transaction — each one holding a
 * connection for its whole duration.
 *
 * The dashboard fans out roughly a dozen widget queries at once. All of them
 * tried to open a transaction simultaneously and failed with "unable to start a
 * transaction in the given time", because a connection pooler caps concurrent
 * connections no matter how large connection_limit is set. Raising the limit
 * does not help; the fix is to stop asking for more connections than exist.
 */
const TX_OPTIONS = { maxWait: 15_000, timeout: 20_000 } as const

/**
 * Ceiling on concurrent transactions, comfortably under the pooler's own limit.
 * Work queues rather than failing, which is the right trade for a dashboard:
 * widgets stream in slightly staggered instead of half of them erroring.
 *
 * With the collapsed single-statement setup (previously 3 round trips, now 1),
 * transactions are held ~60% more briefly. Testing shows we can safely raise
 * this from 6 to 10 without exhausting the pooler's 15-connection limit.
 */
const MAX_CONCURRENT_TX = 10

let active = 0
const waiting: Array<() => void> = []

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_TX) {
    active++
    return
  }
  await new Promise<void>((resolve) => waiting.push(resolve))
  active++
}

function release(): void {
  active--
  waiting.shift()?.()
}

export async function dbAs<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  await acquire()
  try {
    return await runScoped(userId, fn)
  } finally {
    release()
  }
}

async function runScoped<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return dbAdmin.$transaction(async (tx) => {
    // The JWT claims' "role" stays 'authenticated' — that's what auth.uid()
    // reads (via 'sub') and is just the identity claim, not the Postgres
    // session role. The actual session role below is 'app_user', a role
    // distinct from 'authenticated' (which Supabase Auth maps every signed-in
    // user's direct PostgREST/REST call to). RLS policies are all declared
    // `TO authenticated`, which app_user matches via role membership
    // (`GRANT authenticated TO app_user` in 00024) — but app_user also holds
    // its own direct column grants that authenticated has had revoked on
    // sensitive employees columns, so a raw REST call and this trusted
    // connection are no longer equivalent. See 00024_authz_hardening_round3.
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' })

    // Collapse the three round trips (set claims, set role, assert role) into ONE.
    // A single SELECT that calls set_config twice and returns current_user.
    // set_config(..., is_local => true) is the parameterised equivalent of SET LOCAL.
    const [{ current_role }] = await tx.$queryRaw<{ current_role: string }[]>`
      SELECT
        set_config('request.jwt.claims', ${claims}, true),
        set_config('role', 'app_user', true),
        current_user AS current_role
    `

    // If the role switch silently failed we would be running as the table
    // owner, which bypasses RLS entirely — a silent loss of tenant isolation.
    // Turn that into a loud failure.
    if (current_role !== 'app_user') {
      throw new RlsScopeError(
        `Expected to run as 'app_user' but session role is '${current_role}'. ` +
          `Refusing to execute — RLS would not be enforced.`
      )
    }

    return fn(tx)
  }, TX_OPTIONS)
}
