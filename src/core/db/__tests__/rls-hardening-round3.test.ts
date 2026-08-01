/**
 * Round-3 security hardening — static checks against the migration SQL.
 *
 * Round-3 review found production had never received 00020-00023 at all,
 * plus several genuine gaps in what 00022 shipped (organisations had no
 * role-aware update/delete, calendar tokens had no scope check, payroll
 * self-view ignored is_published, assets/expense_claims let a non-admin
 * self-update the entire row, users could self-reactivate). These tests
 * check the fixes in 00024, plus two bugs found only by running the
 * migration against a real Postgres instance while writing it: the
 * employees_self_update_guard trigger blocking dbAdmin/service-role writes
 * (no auth.uid() IS NULL bypass), and a column-level REVOKE on employees
 * silently doing nothing because `authenticated` already had a table-level
 * grant from 00001 (table-level privileges aren't overridden by a narrower
 * column-level REVOKE in Postgres).
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

function lastBlock(migration: string, pattern: string): string {
  const re = new RegExp(pattern, 'gi')
  const matches = [...migration.matchAll(re)]
  return matches.length > 0 ? matches[matches.length - 1][0] : ''
}

describe('RLS hardening — round 3', () => {
  it('organisations has role-aware UPDATE (admin) and DELETE (owner only)', () => {
    const migration = readMigration()
    const updateBlock = lastBlock(migration, 'CREATE POLICY organisations_update[\\s\\S]*?;')
    const deleteBlock = lastBlock(migration, 'CREATE POLICY organisations_delete[\\s\\S]*?;')

    expect(updateBlock).toMatch(/user_role_in_org/)
    expect(updateBlock).toMatch(/'OWNER'/)
    expect(updateBlock).toMatch(/'HR_ADMIN'/)
    expect(deleteBlock).toMatch(/user_role_in_org/)
    expect(deleteBlock).toMatch(/= 'OWNER'/)
    expect(deleteBlock).not.toMatch(/'HR_ADMIN'/)
  })

  it('users self-updates are column-guarded (email/is_active/created_at locked)', () => {
    const migration = readMigration()

    expect(migration).toMatch(/FUNCTION public\.users_self_update_guard/i)
    expect(migration).toMatch(
      /CREATE TRIGGER users_self_update_guard_trigger\s+BEFORE UPDATE ON users/i
    )
    for (const column of ['email', 'is_active', 'created_at']) {
      expect(migration).toMatch(new RegExp(`NEW\\.${column} IS DISTINCT FROM OLD\\.${column}`))
    }
  })

  it('calendar_feed_tokens INSERT enforces the COMPANY-scope restriction', () => {
    const migration = readMigration()
    const block = lastBlock(migration, 'CREATE POLICY calendar_feed_tokens_insert[\\s\\S]*?;')

    expect(block).toMatch(/'PERSONAL'/)
    expect(block).toMatch(/user_role_in_org/)
    expect(block).toMatch(/'OWNER'/)
    expect(block).toMatch(/'HR_ADMIN'/)
  })

  it('payroll self-view requires is_published on both payroll_records and payroll_line_items', () => {
    const migration = readMigration()
    const recordsBlock = lastBlock(migration, 'CREATE POLICY payroll_records_select[\\s\\S]*?;')
    const lineItemsBlock = lastBlock(migration, 'CREATE POLICY payroll_line_items_select[\\s\\S]*?;')

    expect(recordsBlock).toMatch(/is_published = true/)
    expect(lineItemsBlock).toMatch(/is_published = true/)
  })

  it('assets_update and expense_claims_update no longer have a self-edit branch', () => {
    const migration = readMigration()
    const assetsBlock = lastBlock(migration, 'CREATE POLICY assets_update[\\s\\S]*?;')
    const expenseBlock = lastBlock(migration, 'CREATE POLICY expense_claims_update[\\s\\S]*?;')

    expect(assetsBlock).not.toMatch(/person_in_charge_id/)
    expect(expenseBlock).not.toMatch(/auth\.uid\(\)::text\s*$/m)
    // Admin/manager branches must still be present — this isn't admin-locked too.
    expect(assetsBlock).toMatch(/user_role_in_org/)
    expect(expenseBlock).toMatch(/user_manages_employee/)
  })

  it('asset_requests_delete allows self-cancel of a PENDING request; expense_claims_delete allows SUBMITTED withdrawal', () => {
    const migration = readMigration()
    const assetBlock = lastBlock(migration, 'CREATE POLICY asset_requests_delete[\\s\\S]*?;')
    const expenseBlock = lastBlock(migration, 'CREATE POLICY expense_claims_delete[\\s\\S]*?;')

    expect(assetBlock).toMatch(/'PENDING'/)
    expect(assetBlock).toMatch(/user_employee_id/)
    expect(expenseBlock).toMatch(/'DRAFT'/)
    expect(expenseBlock).toMatch(/'SUBMITTED'/)
  })

  it('organisation_modules management is Owner-only', () => {
    const migration = readMigration()
    const insertBlock = lastBlock(migration, 'CREATE POLICY organisation_modules_insert[\\s\\S]*?;')

    expect(insertBlock).toMatch(/= 'OWNER'/)
    expect(insertBlock).not.toMatch(/'HR_ADMIN'/)
  })

  it('attendance/onboarding/leave/performance self-update guards exist with column/state restrictions', () => {
    const migration = readMigration()

    expect(migration).toMatch(/FUNCTION public\.attendance_records_self_update_guard/i)
    expect(migration).toMatch(/FUNCTION public\.onboarding_tasks_self_update_guard/i)
    expect(migration).toMatch(/FUNCTION public\.leave_requests_self_update_guard/i)
    expect(migration).toMatch(/FUNCTION public\.performance_reviews_self_update_guard/i)

    // leave_requests: self-update may only transition PENDING->WITHDRAWN or
    // APPROVED->CANCELLED, checked explicitly, not just "status changed".
    const leaveGuard = migration.match(/FUNCTION public\.leave_requests_self_update_guard[\s\S]*?\$\$;/i)?.[0] ?? ''
    expect(leaveGuard).toMatch(/'PENDING'::"LeaveRequestStatus" AND NEW\.status = 'WITHDRAWN'/)
    expect(leaveGuard).toMatch(/'APPROVED'::"LeaveRequestStatus" AND NEW\.status = 'CANCELLED'/)
  })

  it('leave_requests and performance_reviews INSERT policies reject a pre-decided self-insert', () => {
    const migration = readMigration()
    const leaveInsert = lastBlock(migration, 'CREATE POLICY leave_requests_insert[\\s\\S]*?;')
    const perfInsert = lastBlock(migration, 'CREATE POLICY performance_reviews_insert[\\s\\S]*?;')

    expect(leaveInsert).toMatch(/reviewed_by_id IS NULL/)
    expect(perfInsert).toMatch(/reviewer_id <> employee_id/)
    expect(perfInsert).toMatch(/submitted_at IS NULL/)
  })

  it('performance_reviews_update now includes the reviewee self-branch (fixes submitSelfAssessment/acknowledgeReview)', () => {
    const migration = readMigration()
    const block = lastBlock(migration, 'CREATE POLICY performance_reviews_update[\\s\\S]*?;')

    expect(block).toMatch(/reviewer_id = public\.user_employee_id/)
    expect(block).toMatch(/employee_id = public\.user_employee_id/)
  })

  it('protect_owner_membership serializes concurrent changes with an advisory lock', () => {
    const migration = readMigration()
    // Anchored to the definition, not just the "FUNCTION public.x" substring
    // — an unanchored pattern also matches bare `EXECUTE FUNCTION x();`
    // trigger-invocation lines and later `REVOKE ... ON FUNCTION x() ...;`
    // statements (00025/00026), each of which is a valid match start for a
    // non-greedy `[\s\S]*?\$\$;`, and matchAll's "last match" is then
    // whichever one happens to be closest to the end of the concatenated
    // migration set — not necessarily the actual function body. Same class
    // of bug already fixed for the self-update-guard functions below.
    const fnBlock = lastBlock(
      migration,
      'CREATE (?:OR REPLACE )?FUNCTION public\\.protect_owner_membership\\(\\)[\\s\\S]*?\\$\\$;'
    )

    expect(fnBlock).toMatch(/pg_advisory_xact_lock\(hashtext\(v_org_id\)\)/)
  })

  it('every self-update-guard trigger function bypasses when auth.uid() is NULL (service-role/dbAdmin context)', () => {
    const migration = readMigration()
    const guardFunctions = [
      'employees_self_update_guard',
      'attendance_records_self_update_guard',
      'onboarding_tasks_self_update_guard',
      'leave_requests_self_update_guard',
      'performance_reviews_self_update_guard',
    ]

    for (const fn of guardFunctions) {
      // Must anchor to the definition ("CREATE OR REPLACE FUNCTION ... ()"),
      // not the later "EXECUTE FUNCTION ...();" trigger-creation call — that
      // bare invocation has no nearby "$$;", so a lazy match starting there
      // would run on into the next unrelated function entirely.
      const block = lastBlock(migration, `CREATE (?:OR REPLACE )?FUNCTION public\\.${fn}\\(\\)[\\s\\S]*?\\$\\$;`)
      expect(block).toMatch(/auth\.uid\(\) IS NULL/)
    }
  })

  it('app_user role exists, is granted authenticated for policy matching, and gets a direct grant on every table', () => {
    const migration = readMigration()

    expect(migration).toMatch(/CREATE ROLE app_user NOLOGIN/)
    expect(migration).toMatch(/GRANT authenticated TO app_user/)
    expect(migration).toMatch(/GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user/)
  })

  it('employees sensitive columns are revoked from authenticated at the table level, not just column level', () => {
    const migration = readMigration()

    // The bug: a column-level REVOKE against a role that already has a
    // table-level GRANT does nothing. The fix must revoke the table-level
    // grant on employees from authenticated entirely, then grant back a
    // named column list for SELECT only.
    expect(migration).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE ON employees FROM authenticated/)

    // Round 4 (00027) adds its own single-column `GRANT SELECT (user_id) ON
    // employees TO authenticated;` for an unrelated fix — lastBlock() would
    // grab that one instead since it's a later match against the same broad
    // pattern. Pick the multi-column grant explicitly instead of assuming
    // "last match" is the right one.
    const allGrantBlocks = [
      ...migration.matchAll(/GRANT SELECT \([\s\S]*?\) ON employees TO authenticated;/gi),
    ].map((m) => m[0])
    const grantBackBlock = allGrantBlocks.find((b) => b.includes('first_name')) ?? ''
    for (const sensitive of ['date_of_birth', 'bank_name', 'bank_account_number', 'national_id', 'personal_email', 'compensation_amount_cents']) {
      expect(grantBackBlock).not.toMatch(new RegExp(`\\b${sensitive}\\b`))
    }
    for (const safe of ['first_name', 'last_name', 'work_email', 'department_id', 'manager_id']) {
      expect(grantBackBlock).toMatch(new RegExp(`\\b${safe}\\b`))
    }
  })
})
