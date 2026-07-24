import { Logo } from '@/core/ui/logo'

/**
 * Auth shell.
 *
 * One of only four surfaces where the brand gradient is allowed to be
 * prominent. It reads as a soft bloom behind the card rather than a flat wash —
 * a full-bleed gradient at any usable opacity muddies the near-black canvas and
 * makes body text sit on a moving background.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Brand bloom, anchored behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[820px] -translate-x-1/2 -translate-y-1/2 opacity-25 blur-[110px] dark:opacity-30"
        style={{
          background:
            'radial-gradient(60% 60% at 30% 30%, var(--brand-cyan) 0%, transparent 70%),' +
            'radial-gradient(60% 60% at 70% 45%, var(--brand-indigo) 0%, transparent 70%),' +
            'radial-gradient(55% 55% at 55% 80%, var(--brand-purple) 0%, transparent 70%)',
        }}
      />

      {/* Hairline horizon, so the bloom resolves into an edge rather than fog. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-20"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--brand-indigo), transparent)',
        }}
      />

      <div className="relative z-10 w-full max-w-[380px]">
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
