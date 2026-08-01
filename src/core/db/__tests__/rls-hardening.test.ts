/**
 * Round-2 security hardening — static checks against the migration SQL.
 *
 * rls-coverage.test.ts only ever checked "does a policy exist" — which is
 * exactly the gap the external review flagged: every table with *any*
 * tenant_isolation policy passed that test even though non-admin org members
 * could still read/write every column via a direct Supabase call. These
 * tests check that the newly role-aware tables actually reference a
 * role/ownership check, not just any policy, plus the other closed gaps
 * (owner protection, self-update column lock, audit forgery, storage
 * lockdown, race-condition constraints).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

function readMigration(): string {
  const dir = join(process.cwd(), 'prisma/migrations')
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, 'migration.sql')))
    .sort()
    .map((d) => readFileSync(join(dir, d, 'migration.sql'), 'utf-8'))
    .join('\n')
}

// Several policies (leave_requests_select/update, the storage.objects
// employee_documents_* policies) were first created in 00020 and then
// DROP POLICY IF EXISTS + recreated with different logic in 00022. Both
// textual blocks exist in the concatenated migration; only the LAST one is
// what's actually live once every migration has run in order.
function lastBlock(migration: string, pattern: string): string {
  const re = new RegExp(pattern, 'gi')
  const matches = [...migration.matchAll(re)]
  return matches.length > 0 ? matches[matches.length - 1][0] : ''
}

// Tables that only had tenant_isolation before this round, now expected to
// carry at least one role-aware (user_role_in_org / user_employee_id /
// user_manages_employee) policy.
const NEWLY_ROLE_AWARE_TABLES = [
  'attendance_records',
  'expense_claims',
  'expense_categories',
  'assets',
  'asset_categories',
  'asset_assignments',
  'asset_requests',
  'performance_cycles',
  'performance_reviews',
  'performance_competency_scores',
  'payroll_periods',
  'payroll_line_items',
  'onboarding_templates',
  'onboarding_template_tasks',
  'employee_onboardings',
  'employee_onboarding_tasks',
  'organisation_settings',
  'organisation_modules',
  'invitations',
  'notifications',
  'calendar_events',
  'calendar_event_recipients',
  'holidays',
  'calendar_feed_tokens',
  'shift_templates',
  'job_titles',
  'departments',
  'work_locations',
  'employment_types',
  'leave_types',
  'leave_policies',
]

describe('RLS hardening — round 2', () => {
  it('every previously role-blind table now has a role-aware policy', () => {
    const migration = readMigration()
    const stillBlind: string[] = []

    for (const table of NEWLY_ROLE_AWARE_TABLES) {
      // Find every CREATE POLICY ... ON <table> block and check at least one
      // references a role/ownership helper.
      const blockRegex = new RegExp(
        `CREATE POLICY \\w+ ON ${table}[\\s\\S]*?;`,
        'gi'
      )
      const blocks = migration.match(blockRegex) ?? []
      const hasRoleCheck = blocks.some((b) =>
        /user_role_in_org|user_employee_id|user_manages_employee|auth\.uid\(\)/.test(b)
      )
      if (!hasRoleCheck) stillBlind.push(table)
    }

    expect(stillBlind).toEqual([])
  })

  it('leave_requests manager access is scoped via user_manages_employee, not a blanket role check', () => {
    const migration = readMigration()
    const selectBlock = lastBlock(migration, 'CREATE POLICY leave_requests_select[\\s\\S]*?;')
    const updateBlock = lastBlock(migration, 'CREATE POLICY leave_requests_update[\\s\\S]*?;')

    expect(selectBlock).toMatch(/user_manages_employee/)
    expect(updateBlock).toMatch(/user_manages_employee/)
  })

  it('owner memberships are protected by a trigger, not just a policy', () => {
    const migration = readMigration()

    expect(migration).toMatch(/FUNCTION public\.protect_owner_membership/i)
    expect(migration).toMatch(
      /CREATE TRIGGER protect_owner_membership_trigger\s+BEFORE UPDATE OR DELETE ON organisation_memberships/i
    )
    // Must check both "only an owner may touch an owner row" and "don't
    // leave zero owners" -- not just one of the two invariants.
    expect(migration).toMatch(/Only an OWNER can modify another OWNER/i)
    expect(migration).toMatch(/Cannot remove the organisation''s last OWNER/i)
  })

  it('employee self-updates are column-guarded by a trigger', () => {
    const migration = readMigration()

    expect(migration).toMatch(/FUNCTION public\.employees_self_update_guard/i)
    expect(migration).toMatch(
      /CREATE TRIGGER employees_self_update_guard_trigger\s+BEFORE UPDATE ON employees/i
    )
    // Locked fields must include compensation and identity-linkage columns,
    // not just the obviously-sensitive ones.
    for (const column of [
      'compensation_amount_cents',
      'employment_status',
      'manager_id',
      'bank_account_number',
      'user_id',
    ]) {
      expect(migration).toMatch(new RegExp(`NEW\\.${column} IS DISTINCT FROM OLD\\.${column}`))
    }
  })

  it('audit log INSERT is revoked from authenticated and gated behind write_audit_log()', () => {
    const migration = readMigration()

    expect(migration).toMatch(/REVOKE INSERT ON audit_logs FROM authenticated/i)
    expect(migration).toMatch(/FUNCTION public\.write_audit_log/i)
    // The actor must come from auth.uid() inside the function, never a
    // parameter -- otherwise it can still be forged as someone else.
    const fnBlock = migration.match(/FUNCTION public\.write_audit_log[\s\S]*?\$\$;/i)?.[0] ?? ''
    expect(fnBlock).toMatch(/auth\.uid\(\)/)
    expect(fnBlock).not.toMatch(/p_actor_id/)
  })

  it('audit log SELECT is restricted to admin roles', () => {
    const migration = readMigration()
    const block = migration.match(/CREATE POLICY audit_logs_select[\s\S]*?;/i)?.[0] ?? ''

    expect(block).toMatch(/user_role_in_org/)
    expect(block).toMatch(/'OWNER'/)
    expect(block).toMatch(/'HR_ADMIN'/)
  })

  it('notifications INSERT is revoked from authenticated (service-role only)', () => {
    const migration = readMigration()
    expect(migration).toMatch(/REVOKE INSERT ON notifications FROM authenticated/i)
  })

  it('storage update/delete stay admin-only; insert regains a self-serve branch (round 5, for expense receipts)', () => {
    const migration = readMigration()
    const insertBlock = lastBlock(migration, 'CREATE POLICY employee_documents_insert ON storage\\.objects[\\s\\S]*?;')
    const updateBlock = lastBlock(migration, 'CREATE POLICY employee_documents_update ON storage\\.objects[\\s\\S]*?;')
    const deleteBlock = lastBlock(migration, 'CREATE POLICY employee_documents_delete ON storage\\.objects[\\s\\S]*?;')

    for (const block of [updateBlock, deleteBlock]) {
      expect(block).toMatch(/user_role_in_org/)
      expect(block).not.toMatch(/user_employee_id/)
    }
    // Round 3 dropped this branch on the (incorrect) assumption that no
    // self-serve upload path exists — expense receipts need one. An orphan
    // object without a matching employee_documents row is invisible in the
    // app (read policy requires the DB row), so this is safe to restore.
    expect(insertBlock).toMatch(/user_role_in_org/)
    expect(insertBlock).toMatch(
      /user_employee_id\(\(storage\.foldername\(name\)\)\[2\]\) = \(storage\.foldername\(name\)\)\[4\]/
    )
  })

  it('storage read policy respects document category sensitivity', () => {
    const migration = readMigration()
    const readBlock = lastBlock(migration, 'CREATE POLICY employee_documents_read ON storage\\.objects[\\s\\S]*?;')

    expect(readBlock).toMatch(/document_categories/)
    expect(readBlock).toMatch(/is_sensitive/)
  })

  it('race-condition guards exist: payroll unique constraint and partial unique indexes', () => {
    const migration = readMigration()

    expect(migration).toMatch(/ADD CONSTRAINT "?payroll_records_period_id_employee_id_key"?\s+UNIQUE \("?period_id"?, "?employee_id"?\)/i)
    expect(migration).toMatch(/CREATE UNIQUE INDEX "?attendance_one_open_per_employee"?[\s\S]*?WHERE "?status"? = 'OPEN'/i)
    expect(migration).toMatch(/CREATE UNIQUE INDEX "?asset_assignments_one_open_per_asset"?[\s\S]*?WHERE "?returned_at"? IS NULL/i)
  })
})
