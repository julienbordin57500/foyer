import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, BellRing, CalendarDays, Check, Clock, Plus, Repeat as RepeatIcon, Trash2, Users } from 'lucide-react'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { addDays, nextOccurrence, nextSaturday, parseISODate, toISODate, today } from '../lib/dates'
import { ago, capitalize, dueLabel } from '../lib/format'
import type { Repeat, Todo } from '../lib/types'
import { ReminderBadge, ReminderPicker, type ReminderValue } from '../components/Reminder'
import { SearchButton } from '../components/Search'
import { TasksSwitch } from '../components/Nav'
import { calendarUrl, reminderLabel } from '../lib/reminders'
import { isDemo } from '../lib/supabase'
import {
  Avatar,
  Card,
  CheckCircle,
  DateRow,
  OptionRow,
  SheetActions,
  TitleInput,
  Collapsible,
  Composer,
  Empty,
  Hero,
  SectionTitle,
  Sheet,
  SwipeRow,
  ToggleRow,
  tick,
  cx,
  useArrivals,
} from '../components/ui'

type When = 'none' | 'today' | 'tomorrow' | 'weekend' | 'custom'

export const REPEAT_LABEL: Record<Repeat, string> = {
  day: 'Chaque jour',
  week: 'Chaque semaine',
  '2weeks': 'Toutes les 2 semaines',
  month: 'Chaque mois',
}
type RepeatChoice = Repeat | 'none'
const REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: 'none', label: 'Non, une fois' },
  { value: 'day', label: 'Chaque jour' },
  { value: 'week', label: 'Chaque semaine' },
  { value: '2weeks', label: 'Toutes les 2 semaines' },
  { value: 'month', label: 'Chaque mois' },
]

