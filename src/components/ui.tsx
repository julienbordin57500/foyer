import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { ArrowUp, Check, X } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* Alignement : tout le contenu intérieur des cartes (et les titres de section) démarre à 16 px du bord. */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-[24px] bg-surface shadow-soft ring-1 ring-line/80', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title, action }: { eyebrow?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <header className="pt-safe mb-6 flex min-h-[76px] items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <p className="mb-1.5 h-[18px] text-[13px] font-medium text-muted first-letter:uppercase">{eyebrow}</p>
        <h1 className="truncate font-serif text-[36px] font-medium leading-[1.05] tracking-[-0.01em]">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-8 flex h-5 items-center justify-between px-4">
      <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {aside != null && <span className="num text-[12px] font-medium text-muted">{aside}</span>}
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
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition duration-200 ease-smooth active:scale-[0.97] disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
}

const inputCls =
  'h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none ring-accent/50 transition-shadow duration-200 placeholder:text-faint focus:ring-2'

export function Field({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</span>
      <input className={cx(inputCls, className)} {...rest} />
      {hint && <span className="mt-1 block px-1 text-xs text-muted">{hint}</span>}
    </label>
  )
}

/** Barre d'ajout : champ + bouton rond, avec un emplacement pour une option au milieu. */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  middle,
  inputRef,
  accent,
  enterKeyHint = 'done',
}: {
  value: string
  onChange(v: string): void
  onSubmit(): void
  placeholder: string
  label: string
  middle?: ReactNode
  inputRef?: React.Ref<HTMLInputElement>
  accent?: boolean
  enterKeyHint?: 'done' | 'send'
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex h-14 items-center gap-1.5 rounded-[22px] bg-surface pl-4 pr-2 shadow-soft ring-1 ring-line/80 transition-shadow duration-300 focus-within:ring-2 focus-within:ring-accent/40"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint={enterKeyHint}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
      />
      {middle}
      <button
        aria-label="Ajouter"
        disabled={!value.trim()}
        className={cx(
          'grid size-10 shrink-0 place-items-center rounded-full transition duration-300 ease-smooth active:scale-90 disabled:scale-90 disabled:opacity-20',
          accent ? 'bg-accent text-accent-ink' : 'bg-ink text-bg',
        )}
      >
        <ArrowUp size={20} strokeWidth={2.4} />
      </button>
    </form>
  )
}

/** Choix exclusif sous forme de pastilles. */
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
      {label && <span className="mb-2 block px-1 text-[13px] font-medium text-muted">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cx(
              'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition duration-200 ease-smooth active:scale-95',
              value === o.value ? 'bg-ink text-bg' : 'bg-surface-2 text-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Sélecteur segmenté avec un fond qui glisse sous l'option active. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange(v: T): void }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className="relative grid rounded-2xl bg-surface-2 p-1 text-[14px] font-medium" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-xl bg-surface shadow-soft transition-transform duration-[420ms] ease-smooth"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx('relative h-9 rounded-xl transition-colors duration-300', value === o.value ? 'text-ink' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Fiche qui monte du bas, et redescend en douceur à la fermeture. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const last = useRef<ReactNode>(children)
  if (open) last.current = children

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 380)
    return () => clearTimeout(t)
  }, [open])

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

  if (!mounted) return null
  return (
    <div className={cx('fixed inset-0 z-50 flex items-end justify-center', !shown && 'sheet-closed')} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop absolute inset-0 backdrop-blur-[2px]" style={{ background: 'var(--backdrop)' }} onClick={onClose} />
      <div className="sheet-panel pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-surface px-5 pt-3 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-[26px] font-medium leading-none">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted transition active:scale-90">
            <X size={18} />
          </button>
        </div>
        <div className="pb-4">{open ? children : last.current}</div>
      </div>
    </div>
  )
}

