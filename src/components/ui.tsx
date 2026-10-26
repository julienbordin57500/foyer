import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { ArrowUp, Check, ChevronDown, X } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Petite vibration de confirmation (Android ; sans effet sur iPhone). */
export const tick = () => {
  try {
    navigator.vibrate?.(8)
  } catch {
    /* non disponible */
  }
}

/* Alignement : tout le contenu intérieur des cartes (et les titres de section) démarre à 16 px du bord. */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card-glow rounded-[24px] bg-surface bg-gradient-to-b from-white/[0.035] to-transparent', className)} {...rest}>
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

/**
 * En-tête de page : une carte en dégradé aux couleurs de la rubrique (voir [data-section] dans index.css),
 * posée sous la barre d'état, avec une lueur douce qui se fond dans le fond au lieu d'un bord coupé net.
 */
export function Hero({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="pt-safe relative mb-6">
      <div
        aria-hidden
        className="animate-fade pointer-events-none absolute -inset-x-4 top-0 h-[260px]"
        style={{
          // Lueur limitée au haut de l'écran (sous l'heure) : elle colore sans rendre la carte floue.
          background:
            'radial-gradient(90% 100% at 50% 0%, color-mix(in srgb, var(--hero-from) 30%, transparent) 0%, color-mix(in srgb, var(--hero-to) 10%, transparent) 55%, transparent 80%)',
        }}
      />
      <header
        className="animate-hero relative mt-2 overflow-hidden rounded-[32px] p-5 text-hero-ink ring-1 ring-white/15"
        style={{
          viewTransitionName: 'hero',
          background: 'linear-gradient(140deg, var(--hero-from), var(--hero-to))',
          // Ombre courte et nette + liseré clair en haut : des bords francs.
          boxShadow: '0 14px 32px -20px var(--hero-to), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-white/12" />
        <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-black/6" />
        {(title || eyebrow || action) && (
          <div className="relative flex min-h-[64px] items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1.5 h-[18px] text-[13px] font-medium opacity-75 first-letter:uppercase">{eyebrow}</p>
              <h1 className="line-clamp-2 font-serif text-[36px] font-medium leading-[1.02] tracking-[-0.01em] text-balance">{title}</h1>
            </div>
            {action}
          </div>
        )}
        {children && <div className={cx('relative', !!(title || eyebrow || action) && 'mt-5')}>{children}</div>}
      </header>
    </div>
  )
}

/** Bouton rond posé sur un en-tête coloré. */
export function HeroButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-md transition duration-300 ease-smooth active:scale-90"
      {...rest}
    >
      {children}
    </button>
  )
}

export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-2 mt-8 flex h-5 items-center justify-between px-4', className)}>
      <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
        <span aria-hidden className="size-1.5 rounded-full bg-sec shadow-[0_0_8px_var(--sec)]" />
        {children}
      </h2>
      {aside != null && <span className="num text-[12px] font-medium text-muted">{aside}</span>}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-sec text-bg',
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
  'h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none ring-sec/50 transition-shadow duration-200 placeholder:text-faint focus:ring-2'

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
  onHero,
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
  /** Version translucide, posée sur un en-tête coloré. */
  onHero?: boolean
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className={cx(
        'flex h-14 items-center gap-1.5 rounded-[22px] pl-4 pr-2 transition-shadow duration-300',
        onHero
          ? 'bg-white/18 text-hero-ink ring-1 ring-white/25 backdrop-blur-md focus-within:ring-2 focus-within:ring-white/60'
          : 'bg-surface shadow-soft ring-1 ring-line/80 focus-within:ring-2 focus-within:ring-sec/50',
      )}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint={enterKeyHint}
        className={cx(
          'h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none',
          onHero ? 'placeholder:text-hero-ink/60' : 'placeholder:text-faint',
        )}
      />
      {middle}
      <button
        aria-label="Ajouter"
        disabled={!value.trim()}
        className={cx(
          'grid size-10 shrink-0 place-items-center rounded-full transition duration-300 ease-smooth active:scale-90 disabled:scale-90 disabled:opacity-20',
          onHero ? 'bg-hero-ink' : accent ? 'bg-accent text-accent-ink' : 'bg-ink text-bg',
        )}
        style={onHero ? { color: 'var(--hero-to)' } : undefined}
      >
        <ArrowUp size={20} strokeWidth={2.4} />
      </button>
    </form>
  )
}

