/**
 * RLS-scoped database client.
 *
 * Opens a transaction, switches the session role to `app_user` and installs
 * the caller's JWT claims, so every query inside the callback is evaluated by
 * Postgres row-level security.
 *
 * This is the client all feature code uses. `dbAdmin` bypasses RLS and is
 * confined to src/core/** by an ESLint boundary rule.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { dbAdmin } from './admin'

/**
 * Hosted Supabase blocks `SET ROLE` from the `postgres` connection role to any
 * role outside its platform's own allowlist (`supautils.hint_roles`: anon,
 * authenticated, service_role) — a hosting-level restriction, not a Postgres
 * GRANT issue, discovered only by testing against real production (a local
 * Docker Postgres has no such restriction, so it never surfaced there). A
 * custom role like `app_user` can never be reached via SET ROLE on hosted
 * Supabase, no matter what it's been granted.
 *
 * The fix is to connect to app_user directly (its own login credential)
 * instead of switching into it from `postgres`. When APP_USER_DATABASE_URL is
 * set (hosted Supabase), that direct connection is used. When it isn't set
 * (local/self-hosted Postgres via docker-compose, which has no such
 * restriction), this falls back to the original SET ROLE mechanism on the
 * shared dbAdmin connection.
 */
const globalForAppUserPrisma = globalThis as unknown as {
  appUserPrisma: PrismaClient | undefined
}

function getAppUserClient(): PrismaClient | undefined {
  const connectionString = process.env.APP_USER_DATABASE_URL
  if (!connectionString) return undefined

  if (!globalForAppUserPrisma.appUserPrisma) {
    globalForAppUserPrisma.appUserPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }
  return globalForAppUserPrisma.appUserPrisma
}

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
  // The JWT claims' "role" stays 'authenticated' — that's what auth.uid()
  // reads (via 'sub') and is just the identity claim, not the Postgres
  // session role. The actual session role is 'app_user', a role distinct
  // from 'authenticated' (which Supabase Auth maps every signed-in user's
  // direct PostgREST/REST call to). RLS policies are all declared
  // `TO authenticated`, which app_user matches via role membership
  // (`GRANT authenticated TO app_user` in 00024) — but app_user also holds
  // its own direct column grants that authenticated has had revoked on
  // sensitive employees columns, so a raw REST call and this trusted
  // connection are no longer equivalent. See 00024_authz_hardening_round3.
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' })

  const appUserClient = getAppUserClient()

  if (appUserClient) {
    // Hosted Supabase path: already connected as app_user (see
    // getAppUserClient's comment for why SET ROLE can't be used here).
    // Only the claims need installing per transaction.
    return appUserClient.$transaction(async (tx) => {
      const [{ current_role }] = await tx.$queryRaw<{ current_role: string }[]>`
        SELECT set_config('request.jwt.claims', ${claims}, true), current_user AS current_role
      `
      if (current_role !== 'app_user') {
        throw new RlsScopeError(
          `Expected to run as 'app_user' but session role is '${current_role}'. ` +
            `Refusing to execute — RLS would not be enforced.`
        )
      }
      return fn(tx)
    }, TX_OPTIONS)
  }

  // Local/self-hosted path: no platform-level SET ROLE restriction, so
  // switching role on the shared dbAdmin connection works fine.
  return dbAdmin.$transaction(async (tx) => {
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
