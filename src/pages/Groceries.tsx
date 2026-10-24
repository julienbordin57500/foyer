import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, RotateCcw, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { useMember } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { guessCategory } from '../lib/categorize'
import { ago, capitalize, normalizeName, splitQuantity } from '../lib/format'
import { CATEGORIES, type Category, type GroceryItem, type Place } from '../lib/types'
import {
  Avatar,
  Button,
  Card,
  CheckCircle,
  Chips,
  Collapsible,
  Composer,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  Segmented,
  Sheet,
  SwipeRow,
  cx,
  useArrivals,
} from '../components/ui'

type Filter = 'all' | 'drive' | 'store'
const EMOJI = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.emoji])) as Record<Category, string>

export const PLACES: { value: Place; label: string; short: string }[] = [
  { value: 'store', label: 'En magasin', short: 'Magasin' },
  { value: 'drive', label: 'Au drive', short: 'Drive' },
  { value: 'both', label: 'Drive ou magasin', short: 'Les deux' },
]
const nextPlace: Record<Place, Place> = { store: 'drive', drive: 'both', both: 'store' }
const inDrive = (p: Place) => p !== 'store'
const inStore = (p: Place) => p !== 'drive'

function PlaceIcon({ place, size = 14 }: { place: Place; size?: number }) {
  if (place === 'store') return <ShoppingCart size={size} />
  if (place === 'drive') return <Truck size={size} />
  return (
    <span className="inline-flex items-center -space-x-0.5">
      <Truck size={size} />
      <ShoppingCart size={size} />
    </span>
  )
}