/**
 * Réglage en une ligne (« Pour qui ? · Nous deux ›ˮ) qui se déplie vers le bas en liste d'options.
 * Tout se lit de haut en bas, une option par ligne.
 */
export function OptionRow<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string
  icon?: ReactNode
  value: T
  options: { value: T; label: ReactNode }[]
  onChange(v: T): void
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-14 w-full items-center gap-3 px-4 text-left"
      >
        {icon && <span className="text-sec">{icon}</span>}
        <span className="flex-1 text-[15px] text-muted">{label}</span>
        <span className="text-[15px] font-semibold">{current?.label}</span>
        <ChevronDown size={18} className={cx('text-faint transition-transform duration-300 ease-smooth', open && 'rotate-180')} />
      </button>
      <div className={cx('grid transition-[grid-template-rows] duration-400 ease-smooth', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <ul className="overflow-hidden">
          {options.map((o) => (
            <li key={o.value} className="border-t border-line/50">
              <button
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={cx(
                  'flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] active:bg-line/40',
                  o.value === value && 'font-semibold text-sec',
                )}
              >
                <span className="flex-1">{o.label}</span>
                {o.value === value && <Check size={17} strokeWidth={2.6} />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Ligne de date (même style que OptionRow), avec de quoi l'effacer. */
export function DateRow({
  label,
  icon,
  value,
  onChange,
  min,
}: {
  label: string
  icon?: ReactNode
  value: string
  onChange(v: string): void
  min?: string
}) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-2 focus-within:ring-sec/50">
      {icon && <span className="text-sec">{icon}</span>}
      <span className="flex-1 text-[15px] text-muted">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 bg-transparent text-right text-[15px] font-semibold outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Retirer la date"
          className="grid size-7 place-items-center rounded-full text-faint active:bg-line/40"
        >
          <X size={15} />
        </button>
      )}
    </label>
  )
}

/** Champ principal d'une fiche : grand, centré. */
export function TitleInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-16 w-full rounded-2xl bg-surface-2 px-4 text-center font-serif text-[22px] font-medium outline-none ring-1 ring-line/50 placeholder:text-faint focus:ring-2 focus:ring-sec/50"
    />
  )
}

/** Bas de fiche : « Enregistrer » en grand, « Supprimer » discret en dessous. */
export function SheetActions({
  saveLabel = 'Enregistrer',
  onDelete,
  deleteLabel = 'Supprimer',
}: {
  saveLabel?: string
  onDelete?(): void
  deleteLabel?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 pt-3">
      <Button className="w-full">{saveLabel}</Button>
      {onDelete && (
        <button type="button" onClick={onDelete} className="h-11 px-4 text-[14px] font-semibold text-late active:opacity-60">
          {deleteLabel}
        </button>
      )}
    </div>
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
              value === o.value ? 'bg-sec text-bg' : 'bg-surface-2 text-ink',
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
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  transitionName,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange(v: T): void
  /** Nom de transition : la pastille glisse d'une page à l'autre. */
  transitionName?: string
}) {
  const i = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  return (
    <div
      className="relative grid rounded-2xl bg-surface-2 p-1 text-[14px] font-medium"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-xl bg-surface shadow-soft transition-transform duration-[420ms] ease-smooth"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${i * 100}%)`,
          viewTransitionName: transitionName,
        }}
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
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)
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

  // Glisser la poignée (ou le titre) vers le bas pour fermer, comme sur iPhone.
  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return
    const dy = Math.max(0, e.clientY - drag.current.y)
    drag.current.dy = dy
    panel.current.style.transition = 'none'
    panel.current.style.transform = `translateY(${dy}px)`
  }
  const onUp = () => {
    if (!drag.current || !panel.current) return
    const { dy } = drag.current
    drag.current = null
    panel.current.style.transition = ''
    panel.current.style.transform = ''
    if (dy > 90) onClose()
  }

  if (!mounted) return null
  return (
    <div
      className={cx('fixed inset-0 z-50 flex items-end justify-center', !shown && 'sheet-closed')}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet-backdrop absolute inset-0 backdrop-blur-[2px]" style={{ background: 'var(--backdrop)' }} onClick={onClose} />
      <div
        ref={panel}
        className="sheet-panel pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-surface px-5 shadow-2xl"
      >
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="cursor-grab pt-3"
          style={{ touchAction: 'none' }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
          <div className="relative mb-6 flex items-center justify-center">
            <h2 className="font-serif text-[26px] font-medium leading-none">{title}</h2>
            <button
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Fermer"
              className="absolute right-0 grid size-9 place-items-center rounded-full bg-surface-2 text-muted transition active:scale-90"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="pb-4">{open ? children : last.current}</div>
      </div>
    </div>
  )
}

