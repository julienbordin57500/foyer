import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-[26px] bg-surface shadow-soft ring-1 ring-line/70', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title, action }: { eyebrow?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <header className="pt-safe mb-6 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-[13px] font-medium text-muted first-letter:uppercase">{eyebrow}</p>}
        <h1 className="font-serif text-[34px] font-medium leading-none tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-7 flex items-baseline justify-between px-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {aside && <span className="text-[12px] text-muted">{aside}</span>}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-bg',
  secondary: 'bg-surface-2 text-ink',
  danger: 'bg-late-soft text-late',
}

export function Button({ variant = 'primary', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
}

const inputCls =
  'h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none ring-accent/60 placeholder:text-faint focus:ring-2'

export function Field({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</span>
      <input className={cx(inputCls, className)} {...rest} />
      {hint && <span className="mt-1 block px-1 text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Select({ label, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</span>
      <select className={cx(inputCls, 'appearance-none')} {...rest}>
        {children}
      </select>
    </label>
  )
}

/** Choix exclusif sous forme de pastilles (rayon, destinataire…). */
export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange(v: T): void
  label?: string
}) {
  return (
    <div>
      {label && <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cx(
              'h-9 rounded-full px-3.5 text-[14px] font-medium transition',
              value === o.value ? 'bg-ink text-bg' : 'bg-surface-2 text-ink active:bg-line',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
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
      <div className="animate-fade absolute inset-0 bg-[#1a120b]/35 backdrop-blur-[3px]" onClick={onClose} />
      <div className="animate-sheet pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-surface px-5 pt-3">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-medium">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  )
}

/** Pastille ronde avec l'initiale du membre, dans sa couleur. */
export function Avatar({ initial, tone, size = 'sm', className }: { initial: string; tone: 'a' | 'b'; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold',
        tone === 'a' ? 'bg-person-a-soft text-person-a' : 'bg-person-b-soft text-person-b',
        size === 'xs' && 'size-5 text-[10px]',
        size === 'sm' && 'size-7 text-[12px]',
        size === 'md' && 'size-10 text-[15px]',
        className,
      )}
    >
      {initial}
    </span>
  )
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 text-5xl">{emoji}</div>
      <p className="font-serif text-xl font-medium">{title}</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{text}</p>
    </div>
  )
}
