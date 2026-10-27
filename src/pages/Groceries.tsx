import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, ChevronDown, Hash, LayoutGrid, Lock, Pencil, Plus, RotateCcw, ShoppingCart, Trash2 } from 'lucide-react'
import { useMember, usePartner } from '../auth/AuthGate'
import { SearchButton } from '../components/Search'
import { CategoryPicker, useCategories } from '../components/CategoryPicker'
import { useStore } from '../data/store'
import { guessCategory } from '../lib/categorize'
import { ago, capitalize, normalizeName, splitQuantity } from '../lib/format'
import { type Category, type GroceryItem, type GroceryList } from '../lib/types'
import {
  Avatar,
  Button,
  Card,
  CheckCircle,
  SheetActions,
  SuccessCheck,
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

const LIST_KEY = 'foyer-courses-liste'
const readList = () => {
  try {
    return localStorage.getItem(LIST_KEY)
  } catch {
    return null
  }
}

export default function GroceriesPage() {
  const { data, insert, update, showToast } = useStore()
  const [text, setText] = useState('')
  // Liste affichée : null = les courses de la maison, sinon une liste à part (traiteur…).
  const [savedList, setSavedList] = useState<string | null>(readList)
  const list = data.grocery_lists.find((l) => l.id === savedList) ?? null
  const listId = list?.id ?? null
  const openList = (id: string | null) => {
    setSavedList(id)
    try {
      if (id) localStorage.setItem(LIST_KEY, id)
      else localStorage.removeItem(LIST_KEY)
    } catch {
      /* pas grave : on reviendra sur la maison */
    }
  }
  const [listSheet, setListSheet] = useState<GroceryList | 'new' | null>(null)
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [leaving, setLeaving] = useState(false)
  const [allDone, setAllDone] = useState(0)

  const scope = data.grocery_items.filter((i) => (i.list_id ?? null) === listId)
  const open = scope.filter((i) => i.status !== 'bought')
  const bought = scope
    .filter((i) => i.status === 'bought')
    .sort((a, b) => (b.bought_at ?? '').localeCompare(a.bought_at ?? ''))
    .slice(0, 16)
  const shown = open
  const isNew = useArrivals(data.grocery_items.map((i) => i.id))

  const { all: categories, emojiOf } = useCategories()
  const groups = useMemo(() => {
    // Un article dont le rayon perso a disparu garde quand même son groupe.
    const names = [...categories.map((c) => c.id), ...shown.map((i) => i.category)].filter((n, i, a) => a.indexOf(n) === i)
    return names
      .map((id) => ({
        id,
        emoji: emojiOf(id),
        items: shown.filter((i) => i.category === id).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      }))
      .filter((g) => g.items.length > 0)
  }, [shown, categories, emojiOf])

  const parsed = splitQuantity(text)
  // Rayon : celui choisi à la main, sinon celui de la dernière fois, sinon la suggestion automatique.
  const [picked, setPicked] = useState<Category | null>(null)
  const [choosing, setChoosing] = useState(false)
  const known = parsed.name ? data.grocery_items.find((i) => normalizeName(i.name) === normalizeName(parsed.name))?.category : undefined
  const suggested = parsed.name ? (known ?? guessCategory(parsed.name)) : null
  const category = picked ?? suggested
  useEffect(() => {
    if (!text.trim()) setPicked(null)
  }, [text])

  // Suggestions : ce qu'on a déjà acheté et dont un mot commence par ce qu'on tape.
  const query = normalizeName(parsed.name)
  const suggestions =
    query.length < 2
      ? []
      : scope
          .filter((i) => i.status === 'bought' && normalizeName(i.name) !== query)
          .filter((i) =>
            normalizeName(i.name)
              .split(/[^a-z0-9]+/)
              .some((w) => w.startsWith(query)),
          )
          .sort((a, b) => (b.bought_at ?? '').localeCompare(a.bought_at ?? ''))
          .slice(0, 4)

  const putBack = (item: GroceryItem) => {
    update('grocery_items', item.id, {
      status: 'todo',
      bought_at: null,
      quantity: parsed.quantity,
      ...(picked ? { category: picked } : {}),
    })
    setPicked(null)
    setText('')
    inputRef.current?.focus()
  }

  const add = () => {
    if (!parsed.name) return
    const name = capitalize(parsed.name)
    const key = normalizeName(name)
    const existing = scope.find((i) => normalizeName(i.name) === key)
    if (existing && existing.status !== 'bought') {
      // Déjà sur la liste : on met juste à jour la quantité si on en a donné une.
      if (parsed.quantity || picked)
        update('grocery_items', existing.id, {
          ...(parsed.quantity ? { quantity: parsed.quantity } : {}),
          ...(picked ? { category: picked } : {}),
        })
    } else if (existing) {
      // Déjà acheté par le passé : on le remet sur la liste, avec son rayon.
      return putBack(existing)
    } else {
      insert('grocery_items', {
        name,
        quantity: parsed.quantity,
        category: category ?? guessCategory(name),
        place: 'store',
        list_id: listId,
      })
    }
    setText('')
    setPicked(null)
    inputRef.current?.focus()
  }

  return (
    <div className="animate-page">
      <Hero
        eyebrow={
          (list ? `${list.emoji} ${list.name} · ` : '') +
          (open.length ? `${open.length} article${open.length > 1 ? 's' : ''} à prendre` : 'Rien ne manque')
        }
        title="Courses"
        action={
          <div className="flex gap-2">
            <SearchButton />
            {!list && (
              <button
                onClick={() => setLeaving(true)}
                className="flex h-11 items-center gap-1.5 rounded-full bg-white/18 pl-3 pr-4 text-[14px] font-semibold ring-1 ring-white/25 backdrop-blur-md transition duration-300 ease-smooth active:scale-95"
              >
                <ShoppingCart size={17} /> Je pars
              </button>
            )}
          </div>
        }
      >
        {data.grocery_lists.length > 0 && (
          <ListSwitch lists={data.grocery_lists} current={listId} onPick={openList} onEdit={setListSheet} />
        )}
        <Composer
          value={text}
          onChange={setText}
          onSubmit={add}
          placeholder="Ajouter un article…"
          label="Nouvel article"
          inputRef={inputRef}
          onHero
        />
        {/* Rayon choisi d'office ; un appui pour le changer. Jamais d'étape obligatoire. */}
        <div
          className={cx('flex h-9 items-center gap-2 px-1 pt-2 transition-opacity duration-300', category ? 'opacity-100' : 'opacity-0')}
        >
          {category && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setChoosing(true)}
              aria-label={`Rayon : ${category}. Toucher pour changer`}
              className="flex h-7 items-center gap-1 rounded-full bg-white/14 pl-2.5 pr-2 text-[13px] font-semibold ring-1 ring-white/20 transition active:scale-95"
            >
              {emojiOf(category)} {category}
              <ChevronDown size={14} strokeWidth={2.6} className="opacity-75" />
            </button>
          )}
          {parsed.quantity && <span className="text-[13px] opacity-85">× {parsed.quantity}</span>}
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pt-2" aria-label="Déjà achetés">
            {suggestions.map((i) => (
              <button
                key={i.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => putBack(i)}
                className="flex h-8 animate-pop items-center gap-1.5 rounded-full bg-white/16 px-3 text-[13px] font-semibold ring-1 ring-white/25 backdrop-blur-md transition active:scale-95"
              >
                <span className="text-[12px]">{emojiOf(i.category)}</span>
                {i.name}
              </button>
            ))}
          </div>
        )}
      </Hero>

      <Sheet
        open={choosing}
        title="Rayon"
        onClose={() => {
          setChoosing(false)
          inputRef.current?.focus()
        }}
      >
        {category && (
          <CategoryPicker
            value={category}
            suggested={suggested ?? undefined}
            onChange={(c) => {
              setPicked(c)
              setChoosing(false)
              inputRef.current?.focus()
            }}
          />
        )}
      </Sheet>

      {list && (
        <p className="-mt-2 mb-3 flex animate-fade items-center justify-center gap-1 text-[12px] text-faint">
          <Lock size={11} /> Liste à part : seul vous la voyez
        </p>
      )}

      {!list && <PartnerShopping />}

      {open.length === 0 &&
        (list ? (
          <Empty emoji={list.emoji} title="Rien sur cette liste" text="Ce que vous ajoutez ici reste à part : seul vous le voyez." />
        ) : (
          <Empty emoji="🛒" title="La liste est vide" text="Ajoutez ce qui manque : l'autre le verra tout de suite sur son téléphone." />
        ))}
      <div key={listId ?? 'maison'} className="animate-fade">
        {groups.map((g) => (
          <section key={g.id}>
            {/* Le rayon reste affiché en haut tant qu'on fait défiler ses articles. */}
            <div className="sticky top-0 z-10 mt-3 pt-[env(safe-area-inset-top)]">
              <div className="rounded-full bg-bg/80 py-1.5 backdrop-blur-xl">
                <SectionTitle className="my-0" aside={g.items.length}>
                  <span className="text-[15px] normal-case">{g.emoji}</span>
                  <span className="text-[12.5px] text-ink/85">{g.id}</span>
                </SectionTitle>
              </div>
            </div>
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
            before.forEach((b) =>
              update('grocery_items', b.id, {
                status: 'bought',
                bought_at: now,
              }),
            )
            setAllDone(Date.now())
            showToast(`${before.length} articles achetés`, () =>
              before.forEach((b) =>
                update('grocery_items', b.id, {
                  status: b.status,
                  bought_at: null,
                }),
              ),
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
                onClick={() =>
                  update('grocery_items', i.id, {
                    status: 'todo',
                    bought_at: null,
                  })
                }
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

      {data.grocery_lists.length === 0 && (
        <button
          onClick={() => setListSheet('new')}
          className="mx-auto mt-8 flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-faint transition active:scale-95"
        >
          <Plus size={15} strokeWidth={2.6} /> Une liste à part (traiteur…)
        </button>
      )}

      <Sheet open={!!listSheet} title={listSheet === 'new' ? 'Nouvelle liste à part' : 'Liste à part'} onClose={() => setListSheet(null)}>
        {listSheet && (
          <ListForm
            key={listSheet === 'new' ? 'new' : listSheet.id}
            list={listSheet === 'new' ? null : listSheet}
            onDone={(id) => {
              if (id !== undefined) openList(id)
              setListSheet(null)
            }}
          />
        )}
      </Sheet>

      {allDone > 0 && <DoneOverlay key={allDone} onDone={() => setAllDone(0)} />}

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

  const buy = (delay = 560) => {
    setLeaving(true)
    setTimeout(
      () =>
        update('grocery_items', item.id, {
          status: 'bought',
          bought_at: new Date().toISOString(),
        }),
      delay,
    )
  }

  return (
    <Collapsible leaving={leaving} className={cx('border-b border-line/70 last:border-0', fresh && 'animate-pop')}>
      <SwipeRow
        right={{
          label: 'Acheté',
          icon: <Check size={18} strokeWidth={2.6} />,
          tone: 'done',
          run: () => buy(200),
        }}
        left={{
          label: 'Supprimer',
          icon: <Trash2 size={18} />,
          tone: 'late',
          run: () => removeWithUndo('grocery_items', item.id, item.name),
        }}
      >
        <div className="flex min-h-16 items-center gap-3.5 px-4 py-2.5">
          <CheckCircle big checked={leaving} onClick={() => buy()} label={`Marquer ${item.name} comme acheté`} />
          <button onClick={onEdit} className="min-w-0 flex-1 py-1 text-left">
            <span
              className={cx('block truncate text-[17px] leading-snug transition-colors duration-300', leaving && 'text-muted line-through')}
            >
              {item.name}
              {item.quantity && <span className="num ml-1.5 text-[14px] text-muted">× {item.quantity}</span>}
            </span>
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

  const save = (e: FormEvent) => {
    e.preventDefault()
    update('grocery_items', item.id, {
      name: name.trim() || item.name,
      quantity: quantity.trim() || null,
      category,
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
      <div className="rounded-2xl bg-surface-2/60 px-3 pb-3 pt-2.5 ring-1 ring-line/50">
        <p className="mb-2.5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-muted">
          <LayoutGrid size={15} className="text-sec" /> Rayon
        </p>
        <CategoryPicker value={category} suggested={guessCategory(name)} onChange={setCategory} />
      </div>
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

/** En haut, dans le bandeau : Maison ou liste à part. Un appui change de liste, un second appui sur la liste active la modifie. */
function ListSwitch({
  lists,
  current,
  onPick,
  onEdit,
}: {
  lists: GroceryList[]
  current: string | null
  onPick(id: string | null): void
  onEdit(l: GroceryList | 'new'): void
}) {
  const chip = (active: boolean) =>
    cx(
      'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition duration-200 ease-smooth active:scale-95',
      active ? 'bg-white text-[#0b6f73] shadow-[0_4px_14px_-6px_rgba(0,0,0,0.35)]' : 'bg-white/14 ring-1 ring-white/25 backdrop-blur-md',
    )
  return (
    <div className="mb-3">
      <div className="flex flex-wrap justify-center gap-1.5">
        <button onClick={() => onPick(null)} aria-pressed={current === null} className={chip(current === null)}>
          🏠 Maison
        </button>
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => (current === l.id ? onEdit(l) : onPick(l.id))}
            aria-pressed={current === l.id}
            className={chip(current === l.id)}
          >
            {l.emoji} {l.name}
            {current === l.id && <Pencil size={12} strokeWidth={2.6} className="opacity-70" aria-label="modifier" />}
          </button>
        ))}
        <button onClick={() => onEdit('new')} aria-label="Nouvelle liste à part" className={cx(chip(false), 'w-9 justify-center px-0')}>
          <Plus size={16} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  )
}

/** Créer, renommer ou supprimer une liste à part. `onDone(id)` ouvre la liste ; `onDone(null)` revient à la maison. */
function ListForm({ list, onDone }: { list: GroceryList | null; onDone(id?: string | null): void }) {
  const { insert, update, remove } = useStore()
  const [name, setName] = useState(list?.name ?? '')
  const [emoji, setEmoji] = useState(list?.emoji ?? '')
  const [confirm, setConfirm] = useState(false)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const clean = capitalize(name.trim())
    if (!clean) return
    const icon = emoji.trim() || '📦'
    if (list) {
      update('grocery_lists', list.id, { name: clean, emoji: icon })
      onDone()
    } else onDone(insert('grocery_lists', { name: clean, emoji: icon }))
  }

  if (confirm && list)
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <p className="font-serif text-[22px] font-medium">Supprimer « {list.name} » ?</p>
        <p className="mb-3 text-[14px] text-muted">Ses articles partent avec elle.</p>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            remove('grocery_lists', list.id)
            onDone(null)
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
      <p className="mb-1 flex items-center justify-center gap-1.5 text-center text-[13px] text-muted">
        <Lock size={13} /> Seul vous la voyez, elle ne se mélange pas aux courses de la maison.
      </p>
      <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-2 ring-1 ring-line/50 focus-within:ring-2 focus-within:ring-sec/50">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="📦"
          aria-label="Emoji de la liste (facultatif)"
          className="size-12 shrink-0 rounded-xl bg-surface text-center text-[22px] outline-none ring-1 ring-line/60 placeholder:opacity-60"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!list}
          maxLength={40}
          placeholder="Traiteur, Boulot…"
          aria-label="Nom de la liste"
          className="h-12 min-w-0 flex-1 bg-transparent px-1 text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-faint"
        />
      </div>
      <SheetActions
        saveLabel={list ? 'Enregistrer' : 'Créer la liste'}
        deleteLabel="Supprimer la liste"
        onDelete={list ? () => setConfirm(true) : undefined}
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

/** Fin des courses : une grande coche qui se dessine au centre, puis s'efface. */
function DoneOverlay({ onDone }: { onDone(): void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1400)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div aria-hidden className="done-overlay pointer-events-none fixed inset-0 z-40 grid place-items-center">
      <SuccessCheck />
    </div>
  )
}
