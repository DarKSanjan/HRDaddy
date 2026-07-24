'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '@/actions/auth'
import { Button } from '@/core/ui/button'
import { Input } from '@/core/ui/input'
import { FormField } from '@/core/ui/form-field'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/core/ui/card'

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, {
    error: null,
  })

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your details to create your HR Daddy account
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {state.error && (
            <div className="rounded-[var(--radius-sm)] bg-danger/10 p-3 text-[13px] text-danger" role="alert">
              {state.error}
            </div>
          )}
          <FormField label="Full name" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Jane Doe"
              required
              autoComplete="name"
            />
          </FormField>
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
              minLength={8}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Organisation name" htmlFor="orgName" required>
            <Input
              id="orgName"
              name="orgName"
              type="text"
              placeholder="Acme Inc."
              required
            />
          </FormField>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" loading={pending}>
            Create account
          </Button>
          <p className="text-center text-[13px] text-text-muted">
            Already have an account?{' '}
            <Link
              href="/sign-in"
              className="text-accent-600 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
