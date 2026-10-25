import { useRef, useState, type FormEvent } from 'react'
import { Check, ChevronLeft, MoreHorizontal, Plus, RotateCcw, Trash2, Undo2, X } from 'lucide-react'
import { useMember } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { capitalize } from '../lib/format'
import type { List, ListItem } from '../lib/types'
import { TEMPLATES, TEMPLATE_GROUPS } from '../lib/templates'
import { ReminderBadge, ReminderPicker, type ReminderValue } from '../components/Reminder'
import { SearchButton, consumePendingList } from '../components/Search'
import { TasksSwitch } from '../components/Nav'
import {
  Avatar,
  Button,
  Card,
  CheckCircle,
  Composer,
  Empty,
  SheetActions,
  TitleInput,
  Hero,
  HeroButton,
  SectionTitle,
  Sheet,
  SwipeRow,
  cx,
  useArrivals,
} from '../components/ui'

const EMOJIS = ['📋', '👶', '🎒', '🩺', '🧳', '🏖️', '🧺', '👨‍🍳', '🏠', '🧹', '🥂', '🛋️', '🔨', '🎁', '🎄', '🌱', '🎉', '🚗']

export default function ListsPage() {
  const { data } = useStore()
  const [openId, setOpenId] = useState<string | null>(consumePendingList)
  const [creating, setCreating] = useState(false)
  const current = data.lists.find((l) => l.id === openId)

  if (current) return <ListDetail key={current.id} list={current} onBack={() => setOpenId(null)} />

  return (
    <div className="animate-page">
      <Hero
        eyebrow={data.lists.length ? `${data.lists.length} liste${data.lists.length > 1 ? 's' : ''}` : 'À cocher à deux'}
        title="Listes"
        action={
          <div className="flex gap-2">
            <SearchButton />
            <HeroButton label="Nouvelle liste" onClick={() => setCreating(true)}>
              <Plus size={22} />
            </HeroButton>
          </div>
        }
      />
      <TasksSwitch current="listes" />

      {data.lists.length === 0 ? (
        <>
          <Empty
            emoji="📋"
            title="Aucune liste"
            text="Une valise à préparer, un passage chez Ikea, du bricolage… Créez une liste et cochez-la à deux."
          />
          <div className="flex justify-center">
            <Button onClick={() => setCreating(true)}>
              <Plus size={18} /> Créer une liste
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data.lists.map((l, i) => (
            <ListCard
              key={l.id}
              list={l}
              items={data.list_items.filter((x) => x.list_id === l.id)}
              index={i}
              onOpen={() => setOpenId(l.id)}
            />
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
  const { removeWithUndo } = useStore()
  const done = items.filter((i) => i.done).length
  const pct = items.length ? (done / items.length) * 100 : 0
  const complete = items.length > 0 && done === items.length
  const by = useMember()(list.added_by)

  return (
    <div className="animate-pop relative" style={{ animationDelay: `${index * 40}ms` }}>
      <button
        onClick={onOpen}
        className="card-glow flex min-h-[156px] w-full flex-col rounded-[24px] bg-surface bg-gradient-to-b from-white/[0.035] to-transparent p-4 text-left transition duration-300 ease-smooth active:scale-[0.97]"
      >
        <span className="grid size-11 place-items-center rounded-2xl bg-sec/15 text-[22px]">{list.emoji}</span>
        <span className="mt-auto block pt-4 font-serif text-[20px] font-medium leading-tight">{list.title}</span>
        <span className="mt-2 flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              className={cx('block h-full rounded-full transition-[width] duration-700 ease-smooth', complete ? 'bg-done' : 'bg-sec')}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="num text-[12px] font-medium text-muted">
            {done}/{items.length}
          </span>
        </span>
      </button>
      {/* En haut à droite : qui l'a créée, et la croix pour la supprimer sans l'ouvrir. */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <Avatar initial={by.initial} tone={by.tone} size="xs" />
        <button
          onClick={() => removeWithUndo('lists', list.id, list.title)}
          aria-label={`Supprimer la liste ${list.title}`}
          className="grid size-7 place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-line/60 transition active:scale-90 active:bg-late/20 active:text-late"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
    </div>
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
    setTitle(t ? t.title : '')
    setEmoji(t ? t.emoji : '📋')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = TEMPLATES.find((x) => x.id === template)
    if (!title.trim()) return
    onDone(createList({ title: capitalize(title.trim()), emoji }, t?.items ?? []))
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <span className="mb-2 block px-1 text-[13px] font-medium text-muted">Partir d'une liste toute prête</span>
        <div className="-mx-1 max-h-[38dvh] space-y-4 overflow-y-auto px-1 pb-1">
          {TEMPLATE_GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{g}</p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.filter((t) => t.group === g).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick(template === t.id ? 'none' : t.id)}
                    aria-pressed={template === t.id}
                    className={cx(
                      'flex min-h-[92px] flex-col items-start rounded-2xl p-2.5 text-left transition duration-200 ease-smooth active:scale-95',
                      template === t.id ? 'bg-sec/18 ring-2 ring-sec/70' : 'bg-surface-2',
                    )}
                  >
                    <span className="text-[22px] leading-none">{t.emoji}</span>
                    <span className="mt-auto pt-2 text-[13px] font-semibold leading-tight">{t.title}</span>
                    <span className="text-[11px] text-muted">{t.items.length} éléments</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <TitleInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nom de la liste"
        maxLength={60}
        aria-label="Nom de la liste"
      />
      <div>
        <span className="mb-2 block px-1 text-[13px] font-medium text-muted">Icône</span>
        <div className="grid grid-cols-9 gap-1.5">
          {EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              aria-pressed={emoji === em}
              className={cx(
                'grid aspect-square place-items-center rounded-xl text-[18px] transition duration-200 ease-smooth active:scale-90',
                emoji === em ? 'bg-sec/18 ring-2 ring-sec/60' : 'bg-surface-2',
              )}
            >
              {em}
            </button>
          ))}
        </div>
      </div>
      {template !== 'none' && (
        <p className="px-1 text-[13px] text-muted">
          {TEMPLATES.find((t) => t.id === template)!.items.length} éléments déjà prêts : vous pourrez en ajouter ou en retirer.
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
  // Les éléments avec un rappel passent en tête, du plus proche au plus lointain.
  const todo = items
    .filter((i) => !i.done)
    .sort((a, b) => (a.remind_at && !a.reminded_at ? a.remind_at : '~').localeCompare(b.remind_at && !b.reminded_at ? b.remind_at : '~'))
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
      <Hero
        eyebrow={
          <button onClick={onBack} className="-ml-1.5 inline-flex items-center gap-0.5 rounded-full pr-2 font-semibold active:opacity-60">
            <ChevronLeft size={18} />
            Listes
          </button>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="text-[30px]">{list.emoji}</span>
            <span className="truncate">{list.title}</span>
          </span>
        }
        action={
          <HeroButton label="Options de la liste" onClick={() => setMenu(true)}>
            <MoreHorizontal size={22} />
          </HeroButton>
        }
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <span
              className="block h-full rounded-full bg-white transition-[width] duration-700 ease-smooth"
              style={{ width: `${items.length ? (done.length / items.length) * 100 : 0}%` }}
            />
          </span>
          <span className="num text-[13px] font-semibold opacity-90">
            {items.length === 0 ? 'Vide' : todo.length === 0 ? 'Tout est coché ✨' : `${done.length}/${items.length}`}
          </span>
        </div>
        <Composer
          value={text}
          onChange={setText}
          onSubmit={add}
          placeholder="Ajouter à la liste…"
          label="Nouvel élément"
          inputRef={inputRef}
          onHero
        />
      </Hero>

      {items.length === 0 && (
        <Empty emoji={list.emoji} title="Rien pour l'instant" text="Ajoutez les premiers éléments : ils apparaîtront aussi chez l'autre." />
      )}

      {todo.length > 0 && (
        <Card className="overflow-hidden">
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
              <button
                onClick={() => done.forEach((i) => update('list_items', i.id, { done: false, done_by: null }))}
                className="flex items-center gap-1 text-sec"
              >
                <RotateCcw size={12} /> Tout décocher
              </button>
            }
          >
            Cochés
          </SectionTitle>
          <ul>
            {done.map((i) => (
              <ItemRow key={i.id} item={i} fresh={false} bare onEdit={() => setEditing(i)} />
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

function ItemRow({ item, fresh, bare, onEdit }: { item: ListItem; fresh: boolean; bare?: boolean; onEdit(): void }) {
  const { update, removeWithUndo, me } = useStore()
  const by = useMember()(item.done_by)
  const toggle = () => update('list_items', item.id, item.done ? { done: false, done_by: null } : { done: true, done_by: me })
  const reminder = !item.done && item.remind_at && !item.reminded_at ? item.remind_at : null

  return (
    <li className={cx('border-b border-line/70 last:border-0', fresh && 'animate-pop')}>
      <SwipeRow
        bare={bare}
        right={{
          label: item.done ? 'Décocher' : 'Cocher',
          icon: item.done ? <Undo2 size={18} /> : <Check size={18} strokeWidth={2.6} />,
          tone: 'done',
          run: toggle,
        }}
        left={{ label: 'Supprimer', icon: <Trash2 size={18} />, tone: 'late', run: () => removeWithUndo('list_items', item.id, item.text) }}
      >
        <div className="flex min-h-14 items-center gap-3 px-4 py-2">
          <CheckCircle checked={item.done} label={item.done ? `Décocher ${item.text}` : `Cocher ${item.text}`} onClick={toggle} />
          <button onClick={onEdit} className="min-w-0 flex-1 py-1 text-left">
            <span
              className={cx('block text-[16px] transition-colors duration-300', item.done && 'text-muted line-through decoration-faint')}
            >
              {item.text}
            </span>
            {reminder && (
              <span className="mt-1 flex">
                <ReminderBadge iso={reminder} />
              </span>
            )}
          </button>
          {item.done && item.done_by && <Avatar initial={by.initial} tone={by.tone} size="xs" />}
        </div>
      </SwipeRow>
    </li>
  )
}

function ItemForm({ item, onClose }: { item: ListItem; onClose(): void }) {
  const { update, remove } = useStore()
  const [text, setText] = useState(item.text)
  const [reminder, setReminder] = useState<ReminderValue>({ remind_at: item.remind_at, remind_to: item.remind_to })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        update('list_items', item.id, {
          text: text.trim() || item.text,
          remind_at: reminder.remind_at,
          remind_to: reminder.remind_to,
          ...(reminder.remind_at !== item.remind_at ? { reminded_at: null } : {}),
        })
        onClose()
      }}
      className="flex flex-col gap-2"
    >
      <TitleInput value={text} onChange={(e) => setText(e.target.value)} aria-label="Texte" />
      <ReminderPicker value={reminder} onChange={setReminder} title={text.trim() || item.text} />
      <SheetActions
        deleteLabel="Retirer de la liste"
        onDelete={() => {
          remove('list_items', item.id)
          onClose()
        }}
      />
    </form>
  )
}

function ListMenu({ list, hasDone, onClose, onDeleted }: { list: List; hasDone: boolean; onClose(): void; onDeleted(): void }) {
  const { data, update, remove, removeWithUndo } = useStore()
  const [title, setTitle] = useState(list.title)
  const [emoji, setEmoji] = useState(list.emoji)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        update('lists', list.id, { title: title.trim() || list.title, emoji })
        onClose()
      }}
      className="flex flex-col gap-2"
    >
      <TitleInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} aria-label="Nom de la liste" />
      <div className="grid grid-cols-6 gap-2 py-2">
        {EMOJIS.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => setEmoji(em)}
            className={cx(
              'grid aspect-square place-items-center rounded-2xl text-[22px] transition active:scale-90',
              emoji === em ? 'bg-sec/18 ring-2 ring-sec/60' : 'bg-surface-2',
            )}
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
      <button
        type="button"
        className="h-11 text-[14px] font-semibold text-late active:opacity-60"
        onClick={() => {
          removeWithUndo('lists', list.id, list.title)
          onClose()
          onDeleted()
        }}
      >
        Supprimer la liste
      </button>
    </form>
  )
}
