'use server'

/**
 * Auth actions — thin wrappers around Supabase Auth.
 */

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/core/auth/supabase-server'

export interface AuthState {
  error: string | null
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Invalid email or password' }
  }

  redirect('/')
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!name || !email || !password) {
    return { error: 'All fields are required' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/sign-in')
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
