import { useRef, useState, type FormEvent } from 'react'
import { ChevronLeft, MoreHorizontal, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMember } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { capitalize } from '../lib/format'
import type { List, ListItem } from '../lib/types'
import { Avatar, Button, Card, CheckCircle, Chips, Composer, Empty, Field, PageHeader, SectionTitle, Sheet, cx, useArrivals } from '../components/ui'

const EMOJIS = ['📋', '🧳', '🛋️', '🔨', '🎒', '🎁', '🏕️', '🎄', '🍼', '🌱', '🎉', '🚗']

const TEMPLATES: { id: string; title: string; emoji: string; items: string[] }[] = [
  {
    id: 'valise',
    title: 'Valise',
    emoji: '🧳',
    items: [
      'Brosses à dents', 'Dentifrice', 'Gel douche et shampoing', 'Chargeurs', 'Pyjamas', 'Sous-vêtements', 'Tenues',
      'Chaussures', 'Maillots de bain', 'Médicaments', "Papiers d'identité", 'Doudou de Noah', 'Couches et lingettes', 'Biberons',
    ],
  },
  { id: 'ikea', title: 'Ikea', emoji: '🛋️', items: ['Prendre les mesures', 'Sacs de courses'] },
  {
    id: 'brico',
    title: 'Bricolage',
    emoji: '🔨',
    items: ['Vis et chevilles', 'Ampoules', 'Peinture', 'Rouleaux et pinceaux', 'Scotch de masquage'],
  },
  {
    id: 'creche',
    title: 'Sac de crèche',
    emoji: '🎒',
    items: ['Tenue de rechange', 'Couches', 'Lingettes', 'Doudou', 'Tétine', 'Crème pour le change'],
  },
]

