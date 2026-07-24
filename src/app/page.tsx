import { redirect } from 'next/navigation'
import { resolveHomeDestination, destinationToPath } from '@/core/auth/routing'

export const dynamic = 'force-dynamic'

/**
 * "/" is the single routing brain: signed out to sign-in, signed in without an
 * organisation to the setup wizard, otherwise to their dashboard.
 */
export default async function Home() {
  redirect(destinationToPath(await resolveHomeDestination()))
}
