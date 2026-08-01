/**
 * Round-5 security hardening — static checks against the migration SQL.
 *
 * Round-5 review found app_user's GRANT ALL (00024) included TRUNCATE/
 * REFERENCES/TRIGGER (RLS doesn't apply to TRUNCATE — a leaked
 * APP_USER_DATABASE_URL could wipe every tenant's data in one statement),
 * several remaining business tables (calendar_event_recipients, payroll,
 * org membership, employee_documents, assets, onboarding, ...) still
 * writable by `authenticated` via raw REST, a storage self-read policy whose
 * unqualified `name` reference silently resolved to document_categories.name
 * instead of storage.objects.name, and a self-serve storage upload branch
 * that round 3 dropped without realizing expense receipts need it. These
 * tests check the fixes in 00028.
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

describe('RLS hardening — round 5', () => {
  it('app_user loses GRANT ALL on public tables, gets explicit DML only', () => {
    const migration = readMigration()
    expect(migration).toMatch(
      /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;/
    )
    expect(migration).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;/
    )
  })

  it('app_user has no access to _prisma_migrations', () => {
    const migration = readMigration()
    expect(migration).toMatch(/REVOKE ALL ON public\._prisma_migrations FROM app_user;/)
  })

  it('app_user storage grants are explicit DML, not ALL', () => {
    const migration = readMigration()
    const revoke = lastBlock(migration, 'REVOKE ALL ON storage\\.objects FROM app_user;')
    const grant = lastBlock(
      migration,
      'GRANT SELECT, INSERT, UPDATE, DELETE ON storage\\.objects TO app_user;'
    )
    expect(revoke).not.toBe('')
    expect(grant).not.toBe('')
  })

  it('authenticated loses INSERT/UPDATE/DELETE on every public table, not just an enumerated list', () => {
    const migration = readMigration()
    expect(migration).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;/
    )
    expect(migration).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM authenticated;/
    )
  })

  it('storage self-read policy qualifies the file_key comparison against storage.objects.name', () => {
    const migration = readMigration()
    const block = lastBlock(migration, 'CREATE POLICY employee_documents_read[\\s\\S]*?;')

    // The bug: unqualified `name` inside the EXISTS subquery resolves to
    // document_categories.name (dc has its own name column), shadowing the
    // outer storage.objects correlation, so the self-read branch never
    // actually matches.
    expect(block).toMatch(/ed\.file_key = storage\.objects\.name/)
    expect(block).not.toMatch(/ed\.file_key = name\b/)
  })

  it('storage self-upload branch is restored for own employee folder', () => {
    const migration = readMigration()
    const block = lastBlock(migration, 'CREATE POLICY employee_documents_insert ON storage\\.objects[\\s\\S]*?;')

    expect(block).toMatch(
      /user_employee_id\(\(storage\.foldername\(name\)\)\[2\]\) = \(storage\.foldername\(name\)\)\[4\]/
    )
  })
})
