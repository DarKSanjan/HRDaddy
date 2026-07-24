import { verifySession } from '@/core/auth'
import { getSetupProgress } from './actions'
import { WizardShell } from './_components/wizard-shell'

export const metadata = {
  title: 'Set up your organisation',
}

export default async function OnboardingPage() {
  const session = await verifySession()
  const progress = await getSetupProgress()

  const initialStep = progress?.step ?? 1
  const initialData = progress?.data ?? {}

  return (
    <WizardShell
      initialStep={initialStep}
      initialData={initialData}
      userEmail={session.email}
      userName={session.name}
    />
  )
}
