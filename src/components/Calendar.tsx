import { useRef, useState, type FormEvent } from 'react'
import {
  BellRing,
  CalendarDays,
  CalendarRange,
  Repeat,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2,
} from 'lucide-react'
import type { Tab } from '../App'
import { useStore } from '../data/store'
import { ColorChips, useIphoneImport } from './IphoneCalendars'
import { AGENDA_COLORS, AGENDA_LEGEND, useAgenda, type AgendaItem } from '../lib/agenda'
import { addDays, addMonths, parseISODate, toISODate, today } from '../lib/dates'
import { calendarUrl } from '../lib/reminders'
import { capitalize } from '../lib/format'
import type { CalendarEvent } from '../lib/types'
import { Button, Card, DateRow, SectionTitle, Segmented, Sheet, SheetActions, SwipeRow, TitleInput, cx, tick } from './ui'

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const DAY_TITLE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type Draft = CalendarEvent | { date: string }

const REMINDERS: { days: number | null; label: string }[] = [
  { days: null, label: 'Pas de rappel' },
  { days: 0, label: 'Le jour même' },
  { days: 1, label: '1 jour avant' },
  { days: 2, label: '2 jours avant' },
  { days: 3, label: '3 jours avant' },
  { days: 7, label: '1 semaine avant' },
]

/**
 * Moment de la notification : le jour du rappel (0 à 7 jours avant), à l'heure choisie. Pour un événement
 * qui se répète, on vise la prochaine fois (le serveur passe ensuite tout seul à la suivante).
 */
function remindAt(date: string, days: number | null, at: string, repeat: CalendarEvent['repeat']) {
  if (days === null) return null
  let start = parseISODate(date)
  for (let i = 1; repeat && addDays(start, 1) < today() && i < 2000; i++)
    start = repeat === 'week' ? addDays(parseISODate(date), 7 * i) : addMonths(parseISODate(date), repeat === 'year' ? 12 * i : i)
  const d = addDays(start, -days)
  const [h, m] = (at || '09:00').split(':').map(Number)
  d.setHours(h, m)
  return d.toISOString()
}

const REPEATS: { value: CalendarEvent['repeat']; label: string }[] = [
  { value: null, label: 'Une seule fois' },
  { value: 'week', label: 'Chaque semaine' },
  { value: 'month', label: 'Chaque mois' },
  { value: 'year', label: 'Chaque année' },
]

/** « 09:00 » → « 9 h », « 18:30 » → « 18 h 30 ». */
const spoken = (t: string) => {
  const [h, m] = t.split(':')
  return `${Number(h)} h${m === '00' ? '' : ` ${m}`}`
}
const hhmmOf = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type View = 'mois' | 'semaine' | 'liste'
const VIEW_KEY = 'foyer-calendrier-vue'
const readView = (): View => {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'semaine' || v === 'liste' ? v : 'mois'
  } catch {
    return 'mois'
  }
}
const HIDDEN_KEY = 'foyer-calendrier-masques'
const readHidden = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]'))
  } catch {
    return new Set<string>()
  }
}
const SHORT_DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' })
const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

/** Une pastille par chose prévue (4 au plus, puis « + »), chacune à la couleur de son calendrier. */
function Dots({ items, light }: { items: AgendaItem[]; light?: boolean }) {
  return (
    <span className="flex h-1.5 items-center gap-0.5">
      {items.slice(0, 4).map((it) => (
        <span key={it.key} className="size-1.5 rounded-full" style={{ background: light ? 'var(--bg)' : it.color }} />
      ))}
      {items.length > 4 && <span className={cx('text-[9px] font-bold leading-none', light ? 'text-bg' : 'text-muted')}>+</span>}
    </span>
  )
}

