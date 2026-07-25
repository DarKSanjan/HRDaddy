/**
 * HR Daddy demo seed — types and constants.
 */

export const SHARED_PASSWORD = 'HRDaddy2026!'

export const ORG_A = {
  name: 'Northstar Studios',
  slug: 'northstar-studios',
  timezone: 'Asia/Singapore',
  currency: 'SGD',
} as const

export const ORG_B = {
  name: 'Harbour Logistics',
  slug: 'harbour-logistics',
  timezone: 'Asia/Singapore',
  currency: 'SGD',
} as const

export interface SeedEmployee {
  firstName: string
  lastName: string
  email: string
  role: 'OWNER' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE'
  department: string
  jobTitle: string
  location: string
  employmentType: string
  startDate: string // YYYY-MM-DD
  dateOfBirth: string // YYYY-MM-DD
  residencyStatus: 'CITIZEN' | 'PR' | 'FOREIGNER'
  prStartDate?: string
  prArrangement?: 'GRADUATED_GRADUATED' | 'FULL_GRADUATED'
  compensationCents: number
  managerId?: string // reference by email
}

// ─────── Organisation A employees ───────

export const ORG_A_EMPLOYEES: SeedEmployee[] = [
  // Owner
  {
    firstName: 'Ava',
    lastName: 'Lim',
    email: 'ava.lim@northstarstudios.sg',
    role: 'OWNER',
    department: 'Operations',
    jobTitle: 'CEO',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2020-03-15',
    dateOfBirth: '1985-06-22',
    residencyStatus: 'CITIZEN',
    compensationCents: 1500000,
  },
  // HR Admin
  {
    firstName: 'Rachel',
    lastName: 'Tan',
    email: 'rachel.tan@northstarstudios.sg',
    role: 'HR_ADMIN',
    department: 'Operations',
    jobTitle: 'HR Manager',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2021-01-10',
    dateOfBirth: '1990-11-03',
    residencyStatus: 'CITIZEN',
    compensationCents: 900000,
    managerId: 'ava.lim@northstarstudios.sg',
  },
  // Engineering Manager
  {
    firstName: 'Daniel',
    lastName: 'Chen',
    email: 'daniel.chen@northstarstudios.sg',
    role: 'MANAGER',
    department: 'Engineering',
    jobTitle: 'Engineering Lead',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2021-06-01',
    dateOfBirth: '1988-02-14',
    residencyStatus: 'CITIZEN',
    compensationCents: 1200000,
    managerId: 'ava.lim@northstarstudios.sg',
  },
  // Sales Manager
  {
    firstName: 'Sarah',
    lastName: 'Wong',
    email: 'sarah.wong@northstarstudios.sg',
    role: 'MANAGER',
    department: 'Sales',
    jobTitle: 'Sales Director',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2022-03-01',
    dateOfBirth: '1987-09-19',
    residencyStatus: 'CITIZEN',
    compensationCents: 1100000,
    managerId: 'ava.lim@northstarstudios.sg',
  },
  // Engineer 1
  {
    firstName: 'Marcus',
    lastName: 'Lee',
    email: 'marcus.lee@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Engineering',
    jobTitle: 'Senior Software Engineer',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2022-01-15',
    dateOfBirth: '1992-04-08',
    residencyStatus: 'CITIZEN',
    compensationCents: 1000000,
    managerId: 'daniel.chen@northstarstudios.sg',
  },
  // Engineer 2 (first-year PR)
  {
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2023-04-01',
    dateOfBirth: '1994-12-01',
    residencyStatus: 'PR',
    prStartDate: '2025-09-01',
    prArrangement: 'GRADUATED_GRADUATED',
    compensationCents: 800000,
    managerId: 'daniel.chen@northstarstudios.sg',
  },
  // Engineer 3 (second-year PR)
  {
    firstName: 'Wei',
    lastName: 'Zhang',
    email: 'wei.zhang@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2022-09-01',
    dateOfBirth: '1993-07-15',
    residencyStatus: 'PR',
    prStartDate: '2024-08-01',
    prArrangement: 'FULL_GRADUATED',
    compensationCents: 850000,
    managerId: 'daniel.chen@northstarstudios.sg',
  },
  // Designer
  {
    firstName: 'Jun',
    lastName: 'Nakamura',
    email: 'jun.nakamura@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Design',
    jobTitle: 'Senior UX Designer',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2021-11-15',
    dateOfBirth: '1991-01-28',
    residencyStatus: 'FOREIGNER',
    compensationCents: 900000,
    managerId: 'ava.lim@northstarstudios.sg',
  },
  // Designer 2
  {
    firstName: 'Mei',
    lastName: 'Lin',
    email: 'mei.lin@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Design',
    jobTitle: 'UI Designer',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2023-08-01',
    dateOfBirth: '1996-03-12',
    residencyStatus: 'CITIZEN',
    compensationCents: 650000,
    managerId: 'jun.nakamura@northstarstudios.sg',
  },
  // Sales
  {
    firstName: 'Kevin',
    lastName: 'Ng',
    email: 'kevin.ng@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Sales',
    jobTitle: 'Account Executive',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2023-02-01',
    dateOfBirth: '1995-08-20',
    residencyStatus: 'CITIZEN',
    compensationCents: 700000,
    managerId: 'sarah.wong@northstarstudios.sg',
  },
  // Finance
  {
    firstName: 'Lisa',
    lastName: 'Koh',
    email: 'lisa.koh@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Finance',
    jobTitle: 'Finance Manager',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2021-08-01',
    dateOfBirth: '1989-05-30',
    residencyStatus: 'CITIZEN',
    compensationCents: 950000,
    managerId: 'ava.lim@northstarstudios.sg',
  },
  // New joiner (this year — for pro-rating visibility)
  {
    firstName: 'Aiden',
    lastName: 'Teo',
    email: 'aiden.teo@northstarstudios.sg',
    role: 'EMPLOYEE',
    department: 'Engineering',
    jobTitle: 'Junior Software Engineer',
    location: 'Singapore HQ',
    employmentType: 'Full-time',
    startDate: '2026-06-15',
    dateOfBirth: '2000-10-05',
    residencyStatus: 'CITIZEN',
    compensationCents: 550000,
    managerId: 'daniel.chen@northstarstudios.sg',
  },
]

