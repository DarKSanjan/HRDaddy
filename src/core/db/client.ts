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

export async function dbAs<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return dbAdmin.$transaction(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' })

    // set_config(..., is_local => true) is the parameterised equivalent of
    // SET LOCAL. `SET LOCAL` itself cannot take bind parameters, which is why
    // the naive version has to interpolate into SQL — this one does not.
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`
    await tx.$executeRaw`SELECT set_config('role', 'authenticated', true)`

    // If the role switch silently failed we would be running as the table
    // owner, which bypasses RLS entirely — a silent loss of tenant isolation.
    // Turn that into a loud failure.
    const [{ current_role }] = await tx.$queryRaw<
      { current_role: string }[]
    >`SELECT current_user AS current_role`

    if (current_role !== 'authenticated') {
      throw new RlsScopeError(
        `Expected to run as 'authenticated' but session role is '${current_role}'. ` +
          `Refusing to execute — RLS would not be enforced.`
      )
    }

    return fn(tx)
  })
}
