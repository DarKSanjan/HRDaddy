/**
 * Manual, one-time operational backfill. Run this after deployment with
 * EMPLOYEE_PII_ENCRYPTION_KEY configured; do not add it to migrations or deploy
 * automation. It is intentionally idempotent so it can be safely re-run.
 */
import 'dotenv/config'
import { dbAdmin } from '../src/core/db/admin'
import {
  decryptPII,
  encryptPII,
  PII_ENCRYPTION_PREFIX,
} from '../src/core/employees/pii-crypto'

async function main() {
  const employees = await dbAdmin.employee.findMany({
    where: {
      OR: [
        { nationalId: { not: null } },
        { bankName: { not: null } },
        { bankAccountNumber: { not: null } },
      ],
    },
    select: {
      id: true,
      nationalId: true,
      bankName: true,
      bankAccountNumber: true,
    },
  })

  let encryptedFields = 0

  for (const employee of employees) {
    const data: {
      nationalId?: string | null
      bankName?: string | null
      bankAccountNumber?: string | null
    } = {}

    for (const [field, value] of [
      ['nationalId', employee.nationalId],
      ['bankName', employee.bankName],
      ['bankAccountNumber', employee.bankAccountNumber],
    ] as const) {
      if (value !== null && !value.startsWith(PII_ENCRYPTION_PREFIX)) {
        const plain = decryptPII(value)
        data[field] = encryptPII(plain)
        if (plain !== null) encryptedFields++
      }
    }

    if (Object.keys(data).length > 0) {
      await dbAdmin.employee.update({ where: { id: employee.id }, data })
    }
  }

  console.log(`Scanned ${employees.length} employee rows; encrypted ${encryptedFields} PII fields.`)
}

main()
  .catch((error) => {
    console.error('Employee PII backfill failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbAdmin.$disconnect()
  })
