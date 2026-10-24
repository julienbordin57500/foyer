import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-3xl bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-line', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="pt-safe mb-5 flex items-end justify-between gap-3">
      <div>
        {subtitle && <p className="text-sm text-muted first-letter:uppercase">{subtitle}</p>}
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-baseline justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {aside && <span className="num text-sm text-muted">{aside}</span>}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink',
  secondary: 'bg-surface-2 text-ink',
  ghost: 'text-accent',
  danger: 'bg-danger-soft text-danger',
}

export function Button({ variant = 'primary', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
}

export function IconButton({ label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('grid size-11 place-items-center rounded-full bg-accent text-accent-ink transition active:scale-95', className)}
      {...rest}
    />
  )
}

const inputCls =
  'h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none ring-accent placeholder:text-muted focus:ring-2'

export function Field({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-medium text-muted">{label}</span>
      <input className={inputCls} {...rest} />
      {hint && <span className="mt-1 block px-1 text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Select({ label, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-medium text-muted">{label}</span>
      <select className={cx(inputCls, 'appearance-none')} {...rest}>
        {children}
      </select>
    </label>
  )
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-sheet pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  )
}

export type Tone = 'neutral' | 'warn' | 'danger' | 'good' | 'accent'
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  good: 'bg-good-soft text-good',
  accent: 'bg-accent-soft text-accent',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  )
}

/** Ligne de liste cliquable, utilisée dans les cartes. */
export function Row({ children, onClick, className }: { children: ReactNode; onClick?(): void; className?: string }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cx('flex w-full items-center gap-3 py-3 text-left', onClick && 'active:opacity-60', className)}>
      {children}
    </Tag>
  )
}
