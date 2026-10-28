import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Dices, Plus, X } from 'lucide-react'
import { useStore } from '../data/store'
import { capitalize, normalizeName, splitQuantity } from '../lib/format'
import { RECIPE_BOOK, findRecipes } from '../lib/recipes'
import type { Recipe } from '../lib/types'
import { Button, CheckCircle, Composer, Sheet, cx, tick } from './ui'

type Entry = { name: string; emoji: string; ingredients: string[]; custom?: Recipe }
type Line = { id: number; text: string; on: boolean }

/** Le carnet : recettes du foyer d'abord, puis celles d'office qui n'ont pas été personnalisées. */
function useRecipes(): Entry[] {
  const { data } = useStore()
  return useMemo(() => {
    const mine = data.recipes.map((r) => ({ name: r.name, emoji: r.emoji, ingredients: r.ingredients, custom: r }))
    const taken = new Set(mine.map((r) => normalizeName(r.name)))
    return [...mine, ...RECIPE_BOOK.filter((r) => !taken.has(normalizeName(r.name)))]
  }, [data.recipes])
}

/**
 * Idée recette : au hasard ou tapée à la main. Les ingrédients sont cochés d'office, on décoche ce qu'on a
 * déjà, on corrige ou on en ajoute, puis on valide : seuls les cochés partent dans les courses.
 */
export function RecipeSheet({
  open,
  onClose,
  onAdd,
  onList,
}: {
  open: boolean
  onClose(): void
  /** Ajoute ces lignes (« 500 g spaghetti ») à la liste affichée. */
  onAdd(lines: string[]): void
  /** Noms déjà sur la liste (normalisés) : décochés d'office. */
  onList: Set<string>
}) {
  return (
    <Sheet open={open} title="Idée recette" onClose={onClose}>
      {open && <RecipeFlow onAdd={onAdd} onList={onList} onDone={onClose} />}
    </Sheet>
  )
}

function RecipeFlow({ onAdd, onList, onDone }: { onAdd(lines: string[]): void; onList: Set<string>; onDone(): void }) {
  const { insert, update } = useStore()
  const all = useRecipes()
  const [query, setQuery] = useState('')
  const [recipe, setRecipe] = useState<Entry | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const nextId = useRef(0)

  const show = (r: Entry) => {
    tick()
    setRecipe(r)
    setLines(
      r.ingredients.map((text) => ({
        id: nextId.current++,
        text,
        on: !onList.has(normalizeName(splitQuantity(text).name)),
      })),
    )
  }
  const random = () => {
    const pool = all.filter((r) => r.name !== recipe?.name)
    show(pool[Math.floor(Math.random() * pool.length)])
  }
  const matches = findRecipes(all, query).slice(0, 5)
  const fromText = () => {
    const name = capitalize(query.trim())
    if (!name) return
    // Recette connue : on la reprend. Sinon on la crée, et ses ingrédients seront retenus pour la prochaine fois.
    const known = all.find((r) => normalizeName(r.name) === normalizeName(name)) ?? matches[0]
    show(known ?? { name, emoji: '🍽️', ingredients: [] })
    if (!known) addLine()
  }
  const addLine = () => setLines((l) => [...l, { id: nextId.current++, text: '', on: true }])
  const edit = (id: number, patch: Partial<Line>) => setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const chosen = lines.filter((l) => l.on && l.text.trim())
  const confirm = () => {
    if (!recipe) return
    // Recette nouvelle ou modifiée : on la garde dans le carnet du foyer.
    const ingredients = lines.map((l) => l.text.trim()).filter(Boolean)
    const changed = ingredients.join('\n') !== recipe.ingredients.join('\n')
    if (recipe.custom && changed) update('recipes', recipe.custom.id, { ingredients })
    else if (!recipe.custom && changed && ingredients.length) insert('recipes', { name: recipe.name, emoji: recipe.emoji, ingredients })
    onAdd(chosen.map((l) => l.text.trim()))
    onDone()
  }

  if (!recipe)
    return (
      <div className="flex flex-col gap-3">
        <Button onClick={random} className="w-full">
          <Dices size={19} /> Une recette au hasard
        </Button>
        <p className="text-center text-[13px] text-muted">ou tapez la vôtre</p>
        <Composer value={query} onChange={setQuery} onSubmit={fromText} placeholder="Pâtes carbo, raclette…" label="Nom de la recette" />
        {matches.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {matches.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => show(r)}
                className="flex h-9 animate-pop items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[14px] font-semibold ring-1 ring-line/60 active:scale-95"
              >
                {r.emoji} {r.name}
              </button>
            ))}
          </div>
        )}
        {query.trim().length >= 2 && !matches.some((r) => normalizeName(r.name) === normalizeName(query)) && (
          <button type="button" onClick={fromText} className="mx-auto h-9 px-3 text-[14px] font-semibold text-sec active:opacity-60">
            + Créer « {capitalize(query.trim())} »
          </button>
        )}
      </div>
    )

  return (
    <div key={recipe.name} className="flex animate-fade flex-col gap-3">
      <div className="flex flex-col items-center text-center">
        <span className="text-[40px] leading-none">{recipe.emoji}</span>
        <p className="mt-2 font-serif text-[26px] font-medium leading-tight">{recipe.name}</p>
        <p className="mt-1 text-[13px] text-muted">Décochez ce que vous avez déjà, touchez un ingrédient pour le modifier.</p>
      </div>

      <ul className="overflow-hidden rounded-2xl bg-surface-2/60 ring-1 ring-line/50">
        {lines.map((l) => {
          const already = onList.has(normalizeName(splitQuantity(l.text).name))
          return (
            <li key={l.id} className="flex min-h-13 items-center gap-3 border-b border-line/60 px-3 py-1.5 last:border-0">
              <CheckCircle checked={l.on} onClick={() => edit(l.id, { on: !l.on })} label={l.on ? 'Ne pas acheter' : 'À acheter'} />
              <span className="min-w-0 flex-1">
                <input
                  value={l.text}
                  onChange={(e) => edit(l.id, { text: e.target.value })}
                  autoFocus={!l.text}
                  placeholder="Ingrédient (ex. 200 g lardons)"
                  aria-label="Ingrédient"
                  className={cx(
                    'h-10 w-full bg-transparent text-[16px] outline-none placeholder:text-faint',
                    !l.on && 'text-muted line-through decoration-faint',
                  )}
                />
                {already && <span className="-mt-1 block text-[11.5px] font-medium text-sec">déjà sur la liste</span>}
              </span>
              <button
                type="button"
                onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))}
                aria-label="Retirer cet ingrédient"
                className="grid size-8 place-items-center rounded-full text-faint active:bg-surface"
              >
                <X size={16} />
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={addLine}
            className="flex h-12 w-full items-center justify-center gap-1.5 text-[14px] font-semibold text-sec"
          >
            <Plus size={16} strokeWidth={2.6} /> Ajouter un ingrédient
          </button>
        </li>
      </ul>

      <Button onClick={confirm} disabled={chosen.length === 0} className="w-full">
        Ajouter {chosen.length} ingrédient{chosen.length > 1 ? 's' : ''} aux courses
      </Button>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setRecipe(null)}
          className="flex h-10 items-center gap-1.5 px-3 text-[14px] font-semibold text-muted"
        >
          <ArrowLeft size={16} /> Autre recette
        </button>
        <button type="button" onClick={random} className="flex h-10 items-center gap-1.5 px-3 text-[14px] font-semibold text-muted">
          <Dices size={16} /> Au hasard
        </button>
      </div>
    </div>
  )
}
