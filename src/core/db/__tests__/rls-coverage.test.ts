/**
 * RLS coverage test — ensures every table with an org_id column has an RLS policy.
 * This test validates the migration SQL structure, not a live DB connection.
 * It reads the migration file and ensures every tenant-owned table from the schema
 * is covered.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

// Tables that have org_id and require RLS policies
const TENANT_OWNED_TABLES = [
  'organisation_memberships',
  'invitations',
  'organisation_settings',
  'organisation_modules',
  'employees',
  'departments',
  'job_titles',
  'work_locations',
  'employment_types',
  'leave_types',
  'leave_policies',
  'leave_balances',
  'leave_requests',
  'attendance_records',
  'onboarding_templates',
  'employee_onboardings',
  'employee_onboarding_tasks',
  'document_categories',
  'employee_documents',
  'payroll_periods',
  'payroll_records',
  'payroll_line_items',
  'notifications',
  'audit_logs',
]

/**
 * Tables that are not keyed by org_id but still leak across tenants without a
 * policy. `organisations` is keyed by id; `users` and `org_setup_progress` are
 * user-scoped. Omitting these was the original gap.
 */
const NON_ORG_SCOPED_TABLES = ['organisations', 'users', 'org_setup_progress']

/**
 * Tables reachable through PostgREST that carry no org_id and so were missed by
 * the first pass. onboarding_template_tasks is keyed only by template_id and
 * was flagged by the Supabase security advisor; it is scoped via its parent.
 */
const INDIRECTLY_SCOPED_TABLES = ['onboarding_template_tasks']

/**
 * Reads every migration, not just the first. Policies added in later migrations
 * count as coverage, and a test that only read 00001 would report a false gap.
 */
function readMigration(): string {
  const dir = join(process.cwd(), 'prisma/migrations')
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, 'migration.sql')))
    .sort()
    .map((d) => readFileSync(join(dir, d, 'migration.sql'), 'utf-8'))
    .join('\n')
}

describe('RLS Coverage', () => {
  it('every tenant-owned table has an RLS policy in the migration', () => {
    const migration = readMigration()

    const missingRLS: string[] = []
    const missingPolicy: string[] = []

    for (const table of TENANT_OWNED_TABLES) {
      // Check for ENABLE ROW LEVEL SECURITY
      const rlsRegex = new RegExp(
        `ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        'i'
      )
      if (!rlsRegex.test(migration)) {
        missingRLS.push(table)
      }

      // Check for CREATE POLICY
      const policyRegex = new RegExp(
        `CREATE\\s+POLICY\\s+\\w+\\s+ON\\s+${table}`,
        'i'
      )
      if (!policyRegex.test(migration)) {
        missingPolicy.push(table)
      }
    }

    expect(missingRLS).toEqual([])
    expect(missingPolicy).toEqual([])
  })

  it('user-scoped and org-keyed tables are covered too', () => {
    const migration = readMigration()

    for (const table of NON_ORG_SCOPED_TABLES) {
      expect(
        new RegExp(
          `ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
          'i'
        ).test(migration),
        `${table} is missing ENABLE ROW LEVEL SECURITY`
      ).toBe(true)
      expect(
        new RegExp(`CREATE\\s+POLICY\\s+\\w+\\s+ON\\s+${table}`, 'i').test(
          migration
        ),
        `${table} is missing a policy`
      ).toBe(true)
    }
  })

  it('every protected table also forces RLS for the table owner', () => {
    const migration = readMigration()

    for (const table of [...TENANT_OWNED_TABLES, ...NON_ORG_SCOPED_TABLES, ...INDIRECTLY_SCOPED_TABLES]) {
      expect(
        new RegExp(
          `ALTER\\s+TABLE\\s+${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`,
          'i'
        ).test(migration),
        `${table} is missing FORCE ROW LEVEL SECURITY`
      ).toBe(true)
    }
  })

  it('grants table privileges to the authenticated role', () => {
    const migration = readMigration()

    // RLS narrows rows but grants nothing. Without these, every dbAs() query
    // fails with "permission denied for table ...".
    expect(migration).toMatch(/GRANT\s+USAGE\s+ON\s+SCHEMA\s+public\s+TO\s+authenticated/i)
    expect(migration).toMatch(
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+authenticated/i
    )
  })

  it('does not redefine Supabase built-in auth.uid()', () => {
    const migration = readMigration()

    expect(migration).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+auth\.uid/i)
  })

  it('breaks policy recursion with a SECURITY DEFINER membership lookup', () => {
    const migration = readMigration()

    // A policy on organisation_memberships that selects from
    // organisation_memberships recurses infinitely at runtime.
    expect(migration).toMatch(/FUNCTION\s+public\.user_org_ids/i)
    expect(migration).toMatch(/SECURITY\s+DEFINER/i)
  })

  it('covers tables scoped through a parent rather than org_id', () => {
    const migration = readMigration()

    for (const table of INDIRECTLY_SCOPED_TABLES) {
      expect(
        new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(migration),
        `${table} is missing ENABLE ROW LEVEL SECURITY`
      ).toBe(true)
      expect(
        new RegExp(`CREATE\\s+POLICY\\s+\\w+\\s+ON\\s+${table}`, 'i').test(migration),
        `${table} is missing a policy`
      ).toBe(true)
    }
  })

  it('audit_logs has REVOKE UPDATE, DELETE for authenticated role', () => {
    const migration = readMigration()

    expect(migration).toMatch(/REVOKE\s+UPDATE,\s*DELETE\s+ON\s+audit_logs\s+FROM\s+authenticated/i)
  })
})
