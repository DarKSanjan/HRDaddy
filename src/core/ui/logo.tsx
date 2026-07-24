import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
  version?: string
}

/**
 * HR Daddy logo — inline React SVG so the gradient inherits correctly.
 * The ◈ icon + "HRDaddy" wordmark.
 */
function Logo({ size = 16, className, showText = true, version }: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0EE7FF" />
            <stop offset="0.5" stopColor="#6758FF" />
            <stop offset="1" stopColor="#8A1FFF" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="14" stroke="url(#logo-gradient)" strokeWidth="8" />
        <rect x="16" y="16" width="32" height="32" rx="8" fill="currentColor" className="text-[#000000] dark:text-[#0B0B0F]" />
        <circle cx="28" cy="28" r="3" fill="url(#logo-gradient)" />
        <circle cx="36" cy="28" r="3" fill="url(#logo-gradient)" />
        <path d="M24 38c4 4 12 4 16 0" stroke="url(#logo-gradient)" strokeWidth="5" strokeLinecap="round" fill="none" />
      </svg>
      {showText && (
        <span className="text-[12px] font-semibold text-text-subtle">
          HRDaddy
        </span>
      )}
      {version && (
        <span className="text-[10px] text-text-subtle">
          {version}
        </span>
      )}
    </div>
  )
}

export { Logo }
