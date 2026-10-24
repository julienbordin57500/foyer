import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, Hash, LayoutGrid, RotateCcw, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { useMember, usePartner } from '../auth/AuthGate'
import { SearchButton } from '../components/Search'
import { useStore } from '../data/store'
import { guessCategory } from '../lib/categorize'
import { ago, capitalize, normalizeName, splitQuantity } from '../lib/format'
import { CATEGORIES, type Category, type GroceryItem, type Place } from '../lib/types'
import {
  Avatar,
  Button,
  Card,
  CheckCircle,
  OptionRow,
  SheetActions,
  SuccessCheck,
  TitleInput,
  Collapsible,
  Composer,
  Empty,
  Hero,
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
  const { data, insert, update, showToast } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [place, setPlace] = useState<Place>('store')
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [leaving, setLeaving] = useState(false)
  const [flying, setFlying] = useState<FlyItem[] | null>(null)

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
      <Hero
        eyebrow={open.length ? `${open.length} article${open.length > 1 ? 's' : ''} à prendre` : 'Rien ne manque'}
        title="Courses"
        action={
          <div className="flex gap-2">
            <SearchButton />
            <button
              onClick={() => setLeaving(true)}
              className="flex h-11 items-center gap-1.5 rounded-full bg-white/18 pl-3 pr-4 text-[14px] font-semibold ring-1 ring-white/25 backdrop-blur-md transition duration-300 ease-smooth active:scale-95"
            >
              <ShoppingCart size={17} /> Je pars
            </button>
          </div>
        }
      >
        <Composer
          value={text}
          onChange={setText}
          onSubmit={add}
          placeholder="Ajouter un article…"
          label="Nouvel article"
          inputRef={inputRef}
          onHero
          middle={
            <button
              type="button"
              onClick={() => setPlace(nextPlace[place])}
              title="Où l'acheter ? (appuyer pour changer)"
              className={cx(
                'flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors duration-300',
                place === 'store' ? 'bg-white/14' : 'bg-white text-[#0b6f73]',
              )}
            >
              <PlaceIcon place={place} />
              {PLACES.find((p) => p.value === place)!.short}
            </button>
          }
        />
        <p className={cx('h-4 px-4 pt-2 text-[13px] transition-opacity duration-300', preview ? 'opacity-85' : 'opacity-0')}>
          {preview && (
            <>
              {EMOJI[preview]} {preview}
              {parsed.quantity && <> · quantité {parsed.quantity}</>}
            </>
          )}
        </p>
      </Hero>

      <PartnerShopping />

      {open.length > 0 && (
        <div>
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
        <Empty emoji="🛒" title="La liste est vide" text="Ajoutez ce qui manque : l'autre le verra tout de suite sur son téléphone." />
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

      {shown.length >= 2 && (
        <button
          onClick={() => {
            // Fin des courses : tout ce qui est affiché passe en « acheté », avec « Annuler » au cas où.
            const before = shown.map((i) => ({ id: i.id, status: i.status }))
            const now = new Date().toISOString()
            before.forEach((b) => update('grocery_items', b.id, { status: 'bought', bought_at: now }))
            // Photo de la position de chaque ligne avant qu'elles ne disparaissent : ce sont elles qui volent vers le caddie.
            const rows = shown.flatMap((i) => {
              const el = document.querySelector<HTMLElement>(`[data-grocery-row="${i.id}"]`)
              const r = el?.getBoundingClientRect()
              return r && r.bottom > 0 && r.top < innerHeight ? [{ id: i.id, name: i.name, rect: r }] : []
            })
            setFlying(rows.slice(0, 24))
            showToast(`${before.length} articles achetés`, () =>
              before.forEach((b) => update('grocery_items', b.id, { status: b.status, bought_at: null })),
            )
          }}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-sec ring-1 ring-sec/30 transition active:scale-[0.98] active:bg-sec/10"
        >
          <Check size={18} strokeWidth={2.6} /> J'ai tout pris
        </button>
      )}

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

      {flying && <CartFly items={flying} onDone={() => setFlying(null)} />}

      <Sheet open={leaving} title="Je pars faire les courses" onClose={() => setLeaving(false)}>
        {leaving && <LeavingForm onDone={() => setLeaving(false)} />}
      </Sheet>

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
        <div data-grocery-row={item.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
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
    <form onSubmit={save} className="flex flex-col gap-2">
      <TitleInput value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom" />
      <label className="flex h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-2 focus-within:ring-sec/50">
        <Hash size={18} className="text-sec" />
        <span className="flex-1 text-[15px] text-muted">Quantité</span>
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="—"
          className="w-28 bg-transparent text-right text-[15px] font-semibold outline-none placeholder:text-faint"
        />
      </label>
      <OptionRow<Category>
        label="Rayon"
        icon={<LayoutGrid size={18} />}
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji}  ${c.id}` }))}
      />
      <OptionRow<Place>
        label="Où ?"
        icon={<PlaceIcon place={place} size={18} />}
        value={place}
        onChange={setPlace}
        options={PLACES.map((p) => ({ value: p.value, label: p.label }))}
      />
      {place === 'drive' && (
        <OptionRow
          label="Commande"
          icon={<Truck size={18} />}
          value={ordered ? 'yes' : 'no'}
          onChange={(v) => setOrdered(v === 'yes')}
          options={[
            { value: 'no', label: 'À commander' },
            { value: 'yes', label: 'Déjà commandé' },
          ]}
        />
      )}
      <p className="mt-2 flex items-center justify-center gap-2 text-[13px] text-muted">
        <Avatar initial={member.initial} tone={member.tone} size="xs" />
        Ajouté par {member.isMe ? 'vous' : member.name} · {ago(item.created_at)}
      </p>
      <SheetActions
        deleteLabel="Retirer de la liste"
        onDelete={() => {
          remove('grocery_items', item.id)
          onClose()
        }}
      />
    </form>
  )
}

/** Bandeau quand l'autre vient de partir faire les courses : c'est le moment d'ajouter ce qui manque. */
function PartnerShopping() {
  const { data, me } = useStore()
  const member = useMember()
  const ping = data.pings.find((p) => p.author !== me && Date.now() - new Date(p.created_at).getTime() < 2 * 3_600_000)
  if (!ping) return null
  const who = member(ping.author)
  return (
    <div className="animate-pop mb-4 flex items-center gap-3 rounded-[22px] bg-sec/14 px-4 py-3 ring-1 ring-sec/30">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sec/20 text-[20px]">🛒</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">
          {who.name} est parti{who.pronoun === 'elle' ? 'e' : ''} faire les courses
        </span>
        <span className="block text-[13px] text-muted">{ago(ping.created_at)} · ajoutez vite ce qui manque</span>
      </span>
    </div>
  )
}

function LeavingForm({ onDone }: { onDone(): void }) {
  const { data, insert, me } = useStore()
  const partner = usePartner()
  const member = useMember()
  const [sent, setSent] = useState(false)
  const mine = data.pings.find((p) => p.author === me)
  const recent = !sent && mine && Date.now() - new Date(mine.created_at).getTime() < 15 * 60_000
  const name = partner?.display_name ?? 'votre moitié'
  const pronoun = partner ? member(partner.user_id).pronoun : 'il'
  const e = pronoun === 'elle' ? 'e' : ''

  const send = () => {
    insert('pings', { kind: 'shopping', place: 'store' })
    setSent(true)
    setTimeout(onDone, 1700)
  }

  if (sent)
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <SuccessCheck />
        <p className="animate-pop mt-5 font-serif text-[24px] font-medium" style={{ animationDelay: '0.35s' }}>
          {name} est prévenu{e}
        </p>
        <p className="animate-pop mt-1.5 text-[15px] text-muted" style={{ animationDelay: '0.45s' }}>
          Bonnes courses !
        </p>
      </div>
    )

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 grid size-20 place-items-center rounded-full bg-sec/15 text-[38px]">🛒</div>
      <p className="mb-6 max-w-xs text-[15px] leading-relaxed text-muted">
        {name} reçoit une notification pour ajouter vite ce qui manque à la liste.
      </p>
      {recent && (
        <p className="mb-3 text-[14px] text-muted">
          Déjà prévenu{e} {ago(mine!.created_at)}.
        </p>
      )}
      <Button className="w-full" disabled={!!recent} onClick={send}>
        Prévenir {name}
      </Button>
    </div>
  )
}

type FlyItem = { id: string; name: string; rect: DOMRect }

/**
 * Fin des courses : un caddie apparaît en bas de l'écran, chaque ligne de la liste y plonge
 * l'une après l'autre (il rebondit à chaque arrivée), puis il s'en va vers la droite.
 */
function CartFly({ items, onDone }: { items: FlyItem[]; onDone(): void }) {
  const cart = useRef<HTMLDivElement>(null)
  const ghosts = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const c = cart.current!
    const box = c.getBoundingClientRect()
    const cx = box.left + box.width / 2
    const cy = box.top + box.height * 0.45
    const smooth = 'cubic-bezier(0.22, 1, 0.36, 1)'
    const timers: ReturnType<typeof setTimeout>[] = []

    c.animate(
      [
        { transform: 'translateY(160%) scale(0.5)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 420, easing: smooth, fill: 'both' },
    )

    let end = 500
    items.forEach((it, i) => {
      const g = ghosts.current[i]
      if (!g) return
      const dx = cx - (it.rect.left + it.rect.width / 2)
      const dy = cy - (it.rect.top + it.rect.height / 2)
      const delay = 300 + i * 60
      // Trajectoire en cloche : la ligne monte un peu avant de plonger dans le caddie.
      g.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(0.6)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0.2 },
        ],
        { duration: 620, delay, easing: 'cubic-bezier(0.5, 0, 0.4, 1)', fill: 'both' },
      )
      end = delay + 620
      timers.push(
        setTimeout(
          () =>
            c.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14) translateY(3px)' }, { transform: 'scale(1)' }], {
              duration: 220,
              easing: 'ease-out',
            }),
          end - 40,
        ),
      )
    })

    timers.push(
      setTimeout(
        () =>
          c.animate(
            [
              { transform: 'none' },
              { transform: 'translateX(-14px) rotate(4deg)', offset: 0.18 },
              { transform: 'translateX(75vw) rotate(-5deg)', opacity: 1 },
            ],
            { duration: 750, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' },
          ),
        end + 180,
      ),
      setTimeout(onDone, end + 950),
    )
    return () => timers.forEach(clearTimeout)
  }, [items, onDone])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
      {items.map((it, i) => (
        <div
          key={it.id}
          ref={(el) => {
            ghosts.current[i] = el
          }}
          className="fixed flex items-center truncate rounded-2xl bg-surface px-4 text-[16px] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] ring-1 ring-sec/40"
          style={{ left: it.rect.left, top: it.rect.top, width: it.rect.width, height: it.rect.height, willChange: 'transform' }}
        >
          {it.name}
        </div>
      ))}
      <div className="fixed left-1/2 -ml-11 w-22" style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 12px) + 96px)' }}>
        <div
          ref={cart}
          className="grid size-22 place-items-center rounded-full bg-sec/20 ring-1 ring-sec/40 backdrop-blur-md"
          style={{ willChange: 'transform' }}
        >
          <span className="text-[46px] leading-none">🛒</span>
        </div>
      </div>
    </div>
  )
}
