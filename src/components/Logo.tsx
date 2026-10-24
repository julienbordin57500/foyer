import { cx } from './ui'

/** Logo « toit à deux » : un toit, et vous deux dessous. */
export default function Logo({ size = 56, className, animated }: { size?: number; className?: string; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={cx(animated && 'logo-animated', className)} aria-hidden>
      <rect width="100" height="100" rx="23" fill="#B4603A" />
      <path className="logo-roof" d="M24 52 L50 30 L76 52" fill="none" stroke="#FFFCF8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      <circle className="logo-dot-a" cx="40" cy="66" r="8" fill="#F6F1EA" />
      <circle className="logo-dot-b" cx="60" cy="66" r="8" fill="#B9D3BC" />
    </svg>
  )
}