/** Le calendrier du foyer, en grand sur l'Accueil : par mois (grille), par semaine, ou en liste. */
export function CalendarBlock({ go }: { go(t: Tab): void }) {
  const allOn = useAgenda()
  // Légende : un appui masque ou remontre une sorte (ou un calendrier iPhone). Gardé sur ce téléphone.
  const [hidden, setHidden] = useState<Set<string>>(readHidden)
  const toggle = (key: string) => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setHidden(next)
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
    } catch {
      /* pas grave */
    }
  }
  const itemsOn = (iso: string) => allOn(iso).filter((it) => !hidden.has(it.group))
  // Glisser le doigt sur la grille : à gauche le mois suivant, à droite le précédent.
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const { data } = useStore()
  const { run: importIphone, busy } = useIphoneImport()
  const hasFeeds = data.calendar_feeds.length > 0
  const todayIso = toISODate(today())
  const [view, setView] = useState<View>(readView)
  const [picked, setPicked] = useState(todayIso)
  const [month, setMonth] = useState(() => {
    const d = today()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [week, setWeek] = useState(() => mondayOf(today()))
  const [draft, setDraft] = useState<Draft | null>(null)

  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* pas grave : on reviendra au mois */
    }
  }
  const open = (it: AgendaItem) => (it.event ? setDraft(it.event) : go(it.tab))

  // Grille du lundi au dimanche, 6 semaines : comme le calendrier de l'iPhone.
  const cells = Array.from({ length: 42 }, (_, i) => addDays(mondayOf(month), i))
  const shiftMonth = (n: number) => {
    tick()
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  }
  const pick = (d: Date) => {
    setPicked(toISODate(d))
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    setWeek(mondayOf(d))
  }
  const isThisMonth = month.getMonth() === today().getMonth() && month.getFullYear() === today().getFullYear()
  const isThisWeek = toISODate(week) === toISODate(mondayOf(today()))
  const dayItems = itemsOn(picked)
  // Légende : les sortes, puis mes calendriers iPhone avec leur couleur.
  const legend = [
    ...AGENDA_LEGEND.map((l) => ({ key: l.kind, label: l.label, color: AGENDA_COLORS[l.kind] })),
    ...data.calendar_feeds.map((f) => ({ key: f.id, label: f.name, color: f.color })),
  ]

  const header = (title: string, onPrev: () => void, onNext: () => void, onToday: () => void, isNow: boolean, label: string) => (
    <div className="mb-1 flex items-center justify-between px-1">
      <button
        onClick={onPrev}
        aria-label={`${label} précédent${label === 'Semaine' ? 'e' : ''}`}
        className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2"
      >
        <ChevronLeft size={19} />
      </button>
      <button onClick={onToday} className="flex flex-col items-center leading-tight">
        <span key={title} className="animate-fade font-serif text-[21px] font-medium first-letter:uppercase">
          {title}
        </span>
        {!isNow && <span className="text-[11px] font-semibold text-sec">Revenir à aujourd'hui</span>}
      </button>
      <button
        onClick={onNext}
        aria-label={`${label} suivant${label === 'Semaine' ? 'e' : ''}`}
        className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2"
      >
        <ChevronRight size={19} />
      </button>
    </div>
  )

  return (
    <section>
      <SectionTitle
        aside={
          <span className="flex items-center gap-3">
            {hasFeeds && (
              <button onClick={importIphone} disabled={busy} className="flex items-center gap-1 font-semibold normal-case text-muted">
                <RefreshCw size={12} strokeWidth={2.8} className={cx(busy && 'animate-spin')} /> iPhone
              </button>
            )}
            <button onClick={() => setDraft({ date: picked })} className="flex items-center gap-1 font-semibold normal-case text-sec">
              <Plus size={13} strokeWidth={2.8} /> Ajouter
            </button>
          </span>
        }
      >
        Calendrier
      </SectionTitle>
      <div className="mb-2">
        <Segmented<View>
          value={view}
          onChange={changeView}
          options={[
            { value: 'mois', label: 'Mois' },
            { value: 'semaine', label: 'Semaine' },
            { value: 'liste', label: 'Liste' },
          ]}
        />
      </div>

      {view === 'mois' && (
        <>
          <Card className="p-3">
            {header(
              MONTH.format(month),
              () => shiftMonth(-1),
              () => shiftMonth(1),
              () => pick(today()),
              isThisMonth,
              'Mois',
            )}
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-faint">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div
              key={month.getTime()}
              className="grid animate-fade touch-pan-y grid-cols-7 gap-y-0.5"
              onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
              onPointerUp={(e) => {
                const s0 = swipe.current
                swipe.current = null
                if (!s0) return
                const dx = e.clientX - s0.x
                if (Math.abs(dx) > 50 && Math.abs(e.clientY - s0.y) < 40) shiftMonth(dx < 0 ? 1 : -1)
              }}
            >
              {cells.map((d, i) => {
                const iso = toISODate(d)
                const items = itemsOn(iso)
                const bars = items.filter((it) => it.span).slice(0, 2)
                const holiday = items.find((it) => it.kind === 'holiday')
                const dots = items.filter((it) => !it.span && it.kind !== 'holiday')
                const on = iso === picked
                const isToday = iso === todayIso
                const weekend = i % 7 >= 5
                return (
                  <button
                    key={iso}
                    onClick={() => pick(d)}
                    aria-pressed={on}
                    aria-label={`${DAY_TITLE.format(d)}${holiday ? ` (${holiday.text})` : ''} : ${items.length} chose${items.length > 1 ? 's' : ''}`}
                    className={cx(
                      'flex h-14 flex-col items-center justify-start gap-1 pt-1 transition-opacity',
                      weekend && 'bg-surface-2/50',
                      weekend && i % 7 === 5 && 'rounded-l-xl',
                      weekend && i % 7 === 6 && 'rounded-r-xl',
                      d.getMonth() !== month.getMonth() && 'opacity-30',
                    )}
                  >
                    <span
                      className={cx(
                        'num grid size-8 place-items-center rounded-full text-[15px] font-semibold transition duration-200 ease-smooth',
                        on
                          ? 'bg-sec text-bg shadow-[0_4px_14px_-4px_var(--sec)]'
                          : isToday
                            ? 'bg-sec/15 font-bold text-sec ring-2 ring-sec/70'
                            : holiday && 'text-[#94a3b8] underline decoration-dotted underline-offset-4',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {/* Événements sur plusieurs jours : une barre qui se poursuit d'une case à l'autre. */}
                    {bars.map((b) => (
                      <span
                        key={b.key}
                        className={cx(
                          '-my-0.5 h-1 self-stretch',
                          (b.span!.first || i % 7 === 0) && 'ml-1.5 rounded-l-full',
                          (b.span!.last || i % 7 === 6) && 'mr-1.5 rounded-r-full',
                        )}
                        style={{ background: b.color }}
                      />
                    ))}
                    <Dots items={dots} />
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-line/60 pt-2.5 text-[11px] text-muted">
              {legend.map((l) => (
                <button
                  key={l.key}
                  onClick={() => toggle(l.key)}
                  aria-pressed={!hidden.has(l.key)}
                  className={cx('flex items-center gap-1 transition-opacity', hidden.has(l.key) && 'line-through opacity-40')}
                >
                  <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </button>
              ))}
            </div>
          </Card>

          <p className="mb-2 mt-4 px-4 text-[15px] font-semibold first-letter:uppercase">
            {picked === todayIso ? "Aujourd'hui" : DAY_TITLE.format(parseISODate(picked))}
          </p>
          <Card key={picked} className="animate-fade overflow-hidden">
            {dayItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
                <p className="text-[15px] text-muted">Rien de prévu ce jour-là.</p>
                <Button variant="secondary" onClick={() => setDraft({ date: picked })}>
                  <Plus size={17} /> Ajouter un événement
                </Button>
              </div>
            ) : (
              <ul>
                {dayItems.map((it) => (
                  <AgendaRow key={it.key} item={it} onOpen={() => open(it)} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {view === 'semaine' && (
        <Card className="overflow-hidden">
          <div className="p-3 pb-1">
            {header(
              `${SHORT_DATE.format(week)} – ${SHORT_DATE.format(addDays(week, 6))}`,
              () => setWeek(addDays(week, -7)),
              () => setWeek(addDays(week, 7)),
              () => setWeek(mondayOf(today())),
              isThisWeek,
              'Semaine',
            )}
          </div>
          <ul key={toISODate(week)} className="animate-fade">
            {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => {
              const iso = toISODate(d)
              const items = itemsOn(iso)
              return (
                <li key={iso} className="flex gap-3 border-t border-line/60 px-4 py-2.5">
                  <button
                    onClick={() => setDraft({ date: iso })}
                    aria-label={`Ajouter le ${DAY_TITLE.format(d)}`}
                    className={cx('w-11 shrink-0 pt-1 text-center leading-tight', iso === todayIso ? 'text-sec' : 'text-muted')}
                  >
                    <span className="block text-[11px] font-semibold uppercase">{SHORT_DAY.format(d).split(' ')[0].replace('.', '')}</span>
                    <span className="num block font-serif text-[22px] font-medium text-ink">{d.getDate()}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    {items.length === 0 ? (
                      <p className="pt-2.5 text-[14px] text-faint">—</p>
                    ) : (
                      items.map((it) => <CompactRow key={it.key} item={it} onOpen={() => open(it)} />)
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {view === 'liste' && <AgendaList itemsOn={itemsOn} onOpen={open} />}

      <Sheet open={!!draft} title={draft && 'id' in draft ? "Modifier l'événement" : 'Nouvel événement'} onClose={() => setDraft(null)}>
        {draft && (
          <EventForm
            key={'id' in draft ? draft.id : draft.date}
            draft={draft}
            onDone={(date) => {
              if (date) pick(parseISODate(date))
              setDraft(null)
            }}
          />
        )}
      </Sheet>
    </section>
  )
}

/** Vue Semaine : une ligne courte par chose prévue. */
function CompactRow({ item, onOpen }: { item: AgendaItem; onOpen(): void }) {
  return (
    <button onClick={onOpen} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-1 text-left active:bg-surface-2">
      <span className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
      {item.time && <span className="num shrink-0 text-[12.5px] font-semibold text-sec">{item.time}</span>}
      <span className="min-w-0 flex-1 truncate text-[15px]">{item.text}</span>
    </button>
  )
}

/** Vue Liste : les 60 prochains jours qui ont quelque chose, comme la vue « Liste » de l'iPhone. */
function AgendaList({ itemsOn, onOpen }: { itemsOn(iso: string): AgendaItem[]; onOpen(it: AgendaItem): void }) {
  const start = today()
  const days = Array.from({ length: 60 }, (_, i) => addDays(start, i))
    .map((d) => ({ d, items: itemsOn(toISODate(d)) }))
    .filter((x) => x.items.length > 0)
  if (days.length === 0)
    return (
      <Card>
        <p className="px-4 py-6 text-center text-[15px] text-muted">Rien de prévu dans les deux prochains mois.</p>
      </Card>
    )
  return (
    <div className="space-y-3">
      {days.map(({ d, items }) => (
        <div key={toISODate(d)}>
          <p className="mb-1.5 px-4 text-[13px] font-semibold text-muted first-letter:uppercase">
            {toISODate(d) === toISODate(start) ? "Aujourd'hui" : DAY_TITLE.format(d)}
          </p>
          <Card className="overflow-hidden">
            <ul>
              {items.map((it) => (
                <AgendaRow key={it.key} item={it} onOpen={() => onOpen(it)} />
              ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  )
}

function AgendaRow({ item, onOpen }: { item: AgendaItem; onOpen(): void }) {
  const { removeWithUndo } = useStore()
  const row = (
    <button onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-[18px]">
        {item.emoji}
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface"
          style={{ background: item.color }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] leading-snug">{item.text}</span>
        {(item.time || item.meta) && (
          <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
            {item.time && (
              <span className="num flex items-center gap-1 font-semibold text-sec">
                <Clock size={11} strokeWidth={2.6} /> {item.time}
              </span>
            )}
            {item.meta && <span className="truncate">{item.meta}</span>}
          </span>
        )}
      </span>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </button>
  )
  return (
    <li className="border-b border-line/60 last:border-0">
      {item.event ? (
        <SwipeRow
          left={{
            label: 'Supprimer',
            icon: <Trash2 size={18} />,
            tone: 'late',
            run: () => removeWithUndo('calendar_events', item.event!.id, item.event!.title),
          }}
        >
          {row}
        </SwipeRow>
      ) : (
        row
      )}
    </li>
  )
}

/** Ajouter ou modifier un événement / pense-bête. Supprimer demande une confirmation. */
function EventForm({ draft, onDone }: { draft: Draft; onDone(date?: string): void }) {
  const { insert, update, remove, me } = useStore()
  const existing = 'id' in draft ? draft : null
  const mine = !existing || existing.added_by === me
  const [title, setTitle] = useState(existing?.title ?? '')
  const [kind, setKind] = useState<CalendarEvent['kind']>(existing?.kind ?? 'event')
  const [date, setDate] = useState(draft.date)
  const [time, setTime] = useState(existing?.time?.slice(0, 5) ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [remind, setRemind] = useState<number | null>(existing ? existing.remind_days : 1)
  const [remindTime, setRemindTime] = useState(existing?.remind_at ? hhmmOf(existing.remind_at) : '09:00')
  const [secret, setSecret] = useState(existing?.private ?? false)
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [repeat, setRepeat] = useState<CalendarEvent['repeat']>(existing?.repeat ?? null)
  // Couleur : celle choisie, sinon celle de la sorte (violet-bleu pour un événement, rose pour un pense-bête).
  const [color, setColor] = useState<string | null>(existing?.color ?? null)
  const shown = color ?? AGENDA_COLORS[kind]
  const who = secret ? 'vous seul' : 'vous deux'
  const [confirm, setConfirm] = useState(false)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const clean = capitalize(title.trim())
    if (!clean || !date) return
    const row = {
      title: clean,
      kind,
      date,
      time: time || null,
      note: note.trim() || null,
      remind_days: remind,
      remind_at: remindAt(date, remind, remindTime, repeat),
      private: secret,
      color: shown,
      end_date: endDate && endDate > date ? endDate : null,
      repeat,
    }
    if (existing) {
      // Jour, heure ou rappel changés : la notification repartira à la nouvelle heure.
      const moved = row.remind_at !== existing.remind_at
      update('calendar_events', existing.id, moved ? { ...row, reminded_at: null } : row)
    } else insert('calendar_events', row)
    onDone(date)
  }

  if (confirm && existing)
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <p className="font-serif text-[22px] font-medium">Supprimer « {existing.title} » ?</p>
        <p className="mb-3 text-[14px] text-muted">{existing.repeat ? 'Toutes ses dates disparaîtront' : 'Il disparaîtra'} du calendrier{existing.private ? '' : ' pour vous deux'}.</p>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            remove('calendar_events', existing.id)
            onDone()
          }}
        >
          Oui, supprimer
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setConfirm(false)}>
          Annuler
        </Button>
      </div>
    )

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <TitleInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!existing}
        maxLength={80}
        placeholder={kind === 'memo' ? 'Anniversaire de maman…' : 'Pédiatre, resto, vacances…'}
        aria-label="Titre"
      />
      <div className="flex justify-center gap-1.5 py-1">
        {(
          [
            ['event', '📅 Événement'],
            ['memo', '📌 Pense-bête'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={cx(
              'h-10 rounded-full px-4 text-[14px] font-semibold transition duration-200 ease-smooth active:scale-95',
              kind === k ? 'bg-sec text-bg shadow-[0_4px_14px_-6px_var(--sec)]' : 'bg-surface-2 text-ink ring-1 ring-line/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mine && (
        <div className="flex justify-center gap-1.5 pb-1">
          {(
            [
              [false, '👥 Nous deux'],
              [true, '🔒 Juste moi'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setSecret(p)}
              aria-pressed={secret === p}
              className={cx(
                'h-9 rounded-full px-3.5 text-[14px] font-semibold transition duration-200 ease-smooth active:scale-95',
                secret === p ? 'bg-ink text-bg' : 'bg-surface-2 text-muted ring-1 ring-line/60',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <ColorChips value={shown} onChange={setColor} />
      <DateRow label="Jour" icon={<CalendarDays size={18} />} value={date} onChange={setDate} />
      <DateRow label="Jusqu'au (facultatif)" icon={<CalendarRange size={18} />} value={endDate} min={date} onChange={setEndDate} />
      <div className="flex flex-wrap justify-center gap-1.5 py-1">
        {REPEATS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRepeat(r.value)}
            aria-pressed={repeat === r.value}
            className={cx(
              'flex h-9 items-center gap-1 rounded-full px-3.5 text-[14px] font-semibold transition duration-200 ease-smooth active:scale-95',
              repeat === r.value ? 'bg-sec text-bg shadow-[0_4px_14px_-6px_var(--sec)]' : 'bg-surface-2 text-ink ring-1 ring-line/60',
            )}
          >
            {r.value && <Repeat size={13} strokeWidth={2.6} />}
            {r.label}
          </button>
        ))}
      </div>
      <label className="flex h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-2 focus-within:ring-sec/50">
        <Clock size={18} className="text-sec" />
        <span className="flex-1 text-[15px] text-muted">Heure (facultatif)</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="min-w-0 bg-transparent text-right text-[15px] font-semibold outline-none"
        />
      </label>
      <label className="flex items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 ring-1 ring-line/50 focus-within:ring-2 focus-within:ring-sec/50">
        <StickyNote size={18} className="mt-0.5 shrink-0 text-sec" />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Note (facultatif) : adresse, quoi apporter…"
          className="min-h-11 flex-1 resize-none bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
      </label>
      <div className="rounded-2xl bg-surface-2/60 px-3 pb-3 pt-2.5 ring-1 ring-line/50">
        <p className="mb-2.5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-muted">
          <BellRing size={15} className="text-sec" /> {secret ? 'Me prévenir' : 'Nous prévenir'}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {REMINDERS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRemind(r.days)}
              aria-pressed={remind === r.days}
              className={cx(
                'h-9 rounded-full px-3.5 text-[14px] font-semibold transition duration-200 ease-smooth active:scale-95',
                remind === r.days ? 'bg-sec text-bg shadow-[0_4px_14px_-6px_var(--sec)]' : 'bg-surface-2 text-ink ring-1 ring-line/60',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {remind !== null && (
          <>
            <label className="mx-auto mt-2.5 flex h-11 max-w-60 items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-line/60 focus-within:ring-2 focus-within:ring-sec/50">
              <Clock size={15} className="text-sec" />
              <span className="flex-1 text-[14px] text-muted">À quelle heure ?</span>
              <input
                type="time"
                value={remindTime}
                onChange={(e) => setRemindTime(e.target.value)}
                aria-label="Heure du rappel"
                className="bg-transparent text-right text-[15px] font-semibold outline-none"
              />
            </label>
            <p className="mt-2 text-center text-[12.5px] text-muted">
              Une notification pour {who}{' '}
              {remind === 0 ? 'le jour même' : `${remind === 7 ? 'une semaine' : `${remind} jour${remind > 1 ? 's' : ''}`} avant`}, à{' '}
              {spoken(remindTime || '09:00')}.
            </p>
          </>
        )}
      </div>
      {existing && (
        <a
          href={calendarUrl(
            existing.title,
            (() => {
              const d = parseISODate(existing.date)
              const [h, m] = (existing.time ?? '09:00').split(':').map(Number)
              d.setHours(h, m)
              return d.toISOString()
            })(),
          )}
          className="mx-auto flex h-10 items-center gap-1.5 px-3 text-[14px] font-semibold text-sec active:opacity-60"
        >
          <Smartphone size={16} /> Ajouter à mon iPhone
        </a>
      )}
      <SheetActions
        saveLabel={existing ? 'Enregistrer' : 'Ajouter au calendrier'}
        deleteLabel="Supprimer"
        onDelete={existing ? () => setConfirm(true) : undefined}
      />
    </form>
  )
}
