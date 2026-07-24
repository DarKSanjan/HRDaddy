'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
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

/**
 * Wizard shell — sizes to content, optically centred, with direction-aware
 * slide+fade transitions between steps (~180ms ease-out).
 */
export function WizardShell({
  initialStep,
  initialData,
  userEmail,
  userName,
}: WizardShellProps) {
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [wizardData, setWizardData] = useState<Partial<WizardData>>(initialData)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [transitioning, setTransitioning] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const goNext = useCallback(() => {
    setDirection('forward')
    setTransitioning(true)
    setTimeout(() => {
      setCurrentStep((s) => Math.min(s + 1, 5))
      setTransitioning(false)
    }, 180)
  }, [])

  const goBack = useCallback(() => {
    setDirection('backward')
    setTransitioning(true)
    setTimeout(() => {
      setCurrentStep((s) => Math.max(s - 1, 1))
      setTransitioning(false)
    }, 180)
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
            <span className="text-[12px] text-text-subtle tabular-nums">
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

      {/* Step content — sizes to content, centred in remaining space */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-8">
        <div
          ref={contentRef}
          className={cn(
            'wizard-step-transition',
            transitioning && direction === 'forward' && 'wizard-exit-left',
            transitioning && direction === 'backward' && 'wizard-exit-right',
            !transitioning && direction === 'forward' && 'wizard-enter-from-right',
            !transitioning && direction === 'backward' && 'wizard-enter-from-left',
          )}
        >
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
        </div>
      </main>
    </div>
  )
}
