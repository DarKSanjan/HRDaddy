/**
 * HR Daddy Demo Seed - Leave data seeding.
 * Creates leave types, policies, balances, and requests.
 */
import { PrismaClient } from '@prisma/client'

const SG_LEAVE_TYPES = [
  { name: 'Annual Leave', color: '#3B82F6', serviceBased: true },
  { name: 'Sick Leave', color: '#EF4444', serviceBased: false, allowance: 14 },
  { name: 'Hospitalisation Leave', color: '#F97316', serviceBased: false, allowance: 60 },
  { name: 'Childcare Leave', color: '#8B5CF6', serviceBased: false, allowance: 6 },
  { name: 'Compassionate Leave', color: '#6B7280', serviceBased: false, allowance: 3 },
  { name: 'Unpaid Leave', color: '#9CA3AF', serviceBased: false, allowance: 0 },
]

export async function seedLeaveTypes(db: PrismaClient, orgId: string) {
  const typeMap = new Map<string, string>()

  for (const lt of SG_LEAVE_TYPES) {
    const existing = await db.leaveType.findFirst({
      where: { orgId, name: lt.name },
    })
    if (existing) {
      typeMap.set(lt.name, existing.id)
      continue
    }
    const leaveType = await db.leaveType.create({
      data: {
        orgId,
        name: lt.name,
        color: lt.color,
        requiresApproval: lt.name !== 'Unpaid Leave',
      },
    })
    typeMap.set(lt.name, leaveType.id)
  }

  // Create policies
  for (const lt of SG_LEAVE_TYPES) {
    const typeId = typeMap.get(lt.name)!
    const existing = await db.leavePolicy.findFirst({
      where: { orgId, leaveTypeId: typeId },
    })
    if (existing) continue

    await db.leavePolicy.create({
      data: {
        orgId,
        leaveTypeId: typeId,
        defaultAllowance: lt.allowance ?? 7,
        serviceBased: lt.serviceBased,
      },
    })
  }

  return typeMap
}

export async function seedLeaveBalances(
  db: PrismaClient,
  orgId: string,
  employeeIds: string[],
  leaveTypeMap: Map<string, string>,
  startDates: Map<string, string>
) {
  const year = 2026
  const annualLeaveId = leaveTypeMap.get('Annual Leave')!
  const sickLeaveId = leaveTypeMap.get('Sick Leave')!

  for (const empId of employeeIds) {
    const startDate = startDates.get(empId)
    if (!startDate) continue

    const start = new Date(startDate)
    const yearsOfService = Math.floor(
      (new Date(year, 0, 1).getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    )

    // Annual leave: 7 + (years - 1), cap at 14, min 7; pro-rate if joined this year
    let annualAllowance: number
    if (start.getFullYear() === year) {
      // Pro-rate: remaining months / 12 * 7
      const monthsRemaining = 12 - start.getMonth()
      annualAllowance = Math.round((monthsRemaining / 12) * 7 * 10) / 10
    } else if (yearsOfService < 1) {
      annualAllowance = 0 // hasn't completed first year
    } else {
      annualAllowance = Math.min(7 + (yearsOfService - 1), 14)
    }

    // Annual Leave balance
    await db.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: empId, leaveTypeId: annualLeaveId, year } },
      create: { orgId, employeeId: empId, leaveTypeId: annualLeaveId, year, allowance: annualAllowance, used: 0, pending: 0 },
      update: { allowance: annualAllowance },
    })

    // Sick Leave balance
    await db.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: empId, leaveTypeId: sickLeaveId, year } },
      create: { orgId, employeeId: empId, leaveTypeId: sickLeaveId, year, allowance: 14, used: 0, pending: 0 },
      update: {},
    })
  }
}

interface LeaveRequestSeed {
  employeeEmail: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reason?: string
  reviewerEmail?: string
  reviewNote?: string
}

