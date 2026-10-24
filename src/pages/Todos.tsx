import { useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Trash2 } from 'lucide-react'
import { useMember, usePartner, useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { addDays, nextSaturday, toISODate, today } from '../lib/dates'
import { ago, capitalize, dueLabel } from '../lib/format'
import type { Todo } from '../lib/types'
import { Avatar, Button, Card, CheckCircle, Chips, Collapsible, Composer, Empty, Field, PageHeader, SectionTitle, Sheet, cx, useArrivals } from '../components/ui'

type When = 'none' | 'today' | 'tomorrow' | 'weekend' | 'custom'

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
    insert('todos', {
      title: capitalize(title),
      assignee: assignee === 'both' ? null : assignee,
      due_date: whenToDate(when, custom),
    })
    setText('')
    setWhen('none')
    inputRef.current?.focus()
  }

  const assigneeOptions = [
    { value: 'both', label: 'Nous deux' },
    { value: me.user_id, label: 'Moi' },
    ...(partner ? [{ value: partner.user_id, label: partner.display_name }] : []),
  ]

  return (
    <div className="animate-page">
      <PageHeader
        eyebrow={
          open.length === 0
            ? 'Tout est fait'
            : `${open.length} chose${open.length > 1 ? 's' : ''} à faire${lateCount ? ` · ${lateCount} en retard` : ''}`
        }
        title="À faire"
      />

      <Composer value={text} onChange={setText} onSubmit={add} placeholder="Une chose à faire…" label="Nouvelle tâche" inputRef={inputRef} />
      <div
        className={cx(
          'grid transition-[grid-template-rows,opacity] duration-500 ease-smooth',
          text.trim() ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-4 space-y-4 px-1">
            <Chips label="Pour qui ?" value={assignee} onChange={setAssignee} options={assigneeOptions} />
            <Chips<When>
              label="Quand ?"
              value={when}
              onChange={setWhen}
              options={[
                { value: 'none', label: 'Pas pressé' },
                { value: 'today', label: "Aujourd'hui" },
                { value: 'tomorrow', label: 'Demain' },
                { value: 'weekend', label: 'Ce week-end' },
                { value: 'custom', label: <CalendarDays size={16} className="inline" aria-label="Choisir une date" /> },
              ]}
            />
            {when === 'custom' && (
              <input
                type="date"
                value={custom}
                min={toISODate(today())}
                onChange={(e) => setCustom(e.target.value)}
                className="h-11 rounded-2xl bg-surface-2 px-4 text-[16px] outline-none"
                aria-label="Date"
              />
            )}
          </div>
        </div>
      </div>

      {open.length === 0 && done.length === 0 && (
        <Empty emoji="🌿" title="Rien à faire" text="Notez ici ce qui vous trotte dans la tête. Quand l'un coche, c'est fait pour les deux." />
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
  const { update, me } = useStore()
  const member = useMember()
  const [leaving, setLeaving] = useState(false)
  const due = todo.due_date ? dueLabel(todo.due_date) : null
  const who = todo.assignee ? member(todo.assignee) : null
  const by = member(todo.added_by)

  const complete = () => {
    setLeaving(true)
    setTimeout(() => update('todos', todo.id, { done_at: new Date().toISOString(), done_by: me }), 560)
  }

  return (
    <Collapsible leaving={leaving} className={cx('border-b border-line/70 last:border-0', fresh && 'animate-pop')}>
      <div className="flex min-h-14 items-start gap-3 px-4 py-3">
        <CheckCircle checked={leaving} tone={due?.late ? 'late' : 'default'} onClick={complete} label={`Marquer « ${todo.title} » comme faite`} />
        <button onClick={onEdit} className="min-w-0 flex-1 pt-0.5 text-left">
          <span className={cx('block text-[16px] leading-snug transition-colors duration-300', leaving && 'text-muted line-through')}>{todo.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] leading-5 text-muted">
            {due && <span className={cx('font-medium', due.late ? 'text-late' : due.days === 0 ? 'text-accent' : '')}>{due.text}</span>}
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
      <SectionTitle aside={items.length > 3 && <button onClick={() => setOpen(!open)}>{open ? 'Réduire' : `Tout voir (${items.length})`}</button>}>
        Fait cette semaine
      </SectionTitle>
      <ul>
        {shown.map((t) => {
          const by = member(t.done_by)
          return (
            <li key={t.id} className="animate-fade flex min-h-12 items-center gap-3 px-4">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-done/15 text-done">
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

  const save = (e: FormEvent) => {
    e.preventDefault()
    update('todos', todo.id, { title: title.trim() || todo.title, assignee: assignee === 'both' ? null : assignee, due_date: due || null })
    onClose()
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Quoi ?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Chips
        label="Pour qui ?"
        value={assignee}
        onChange={setAssignee}
        options={[
          { value: 'both', label: 'Nous deux' },
          { value: me.user_id, label: 'Moi' },
          ...(partner ? [{ value: partner.user_id, label: partner.display_name }] : []),
        ]}
      />
      <div>
        <Field label="Pour quand ? (facultatif)" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        {due && (
          <button type="button" onClick={() => setDue('')} className="mt-1.5 px-1 text-[13px] font-medium text-accent">
            Retirer la date
          </button>
        )}
      </div>
      <p className="flex items-center gap-2 px-1 text-[13px] text-muted">
        <Avatar initial={by.initial} tone={by.tone} size="xs" />
        Notée par {by.isMe ? 'vous' : by.name} · {ago(todo.created_at)}
      </p>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="danger"
          aria-label="Supprimer"
          className="px-4"
          onClick={() => {
            remove('todos', todo.id)
            onClose()
          }}
        >
          <Trash2 size={18} />
        </Button>
        <Button className="flex-1">Enregistrer</Button>
      </div>
    </form>
  )
}
