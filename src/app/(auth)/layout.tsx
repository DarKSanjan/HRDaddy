/**
 * Auth shell — background only.
 *
 * Deliberately imposes no width and renders no logo. Sign-in and sign-up are
 * narrow centred cards; the setup wizard is a full-page flow with its own
 * header. Constraining both here clamped the wizard to 380px and made it show
 * two headers, so width and chrome are each page's own decision.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Brand bloom. One of the few surfaces where the gradient is prominent. */}
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
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  )
}
