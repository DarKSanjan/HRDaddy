/**
 * Onboarding wizard Zod schemas — one per step, validated server-side.
 * Never trust the client.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────
// Reserved slugs — cannot be used as org slugs
// ─────────────────────────────────────────────

export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'blog',
  'cdn',
  'dashboard',
  'docs',
  'help',
  'hr',
  'hrdaddy',
  'login',
  'mail',
  'onboarding',
  'pricing',
  'settings',
  'sign-in',
  'sign-up',
  'signup',
  'status',
  'support',
  'terms',
  'www',
])

// ─────────────────────────────────────────────
// Step 1: Verify email
// ─────────────────────────────────────────────

export const step1Schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
})

export const step1VerifySchema = z.object({
  token: z.string().min(6, 'Verification code must be 6 digits').max(6),
})

export type Step1Data = z.infer<typeof step1Schema>
export type Step1VerifyData = z.infer<typeof step1VerifySchema>

// ─────────────────────────────────────────────
// Step 2: Company profile
// ─────────────────────────────────────────────

const SLUG_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$/

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
] as const

export const INDUSTRIES = [
  'Technology',
  'Finance & Banking',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Retail & E-commerce',
  'Professional Services',
  'Media & Entertainment',
  'Real Estate',
  'Transportation & Logistics',
  'Non-profit',
  'Government',
  'Other',
] as const

export const WORKING_DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

export const step2Schema = z.object({
  legalName: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Company name too long'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(48, 'Slug must be under 48 characters')
    .regex(SLUG_REGEX, 'Slug must be lowercase letters, numbers and hyphens only, starting with a letter')
    .refine((s) => !RESERVED_SLUGS.has(s), 'This slug is reserved'),
  companySize: z.enum(COMPANY_SIZES),
  industry: z.enum(INDUSTRIES),
  country: z.string().min(1).default('Singapore'),
  timezone: z.string().min(1).default('Asia/Singapore'),
  currency: z.string().length(3).default('SGD'),
  leaveYearStart: z
    .string()
    .regex(/^\d{2}-\d{2}$/, 'Must be MM-DD format')
    .default('01-01'),
  workingDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'At least one working day required')
    .default([1, 2, 3, 4, 5]),
  workingHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format')
    .default('09:00'),
  workingHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format')
    .default('18:00'),
})

export type Step2Data = z.infer<typeof step2Schema>

// ─────────────────────────────────────────────
// Step 3: Module selection
// ─────────────────────────────────────────────

export const step3Schema = z.object({
  modules: z
    .array(z.string())
    .refine((arr) => arr.includes('employees'), 'employees module is required'),
})

export type Step3Data = z.infer<typeof step3Schema>

// ─────────────────────────────────────────────
// Step 4: Seed defaults
// ─────────────────────────────────────────────

export const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
})

export const jobTitleSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(100),
})

export const leaveTypeSchema = z.object({
  name: z.string().min(1, 'Leave type name is required').max(100),
  daysPerYear: z.number().positive('Must be positive'),
  description: z.string().max(500).default(''),
})

export const step4Schema = z.object({
  departments: z.array(departmentSchema).min(1, 'At least one department required'),
  jobTitles: z.array(jobTitleSchema).min(1, 'At least one job title required'),
  leaveTypes: z.array(leaveTypeSchema),
})

export type Step4Data = z.infer<typeof step4Schema>

// ─────────────────────────────────────────────
// Step 5: Invite team
// ─────────────────────────────────────────────

export const invitationSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']),
})

export const step5Schema = z.object({
  invitations: z.array(invitationSchema).default([]),
  skip: z.boolean().default(false),
})

export type Step5Data = z.infer<typeof step5Schema>

// ─────────────────────────────────────────────
// Full wizard data (accumulated across steps)
// ─────────────────────────────────────────────

export const wizardDataSchema = z.object({
  step1: step1Schema.optional(),
  step2: step2Schema.optional(),
  step3: step3Schema.optional(),
  step4: step4Schema.optional(),
  step5: step5Schema.optional(),
})

export type WizardData = z.infer<typeof wizardDataSchema>