/** Heure proposée au calendrier : celle du rappel, sinon la date de la tâche à 9 h, sinon dans une heure. */
const calendarTime = (t: Todo) => {
  if (t.remind_at) return t.remind_at
  if (t.due_date) {
    const d = parseISODate(t.due_date)
    d.setHours(9, 0, 0, 0)
    if (d.getTime() > Date.now()) return d.toISOString()
  }
  const d = new Date(Date.now() + 3_600_000)
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

type WhoFilter = 'all' | 'me' | 'partner'
type GroupId = 'late' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday'

/** Groupes dans l'ordre d'urgence ; la date n'est répétée sur la ligne que si le groupe ne la dit pas déjà. */
const GROUPS: { id: GroupId; label: string; showDate: boolean }[] = [
  { id: 'late', label: 'En retard', showDate: true },
  { id: 'today', label: "Aujourd'hui", showDate: false },
  { id: 'tomorrow', label: 'Demain', showDate: false },
  { id: 'week', label: 'Cette semaine', showDate: true },
  { id: 'later', label: 'Plus tard', showDate: true },
  { id: 'someday', label: 'Quand on peut', showDate: false },
]
const groupOf = (t: Todo): GroupId => {
  if (!t.due_date) return 'someday'
  const d = dueLabel(t.due_date).days
  return d < 0 ? 'late' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : d < 7 ? 'week' : 'later'
}

/** Heure du rappel : le jour de la tâche à l'heure choisie ; sans date, la prochaine fois que cette heure arrive. */
const remindAt = (due: string | null, time: string) => {
  const [h, m] = time.split(':').map(Number)
  const d = due ? parseISODate(due) : today()
  d.setHours(h || 0, m || 0, 0, 0)
  if (!due && d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

const whenToDate = (w: When, custom: string) => {
  if (w === 'today') return toISODate(today())
  if (w === 'tomorrow') return toISODate(addDays(today(), 1))
  if (w === 'weekend') return toISODate(nextSaturday())
  if (w === 'custom') return custom || null
  return null
}

export default function TodosPage() {
  const { data, insert } = useStore()
  const { me } = useSession()
  const partner = usePartner()
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState<string>('both')
  const [when, setWhen] = useState<When>('none')
  const [custom, setCustom] = useState('')
  const [repeat, setRepeat] = useState<RepeatChoice>('none')
  const [notify, setNotify] = useState(false)
  const [notifyTime, setNotifyTime] = useState('09:00')
  const [editing, setEditing] = useState<Todo | null>(null)
  const [who, setWho] = useState<WhoFilter>(() => {
    try {
      return (localStorage.getItem('foyer-todo-filter') as WhoFilter) || 'all'
    } catch {
      return 'all'
    }
  })
  const pickWho = (w: WhoFilter) => {
    setWho(w)
    try {
      localStorage.setItem('foyer-todo-filter', w)
    } catch {
      /* stockage indisponible */
    }
  }
  const inputRef = useRef<HTMLInputElement>(null)

  // Filtre « Tout · Moi · Claire » : les tâches pour nous deux restent visibles des deux côtés.
  const target = who === 'me' ? me.user_id : who === 'partner' ? partner?.user_id : null
  const forWho = (t: Todo) => !target || t.assignee === null || t.assignee === target
  const open = data.todos.filter((t) => !t.done_at && forWho(t))
  const done = data.todos
    .filter((t) => t.done_at && Date.now() - new Date(t.done_at).getTime() < 7 * 86_400_000)
    .sort((a, b) => b.done_at!.localeCompare(a.done_at!))

  // Ordre : en retard, puis par échéance, puis sans date (les plus récentes d'abord).
  const sorted = [...open].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return b.created_at.localeCompare(a.created_at)
  })
  const groups = GROUPS.map((g) => ({ ...g, items: sorted.filter((t) => groupOf(t) === g.id) })).filter((g) => g.items.length > 0)
  const lateCount = sorted.filter((t) => groupOf(t) === 'late').length
  const isNew = useArrivals(data.todos.map((t) => t.id))

  const add = () => {
    const title = text.trim()
    if (!title) return
    // Une tâche qui revient a besoin d'une première date : aujourd'hui par défaut.
    const due = whenToDate(when, custom) ?? (repeat !== 'none' ? toISODate(today()) : null)
    insert('todos', {
      title: capitalize(title),
      assignee: assignee === 'both' ? null : assignee,
      due_date: due,
      repeat: repeat === 'none' ? null : repeat,
      ...(notify
        ? {
            remind_at: remindAt(due, notifyTime),
            remind_to: assignee === 'both' ? null : assignee,
          }
        : {}),
    })
    setText('')
    setWhen('none')
    setRepeat('none')
    setNotify(false)
    inputRef.current?.focus()
  }

  const notifyLabel =
    assignee === me.user_id ? 'Me prévenir' : assignee === 'both' ? 'Nous prévenir' : `Prévenir ${partner?.display_name ?? ''}`
  const notifyPreview = remindAt(whenToDate(when, custom) ?? (repeat !== 'none' ? toISODate(today()) : null), notifyTime)

  const assigneeOptions = [
    { value: 'both', label: 'Nous deux' },
    { value: me.user_id, label: 'Moi' },
    ...(partner ? [{ value: partner.user_id, label: partner.display_name }] : []),
  ]

  return (
    <div className="animate-page">
      <Hero
        eyebrow={
          open.length === 0
            ? 'Tout est fait'
            : `${open.length} chose${open.length > 1 ? 's' : ''} à faire${lateCount ? ` · ${lateCount} en retard` : ''}`
        }
        title="À faire"
        action={<SearchButton />}
      >
        <Composer
          value={text}
          onChange={setText}
          onSubmit={add}
          placeholder="Une chose à faire…"
          label="Nouvelle tâche"
          inputRef={inputRef}
          onHero
        />
      </Hero>
      <TasksSwitch current="afaire" />
      {partner && (
        <div className="mb-2 flex justify-center gap-1.5" role="group" aria-label="Afficher les tâches de">
          {(
            [
              { value: 'all', label: 'Tout' },
              { value: 'me', label: 'Moi' },
              { value: 'partner', label: partner.display_name },
            ] as { value: WhoFilter; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => pickWho(o.value)}
              aria-pressed={who === o.value}
              className={cx(
                'h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-300 active:scale-95',
                who === o.value ? 'bg-sec/18 text-sec ring-1 ring-sec/35' : 'text-muted ring-1 ring-line/60',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div
        className={cx(
          'grid transition-[grid-template-rows,opacity] duration-500 ease-smooth',
          text.trim() ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="mb-2 space-y-2">
            {/* Pour qui et quand : un appui sur une pastille, sans ouvrir de menu. */}
            <QuickRow label="Pour qui ?" icon={<Users size={16} />} value={assignee} onChange={setAssignee} options={assigneeOptions} />
            <QuickRow<When>
              label="Quand ?"
              icon={<CalendarDays size={16} />}
              value={when}
              onChange={setWhen}
              options={[
                { value: 'none', label: 'Pas pressé' },
                { value: 'today', label: "Aujourd'hui" },
                { value: 'tomorrow', label: 'Demain' },
                { value: 'weekend', label: 'Week-end' },
                { value: 'custom', label: 'Une date…' },
              ]}
            />
            {when === 'custom' && <DateRow label="Le" value={custom} onChange={setCustom} min={toISODate(today())} />}
            <OptionRow<RepeatChoice>
              label="Revient ?"
              icon={<RepeatIcon size={18} />}
              value={repeat}
              onChange={setRepeat}
              options={REPEAT_OPTIONS}
            />
            <ToggleRow
              label={notifyLabel}
              hint={notify ? `Notification · ${reminderLabel(notifyPreview)}` : 'Une notification sur le téléphone'}
              icon={<BellRing size={18} />}
              checked={notify}
              onChange={setNotify}
            />
            {notify && (
              <label className="flex h-14 animate-pop items-center gap-3 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-2 focus-within:ring-sec/50">
                <span className="text-sec">
                  <Clock size={18} />
                </span>
                <span className="flex-1 text-[15px] text-muted">À quelle heure ?</span>
                <input
                  type="time"
                  value={notifyTime}
                  onChange={(e) => e.target.value && setNotifyTime(e.target.value)}
                  className="bg-transparent text-right text-[15px] font-semibold outline-none"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {open.length === 0 && done.length === 0 && (
        <Empty
          emoji="🌿"
          title="Rien à faire"
          text="Notez ici ce qui vous trotte dans la tête. Quand l'un coche, c'est fait pour les deux."
        />
      )}

      {groups.map((g) => (
        <section key={g.id}>
          <SectionTitle aside={g.items.length}>
            <span className={cx(g.id === 'late' && 'text-late')}>{g.label}</span>
          </SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {g.items.map((t) => (
                <TodoRow key={t.id} todo={t} fresh={isNew(t.id)} showDate={g.showDate} onEdit={() => setEditing(t)} />
              ))}
            </ul>
          </Card>
        </section>
      ))}

      {done.length > 0 && <DoneList items={done} />}

      <Sheet open={!!editing} title="Tâche" onClose={() => setEditing(null)}>
        {editing && <TodoForm key={editing.id} todo={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

/** Rangée de pastilles : le choix se fait d'un seul appui. */
function QuickRow<T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string
  icon: ReactNode
  value: T
  onChange(v: T): void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 pb-3 pt-2.5 ring-1 ring-line/50" role="group" aria-label={label}>
      <p className="mb-2 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-muted">
        <span className="text-sec">{icon}</span>
        {label}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              tick()
              onChange(o.value)
            }}
            aria-pressed={value === o.value}
            className={cx(
              'h-9 rounded-full px-3.5 text-[14px] font-semibold transition duration-200 ease-smooth active:scale-95',
              value === o.value ? 'bg-sec text-bg shadow-[0_4px_14px_-6px_var(--sec)]' : 'bg-surface text-ink ring-1 ring-line/60',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TodoRow({ todo, fresh, showDate, onEdit }: { todo: Todo; fresh: boolean; showDate: boolean; onEdit(): void }) {
  const { update, insert, removeWithUndo, showToast, me } = useStore()
  const member = useMember()
  const partner = usePartner()
  const [leaving, setLeaving] = useState(false)
  const due = todo.due_date ? dueLabel(todo.due_date) : null
  const reminder = todo.remind_at && !todo.reminded_at ? todo.remind_at : null
  const who = todo.assignee ? member(todo.assignee) : null
  const both = [member(me), partner ? member(partner.user_id) : null].filter((m) => m !== null)

  // Reporter à demain, en gardant l'heure du rappel s'il y en a un.
  const canPostpone = !!due && due.days <= 0
  const postpone = () => {
    const tomorrow = addDays(today(), 1)
    const shift = tomorrow.getTime() - parseISODate(todo.due_date!).getTime()
    update('todos', todo.id, {
      due_date: toISODate(tomorrow),
      ...(todo.remind_at ? { remind_at: new Date(new Date(todo.remind_at).getTime() + shift).toISOString(), reminded_at: null } : {}),
    })
    const before = { due_date: todo.due_date, remind_at: todo.remind_at, reminded_at: todo.reminded_at }
    showToast(`Reportée à demain`, () => update('todos', todo.id, before))
  }

  const complete = (delay = 560) => {
    setLeaving(true)
    setTimeout(() => {
      update('todos', todo.id, {
        done_at: new Date().toISOString(),
        done_by: me,
      })
      // Tâche qui revient : la suivante apparaît aussitôt, avec son rappel décalé d'autant.
      if (todo.repeat && todo.due_date) {
        const next = nextOccurrence(todo.due_date, todo.repeat)
        const shift = parseISODate(next).getTime() - parseISODate(todo.due_date).getTime()
        insert('todos', {
          title: todo.title,
          assignee: todo.assignee,
          due_date: next,
          repeat: todo.repeat,
          remind_at: todo.remind_at ? new Date(new Date(todo.remind_at).getTime() + shift).toISOString() : null,
          remind_to: todo.remind_to,
        })
      }
    }, delay)
  }

  return (
    <Collapsible leaving={leaving} className={cx('border-b border-line/70 last:border-0', fresh && 'animate-pop')}>
      <SwipeRow
        right={{
          label: 'Faite',
          icon: <Check size={18} strokeWidth={2.6} />,
          tone: 'done',
          run: () => complete(200),
        }}
        left={{
          label: 'Supprimer',
          icon: <Trash2 size={18} />,
          tone: 'late',
          run: () => removeWithUndo('todos', todo.id, todo.title),
        }}
      >
        <div className="flex min-h-16 items-center gap-3 px-4 py-3">
          <CheckCircle
            checked={leaving}
            tone={due?.late ? 'late' : 'default'}
            onClick={() => complete()}
            label={`Marquer « ${todo.title} » comme faite`}
          />
          <button onClick={onEdit} className="min-w-0 flex-1 text-left">
            <span className={cx('block text-[16.5px] leading-snug transition-colors duration-300', leaving && 'text-muted line-through')}>
              {todo.title}
            </span>
            {/* Une seule petite ligne : rappel, date si utile, répétition, et pour qui (les initiales). */}
            <span className="mt-1 flex items-center gap-2 text-[12.5px] leading-5 text-muted">
              {reminder && <ReminderBadge iso={reminder} />}
              {due && showDate && <span className={cx('font-semibold', due.late ? 'text-late' : 'text-ink/75')}>{due.text}</span>}
              {todo.repeat && (
                <span className="inline-flex text-sec" title={REPEAT_LABEL[todo.repeat]} aria-label={REPEAT_LABEL[todo.repeat]}>
                  <RepeatIcon size={13} strokeWidth={2.4} />
                </span>
              )}
              <span
                className="inline-flex items-center -space-x-1"
                aria-label={who ? (who.isMe ? 'Pour moi' : `Pour ${who.name}`) : 'Pour nous deux'}
              >
                {(who ? [who] : both).map((m) => (
                  <Avatar key={m.initial + m.tone} initial={m.initial} tone={m.tone} size="xs" />
                ))}
              </span>
            </span>
          </button>
          {canPostpone ? (
            <button
              type="button"
              onClick={() => {
                tick()
                postpone()
              }}
              aria-label={`Reporter « ${todo.title} » à demain`}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-sec/12 px-2.5 text-[12.5px] font-semibold text-sec ring-1 ring-sec/25 transition active:scale-90"
            >
              Demain <ArrowRight size={13} strokeWidth={2.6} />
            </button>
          ) : (
            !isDemo && (
              <a
                href={calendarUrl(todo.title, calendarTime(todo))}
                target="_blank"
                rel="noreferrer"
                aria-label={`Ajouter « ${todo.title} » au calendrier`}
                title="Ajouter au calendrier"
                className="mt-0.5 flex h-7 shrink-0 items-center gap-0.5 self-end rounded-full bg-sec/12 px-2 text-sec ring-1 ring-sec/25 transition active:scale-90"
              >
                <Plus size={11} strokeWidth={3} />
                <CalendarDays size={14} />
              </a>
            )
          )}
        </div>
      </SwipeRow>
    </Collapsible>
  )
}

function DoneList({ items }: { items: Todo[] }) {
  const { update } = useStore()
  const member = useMember()
  const [open, setOpen] = useState(false)
  const shown = open ? items : items.slice(0, 3)

  return (
    <>
      <SectionTitle
        aside={items.length > 3 && <button onClick={() => setOpen(!open)}>{open ? 'Réduire' : `Tout voir (${items.length})`}</button>}
      >
        Fait cette semaine
      </SectionTitle>
      <ul>
        {shown.map((t) => {
          const by = member(t.done_by)
          return (
            <li key={t.id} className="animate-fade flex min-h-12 items-center gap-3 px-4">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-sec/15 text-sec">
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-muted line-through decoration-faint">{t.title}</span>
                <span className="block text-[12px] text-faint">
                  Faite par {by.isMe ? 'moi' : by.name} · {ago(t.done_at!)}
                </span>
              </span>
              <button
                onClick={() => update('todos', t.id, { done_at: null, done_by: null })}
                className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted active:bg-surface-2"
              >
                Annuler
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function TodoForm({ todo, onClose }: { todo: Todo; onClose(): void }) {
  const { update, remove } = useStore()
  const { me } = useSession()
  const partner = usePartner()
  const by = useMember()(todo.added_by)
  const [title, setTitle] = useState(todo.title)
  const [assignee, setAssignee] = useState(todo.assignee ?? 'both')
  const [due, setDue] = useState(todo.due_date ?? '')
  const [repeat, setRepeat] = useState<RepeatChoice>(todo.repeat ?? 'none')
  const [reminder, setReminder] = useState<ReminderValue>({
    remind_at: todo.remind_at,
    remind_to: todo.remind_to,
  })

  const save = (e: FormEvent) => {
    e.preventDefault()
    const reminderChanged = reminder.remind_at !== todo.remind_at
    update('todos', todo.id, {
      title: title.trim() || todo.title,
      assignee: assignee === 'both' ? null : assignee,
      due_date: due || (repeat !== 'none' ? toISODate(today()) : null),
      repeat: repeat === 'none' ? null : repeat,
      remind_at: reminder.remind_at,
      remind_to: reminder.remind_to,
      // Nouvelle heure : le rappel repart.
      ...(reminderChanged ? { reminded_at: null } : {}),
    })
    onClose()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <TitleInput value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Quoi ?" />
      <OptionRow
        label="Pour qui ?"
        icon={<Users size={18} />}
        value={assignee}
        onChange={setAssignee}
        options={[
          { value: 'both', label: 'Nous deux' },
          { value: me.user_id, label: 'Moi' },
          ...(partner ? [{ value: partner.user_id, label: partner.display_name }] : []),
        ]}
      />
      <DateRow label="Date" icon={<CalendarDays size={18} />} value={due} onChange={setDue} />
      <OptionRow<RepeatChoice>
        label="Revient ?"
        icon={<RepeatIcon size={18} />}
        value={repeat}
        onChange={setRepeat}
        options={REPEAT_OPTIONS}
      />
      <ReminderPicker value={reminder} onChange={setReminder} title={title.trim() || todo.title} />
      <p className="mt-2 flex items-center justify-center gap-2 text-[13px] text-muted">
        <Avatar initial={by.initial} tone={by.tone} size="xs" />
        Notée par {by.isMe ? 'vous' : by.name} · {ago(todo.created_at)}
      </p>
      <SheetActions
        deleteLabel="Supprimer la tâche"
        onDelete={() => {
          remove('todos', todo.id)
          onClose()
        }}
      />
    </form>
  )
}
