/**
 * HR Daddy Demo Seed
 *
 * Creates two organisations to demonstrate tenant isolation and module-aware dashboards.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npm run db:seed
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ensureAuthUser } from './seed-auth'
import {
  SHARED_PASSWORD,
  ORG_A,
  ORG_B,
  ORG_A_EMPLOYEES,
  ORG_B_EMPLOYEES,
} from './seed-data'
import {
  seedOrganisation,
  seedDepartments,
  seedJobTitles,
  seedWorkLocations,
  seedEmploymentTypes,
  seedEmployees,
  seedMemberships,
  seedUsers,
} from './seed-org'
import { seedLeaveTypes, seedLeaveBalances, seedLeaveRequests, ORG_A_LEAVE_REQUESTS } from './seed-leave'
import { seedAttendance } from './seed-attendance'
import { seedOnboarding } from './seed-onboarding'
import { seedDocuments } from './seed-documents'
import { seedPayroll } from './seed-payroll'
import { seedNotifications, seedAuditLog } from './seed-notifications'
import { seedAssets, seedExpenses } from './seed-assets-expenses'
import { seedCalendar } from './seed-calendar'

async function main() {
  console.log('🌱 HR Daddy Demo Seed')
  console.log('─'.repeat(50))

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })

  try {
    // ═══════════════════════════════════════════
    // ORGANISATION A — Northstar Studios (full)
    // ═══════════════════════════════════════════
    console.log('\n📦 Seeding Organisation A: Northstar Studios')

    const orgA = await seedOrganisation(db, ORG_A, [
      'employees', 'leave', 'attendance', 'onboarding', 'documents', 'payroll', 'performance', 'expenses', 'assets', 'calendar',
    ])
    console.log('  ✓ Organisation created')

    // Create auth users
    const userIdMapA = new Map<string, string>()
    for (const emp of ORG_A_EMPLOYEES) {
      const userId = await ensureAuthUser(
        db,
        emp.email,
        SHARED_PASSWORD,
        `${emp.firstName} ${emp.lastName}`
      )
      userIdMapA.set(emp.email, userId)
    }
    console.log(`  ✓ ${userIdMapA.size} auth users created/verified`)

    // Create public.users mirror
    await seedUsers(db, ORG_A_EMPLOYEES, userIdMapA)
    console.log('  ✓ User records mirrored')

    // Create memberships
    await seedMemberships(db, orgA.id, ORG_A_EMPLOYEES, userIdMapA)
    console.log('  ✓ Memberships created')

    // Departments, Job Titles, Locations, Employment Types
    const deptNamesA = [...new Set(ORG_A_EMPLOYEES.map((e) => e.department))]
    const jobTitleNamesA = [...new Set(ORG_A_EMPLOYEES.map((e) => e.jobTitle))]
    const locationNamesA = [...new Set(ORG_A_EMPLOYEES.map((e) => e.location))]
    const empTypeNamesA = [...new Set(ORG_A_EMPLOYEES.map((e) => e.employmentType))]

    const deptMapA = await seedDepartments(db, orgA.id, deptNamesA)
    const jobTitleMapA = await seedJobTitles(db, orgA.id, jobTitleNamesA)
    const locationMapA = await seedWorkLocations(db, orgA.id, locationNamesA)
    const empTypeMapA = await seedEmploymentTypes(db, orgA.id, empTypeNamesA)
    console.log('  ✓ Org structure (departments, titles, locations)')

    // Employees
    const employeeIdMapA = await seedEmployees(
      db, orgA.id, ORG_A_EMPLOYEES, userIdMapA,
      deptMapA, jobTitleMapA, locationMapA, empTypeMapA
    )
    console.log(`  ✓ ${employeeIdMapA.size} employees created`)

    // Leave
    const leaveTypeMapA = await seedLeaveTypes(db, orgA.id)
    const startDatesA = new Map<string, string>()
    for (const emp of ORG_A_EMPLOYEES) {
      const empId = employeeIdMapA.get(emp.email)!
      startDatesA.set(empId, emp.startDate)
    }
    await seedLeaveBalances(db, orgA.id, Array.from(employeeIdMapA.values()), leaveTypeMapA, startDatesA)
    await seedLeaveRequests(db, orgA.id, ORG_A_LEAVE_REQUESTS, leaveTypeMapA, employeeIdMapA)
    console.log('  ✓ Leave types, balances, and requests')

    // Attendance (3 months)
    await seedAttendance(db, orgA.id, Array.from(employeeIdMapA.values()))
    console.log('  ✓ Attendance records (3 months)')

    // Onboarding
    await seedOnboarding(db, orgA.id, employeeIdMapA)
    console.log('  ✓ Onboarding templates and instances')

    // Documents
    await seedDocuments(db, orgA.id, employeeIdMapA)
    console.log('  ✓ Document categories and files')

    // Payroll
    const avaIdA = employeeIdMapA.get('ava.lim@northstarstudios.sg')!
    await seedPayroll(db, orgA.id, employeeIdMapA, avaIdA)
    console.log('  ✓ Payroll periods and payslips')

    // Notifications & Audit
    await seedNotifications(db, orgA.id, userIdMapA)
    await seedAuditLog(db, orgA.id, userIdMapA, employeeIdMapA)
    console.log('  ✓ Notifications and audit log')

    // Assets & Expenses
    await seedAssets(db, orgA.id, employeeIdMapA)
    console.log('  ✓ Asset categories, register, assignments, and requests')
    await seedExpenses(db, orgA.id, employeeIdMapA)
    console.log('  ✓ Expense categories and claims')

    // Calendar
    const employeeIdObjA = Object.fromEntries(employeeIdMapA.entries())
    await seedCalendar(db, orgA.id, employeeIdObjA)
    console.log('  ✓ Calendar holidays and events')

    // ═══════════════════════════════════════════
    // ORGANISATION B — Harbour Logistics (minimal)
    // ═══════════════════════════════════════════
    console.log('\n📦 Seeding Organisation B: Harbour Logistics')

    const orgB = await seedOrganisation(db, ORG_B, ['employees', 'leave', 'calendar'])
    console.log('  ✓ Organisation created (employees + leave only)')

    const userIdMapB = new Map<string, string>()
    for (const emp of ORG_B_EMPLOYEES) {
      const userId = await ensureAuthUser(
        db,
        emp.email,
        SHARED_PASSWORD,
        `${emp.firstName} ${emp.lastName}`
      )
      userIdMapB.set(emp.email, userId)
    }
    console.log(`  ✓ ${userIdMapB.size} auth users created/verified`)

    await seedUsers(db, ORG_B_EMPLOYEES, userIdMapB)
    await seedMemberships(db, orgB.id, ORG_B_EMPLOYEES, userIdMapB)

    const deptNamesB = [...new Set(ORG_B_EMPLOYEES.map((e) => e.department))]
    const jobTitleNamesB = [...new Set(ORG_B_EMPLOYEES.map((e) => e.jobTitle))]
    const locationNamesB = [...new Set(ORG_B_EMPLOYEES.map((e) => e.location))]
    const empTypeNamesB = [...new Set(ORG_B_EMPLOYEES.map((e) => e.employmentType))]

    const deptMapB = await seedDepartments(db, orgB.id, deptNamesB)
    const jobTitleMapB = await seedJobTitles(db, orgB.id, jobTitleNamesB)
    const locationMapB = await seedWorkLocations(db, orgB.id, locationNamesB)
    const empTypeMapB = await seedEmploymentTypes(db, orgB.id, empTypeNamesB)

    const employeeIdMapB = await seedEmployees(
      db, orgB.id, ORG_B_EMPLOYEES, userIdMapB,
      deptMapB, jobTitleMapB, locationMapB, empTypeMapB
    )
    console.log(`  ✓ ${employeeIdMapB.size} employees created`)

    // Leave for Org B
    const leaveTypeMapB = await seedLeaveTypes(db, orgB.id)
    const startDatesB = new Map<string, string>()
    for (const emp of ORG_B_EMPLOYEES) {
      const empId = employeeIdMapB.get(emp.email)!
      startDatesB.set(empId, emp.startDate)
    }
    await seedLeaveBalances(db, orgB.id, Array.from(employeeIdMapB.values()), leaveTypeMapB, startDatesB)
    console.log('  ✓ Leave types and balances')

    // ═══════════════════════════════════════════
    // CREDENTIALS TABLE
    // ═══════════════════════════════════════════
    console.log('\n' + '═'.repeat(60))
    console.log('  DEMO CREDENTIALS')
    console.log('═'.repeat(60))
    console.log(`  Password (all accounts): ${SHARED_PASSWORD}`)
    console.log('─'.repeat(60))
    console.log('  ORG A — Northstar Studios (/northstar-studios/dashboard)')
    console.log('─'.repeat(60))
    console.log('  Email                                    Role')
    console.log('  ' + '─'.repeat(56))
    for (const emp of ORG_A_EMPLOYEES) {
      const padded = emp.email.padEnd(42)
      console.log(`  ${padded}${emp.role}`)
    }
    console.log('─'.repeat(60))
    console.log('  ORG B — Harbour Logistics (/harbour-logistics/dashboard)')
    console.log('─'.repeat(60))
    console.log('  Email                                    Role')
    console.log('  ' + '─'.repeat(56))
    for (const emp of ORG_B_EMPLOYEES) {
      const padded = emp.email.padEnd(42)
      console.log(`  ${padded}${emp.role}`)
    }
    console.log('═'.repeat(60))
    console.log('\n✅ Seed complete!')
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