export default function GroceriesPage() {
  const { data, insert, update } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [place, setPlace] = useState<Place>('store')
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const open = data.grocery_items.filter((i) => i.status !== 'bought')
  const bought = data.grocery_items
    .filter((i) => i.status === 'bought')
    .sort((a, b) => (b.bought_at ?? '').localeCompare(a.bought_at ?? ''))
    .slice(0, 16)
  const driveCount = open.filter((i) => inDrive(i.place)).length
  const storeCount = open.filter((i) => inStore(i.place)).length
  const shown = open.filter((i) => filter === 'all' || (filter === 'drive' ? inDrive(i.place) : inStore(i.place)))
  const isNew = useArrivals(data.grocery_items.map((i) => i.id))

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

  const add = () => {
    if (!parsed.name) return
    const name = capitalize(parsed.name)
    const key = normalizeName(name)
    const existing = data.grocery_items.find((i) => normalizeName(i.name) === key)
    if (existing && existing.status !== 'bought') {
      // Déjà sur la liste : on met juste à jour la quantité si on en a donné une.
      if (parsed.quantity) update('grocery_items', existing.id, { quantity: parsed.quantity })
    } else if (existing) {
      // Déjà acheté par le passé : on le remet sur la liste, avec son rayon.
      update('grocery_items', existing.id, { status: 'todo', bought_at: null, place, quantity: parsed.quantity })
    } else {
      insert('grocery_items', { name, quantity: parsed.quantity, category: guessCategory(name), place })
    }
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="animate-page">
      <PageHeader
        eyebrow={open.length ? `${open.length} article${open.length > 1 ? 's' : ''} à prendre` : 'Rien ne manque'}
        title="Courses"
      />

      <Composer
        value={text}
        onChange={setText}
        onSubmit={add}
        placeholder="Ajouter un article…"
        label="Nouvel article"
        inputRef={inputRef}
        middle={
          <button
            type="button"
            onClick={() => setPlace(nextPlace[place])}
            title="Où l'acheter ? (appuyer pour changer)"
            className={cx(
              'flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors duration-300',
              place === 'store' ? 'bg-surface-2 text-muted' : 'bg-drive-soft text-drive',
            )}
          >
            <PlaceIcon place={place} />
            {PLACES.find((p) => p.value === place)!.short}
          </button>
        }
      />
      <p className={cx('h-5 px-4 pt-2 text-[13px] text-muted transition-opacity duration-300', preview ? 'opacity-100' : 'opacity-0')}>
        {preview && (
          <>
            {EMOJI[preview]} {preview}
            {parsed.quantity && <> · quantité {parsed.quantity}</>}
          </>
        )}
      </p>

      {open.length > 0 && (
        <div className="mt-4">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              {
                value: 'all',
                label: (
                  <>
                    Tout <span className="num text-faint">{open.length}</span>
                  </>
                ),
              },
              {
                value: 'drive',
                label: (
                  <>
                    Drive <span className="num text-faint">{driveCount}</span>
                  </>
                ),
              },
              {
                value: 'store',
                label: (
                  <>
                    Magasin <span className="num text-faint">{storeCount}</span>
                  </>
                ),
              },
            ]}
          />
        </div>
      )}

      {open.length === 0 && (
        <Empty emoji="🧺" title="La liste est vide" text="Ajoutez ce qui manque : l'autre le verra tout de suite sur son téléphone." />
      )}
      {open.length > 0 && groups.length === 0 && (
        <p className="animate-fade py-12 text-center text-[15px] text-muted">
          {filter === 'drive' ? 'Rien à prendre au drive.' : 'Rien à prendre en magasin.'}
        </p>
      )}

      <div key={filter} className="animate-fade">
        {groups.map((g) => (
          <section key={g.id}>
            <SectionTitle aside={g.items.length}>
              <span className="text-[14px] normal-case">{g.emoji}</span>
              {g.id}
            </SectionTitle>
            <Card className="overflow-hidden">
              <ul>
                {g.items.map((i) => (
                  <GroceryRow key={i.id} item={i} fresh={isNew(i.id)} onEdit={() => setEditing(i)} />
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>

      {bought.length > 0 && (
        <section>
          <SectionTitle>Récemment achetés</SectionTitle>
          <div className="flex flex-wrap gap-2 px-1">
            {bought.map((i) => (
              <button
                key={i.id}
                onClick={() => update('grocery_items', i.id, { status: 'todo', bought_at: null })}
                className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 pl-3 pr-3.5 text-[14px] text-muted transition duration-200 ease-smooth active:scale-95"
                title={`Remettre ${i.name} sur la liste`}
              >
                <RotateCcw size={13} />
                {i.name}
              </button>
            ))}
          </div>
          <p className="mt-2 px-4 text-[12px] text-faint">Un appui remet l'article sur la liste.</p>
        </section>
      )}

      <Sheet open={!!editing} title="Article" onClose={() => setEditing(null)}>
        {editing && <ItemForm key={editing.id} item={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function GroceryRow({ item, fresh, onEdit }: { item: GroceryItem; fresh: boolean; onEdit(): void }) {
  const { update, removeWithUndo } = useStore()
  const member = useMember()(item.added_by)
  const [leaving, setLeaving] = useState(false)
  const ordered = item.status === 'ordered'

  const buy = (delay = 560) => {
    setLeaving(true)
    setTimeout(() => update('grocery_items', item.id, { status: 'bought', bought_at: new Date().toISOString() }), delay)
  }
  // Drive seul : à commander → commandé → acheté. Sinon : à acheter → acheté.
  const advance = () => {
    if (item.place === 'drive' && item.status === 'todo') return update('grocery_items', item.id, { status: 'ordered' })
    buy()
  }

  return (
    <Collapsible leaving={leaving} className={cx('border-b border-line/70 last:border-0', fresh && 'animate-pop')}>
      <SwipeRow
        right={{ label: 'Acheté', icon: <Check size={18} strokeWidth={2.6} />, tone: 'done', run: () => buy(200) }}
        left={{
          label: 'Supprimer',
          icon: <Trash2 size={18} />,
          tone: 'late',
          run: () => removeWithUndo('grocery_items', item.id, item.name),
        }}
      >
        <div className="flex min-h-14 items-center gap-3 px-4 py-2">
          <CheckCircle
            checked={leaving}
            tone={ordered ? 'drive' : 'default'}
            onClick={advance}
            label={item.place === 'drive' && !ordered ? `Marquer ${item.name} comme commandé` : `Marquer ${item.name} comme acheté`}
          >
            {ordered && <Truck size={13} strokeWidth={2.4} />}
          </CheckCircle>
          <button onClick={onEdit} className="min-w-0 flex-1 py-1 text-left">
            <span
              className={cx('block truncate text-[16px] leading-snug transition-colors duration-300', leaving && 'text-muted line-through')}
            >
              {item.name}
              {item.quantity && <span className="num ml-1.5 text-[14px] text-muted">× {item.quantity}</span>}
            </span>
            {item.place !== 'store' && (
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-drive">
                <PlaceIcon place={item.place} size={12} />
                {ordered ? 'Commandé au drive' : item.place === 'both' ? 'Drive ou magasin' : 'Drive'}
              </span>
            )}
          </button>
          <Avatar initial={member.initial} tone={member.tone} size="xs" />
        </div>
      </SwipeRow>
    </Collapsible>
  )
}

function ItemForm({ item, onClose }: { item: GroceryItem; onClose(): void }) {
  const { update, remove } = useStore()
  const member = useMember()(item.added_by)
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [category, setCategory] = useState<Category>(item.category)
  const [place, setPlace] = useState<Place>(item.place)
  const [ordered, setOrdered] = useState(item.status === 'ordered')

  const save = (e: FormEvent) => {
    e.preventDefault()
    update('grocery_items', item.id, {
      name: name.trim() || item.name,
      quantity: quantity.trim() || null,
      category,
      place,
      status: place === 'drive' && ordered ? 'ordered' : 'todo',
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
      <Chips<Place>
        label="Où ?"
        value={place}
        onChange={setPlace}
        options={PLACES.map((p) => ({
          value: p.value,
          label: (
            <>
              <PlaceIcon place={p.value} /> {p.label}
            </>
          ),
        }))}
      />
      {place === 'drive' && (
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
