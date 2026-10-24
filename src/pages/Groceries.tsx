import { useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, Check, RotateCcw, Trash2, Truck } from 'lucide-react'
import { useMember } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { guessCategory } from '../lib/categorize'
import { ago, capitalize, normalizeName, splitQuantity } from '../lib/format'
import { CATEGORIES, type Category, type GroceryItem } from '../lib/types'
import { Avatar, Button, Card, Chips, Empty, Field, PageHeader, SectionTitle, Sheet, cx } from '../components/ui'

type Filter = 'all' | 'drive' | 'store'
const EMOJI = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.emoji])) as Record<Category, string>

export default function GroceriesPage() {
  const { data, insert, update } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [drive, setDrive] = useState(false)
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const open = data.grocery_items.filter((i) => i.status !== 'bought')
  const bought = data.grocery_items
    .filter((i) => i.status === 'bought')
    .sort((a, b) => (b.bought_at ?? '').localeCompare(a.bought_at ?? ''))
    .slice(0, 16)
  const driveCount = open.filter((i) => i.drive).length
  const shown = open.filter((i) => filter === 'all' || (filter === 'drive' ? i.drive : !i.drive))

  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        items: shown.filter((i) => i.category === c.id).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      })).filter((g) => g.items.length > 0),
    [shown],
  )

  const parsed = splitQuantity(text)
  const preview = parsed.name ? guessCategory(parsed.name) : null
  const willDrive = drive || filter === 'drive'

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!parsed.name) return
    const name = capitalize(parsed.name)
    const key = normalizeName(name)
    const existing = data.grocery_items.find((i) => normalizeName(i.name) === key)
    if (existing && existing.status !== 'bought') {
      // Déjà sur la liste : on met juste à jour la quantité si on en a donné une.
      if (parsed.quantity) update('grocery_items', existing.id, { quantity: parsed.quantity })
    } else if (existing) {
      // Déjà acheté par le passé : on le remet sur la liste, avec son rayon.
      update('grocery_items', existing.id, { status: 'todo', bought_at: null, drive: willDrive, quantity: parsed.quantity })
    } else {
      insert('grocery_items', { name, quantity: parsed.quantity, category: guessCategory(name), drive: willDrive })
    }
    setText('')
    inputRef.current?.focus()
  }

  return (
    <>
      <PageHeader
        eyebrow={open.length ? `${open.length} article${open.length > 1 ? 's' : ''} à prendre` : 'Rien ne manque'}
        title="Courses"
      />

      {/* Ajout */}
      <form onSubmit={add} className="relative">
        <div className="flex items-center gap-2 rounded-[22px] bg-surface p-1.5 pl-4 shadow-soft ring-1 ring-line/70 focus-within:ring-2 focus-within:ring-accent/50">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un article…"
            aria-label="Nouvel article"
            enterKeyHint="done"
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => setDrive(!drive)}
            aria-pressed={willDrive}
            title="À prendre au drive"
            className={cx(
              'flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition',
              willDrive ? 'bg-drive-soft text-drive' : 'text-faint',
            )}
          >
            <Truck size={16} />
            Drive
          </button>
          <button
            aria-label="Ajouter"
            disabled={!parsed.name}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-bg transition active:scale-95 disabled:opacity-20"
          >
            <ArrowUp size={20} strokeWidth={2.4} />
          </button>
        </div>
        {preview && (
          <p className="animate-fade mt-2 px-4 text-[13px] text-muted">
            {EMOJI[preview]} {preview}
            {parsed.quantity && <> · quantité {parsed.quantity}</>}
            {willDrive && <> · au drive</>}
          </p>
        )}
      </form>

      {/* Filtre */}
      {open.length > 0 && (
        <div className="mt-5 grid grid-cols-3 rounded-2xl bg-surface-2 p-1 text-[14px] font-medium">
          {(
            [
              ['all', 'Tout', open.length],
              ['drive', 'Drive', driveCount],
              ['store', 'Magasin', open.length - driveCount],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cx('h-9 rounded-xl transition', filter === id ? 'bg-surface text-ink shadow-soft' : 'text-muted')}
            >
              {label} <span className="num text-faint">{n}</span>
            </button>
          ))}
        </div>
      )}

      {open.length === 0 && <Empty emoji="🧺" title="La liste est vide" text="Ajoutez ce qui manque : l'autre le verra tout de suite sur son téléphone." />}
      {open.length > 0 && groups.length === 0 && (
        <p className="py-10 text-center text-[15px] text-muted">{filter === 'drive' ? 'Rien à prendre au drive.' : 'Tout est au drive.'}</p>
      )}

      {groups.map((g) => (
        <section key={g.id}>
          <SectionTitle aside={g.items.length}>
            <span className="mr-1.5 normal-case">{g.emoji}</span>
            {g.id}
          </SectionTitle>
          <Card className="px-1.5 py-1">
            <ul className="divide-y divide-line/70">
              {g.items.map((i) => (
                <GroceryRow key={i.id} item={i} onEdit={() => setEditing(i)} />
              ))}
            </ul>
          </Card>
        </section>
      ))}

      {bought.length > 0 && (
        <section>
          <SectionTitle>Récemment achetés</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {bought.map((i) => (
              <button
                key={i.id}
                onClick={() => update('grocery_items', i.id, { status: 'todo', bought_at: null })}
                className="flex items-center gap-1.5 rounded-full bg-surface-2 py-2 pl-3 pr-3.5 text-[14px] text-muted transition active:scale-95"
                title={`Remettre ${i.name} sur la liste`}
              >
                <RotateCcw size={13} />
                {i.name}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-[12px] text-faint">Un appui remet l'article sur la liste.</p>
        </section>
      )}

      <Sheet open={!!editing} title="Article" onClose={() => setEditing(null)}>
        {editing && <ItemForm key={editing.id} item={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}

function GroceryRow({ item, onEdit }: { item: GroceryItem; onEdit(): void }) {
  const { update } = useStore()
  const member = useMember()(item.added_by)
  const [leaving, setLeaving] = useState(false)
  const ordered = item.status === 'ordered'

  // Drive : à commander → commandé → acheté. Magasin : à acheter → acheté.
  const advance = () => {
    if (item.drive && item.status === 'todo') return update('grocery_items', item.id, { status: 'ordered' })
    setLeaving(true)
    setTimeout(() => update('grocery_items', item.id, { status: 'bought', bought_at: new Date().toISOString() }), 320)
  }

  return (
    <li className={cx('flex items-center gap-3 px-2.5 py-2.5', leaving && 'animate-leave')}>
      <button
        onClick={advance}
        aria-label={item.drive && !ordered ? `Marquer ${item.name} comme commandé` : `Marquer ${item.name} comme acheté`}
        className={cx(
          'grid size-[26px] shrink-0 place-items-center rounded-full border-[1.5px] transition',
          leaving ? 'animate-check border-done bg-done text-surface' : ordered ? 'border-drive bg-drive-soft text-drive' : 'border-faint text-transparent',
        )}
      >
        {leaving ? <Check size={15} strokeWidth={3} /> : ordered ? <Truck size={13} strokeWidth={2.4} /> : null}
      </button>
      <button onClick={onEdit} className="min-w-0 flex-1 py-0.5 text-left">
        <span className={cx('block truncate text-[16px]', leaving && 'text-muted line-through')}>
          {item.name}
          {item.quantity && <span className="num ml-1.5 text-[14px] text-muted">× {item.quantity}</span>}
        </span>
        {item.drive && (
          <span className={cx('mt-0.5 flex items-center gap-1 text-[12px] font-medium', 'text-drive')}>
            <Truck size={12} />
            {ordered ? 'Commandé au drive' : 'Drive'}
          </span>
        )}
      </button>
      <Avatar initial={member.initial} tone={member.tone} size="xs" />
    </li>
  )
}

function ItemForm({ item, onClose }: { item: GroceryItem; onClose(): void }) {
  const { update, remove } = useStore()
  const member = useMember()(item.added_by)
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [category, setCategory] = useState<Category>(item.category)
  const [drive, setDrive] = useState(item.drive)
  const [ordered, setOrdered] = useState(item.status === 'ordered')

  const save = (e: FormEvent) => {
    e.preventDefault()
    update('grocery_items', item.id, {
      name: name.trim() || item.name,
      quantity: quantity.trim() || null,
      category,
      drive,
      status: drive && ordered ? 'ordered' : 'todo',
    })
    onClose()
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Quantité" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="—" />
      </div>
      <Chips<Category>
        label="Rayon"
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji} ${c.id}` }))}
      />
      <Chips
        label="Où ?"
        value={drive ? 'drive' : 'store'}
        onChange={(v) => setDrive(v === 'drive')}
        options={[
          { value: 'store', label: '🛒 En magasin' },
          { value: 'drive', label: '🚗 Au drive' },
        ]}
      />
      {drive && (
        <Chips
          label="Commande"
          value={ordered ? 'yes' : 'no'}
          onChange={(v) => setOrdered(v === 'yes')}
          options={[
            { value: 'no', label: 'À commander' },
            { value: 'yes', label: 'Déjà commandé' },
          ]}
        />
      )}
      <p className="flex items-center gap-2 px-1 text-[13px] text-muted">
        <Avatar initial={member.initial} tone={member.tone} size="xs" />
        Ajouté par {member.isMe ? 'vous' : member.name} · {ago(item.created_at)}
      </p>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="danger"
          aria-label="Supprimer"
          className="px-4"
          onClick={() => {
            remove('grocery_items', item.id)
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
