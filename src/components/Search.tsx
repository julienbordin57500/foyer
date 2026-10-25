import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import type { Tab } from '../App'
import { useStore } from '../data/store'
import { euros, normalizeName } from '../lib/format'
import { cx } from './ui'

/** Ouvre la recherche depuis n'importe quel en-tête. */
export const SearchContext = createContext<() => void>(() => {})
export const useOpenSearch = () => useContext(SearchContext)

/** Liste à ouvrir directement quand on arrive sur l'onglet Listes depuis la recherche. */
export let pendingListId: string | null = null
export const consumePendingList = () => {
  const id = pendingListId
  pendingListId = null
  return id
}

interface Result {
  id: string
  tab: Tab
  icon: string
  text: string
  where: string
  done?: boolean
  listId?: string
}

export function SearchButton({ className }: { className?: string }) {
  const open = useOpenSearch()
  return (
    <button
      onClick={open}
      aria-label="Rechercher"
      className={cx(
        'grid size-11 shrink-0 place-items-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-md transition duration-300 ease-smooth active:scale-90',
        className,
      )}
    >
      <SearchIcon size={19} />
    </button>
  )
}

/** Recherche plein écran dans les courses, les tâches, les listes et les petits mots. */
export function SearchOverlay({ open, onClose, go }: { open: boolean; onClose(): void; go(t: Tab): void }) {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    const t = setTimeout(() => input.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const results = useMemo<Result[]>(() => {
    const n = normalizeName(q)
    if (n.length < 2) return []
    const hit = (s: string) => normalizeName(s).includes(n)
    const listTitle = (id: string) => data.lists.find((l) => l.id === id)
    return [
      ...data.grocery_items
        .filter((i) => hit(i.name))
        .map((i) => ({
          id: i.id,
          tab: 'courses' as Tab,
          icon: '🛒',
          text: i.name,
          where: i.status === 'bought' ? 'Courses · déjà acheté' : 'Courses',
          done: i.status === 'bought',
        })),
      ...data.todos
        .filter((t) => hit(t.title))
        .map((t) => ({
          id: t.id,
          tab: 'afaire' as Tab,
          icon: '📝',
          text: t.title,
          where: t.done_at ? 'À faire · faite' : 'À faire',
          done: !!t.done_at,
        })),
      ...data.lists
        .filter((l) => hit(l.title))
        .map((l) => ({ id: l.id, tab: 'listes' as Tab, icon: l.emoji, text: l.title, where: 'Liste', listId: l.id })),
      ...data.list_items
        .filter((i) => hit(i.text))
        .map((i) => {
          const l = listTitle(i.list_id)
          return {
            id: i.id,
            tab: 'listes' as Tab,
            icon: l?.emoji ?? '📋',
            text: i.text,
            where: `Liste · ${l?.title ?? ''}`,
            done: i.done,
            listId: i.list_id,
          }
        }),
      ...data.bills
        .filter((b) => hit(b.title))
        .map((b) => ({
          id: b.id,
          tab: 'factures' as Tab,
          icon: '💶',
          text: `${b.title} · ${euros(b.amount)}`,
          where: b.paid_at ? 'Facture · payée' : 'Facture',
          done: !!b.paid_at,
        })),
      ...data.notes
        .filter((m) => hit(m.body))
        .map((m) => ({ id: m.id, tab: 'accueil' as Tab, icon: '💌', text: m.body, where: 'Petit mot' })),
    ].slice(0, 40)
  }, [q, data])

  if (!open) return null
  return (
    <div
      className="animate-fade fixed inset-0 z-50 overflow-y-auto bg-bg/96 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Rechercher"
    >
      <div className="pt-safe mx-auto max-w-lg px-4 pb-10">
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-12 flex-1 items-center gap-2 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-sec/50">
            <SearchIcon size={18} className="shrink-0 text-muted" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Lait, valise, garage…"
              aria-label="Rechercher"
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
            />
            {q && (
              <button onClick={() => setQ('')} aria-label="Effacer" className="text-muted">
                <X size={16} />
              </button>
            )}
          </div>
          <button onClick={onClose} className="h-12 px-2 text-[15px] font-semibold text-sec">
            Fermer
          </button>
        </div>

        {q.trim().length >= 2 && results.length === 0 && (
          <p className="animate-fade py-16 text-center text-[15px] text-muted">Rien trouvé pour « {q.trim()} »</p>
        )}
        {q.trim().length < 2 && (
          <p className="py-16 text-center text-[15px] leading-relaxed text-muted">
            Cherchez un article, une tâche, une liste ou un petit mot.
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {results.map((r, i) => (
            <li key={r.tab + r.id} data-section={r.tab} className="animate-pop" style={{ animationDelay: `${Math.min(i, 10) * 18}ms` }}>
              <button
                onClick={() => {
                  if (r.listId) pendingListId = r.listId
                  onClose()
                  go(r.tab)
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left ring-1 ring-line/60 active:scale-[0.99]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sec/15 text-[17px]">{r.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-[15px]', r.done && 'text-muted line-through')}>{r.text}</span>
                  <span className="block text-[12px] font-medium text-sec">{r.where}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