export default function ListsPage() {
  const { data } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const current = data.lists.find((l) => l.id === openId)

  if (current) return <ListDetail key={current.id} list={current} onBack={() => setOpenId(null)} />

  return (
    <div className="animate-page">
      <PageHeader
        eyebrow={data.lists.length ? `${data.lists.length} liste${data.lists.length > 1 ? 's' : ''}` : 'À cocher à deux'}
        title="Listes"
        action={
          <button
            onClick={() => setCreating(true)}
            aria-label="Nouvelle liste"
            className="grid size-11 place-items-center rounded-full bg-ink text-bg shadow-soft transition duration-300 ease-smooth active:scale-90"
          >
            <Plus size={22} />
          </button>
        }
      />

      {data.lists.length === 0 ? (
        <>
          <Empty emoji="📋" title="Aucune liste" text="Une valise à préparer, un passage chez Ikea, du bricolage… Créez une liste et cochez-la à deux." />
          <div className="flex justify-center">
            <Button onClick={() => setCreating(true)}>
              <Plus size={18} /> Créer une liste
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data.lists.map((l, i) => (
            <ListCard key={l.id} list={l} items={data.list_items.filter((x) => x.list_id === l.id)} index={i} onOpen={() => setOpenId(l.id)} />
          ))}
        </div>
      )}

      <Sheet open={creating} title="Nouvelle liste" onClose={() => setCreating(false)}>
        {creating && (
          <CreateForm
            onDone={(id) => {
              setCreating(false)
              if (id) setOpenId(id)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

function ListCard({ list, items, index, onOpen }: { list: List; items: ListItem[]; index: number; onOpen(): void }) {
  const done = items.filter((i) => i.done).length
  const pct = items.length ? (done / items.length) * 100 : 0
  const complete = items.length > 0 && done === items.length
  const by = useMember()(list.added_by)

  return (
    <button
      onClick={onOpen}
      className="animate-pop flex min-h-[156px] flex-col rounded-[24px] bg-surface p-4 text-left shadow-soft ring-1 ring-line/80 transition duration-300 ease-smooth active:scale-[0.97]"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-surface-2 text-[22px]">{list.emoji}</span>
        <Avatar initial={by.initial} tone={by.tone} size="xs" />
      </span>
      <span className="mt-auto block pt-4 font-serif text-[20px] font-medium leading-tight">{list.title}</span>
      <span className="mt-2 flex items-center gap-2">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span
            className={cx('block h-full rounded-full transition-[width] duration-700 ease-smooth', complete ? 'bg-done' : 'bg-accent')}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="num text-[12px] font-medium text-muted">
          {done}/{items.length}
        </span>
      </span>
    </button>
  )
}

function CreateForm({ onDone }: { onDone(id: string | null): void }) {
  const { createList } = useStore()
  const [template, setTemplate] = useState('none')
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('📋')

  const pick = (id: string) => {
    setTemplate(id)
    const t = TEMPLATES.find((x) => x.id === id)
    if (t) {
      setTitle(t.title)
      setEmoji(t.emoji)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = TEMPLATES.find((x) => x.id === template)
    if (!title.trim()) return
    onDone(createList({ title: capitalize(title.trim()), emoji }, t?.items ?? []))
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Chips
        label="Partir de"
        value={template}
        onChange={pick}
        options={[{ value: 'none', label: 'Zéro' }, ...TEMPLATES.map((t) => ({ value: t.id, label: `${t.emoji} ${t.title}` }))]}
      />
      <Field label="Nom" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week-end à la mer" maxLength={60} />
      <div>
        <span className="mb-2 block px-1 text-[13px] font-medium text-muted">Icône</span>
        <div className="grid grid-cols-6 gap-2">
          {EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              aria-pressed={emoji === em}
              className={cx(
                'grid aspect-square place-items-center rounded-2xl text-[22px] transition duration-200 ease-smooth active:scale-90',
                emoji === em ? 'bg-accent-soft ring-2 ring-accent/60' : 'bg-surface-2',
              )}
            >
              {em}
            </button>
          ))}
        </div>
      </div>
      {template !== 'none' && (
        <p className="px-1 text-[13px] text-muted">
          {TEMPLATES.find((t) => t.id === template)!.items.length} éléments déjà prêts, à compléter ensuite.
        </p>
      )}
      <Button className="w-full" disabled={!title.trim()}>
        Créer la liste
      </Button>
    </form>
  )
}

function ListDetail({ list, onBack }: { list: List; onBack(): void }) {
  const { data, insert, update } = useStore()
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState<ListItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = data.list_items.filter((i) => i.list_id === list.id)
  const todo = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const isNew = useArrivals(items.map((i) => i.id))

  const add = () => {
    const t = text.trim()
    if (!t) return
    insert('list_items', { list_id: list.id, text: capitalize(t) })
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="animate-slide">
      <div className="pt-safe flex items-center justify-between">
        <button onClick={onBack} className="-ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-muted active:bg-surface-2">
          <ChevronLeft size={22} />
          Listes
        </button>
        <button onClick={() => setMenu(true)} aria-label="Options de la liste" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
          <MoreHorizontal size={22} />
        </button>
      </div>

      <header className="mb-6 mt-3 flex items-center gap-4 px-1">
        <span className="grid size-14 shrink-0 place-items-center rounded-[20px] bg-surface text-[28px] shadow-soft ring-1 ring-line/80">{list.emoji}</span>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[32px] font-medium leading-[1.05]">{list.title}</h1>
          <p className="mt-1 text-[13px] font-medium text-muted">
            {items.length === 0 ? 'Liste vide' : todo.length === 0 ? 'Tout est coché ✨' : `${done.length} sur ${items.length} cochés`}
          </p>
        </div>
      </header>

      <Composer value={text} onChange={setText} onSubmit={add} placeholder="Ajouter à la liste…" label="Nouvel élément" inputRef={inputRef} />

      {items.length === 0 && <Empty emoji={list.emoji} title="Rien pour l'instant" text="Ajoutez les premiers éléments : ils apparaîtront aussi chez l'autre." />}

      {todo.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <ul>
            {todo.map((i) => (
              <ItemRow key={i.id} item={i} fresh={isNew(i.id)} onEdit={() => setEditing(i)} />
            ))}
          </ul>
        </Card>
      )}

      {done.length > 0 && (
        <>
          <SectionTitle
            aside={
              <button onClick={() => done.forEach((i) => update('list_items', i.id, { done: false, done_by: null }))} className="flex items-center gap-1 text-accent">
                <RotateCcw size={12} /> Tout décocher
              </button>
            }
          >
            Cochés
          </SectionTitle>
          <ul>
            {done.map((i) => (
              <ItemRow key={i.id} item={i} fresh={false} onEdit={() => setEditing(i)} />
            ))}
          </ul>
        </>
      )}

      <Sheet open={!!editing} title="Élément" onClose={() => setEditing(null)}>
        {editing && <ItemForm key={editing.id} item={editing} onClose={() => setEditing(null)} />}
      </Sheet>

      <Sheet open={menu} title="Liste" onClose={() => setMenu(false)}>
        {menu && <ListMenu list={list} hasDone={done.length > 0} onClose={() => setMenu(false)} onDeleted={onBack} />}
      </Sheet>
    </div>
  )
}

function ItemRow({ item, fresh, onEdit }: { item: ListItem; fresh: boolean; onEdit(): void }) {
  const { update, me } = useStore()
  const by = useMember()(item.done_by)

  return (
    <li className={cx('border-b border-line/70 last:border-0', fresh && 'animate-pop')}>
      <div className="flex min-h-14 items-center gap-3 px-4 py-2">
        <CheckCircle
          checked={item.done}
          label={item.done ? `Décocher ${item.text}` : `Cocher ${item.text}`}
          onClick={() => update('list_items', item.id, item.done ? { done: false, done_by: null } : { done: true, done_by: me })}
        />
        <button onClick={onEdit} className="min-w-0 flex-1 py-1 text-left">
          <span className={cx('block text-[16px] transition-colors duration-300', item.done && 'text-muted line-through decoration-faint')}>{item.text}</span>
        </button>
        {item.done && item.done_by && <Avatar initial={by.initial} tone={by.tone} size="xs" />}
      </div>
    </li>
  )
}

function ItemForm({ item, onClose }: { item: ListItem; onClose(): void }) {
  const { update, remove } = useStore()
  const [text, setText] = useState(item.text)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        update('list_items', item.id, { text: text.trim() || item.text })
        onClose()
      }}
      className="space-y-5"
    >
      <Field label="Texte" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-3">
        <Button
          type="button"
          variant="danger"
          aria-label="Supprimer"
          className="px-4"
          onClick={() => {
            remove('list_items', item.id)
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

function ListMenu({ list, hasDone, onClose, onDeleted }: { list: List; hasDone: boolean; onClose(): void; onDeleted(): void }) {
  const { data, update, remove } = useStore()
  const [title, setTitle] = useState(list.title)
  const [emoji, setEmoji] = useState(list.emoji)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        update('lists', list.id, { title: title.trim() || list.title, emoji })
        onClose()
      }}
      className="space-y-5"
    >
      <Field label="Nom" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
      <div className="grid grid-cols-6 gap-2">
        {EMOJIS.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => setEmoji(em)}
            className={cx('grid aspect-square place-items-center rounded-2xl text-[22px] transition active:scale-90', emoji === em ? 'bg-accent-soft ring-2 ring-accent/60' : 'bg-surface-2')}
          >
            {em}
          </button>
        ))}
      </div>
      <Button className="w-full">Enregistrer</Button>
      {hasDone && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            data.list_items.filter((i) => i.list_id === list.id && i.done).forEach((i) => remove('list_items', i.id))
            onClose()
          }}
        >
          Retirer les éléments cochés
        </Button>
      )}
      <Button
        type="button"
        variant="danger"
        className="w-full"
        onClick={() => {
          if (!confirm(`Supprimer la liste « ${list.title} » ?`)) return
          remove('lists', list.id)
          onClose()
          onDeleted()
        }}
      >
        <Trash2 size={18} /> Supprimer la liste
      </Button>
    </form>
  )
}

