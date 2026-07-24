'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signIn } from '@/actions/auth'
import { Button } from '@/core/ui/button'
import { Input } from '@/core/ui/input'
import { FormField } from '@/core/ui/form-field'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/core/ui/card'
import { AuthCardShell } from '../_components/auth-card-shell'

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signIn, {
    error: null,
  })

  return (
    <AuthCardShell>
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="space-y-4">
            {state.error && (
              <div className="rounded-[var(--radius-sm)] bg-danger/10 p-3 text-[13px] text-danger" role="alert">
                {state.error}
              </div>
            )}
            <FormField label="Email" htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                required
                autoComplete="email"
              />
            </FormField>
            <FormField label="Password" htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </FormField>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" loading={pending}>
              Sign in
            </Button>
            <p className="text-center text-[13px] text-text-muted">
              Don&apos;t have an account?{' '}
              <Link
                href="/sign-up"
                className="text-accent-600 underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthCardShell>
  )
}
