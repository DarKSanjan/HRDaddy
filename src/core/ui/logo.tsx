import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
  version?: string
}

/**
 * HR Daddy logo — renders the real brand PNG from /public/logo.png.
 */
function Logo({ size = 16, className, showText = true, version }: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain img matches sidebar pattern; sizes vary by call site */}
      <img
        src="/logo.png"
        width={size}
        height={size}
        alt="HRDaddy"
        aria-hidden="true"
      />
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
