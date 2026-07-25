/**
 * HR Daddy Demo Seed - Payroll data.
 * Creates one published period with payslips (June 2026) and one draft (July 2026).
 */
import { PrismaClient } from '@prisma/client'

export async function seedPayroll(
  db: PrismaClient,
  orgId: string,
  employeeIdMap: Map<string, string>,
  avaId: string
) {
  // Check if already seeded
  const existingPeriods = await db.payrollPeriod.count({ where: { orgId } })
  if (existingPeriods > 0) return

  const employees = Array.from(employeeIdMap.entries())

  // ─── Published period: June 2026 ───
  const junePeriod = await db.payrollPeriod.create({
    data: {
      orgId,
      name: 'June 2026',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      status: 'PUBLISHED',
      approvedById: avaId,
      approvedAt: new Date('2026-07-03'),
    },
  })

  // Create payslips for each employee
  for (const [, empId] of employees) {
    // Derive monthly salary from the data
    const emp = await db.employee.findUnique({
      where: { id: empId },
      select: {
        compensationAmountCents: true,
        residencyStatus: true,
      },
    })
    if (!emp?.compensationAmountCents) continue

    const grossCents = Math.round(emp.compensationAmountCents / 12)
    let cpfEmployeeCents = 0
    let cpfEmployerCents = 0
    let cpfTotalCents = 0

    // Simple CPF calculation for citizens/PRs (under 55, full rates)
    if (emp.residencyStatus === 'CITIZEN') {
      cpfTotalCents = Math.round(grossCents * 0.37)
      cpfEmployeeCents = Math.floor(grossCents * 0.20)
      cpfEmployerCents = cpfTotalCents - cpfEmployeeCents
    } else if (emp.residencyStatus === 'PR') {
      // Simplified graduated rate for demo
      cpfTotalCents = Math.round(grossCents * 0.26)
      cpfEmployeeCents = Math.floor(grossCents * 0.15)
      cpfEmployerCents = cpfTotalCents - cpfEmployeeCents
    }
    // FOREIGNER: no CPF

    const netCents = grossCents - cpfEmployeeCents

    const record = await db.payrollRecord.create({
      data: {
        orgId,
        periodId: junePeriod.id,
        employeeId: empId,
        grossAmountCents: grossCents,
        netAmountCents: netCents,
        cpfTotalCents: cpfTotalCents || null,
        cpfEmployeeCents: cpfEmployeeCents || null,
        cpfEmployerCents: cpfEmployerCents || null,
        ytdOwCents: grossCents * 6, // 6 months
        isPublished: true,
        publishedAt: new Date('2026-07-03'),
      },
    })

    // Create line items
    await db.payrollLineItem.create({
      data: {
        recordId: record.id,
        orgId,
        type: 'EARNING',
        name: 'Basic Salary',
        amountCents: grossCents,
      },
    })

    if (cpfEmployeeCents > 0) {
      await db.payrollLineItem.create({
        data: {
          recordId: record.id,
          orgId,
          type: 'DEDUCTION',
          name: 'CPF Employee Contribution',
          amountCents: cpfEmployeeCents,
        },
      })
    }
  }

  // ─── Draft period: July 2026 ───
  await db.payrollPeriod.create({
    data: {
      orgId,
      name: 'July 2026',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      status: 'DRAFT',
    },
  })
}