export const ORG_A_LEAVE_REQUESTS: LeaveRequestSeed[] = [
  // Approved requests (some used days)
  {
    employeeEmail: 'marcus.lee@northstarstudios.sg',
    leaveType: 'Annual Leave',
    startDate: '2026-05-05',
    endDate: '2026-05-09',
    totalDays: 5,
    status: 'APPROVED',
    reason: 'Family vacation',
    reviewerEmail: 'daniel.chen@northstarstudios.sg',
  },
  {
    employeeEmail: 'priya.sharma@northstarstudios.sg',
    leaveType: 'Sick Leave',
    startDate: '2026-06-20',
    endDate: '2026-06-20',
    totalDays: 1,
    status: 'APPROVED',
    reason: 'Flu',
    reviewerEmail: 'daniel.chen@northstarstudios.sg',
  },
  {
    employeeEmail: 'kevin.ng@northstarstudios.sg',
    leaveType: 'Annual Leave',
    startDate: '2026-07-04',
    endDate: '2026-07-05', // Fri-Sat (Sat not counted), spans weekend
    totalDays: 1,
    status: 'APPROVED',
    reason: 'Long weekend',
    reviewerEmail: 'sarah.wong@northstarstudios.sg',
  },
  {
    employeeEmail: 'jun.nakamura@northstarstudios.sg',
    leaveType: 'Annual Leave',
    startDate: '2026-08-07',
    endDate: '2026-08-11', // Thu-Mon (includes National Day 9 Aug PH)
    totalDays: 2,
    status: 'APPROVED',
    reason: 'Travel home',
    reviewerEmail: 'ava.lim@northstarstudios.sg',
  },
  // Pending requests
  {
    employeeEmail: 'wei.zhang@northstarstudios.sg',
    leaveType: 'Annual Leave',
    startDate: '2026-08-18',
    endDate: '2026-08-22',
    totalDays: 5,
    status: 'PENDING',
    reason: 'Holiday trip',
  },
  {
    employeeEmail: 'mei.lin@northstarstudios.sg',
    leaveType: 'Annual Leave',
    startDate: '2026-08-04',
    endDate: '2026-08-05',
    totalDays: 2,
    status: 'PENDING',
    reason: 'Personal errands',
  },
  // Rejected request
  {
    employeeEmail: 'kevin.ng@northstarstudios.sg',
    leaveType: 'Annual Leave',
    startDate: '2026-06-30',
    endDate: '2026-07-11',
    totalDays: 10,
    status: 'REJECTED',
    reason: 'Extended break',
    reviewerEmail: 'sarah.wong@northstarstudios.sg',
    reviewNote: 'Too close to quarter end. Please reschedule.',
  },
]

export async function seedLeaveRequests(
  db: PrismaClient,
  orgId: string,
  requests: LeaveRequestSeed[],
  leaveTypeMap: Map<string, string>,
  employeeIdMap: Map<string, string>
) {
  for (const req of requests) {
    const employeeId = employeeIdMap.get(req.employeeEmail)!
    const leaveTypeId = leaveTypeMap.get(req.leaveType)!
    const reviewedById = req.reviewerEmail ? employeeIdMap.get(req.reviewerEmail) : null

    // Idempotency: check for matching existing request
    const existing = await db.leaveRequest.findFirst({
      where: {
        orgId,
        employeeId,
        leaveTypeId,
        startDate: new Date(req.startDate),
        endDate: new Date(req.endDate),
      },
    })
    if (existing) continue

    await db.leaveRequest.create({
      data: {
        orgId,
        employeeId,
        leaveTypeId,
        startDate: new Date(req.startDate),
        endDate: new Date(req.endDate),
        totalDays: req.totalDays,
        status: req.status,
        reason: req.reason,
        reviewedById: reviewedById ?? undefined,
        reviewedAt: req.status !== 'PENDING' ? new Date() : undefined,
        reviewNote: req.reviewNote,
      },
    })

    // Update balances for approved/pending
    if (req.status === 'APPROVED') {
      await db.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId, year: 2026 },
        data: { used: { increment: req.totalDays } },
      })
    } else if (req.status === 'PENDING') {
      await db.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId, year: 2026 },
        data: { pending: { increment: req.totalDays } },
      })
    }
  }
}
