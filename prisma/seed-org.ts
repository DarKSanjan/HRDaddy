/**
 * HR Daddy Demo Seed - Organisation seeding logic.
 * Creates org, settings, modules, departments, job titles, locations, types.
 */
import { PrismaClient } from '@prisma/client'
import type { SeedEmployee } from './seed-data'

export async function seedOrganisation(
  db: PrismaClient,
  orgData: { name: string; slug: string; timezone: string; currency: string },
  enabledModules: string[]
) {
  // Upsert organisation
  const org = await db.organisation.upsert({
    where: { slug: orgData.slug },
    create: { name: orgData.name, slug: orgData.slug },
    update: { name: orgData.name },
  })

  // Upsert settings
  await db.organisationSettings.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      timezone: orgData.timezone,
      currency: orgData.currency,
      dateFormat: 'DD/MM/YYYY',
      workingDays: JSON.stringify([1, 2, 3, 4, 5]),
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      leaveYearStart: '01-01',
    },
    update: {
      timezone: orgData.timezone,
      currency: orgData.currency,
    },
  })

  // Upsert enabled modules
  for (const moduleId of enabledModules) {
    await db.organisationModule.upsert({
      where: { orgId_moduleId: { orgId: org.id, moduleId } },
      create: { orgId: org.id, moduleId, enabled: true },
      update: { enabled: true },
    })
  }

  return org
}

export async function seedDepartments(
  db: PrismaClient,
  orgId: string,
  names: string[]
) {
  const map = new Map<string, string>()
  for (const name of names) {
    const existing = await db.department.findFirst({ where: { orgId, name } })
    if (existing) {
      map.set(name, existing.id)
    } else {
      const dept = await db.department.create({ data: { orgId, name } })
      map.set(name, dept.id)
    }
  }
  return map
}

export async function seedJobTitles(
  db: PrismaClient,
  orgId: string,
  names: string[]
) {
  const map = new Map<string, string>()
  for (const name of names) {
    const existing = await db.jobTitle.findFirst({ where: { orgId, name } })
    if (existing) {
      map.set(name, existing.id)
    } else {
      const jt = await db.jobTitle.create({ data: { orgId, name } })
      map.set(name, jt.id)
    }
  }
  return map
}

export async function seedWorkLocations(
  db: PrismaClient,
  orgId: string,
  names: string[]
) {
  const map = new Map<string, string>()
  for (const name of names) {
    const existing = await db.workLocation.findFirst({ where: { orgId, name } })
    if (existing) {
      map.set(name, existing.id)
    } else {
      const loc = await db.workLocation.create({ data: { orgId, name } })
      map.set(name, loc.id)
    }
  }
  return map
}

export async function seedEmploymentTypes(
  db: PrismaClient,
  orgId: string,
  names: string[]
) {
  const map = new Map<string, string>()
  for (const name of names) {
    const existing = await db.employmentType.findFirst({ where: { orgId, name } })
    if (existing) {
      map.set(name, existing.id)
    } else {
      const et = await db.employmentType.create({ data: { orgId, name } })
      map.set(name, et.id)
    }
  }
  return map
}

export async function seedEmployees(
  db: PrismaClient,
  orgId: string,
  employees: SeedEmployee[],
  userIdMap: Map<string, string>,
  deptMap: Map<string, string>,
  jobTitleMap: Map<string, string>,
  locationMap: Map<string, string>,
  empTypeMap: Map<string, string>
) {
  const employeeIdMap = new Map<string, string>()

  // First pass: create employees without manager references
  for (const emp of employees) {
    const userId = userIdMap.get(emp.email)!
    const existing = await db.employee.findFirst({
      where: { orgId, workEmail: emp.email },
    })

    if (existing) {
      employeeIdMap.set(emp.email, existing.id)
      continue
    }

    const employee = await db.employee.create({
      data: {
        orgId,
        userId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        workEmail: emp.email,
        dateOfBirth: new Date(emp.dateOfBirth),
        employmentStatus: 'ACTIVE',
        startDate: new Date(emp.startDate),
        departmentId: deptMap.get(emp.department)!,
        jobTitleId: jobTitleMap.get(emp.jobTitle)!,
        locationId: locationMap.get(emp.location)!,
        employmentTypeId: empTypeMap.get(emp.employmentType)!,
        compensationAmountCents: emp.compensationCents,
        compensationCurrency: 'SGD',
        residencyStatus: emp.residencyStatus,
        prStartDate: emp.prStartDate ? new Date(emp.prStartDate) : null,
        prArrangement: emp.prArrangement ?? null,
      },
    })
    employeeIdMap.set(emp.email, employee.id)
  }

  // Second pass: set manager relationships
  for (const emp of employees) {
    if (!emp.managerId) continue
    const employeeId = employeeIdMap.get(emp.email)!
    const managerId = employeeIdMap.get(emp.managerId)!
    if (managerId) {
      await db.employee.update({
        where: { id: employeeId },
        data: { managerId },
      })
    }
  }

  return employeeIdMap
}

export async function seedMemberships(
  db: PrismaClient,
  orgId: string,
  employees: SeedEmployee[],
  userIdMap: Map<string, string>
) {
  for (const emp of employees) {
    const userId = userIdMap.get(emp.email)!
    await db.organisationMembership.upsert({
      where: { userId_orgId: { userId, orgId } },
      create: { userId, orgId, role: emp.role },
      update: { role: emp.role, isActive: true },
    })
  }
}

export async function seedUsers(
  db: PrismaClient,
  employees: SeedEmployee[],
  userIdMap: Map<string, string>
) {
  for (const emp of employees) {
    const userId = userIdMap.get(emp.email)!
    await db.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: emp.email,
        name: `${emp.firstName} ${emp.lastName}`,
      },
      update: {
        name: `${emp.firstName} ${emp.lastName}`,
      },
    })
  }
}
