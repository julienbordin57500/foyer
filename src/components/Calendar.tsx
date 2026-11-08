import { useState, type FormEvent } from 'react'
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, RefreshCw, StickyNote, Trash2 } from 'lucide-react'
import type { Tab } from '../App'
import { useStore } from '../data/store'
import { useIphoneImport } from './IphoneCalendars'
import { AGENDA_COLORS, AGENDA_LEGEND, useAgenda, type AgendaItem } from '../lib/agenda'
import { addDays, parseISODate, toISODate, today } from '../lib/dates'
import { capitalize } from '../lib/format'
import type { CalendarEvent } from '../lib/types'
import { Button, Card, DateRow, SectionTitle, Sheet, SheetActions, SwipeRow, TitleInput, cx, tick } from './ui'

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

/** Moment de la notification : le jour du rappel (0 à 7 jours avant), à l'heure choisie. Déjà passé : elle part tout de suite. */
function remindAt(date: string, days: number | null, at: string) {
  if (days === null) return null
  const d = addDays(parseISODate(date), -days)
  const [h, m] = (at || '09:00').split(':').map(Number)
  d.setHours(h, m)
  return d.toISOString()
}
/** « 09:00 » → « 9 h », « 18:30 » → « 18 h 30 ». */
const spoken = (t: string) => {
  const [h, m] = t.split(':')
  return `${Number(h)} h${m === '00' ? '' : ` ${m}`}`
}
const hhmmOf = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Le calendrier du foyer, en grand sur l'Accueil : le mois, puis le détail du jour choisi. */
export function CalendarBlock({ go }: { go(t: Tab): void }) {
  const itemsOn = useAgenda()
  const { data } = useStore()
  const { run: importIphone, busy } = useIphoneImport()
  const hasFeeds = data.calendar_feeds.length > 0
  const todayIso = toISODate(today())
  const [picked, setPicked] = useState(todayIso)
  const [month, setMonth] = useState(() => {
    const d = today()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [draft, setDraft] = useState<Draft | null>(null)

  // Grille du lundi au dimanche, 6 semaines : comme le calendrier de l'iPhone.
  const first = addDays(month, -((month.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const shift = (n: number) => {
    tick()
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  }
  const pick = (d: Date) => {
    setPicked(toISODate(d))
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }
  const isThisMonth = month.getMonth() === today().getMonth() && month.getFullYear() === today().getFullYear()
  const dayItems = itemsOn(picked)

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
      <Card className="p-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <button
            onClick={() => shift(-1)}
            aria-label="Mois précédent"
            className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2"
          >
            <ChevronLeft size={19} />
          </button>
          <button onClick={() => pick(today())} className="flex flex-col items-center leading-tight">
            <span key={month.getTime()} className="animate-fade font-serif text-[21px] font-medium first-letter:uppercase">
              {MONTH.format(month)}
            </span>
            {!isThisMonth && <span className="text-[11px] font-semibold text-sec">Revenir à aujourd'hui</span>}
          </button>
          <button
            onClick={() => shift(1)}
            aria-label="Mois suivant"
            className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2"
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-faint">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div key={month.getTime()} className="grid animate-fade grid-cols-7 gap-y-0.5">
          {cells.map((d) => {
            const iso = toISODate(d)
            const items = itemsOn(iso)
            const kinds = [...new Set(items.map((x) => x.kind))].slice(0, 3)
            const on = iso === picked
            const out = d.getMonth() !== month.getMonth()
            return (
              <button
                key={iso}
                onClick={() => pick(d)}
                aria-pressed={on}
                aria-label={`${DAY_TITLE.format(d)} : ${items.length} chose${items.length > 1 ? 's' : ''}`}
                className={cx('flex h-12 flex-col items-center justify-center gap-1 transition-opacity', out && 'opacity-30')}
              >
                <span
                  className={cx(
                    'num grid size-8 place-items-center rounded-full text-[15px] font-semibold transition duration-200 ease-smooth',
                    on ? 'bg-sec text-bg shadow-[0_4px_14px_-4px_var(--sec)]' : iso === todayIso && 'text-sec ring-2 ring-sec/60',
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {kinds.map((k) => (
                    <span key={k} className="size-1.5 rounded-full" style={{ background: AGENDA_COLORS[k] }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-line/60 pt-2.5 text-[11px] text-muted">
          {AGENDA_LEGEND.map((l) => (
            <span key={l.kind} className="flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ background: AGENDA_COLORS[l.kind] }} />
              {l.label}
            </span>
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
              <AgendaRow key={it.key} item={it} onOpen={() => (it.event ? setDraft(it.event) : go(it.tab))} />
            ))}
          </ul>
        )}
      </Card>

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

function AgendaRow({ item, onOpen }: { item: AgendaItem; onOpen(): void }) {
  const { removeWithUndo } = useStore()
  const row = (
    <button onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-[18px]">
        {item.emoji}
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface"
          style={{ background: AGENDA_COLORS[item.kind] }}
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
      remind_at: remindAt(date, remind, remindTime),
      private: secret,
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
        <p className="mb-3 text-[14px] text-muted">Il disparaîtra du calendrier{existing.private ? '' : ' pour vous deux'}.</p>
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
      <DateRow label="Jour" icon={<CalendarDays size={18} />} value={date} onChange={setDate} />
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
      <SheetActions
        saveLabel={existing ? 'Enregistrer' : 'Ajouter au calendrier'}
        deleteLabel="Supprimer"
        onDelete={existing ? () => setConfirm(true) : undefined}
      />
    </form>
  )
}
