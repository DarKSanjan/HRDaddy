import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { PrismaPg } = require('@prisma/adapter-pg') as { PrismaPg: new (opts: { connectionString: string }) => unknown }
  const connectionString = process.env.DATABASE_URL!
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

// Lazy singleton - only created on first property access at runtime
let _db: PrismaClient | undefined

Object.defineProperty(globalForPrisma, '__db_getter', {
  get() {
    if (!_db) {
      _db = globalForPrisma.prisma ?? createClient()
      if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = _db
      }
    }
    return _db
  },
})

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (prop === Symbol.toPrimitive || prop === 'then') return undefined
    if (!_db) {
      _db = globalForPrisma.prisma ?? createClient()
      if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = _db
      }
    }
    const val = (_db as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof val === 'function') return val.bind(_db)
    return val
  },
})
