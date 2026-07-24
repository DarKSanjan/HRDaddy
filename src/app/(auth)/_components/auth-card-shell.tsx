import { Logo } from '@/core/ui/logo'

/**
 * The narrow centred column used by sign-in and sign-up.
 *
 * Lives here rather than in the auth layout because the setup wizard shares
 * that layout but is a full-width flow with its own header — putting the width
 * clamp and the logo in the layout applied them to the wizard too.
 */
export function AuthCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 flex justify-center">
          <Logo size={30} showText className="text-text" />
        </div>
        {children}
        <p className="mt-6 text-center text-[11px] text-text-subtle">
          Open-source HR for small teams
        </p>
      </div>
    </div>
  )
}
