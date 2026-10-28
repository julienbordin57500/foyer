import { useState, type KeyboardEvent } from 'react'
import { Pencil, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../data/store'
import { capitalize, normalizeName } from '../lib/format'
import { guessCategory } from '../lib/categorize'
import { CATEGORIES, type Category, type GroceryCategory } from '../lib/types'
import { cx, tick } from './ui'

export type CategoryOption = { id: Category; emoji: string; custom?: GroceryCategory }

const CUSTOM_EMOJI = '🏷️'

/** Rayons d'office, puis ceux créés à la main, et « Autre » toujours en dernier. */
export function useCategories() {
  const { data } = useStore()
  const builtins = CATEGORIES.filter((c) => c.id !== 'Autre')
  const custom = [...data.grocery_categories]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map((c) => ({ id: c.name, emoji: c.emoji || CUSTOM_EMOJI, custom: c }))
  const all: CategoryOption[] = [...builtins, ...custom, { id: 'Autre', emoji: '🛒' }]
  const emojiOf = (name: Category) => all.find((c) => c.id === name)?.emoji ?? CUSTOM_EMOJI
  return { all, emojiOf }
}

/**
 * Choix du rayon : la suggestion automatique est déjà sélectionnée, un appui la change,
 * et « Nouvelle catégorie » se crée ici même, sans passer par un réglage.
 */
export function CategoryPicker({ value, suggested, onChange }: { value: Category; suggested?: Category; onChange(c: Category): void }) {
  const { data, insert, update, remove } = useStore()
  const { all } = useCategories()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  // « Modifier mes rayons » : un appui sur un rayon perso l'ouvre pour le renommer ou le supprimer.
  const [manage, setManage] = useState(false)
  const [editing, setEditing] = useState<GroceryCategory | null>(null)
  const hasCustom = all.some((c) => c.custom)

  const close = () => {
    setCreating(false)
    setEditing(null)
    setName('')
    setEmoji('')
  }
  const startEdit = (c: GroceryCategory) => {
    setEditing(c)
    setCreating(true)
    setName(c.name)
    setEmoji(c.emoji)
  }
  // Les articles suivent leur rayon : renommé, ils changent avec ; supprimé, ils retrouvent un rayon d'office.
  const itemsIn = (n: Category) => data.grocery_items.filter((i) => i.category === n)
  const rename = (c: GroceryCategory) => {
    const clean = capitalize(name.trim())
    if (!clean) return
    const clash = all.find((o) => o.id !== c.name && normalizeName(o.id) === normalizeName(clean))
    if (clash) return
    update('grocery_categories', c.id, { name: clean, emoji: emoji.trim() || CUSTOM_EMOJI })
    if (clean !== c.name) itemsIn(c.name).forEach((i) => update('grocery_items', i.id, { category: clean }))
    if (value === c.name) onChange(clean)
    close()
  }
  const drop = (c: GroceryCategory) => {
    itemsIn(c.name).forEach((i) => update('grocery_items', i.id, { category: guessCategory(i.name) }))
    remove('grocery_categories', c.id)
    if (value === c.name) onChange(suggested && suggested !== c.name ? suggested : 'Autre')
    close()
  }

  const pick = (c: Category) => {
    tick()
    onChange(c)
  }

  const create = () => {
    if (editing) return rename(editing)
    const clean = capitalize(name.trim())
    if (!clean) return
    // Déjà là (même écrite autrement) : on la choisit simplement.
    const same = all.find((c) => normalizeName(c.id) === normalizeName(clean))
    if (!same) insert('grocery_categories', { name: clean, emoji: emoji.trim() || CUSTOM_EMOJI })
    pick(same?.id ?? clean)
    close()
  }
  // Dans une fiche, « Entrée » ne doit pas enregistrer tout l'article.
  const onEnter = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    create()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center gap-1.5">
        {all.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => (manage ? c.custom && startEdit(c.custom) : pick(c.id))}
            disabled={manage && !c.custom}
            aria-pressed={value === c.id}
            className={cx(
              'relative inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition duration-200 ease-smooth active:scale-95 disabled:opacity-35',
              value === c.id && !manage
                ? 'bg-sec text-bg shadow-[0_4px_14px_-6px_var(--sec)]'
                : 'bg-surface-2 text-ink ring-1 ring-line/60',
              manage && c.custom && 'ring-sec/60',
            )}
          >
            <span className="text-[15px]">{c.emoji}</span>
            {c.id}
            {manage && c.custom && <Pencil size={12} className="text-sec" aria-label="modifier" />}
            {!manage && suggested === c.id && (
              <Sparkles size={12} className={value === c.id ? 'text-bg/80' : 'text-sec'} aria-label="suggérée" />
            )}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="flex animate-pop items-center gap-2 rounded-2xl bg-surface-2 p-2 ring-1 ring-sec/40">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            onKeyDown={onEnter}
            placeholder={CUSTOM_EMOJI}
            aria-label="Emoji de la catégorie (facultatif)"
            className="size-11 shrink-0 rounded-xl bg-surface text-center text-[20px] outline-none ring-1 ring-line/60 placeholder:opacity-60"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onEnter}
            autoFocus
            maxLength={40}
            placeholder="Nom : Animaux, Apéro…"
            aria-label="Nom de la nouvelle catégorie"
            className="h-11 min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={create}
            disabled={!name.trim()}
            className="h-11 shrink-0 rounded-xl bg-sec px-4 text-[14px] font-semibold text-bg transition active:scale-95 disabled:opacity-40"
          >
            {editing ? 'OK' : 'Créer'}
          </button>
        </div>
      ) : null}
      {creating && editing && (
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => drop(editing)} className="h-10 px-4 text-[14px] font-semibold text-late active:opacity-60">
            Supprimer ce rayon
          </button>
          <button type="button" onClick={close} className="h-10 px-4 text-[14px] font-semibold text-muted active:opacity-60">
            Annuler
          </button>
        </div>
      )}
      {!creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mx-auto flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold border border-dashed border-sec/50 text-sec active:scale-95"
        >
          <Plus size={16} strokeWidth={2.6} /> Nouvelle catégorie
        </button>
      )}
      {!creating && hasCustom && (
        <button
          type="button"
          onClick={() => setManage(!manage)}
          className="mx-auto block h-9 px-3 text-[13px] font-semibold text-faint active:opacity-60"
        >
          {manage ? 'Terminé' : 'Modifier mes rayons'}
        </button>
      )}
    </div>
  )
}
