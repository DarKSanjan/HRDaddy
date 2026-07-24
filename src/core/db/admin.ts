/**
 * Service-role Prisma client. Bypasses RLS.
 *
 * Import restricted to src/core/** by an ESLint boundary rule. Legitimate uses
 * are exactly three: the signup transaction before a membership exists,
 * background jobs, and migrations. Everything else goes through dbAs().
 *
 * Constructed lazily. Prisma 7 requires a driver adapter, and building the
 * client eagerly at import time makes this module throw in any context that has
 * no DATABASE_URL — which took the module registry down with it, since the
 * kernel imports from here.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. It is required for any database access.'
    )
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient()
  }
  return globalForPrisma.prisma
}

/**
 * Proxy so the client is built on first property access rather than on import.
 * Importing this module must stay side-effect free.
 */
export const dbAdmin: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
  has(_target, prop) {
    return Reflect.has(getClient(), prop)
  },
})
