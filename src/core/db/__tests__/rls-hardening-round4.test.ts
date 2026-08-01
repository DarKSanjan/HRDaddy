/**
 * Round-4 security hardening — static checks against the migration SQL.
 *
 * Round-4 review found write_audit_log() forgeable by any org member
 * (00022 granted it to `authenticated`, and only actor_id was forced),
 * several workflow tables still directly writable by `authenticated` via
 * raw PostgREST (round 3 only did the app_user split for employees),
 * calendar_events with no audience check at all, users_delete_own still
 * live, and get_advisors showing four RPCs executable by `anon`. These
 * tests check the fixes in 00027, plus the two bugs found only by actually
 * running the full migration set against a real Postgres instance:
 * employees.user_id was missing from round 3's column grant-back list
 * (broke every policy that does `e.user_id = auth.uid()` for the
 * `authenticated` role), and the SPECIFIC_EMPLOYEES calendar-audience check
 * caused infinite RLS recursion until moved into a SECURITY DEFINER helper.
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

describe('RLS hardening — round 4', () => {
  it('employees.user_id is granted back to authenticated (round-3 regression)', () => {
    const migration = readMigration()
    expect(migration).toMatch(/GRANT SELECT \(user_id\) ON employees TO authenticated/)
  })

  it('write_audit_log is revoked from authenticated and anon, granted only to app_user', () => {
    const migration = readMigration()
    const revoke = lastBlock(
      migration,
      'REVOKE EXECUTE ON FUNCTION public\\.write_audit_log\\([^)]*\\) FROM [^;]*;'
    )
    const grant = lastBlock(
      migration,
      'GRANT EXECUTE ON FUNCTION public\\.write_audit_log\\([^)]*\\) TO [^;]*;'
    )
    expect(revoke).toMatch(/authenticated/)
    expect(revoke).toMatch(/anon/)
    expect(grant).toMatch(/app_user/)
    expect(grant).not.toMatch(/authenticated/)
  })

  it('user_employee_id/user_role_in_org/user_manages_employee lose anon EXECUTE but keep authenticated', () => {
    const migration = readMigration()
    for (const fn of ['user_employee_id(text)', 'user_role_in_org(text)', 'user_manages_employee(text, text)']) {
      const escaped = fn.replace(/[()]/g, '\\$&')
      const revoke = lastBlock(migration, `REVOKE EXECUTE ON FUNCTION public\\.${escaped} FROM [^;]*;`)
      expect(revoke).toMatch(/anon/)
      expect(revoke).not.toMatch(/authenticated/)
    }
  })

  it('workflow tables have INSERT/UPDATE/DELETE revoked from authenticated (raw-REST bypass closed)', () => {
    const migration = readMigration()
    for (const table of [
      'attendance_records',
      'expense_claims',
      'asset_requests',
      'leave_requests',
      'performance_reviews',
      'asset_assignments',
      'calendar_events',
    ]) {
      const revoke = lastBlock(migration, `REVOKE INSERT, UPDATE, DELETE ON ${table} FROM authenticated;`)
      expect(revoke).not.toBe('')
    }
  })

  it('users_delete_own is dropped and DELETE revoked from authenticated', () => {
    const migration = readMigration()
    expect(migration).toMatch(/DROP POLICY IF EXISTS users_delete_own ON users/)
    expect(migration).toMatch(/REVOKE DELETE ON users FROM authenticated/)
  })

  it('calendar_events_select checks audience (COMPANY/DEPARTMENT/SPECIFIC_EMPLOYEES), not USING (true)', () => {
    const migration = readMigration()
    const block = lastBlock(migration, 'CREATE POLICY calendar_events_select[\\s\\S]*?;')

    expect(block).not.toMatch(/USING \(\s*true\s*\)/)
    expect(block).toMatch(/'COMPANY'::"CalendarEventAudience"/)
    expect(block).toMatch(/'DEPARTMENT'::"CalendarEventAudience"/)
    expect(block).toMatch(/user_is_calendar_event_recipient/)
    expect(block).toMatch(/created_by_id = public\.user_employee_id/)
  })

  it('user_is_calendar_event_recipient is SECURITY DEFINER (avoids RLS recursion) and anon-restricted', () => {
    const migration = readMigration()
    const fnBlock = lastBlock(
      migration,
      'CREATE (?:OR REPLACE )?FUNCTION public\\.user_is_calendar_event_recipient\\(p_event_id text\\)[\\s\\S]*?\\$\\$;'
    )
    expect(fnBlock).toMatch(/SECURITY DEFINER/)

    const revoke = lastBlock(
      migration,
      'REVOKE ALL ON FUNCTION public\\.user_is_calendar_event_recipient\\(text\\) FROM [^;]*;'
    )
    expect(revoke).toMatch(/anon/)
  })

  it('calendar_events_update/_delete are creator-or-admin only, not any MANAGER', () => {
    const migration = readMigration()
    const updateBlock = lastBlock(migration, 'CREATE POLICY calendar_events_update[\\s\\S]*?;')
    const deleteBlock = lastBlock(migration, 'CREATE POLICY calendar_events_delete[\\s\\S]*?;')

    for (const block of [updateBlock, deleteBlock]) {
      expect(block).toMatch(/created_by_id = public\.user_employee_id/)
      expect(block).not.toMatch(/'MANAGER'::"OrgRole"/)
    }
  })

  it('performance_reviews_insert self-reviewer branch requires being the reviewee\'s direct manager', () => {
    const migration = readMigration()
    const block = lastBlock(migration, 'CREATE POLICY performance_reviews_insert[\\s\\S]*?;')

    expect(block).toMatch(/reviewer_id <> employee_id/)
    expect(block).toMatch(/e\.manager_id = reviewer_id/)
    // Must NOT rely on the manager-chain walk — that's laxer than the app's
    // own canSubmitReviewAs(), which checks direct management only.
    expect(block).not.toMatch(/user_manages_employee/)
  })
})
