'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, destroySession } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName: z.string().min(2, 'Organisation name must be at least 2 characters'),
})

export interface AuthState {
  error: string | null
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = signInSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password } = parsed.data

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (!user) {
    return { error: 'Invalid email or password' }
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)
  if (!passwordValid) {
    return { error: 'Invalid email or password' }
  }

  if (!user.isActive) {
    return { error: 'Your account has been deactivated' }
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
  })

  // Get user's first organisation to redirect to dashboard
  const membership = await db.organisationMembership.findFirst({
    where: { userId: user.id, isActive: true },
    include: { organisation: true },
  })

  if (membership) {
    redirect(`/${membership.organisation.slug}/dashboard`)
  }

  redirect('/onboarding')
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    orgName: formData.get('orgName'),
  }

  const parsed = signUpSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { name, email, password, orgName } = parsed.data

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (existingUser) {
    return { error: 'An account with this email already exists' }
  }

  // Create slug from org name
  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Check if org slug is unique
  const existingOrg = await db.organisation.findUnique({
    where: { slug },
  })

  if (existingOrg) {
    return { error: 'An organisation with a similar name already exists. Please choose a different name.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Create user, organisation, membership, and settings in a transaction
  const { user, org } = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
      },
    })

    const org = await tx.organisation.create({
      data: {
        name: orgName,
        slug,
        settings: {
          create: {},
        },
      },
    })

    await tx.organisationMembership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'OWNER',
      },
    })

    return { user, org }
  })

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
  })

  redirect(`/${org.slug}/dashboard`)
}

export async function signOut(): Promise<void> {
  await destroySession()
  redirect('/sign-in')
}
