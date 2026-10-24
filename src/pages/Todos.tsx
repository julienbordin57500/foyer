import { useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Repeat as RepeatIcon, Trash2, Users } from 'lucide-react'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { addDays, nextOccurrence, nextSaturday, parseISODate, toISODate, today } from '../lib/dates'
import { ago, capitalize, dueLabel } from '../lib/format'
import type { Repeat, Todo } from '../lib/types'
import { ReminderBadge, ReminderPicker, type ReminderValue } from '../components/Reminder'
import { SearchButton } from '../components/Search'
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
  const [editing, setEditing] = useState<Todo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const open = data.todos.filter((t) => !t.done_at)
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
  const dated = sorted.filter((t) => t.due_date)
  const someday = sorted.filter((t) => !t.due_date)
  const lateCount = dated.filter((t) => dueLabel(t.due_date!).late).length
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
    })
    setText('')
    setWhen('none')
    setRepeat('none')
    inputRef.current?.focus()
  }

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
      <div
        className={cx(
          'grid transition-[grid-template-rows,opacity] duration-500 ease-smooth',
          text.trim() ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="mb-2 space-y-2">
            <OptionRow label="Pour qui ?" icon={<Users size={18} />} value={assignee} onChange={setAssignee} options={assigneeOptions} />
            <OptionRow<When>
              label="Quand ?"
              icon={<CalendarDays size={18} />}
              value={when}
              onChange={setWhen}
              options={[
                { value: 'none', label: 'Pas pressé' },
                { value: 'today', label: "Aujourd'hui" },
                { value: 'tomorrow', label: 'Demain' },
                { value: 'weekend', label: 'Ce week-end' },
                { value: 'custom', label: 'Une date précise' },
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

      {dated.length > 0 && (
        <>
          <SectionTitle>Avec une date</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {dated.map((t) => (
                <TodoRow key={t.id} todo={t} fresh={isNew(t.id)} onEdit={() => setEditing(t)} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {someday.length > 0 && (
        <>
          <SectionTitle>Quand on peut</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {someday.map((t) => (
                <TodoRow key={t.id} todo={t} fresh={isNew(t.id)} onEdit={() => setEditing(t)} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {done.length > 0 && <DoneList items={done} />}

      <Sheet open={!!editing} title="Tâche" onClose={() => setEditing(null)}>
        {editing && <TodoForm key={editing.id} todo={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function TodoRow({ todo, fresh, onEdit }: { todo: Todo; fresh: boolean; onEdit(): void }) {
  const { update, insert, removeWithUndo, me } = useStore()
  const member = useMember()
  const [leaving, setLeaving] = useState(false)
  const due = todo.due_date ? dueLabel(todo.due_date) : null
  const reminder = todo.remind_at && !todo.reminded_at ? todo.remind_at : null
  const who = todo.assignee ? member(todo.assignee) : null
  const by = member(todo.added_by)

  const complete = (delay = 560) => {
    setLeaving(true)
    setTimeout(() => {
      update('todos', todo.id, { done_at: new Date().toISOString(), done_by: me })
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
        right={{ label: 'Faite', icon: <Check size={18} strokeWidth={2.6} />, tone: 'done', run: () => complete(200) }}
        left={{ label: 'Supprimer', icon: <Trash2 size={18} />, tone: 'late', run: () => removeWithUndo('todos', todo.id, todo.title) }}
      >
        <div className="flex min-h-14 items-start gap-3 px-4 py-3">
          <CheckCircle
            checked={leaving}
            tone={due?.late ? 'late' : 'default'}
            onClick={() => complete()}
            label={`Marquer « ${todo.title} » comme faite`}
          />
          <button onClick={onEdit} className="min-w-0 flex-1 pt-0.5 text-left">
            <span className={cx('block text-[16px] leading-snug transition-colors duration-300', leaving && 'text-muted line-through')}>
              {todo.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] leading-5 text-muted">
              {reminder && <ReminderBadge iso={reminder} />}
              {due && <span className={cx('font-medium', due.late ? 'text-late' : due.days === 0 ? 'text-sec' : '')}>{due.text}</span>}
              {todo.repeat && (
                <span className="inline-flex items-center gap-0.5 text-sec" title={REPEAT_LABEL[todo.repeat]}>
                  <RepeatIcon size={12} strokeWidth={2.4} />
                </span>
              )}
              {due && <span className="text-faint">·</span>}
              {who ? (
                <span className="inline-flex items-center gap-1">
                  <Avatar initial={who.initial} tone={who.tone} size="xs" />
                  {who.isMe ? 'Pour moi' : `Pour ${who.name}`}
                </span>
              ) : (
                <span>Nous deux</span>
              )}
              <span className="text-faint">·</span>
              <span>notée par {by.isMe ? 'moi' : by.name}</span>
            </span>
          </button>
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
  const [reminder, setReminder] = useState<ReminderValue>({ remind_at: todo.remind_at, remind_to: todo.remind_to })

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
