'use server'

/**
 * Onboarding wizard server actions — one per step.
 * Each validates with the step's Zod schema, then persists to OrgSetupProgress.
 * The final step (5) commits the entire org in a single transaction.
 */
import { redirect } from 'next/navigation'
import { verifySession } from '@/core/auth'
import { writeAudit } from '@/core/audit'
import {
  checkSlugAvailable,
  getOrgSetupProgress,
  saveOrgSetupProgress,
  commitOrgSetup,
} from '@/core/org-setup'
import {
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  type WizardData,
} from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

// ─────────────────────────────────────────────
// Slug availability check
// ─────────────────────────────────────────────

export async function checkSlugAvailability(
  slug: string
): Promise<{ available: boolean; reason?: string }> {
  return checkSlugAvailable(slug)
}

// ─────────────────────────────────────────────
// Step 1: Verify email (marks step as done)
// ─────────────────────────────────────────────

export async function completeStep1(): Promise<ActionResult> {
  const session = await verifySession()
  const progress = await getOrgSetupProgress(session.userId)
  const existingData = (progress?.data as WizardData) ?? {}

  await saveOrgSetupProgress(session.userId, 2, {
    ...existingData,
    step1: { email: session.email, name: session.name },
  })

  return { success: true }
}

// ─────────────────────────────────────────────
// Step 2: Company profile
// ─────────────────────────────────────────────

export async function completeStep2(
  formData: FormData
): Promise<ActionResult> {
  const session = await verifySession()

  const raw = {
    legalName: formData.get('legalName') as string,
    slug: (formData.get('slug') as string)?.toLowerCase().trim(),
    companySize: formData.get('companySize') as string,
    industry: formData.get('industry') as string,
    country: (formData.get('country') as string) || 'Singapore',
    timezone: (formData.get('timezone') as string) || 'Asia/Singapore',
    currency: (formData.get('currency') as string) || 'SGD',
    leaveYearStart: (formData.get('leaveYearStart') as string) || '01-01',
    workingDays: JSON.parse(
      (formData.get('workingDays') as string) || '[1,2,3,4,5]'
    ) as number[],
    workingHoursStart: (formData.get('workingHoursStart') as string) || '09:00',
    workingHoursEnd: (formData.get('workingHoursEnd') as string) || '18:00',
  }

  const result = step2Schema.safeParse(raw)
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] = fieldErrors[key] || []
      fieldErrors[key].push(issue.message)
    }
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  // Check slug isn't taken
  const slugCheck = await checkSlugAvailable(result.data.slug)
  if (!slugCheck.available) {
    return {
      success: false,
      error: 'Slug unavailable',
      fieldErrors: { slug: [slugCheck.reason!] },
    }
  }

  const progress = await getOrgSetupProgress(session.userId)
  const existingData = (progress?.data as WizardData) ?? {}

  await saveOrgSetupProgress(session.userId, 3, {
    ...existingData,
    step2: result.data,
  })

  return { success: true }
}

// ─────────────────────────────────────────────
// Step 3: Module selection
// ─────────────────────────────────────────────

export async function completeStep3(
  formData: FormData
): Promise<ActionResult> {
  const session = await verifySession()

  const modules = JSON.parse(
    (formData.get('modules') as string) || '["employees"]'
  ) as string[]

  const result = step3Schema.safeParse({ modules })
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] = fieldErrors[key] || []
      fieldErrors[key].push(issue.message)
    }
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  const progress = await getOrgSetupProgress(session.userId)
  const existingData = (progress?.data as WizardData) ?? {}

  await saveOrgSetupProgress(session.userId, 4, {
    ...existingData,
    step3: result.data,
  })

  return { success: true }
}

// ─────────────────────────────────────────────
// Step 4: Seed defaults
// ─────────────────────────────────────────────

export async function completeStep4(
  formData: FormData
): Promise<ActionResult> {
  const session = await verifySession()

  const raw = {
    departments: JSON.parse(
      (formData.get('departments') as string) || '[]'
    ) as { name: string }[],
    jobTitles: JSON.parse(
      (formData.get('jobTitles') as string) || '[]'
    ) as { title: string }[],
    leaveTypes: JSON.parse(
      (formData.get('leaveTypes') as string) || '[]'
    ) as { name: string; daysPerYear: number; description?: string }[],
  }

  const result = step4Schema.safeParse(raw)
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] = fieldErrors[key] || []
      fieldErrors[key].push(issue.message)
    }
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  const progress = await getOrgSetupProgress(session.userId)
  const existingData = (progress?.data as WizardData) ?? {}

  await saveOrgSetupProgress(session.userId, 5, {
    ...existingData,
    step4: result.data,
  })

  return { success: true }
}

// ─────────────────────────────────────────────
// Step 5: Invite team + FINAL COMMIT
// ─────────────────────────────────────────────

export async function completeStep5(
  formData: FormData
): Promise<ActionResult> {
  const session = await verifySession()

  const raw = {
    invitations: JSON.parse(
      (formData.get('invitations') as string) || '[]'
    ) as { email: string; role: string }[],
    skip: formData.get('skip') === 'true',
  }

  const result = step5Schema.safeParse(raw)
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] = fieldErrors[key] || []
      fieldErrors[key].push(issue.message)
    }
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  // Load full wizard data
  const progress = await getOrgSetupProgress(session.userId)
  if (!progress) {
    return { success: false, error: 'No setup progress found. Please start over.' }
  }

  const data = progress.data as WizardData
  if (!data.step2 || !data.step3 || !data.step4) {
    return { success: false, error: 'Incomplete wizard data. Please go back and complete all steps.' }
  }

  // Re-validate slug one last time
  const slugCheck = await checkSlugAvailable(data.step2.slug)
  if (!slugCheck.available) {
    return { success: false, error: `Slug "${data.step2.slug}" is no longer available. Please go back to Step 2.` }
  }

  // Merge step5 data into the full wizard data
  const fullData: WizardData = {
    ...data,
    step5: result.data,
  }

  // ── ATOMIC TRANSACTION ──
  let org: { id: string; name: string; slug: string }
  try {
    const setupResult = await commitOrgSetup(session.userId, fullData)
    org = setupResult.org
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transaction failed'
    return { success: false, error: message }
  }

  // Write audit event (outside txn — best effort)
  await writeAudit({
    orgId: org.id,
    actorId: session.userId,
    action: 'organisation.created',
    targetType: 'Organisation',
    targetId: org.id,
    after: {
      name: org.name,
      slug: org.slug,
      modules: data.step3.modules,
      departments: data.step4.departments.length,
      jobTitles: data.step4.jobTitles.length,
      leaveTypes: data.step4.leaveTypes.length,
      invitations: result.data.invitations.length,
    },
  })

  redirect(`/${org.slug}`)
}

// ─────────────────────────────────────────────
// Resume: get current progress
// ─────────────────────────────────────────────

export async function getSetupProgress(): Promise<{
  step: number
  data: WizardData
} | null> {
  const session = await verifySession()
  const progress = await getOrgSetupProgress(session.userId)
  if (!progress) return null
  return { step: progress.step, data: progress.data as WizardData }
}
