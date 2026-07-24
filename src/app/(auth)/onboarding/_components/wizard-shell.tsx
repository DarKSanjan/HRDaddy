'use client'

import { useState, useCallback } from 'react'
import type { WizardData } from '../schemas'
import { ProgressIndicator } from './progress-indicator'
import { Step1VerifyEmail } from './step-1-verify-email'
import { Step2CompanyProfile } from './step-2-company-profile'
import { Step3ModuleSelection } from './step-3-module-selection'
import { Step4SeedDefaults } from './step-4-seed-defaults'
import { Step5InviteTeam } from './step-5-invite-team'

const STEP_LABELS = [
  'Verify email',
  'Company profile',
  'Select modules',
  'Seed defaults',
  'Invite team',
]

interface WizardShellProps {
  initialStep: number
  initialData: Partial<WizardData>
  userEmail: string
  userName: string
}

export function WizardShell({
  initialStep,
  initialData,
  userEmail,
  userName,
}: WizardShellProps) {
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [wizardData, setWizardData] = useState<Partial<WizardData>>(initialData)

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, 5))
  }, [])

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }, [])

  const updateData = useCallback((patch: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...patch }))
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header with progress */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-[14px] font-semibold text-text">
              Set up your organisation
            </h1>
            <span className="text-[12px] text-text-subtle">
              Step {currentStep} of 5
            </span>
          </div>
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={5}
            labels={STEP_LABELS}
          />
        </div>
      </header>

      {/* Step content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {currentStep === 1 && (
          <Step1VerifyEmail
            userEmail={userEmail}
            userName={userName}
            onNext={goNext}
          />
        )}
        {currentStep === 2 && (
          <Step2CompanyProfile
            defaultValues={wizardData.step2}
            onNext={goNext}
            onBack={goBack}
            onSave={updateData}
          />
        )}
        {currentStep === 3 && (
          <Step3ModuleSelection
            defaultValues={wizardData.step3}
            onNext={goNext}
            onBack={goBack}
            onSave={updateData}
          />
        )}
        {currentStep === 4 && (
          <Step4SeedDefaults
            defaultValues={wizardData.step4}
            selectedModules={wizardData.step3?.modules ?? ['employees']}
            onNext={goNext}
            onBack={goBack}
            onSave={updateData}
          />
        )}
        {currentStep === 5 && (
          <Step5InviteTeam
            defaultValues={wizardData.step5}
            onBack={goBack}
            onSave={updateData}
          />
        )}
      </main>
    </div>
  )
}