/** Pastille ronde avec l'initiale du membre, dans sa couleur. */
export function Avatar({
  initial,
  tone,
  size = 'sm',
  className,
}: {
  initial: string
  tone: 'a' | 'b'
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
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
  big,
  children,
}: {
  checked: boolean
  onClick(): void
  label: string
  tone?: 'default' | 'late' | 'drive'
  /** Plus grande, pour cocher d'un pouce en magasin. */
  big?: boolean
  children?: ReactNode
}) {
  return (
    <button
      onClick={() => {
        tick()
        onClick()
      }}
      aria-label={label}
      aria-pressed={checked}
      className={cx(
        'relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-300 active:scale-90',
        big ? 'size-[32px] border-2' : 'size-[26px]',
        checked
          ? 'border-sec bg-sec text-bg'
          : tone === 'late'
            ? 'border-late'
            : tone === 'drive'
              ? 'border-drive bg-drive-soft text-drive'
              : 'border-faint hover:border-sec',
      )}
    >
      {checked ? <Check size={big ? 18 : 15} strokeWidth={3} className="animate-check" /> : children}
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
      <div className="relative mb-5 grid size-24 place-items-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--hero-from)] to-[var(--hero-to)] opacity-20 blur-xl"
        />
        <span aria-hidden className="absolute inset-2 rounded-full bg-sec/10 ring-1 ring-sec/20" />
        <span className="relative text-[44px] leading-none">{emoji}</span>
      </div>
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
export function SwipeRow({
  right,
  left,
  children,
  bare,
}: {
  right?: SwipeAction
  left?: SwipeAction
  children: ReactNode
  bare?: boolean
}) {
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
      try {
        fg.current!.setPointerCapture(e.pointerId)
      } catch {
        /* pointeur déjà relâché */
      }
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
      tick()
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
            action.tone === 'done' ? 'bg-sec/18 text-sec' : 'bg-late-soft text-late',
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

/** Grande coche animée : le cercle apparaît, puis la coche se dessine. */
export function SuccessCheck() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="success-check" aria-hidden>
      <circle cx="48" cy="48" r="44" fill="var(--sec)" className="success-disc" />
      <path
        d="M30 49 L43 62 L67 36"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="success-tick"
      />
    </svg>
  )
}

/** Interrupteur sur une ligne, avec une petite explication dessous. */
export function ToggleRow({
  label,
  hint,
  icon,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  icon?: ReactNode
  checked: boolean
  onChange(v: boolean): void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-2.5 text-left ring-1 ring-line/50"
    >
      {icon && <span className="text-sec">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300', checked ? 'bg-sec' : 'bg-line')}>
        <span
          className={cx(
            'absolute left-0.5 top-0.5 size-6 rounded-full bg-surface shadow-soft transition-transform duration-300 ease-smooth',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}