// ─────── Organisation B employees ───────

export const ORG_B_EMPLOYEES: SeedEmployee[] = [
  {
    firstName: 'Tom',
    lastName: 'Lau',
    email: 'tom.lau@harbourlogistics.sg',
    role: 'OWNER',
    department: 'Management',
    jobTitle: 'Managing Director',
    location: 'Harbour Office',
    employmentType: 'Full-time',
    startDate: '2019-06-01',
    dateOfBirth: '1980-03-10',
    residencyStatus: 'CITIZEN',
    compensationCents: 1200000,
  },
  {
    firstName: 'Amy',
    lastName: 'Chia',
    email: 'amy.chia@harbourlogistics.sg',
    role: 'HR_ADMIN',
    department: 'Management',
    jobTitle: 'Admin & HR',
    location: 'Harbour Office',
    employmentType: 'Full-time',
    startDate: '2020-01-15',
    dateOfBirth: '1992-07-22',
    residencyStatus: 'CITIZEN',
    compensationCents: 650000,
    managerId: 'tom.lau@harbourlogistics.sg',
  },
  {
    firstName: 'Ben',
    lastName: 'Tan',
    email: 'ben.tan@harbourlogistics.sg',
    role: 'EMPLOYEE',
    department: 'Operations',
    jobTitle: 'Logistics Coordinator',
    location: 'Harbour Office',
    employmentType: 'Full-time',
    startDate: '2022-05-10',
    dateOfBirth: '1994-11-18',
    residencyStatus: 'CITIZEN',
    compensationCents: 500000,
    managerId: 'tom.lau@harbourlogistics.sg',
  },
  {
    firstName: 'Cindy',
    lastName: 'Yeo',
    email: 'cindy.yeo@harbourlogistics.sg',
    role: 'EMPLOYEE',
    department: 'Operations',
    jobTitle: 'Warehouse Supervisor',
    location: 'Harbour Office',
    employmentType: 'Full-time',
    startDate: '2023-01-03',
    dateOfBirth: '1998-02-14',
    residencyStatus: 'CITIZEN',
    compensationCents: 480000,
    managerId: 'tom.lau@harbourlogistics.sg',
  },
]
