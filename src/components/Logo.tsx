import { useId } from 'react'
import { cx } from './ui'

/** Logo « toit à deux » : un toit, et vous deux dessous. */
export default function Logo({ size = 56, className, animated }: { size?: number; className?: string; animated?: boolean }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={cx(animated && 'logo-animated', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF7A59" />
          <stop offset="1" stopColor="#E0457B" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="23" fill={`url(#${id})`} />
      <path className="logo-roof" d="M24 52 L50 30 L76 52" fill="none" stroke="#FFFCF8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      <circle className="logo-dot-a" cx="40" cy="66" r="8" fill="#FFF3EC" />
      <circle className="logo-dot-b" cx="60" cy="66" r="8" fill="#7EE0B0" />
    </svg>
  )
}