/** Pastille ronde avec l'initiale du membre, dans sa couleur. */
export function Avatar({ initial, tone, size = 'sm', className }: { initial: string; tone: 'a' | 'b'; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold leading-none',
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

/** Case ronde à cocher : se remplit avec un petit rebond. */
export function CheckCircle({
  checked,
  onClick,
  label,
  tone = 'default',
  children,
}: {
  checked: boolean
  onClick(): void
  label: string
  tone?: 'default' | 'late' | 'drive'
  children?: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
      className={cx(
        'relative grid size-[26px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-300 active:scale-90',
        checked
          ? 'border-done bg-done text-surface'
          : tone === 'late'
            ? 'border-late'
            : tone === 'drive'
              ? 'border-drive bg-drive-soft text-drive'
              : 'border-faint',
      )}
    >
      {checked ? <Check size={15} strokeWidth={3} className="animate-check" /> : children}
    </button>
  )
}

/** Ligne qui se replie quand elle quitte la liste. */
export function Collapsible({ leaving, children, className }: { leaving: boolean; children: ReactNode; className?: string }) {
  return (
    <li className={cx('collapsible', leaving && 'is-leaving', className)}>
      <div>{children}</div>
    </li>
  )
}

/**
 * Renvoie une fonction qui dit si un élément vient d'arriver (après le premier affichage) :
 * on l'anime à l'entrée, sans faire « clignoter » toute la liste à l'ouverture de l'onglet.
 */
export function useArrivals(ids: string[]) {
  const initial = useRef<Set<string> | null>(null)
  if (initial.current === null) initial.current = new Set(ids)
  return (id: string) => !initial.current!.has(id)
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="animate-pop flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 text-5xl">{emoji}</div>
      <p className="font-serif text-[22px] font-medium">{title}</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{text}</p>
    </div>
  )
}

type SwipeAction = { label: string; icon: ReactNode; tone: 'done' | 'late'; run(): void }

/**
 * Ligne qu'on peut faire glisser : vers la droite (action positive), vers la gauche (supprimer).
 * Le défilement vertical reste prioritaire ; le mouvement suit le doigt sans re-rendu React.
 */
export function SwipeRow({ right, left, children, bare }: { right?: SwipeAction; left?: SwipeAction; children: ReactNode; bare?: boolean }) {
  const fg = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLDivElement>(null)
  const g = useRef({ x: 0, y: 0, dx: 0, active: false, decided: false, moved: false, width: 1 })
  const [side, setSide] = useState<'left' | 'right' | null>(null)

  const setX = (x: number, animate: boolean) => {
    const el = fg.current!
    el.style.transition = animate ? 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    el.style.transform = `translate3d(${x}px, 0, 0)`
    const p = Math.min(1, Math.abs(x) / (g.current.width * 0.35))
    if (bg.current) {
      bg.current.style.opacity = String(Math.min(1, p * 1.4))
      bg.current.dataset.armed = p >= 1 ? 'true' : 'false'
    }
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    g.current = { x: e.clientX, y: e.clientY, dx: 0, active: true, decided: false, moved: false, width: fg.current!.offsetWidth }
  }
  const onMove = (e: React.PointerEvent) => {
    const s = g.current
    if (!s.active) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.decided) {
      if (Math.abs(dy) > 10) return void (s.active = false) // défilement vertical
      if (Math.abs(dx) < 10) return
      s.decided = true
      s.moved = true
      fg.current!.setPointerCapture(e.pointerId)
    }
    let x = dx
    if ((x > 0 && !right) || (x < 0 && !left)) x = 0
    // Résistance au-delà de la moitié de la ligne.
    const max = s.width * 0.5
    if (Math.abs(x) > max) x = Math.sign(x) * (max + (Math.abs(x) - max) * 0.25)
    s.dx = x
    const next = x > 0 ? 'right' : x < 0 ? 'left' : null
    if (next !== side) setSide(next)
    setX(x, false)
  }
  const onUp = () => {
    const s = g.current
    if (!s.active) return
    s.active = false
    const action = s.dx > 0 ? right : left
    if (action && Math.abs(s.dx) >= s.width * 0.35) {
      setX(Math.sign(s.dx) * s.width, true)
      setTimeout(() => {
        action.run()
        setX(0, false)
        setSide(null)
      }, 240)
    } else {
      setX(0, true)
    }
  }

  const action = side === 'right' ? right : side === 'left' ? left : null
  return (
    <div className="relative overflow-hidden">
      {action && (
        <div
          ref={bg}
          data-armed="false"
          className={cx(
            'group absolute inset-0 flex items-center gap-2 px-5 text-[14px] font-semibold opacity-0',
            side === 'right' ? 'justify-start' : 'justify-end',
            action.tone === 'done' ? 'bg-done/15 text-done' : 'bg-late-soft text-late',
          )}
        >
          <span className="transition-transform duration-200 ease-smooth group-data-[armed=true]:scale-125">{action.icon}</span>
          {action.label}
        </div>
      )}
      <div
        ref={fg}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          // Un glissement ne doit pas ouvrir la fiche de l'élément.
          if (g.current.moved) {
            e.stopPropagation()
            g.current.moved = false
          }
        }}
        className={cx('relative', bare ? 'bg-bg' : 'bg-surface')}
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  )
}
