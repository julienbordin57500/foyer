import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ListItem, TableName, Tables } from '../lib/types'
import { TABLES, rowDefaults, type Backend, type Data, type NewRow, type Patch } from './backends'

interface Store {
  me: string
  data: Data
  loading: boolean
  error: string | null
  dismissError(): void
  insert<T extends TableName>(table: T, row: NewRow<T>): void
  update<T extends TableName>(table: T, id: string, patch: Patch<T>): void
  remove(table: TableName, id: string): void
  /** Supprime après quelques secondes, avec un bouton « Annuler » entre-temps. */
  removeWithUndo(table: TableName, id: string, label: string): void
  toast: { message: string; undo(): void } | null
  /** Bandeau « … · Annuler » pendant 5 secondes. */
  showToast(message: string, undo: () => void): void
  /** Crée une liste et ses premiers éléments (modèle), dans cet ordre. */
  createList(list: NewRow<'lists'>, items: string[]): string
}

const EMPTY: Data = { grocery_items: [], todos: [], notes: [], lists: [], list_items: [], note_reactions: [], pings: [] }
const Ctx = createContext<Store | null>(null)

export function DataProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Store['toast']>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Écritures en vol par table : un rechargement temps réel pendant ce temps ferait clignoter l'écran.
  const pending = useRef<Record<TableName, number>>({
    grocery_items: 0,
    todos: 0,
    notes: 0,
    lists: 0,
    list_items: 0,
    note_reactions: 0,
    pings: 0,
  })

  const refresh = useCallback(
    async (table: TableName) => {
      if (pending.current[table] > 0) return
      try {
        const rows = await backend.reload(table)
        if (pending.current[table] === 0) setData((d) => ({ ...d, [table]: rows }))
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [backend],
  )

  useEffect(() => {
    let alive = true
    backend
      .load()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false))

    const unsubscribe = backend.subscribe(refresh)
    // Un téléphone en veille perd sa connexion temps réel : on resynchronise au retour.
    const onVisible = () => document.visibilityState === 'visible' && TABLES.forEach(refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [backend, refresh])

  /** Applique tout de suite à l'écran, envoie au serveur, puis resynchronise. */
  const run = useCallback(
    (table: TableName, local: (rows: Tables[TableName][]) => Tables[TableName][], op: () => Promise<void>) => {
      setData((d) => ({ ...d, [table]: local(d[table]) }))
      pending.current[table]++
      op()
        .catch((e) => setError((e as Error).message))
        .finally(() => {
          pending.current[table]--
          refresh(table)
        })
    },
    [refresh],
  )

  const store = useMemo<Store>(
    () => ({
      me: backend.me,
      data,
      loading,
      error,
      dismissError: () => setError(null),
      insert: (table, row) => {
        const full = { ...row, id: crypto.randomUUID() }
        const optimistic = { ...rowDefaults(table, backend.me), ...full } as unknown as Tables[TableName]
        // Les éléments de liste s'affichent dans l'ordre d'ajout, le reste du plus récent au plus ancien.
        run(
          table,
          (rows) => (table === 'list_items' ? [...rows, optimistic] : [optimistic, ...rows]),
          () => backend.insert(table, full),
        )
      },
      update: (table, id, patch) =>
        run(
          table,
          (rows) => rows.map((r) => (r.id === id ? ({ ...r, ...patch } as typeof r) : r)),
          () => backend.update(table, id, patch),
        ),
      createList: (list, items) => {
        const id = crypto.randomUUID()
        const rows = items.map((text) => ({ id: crypto.randomUUID(), list_id: id, text }))
        const now = rowDefaults('lists', backend.me)
        setData((d) => ({
          ...d,
          list_items: [...d.list_items, ...rows.map((r) => ({ ...rowDefaults('list_items', backend.me), ...r }) as unknown as ListItem)],
        }))
        pending.current.list_items++
        run(
          'lists',
          (existing) => [{ ...now, ...list, id } as unknown as Tables['lists'], ...existing],
          async () => {
            try {
              await backend.insert('lists', { ...list, id })
              await backend.insertMany('list_items', rows)
            } finally {
              pending.current.list_items--
              refresh('list_items')
            }
          },
        )
        return id
      },
      toast,
      showToast: (message, undo) => {
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 5000)
        setToast({
          message,
          undo: () => {
            undo()
            setToast(null)
          },
        })
      },
      removeWithUndo: (table, id, label) => {
        // Masqué tout de suite, supprimé pour de bon 5 s plus tard sauf « Annuler ».
        setData((d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) }))
        pending.current[table]++
        let undone = false
        const commit = setTimeout(() => {
          if (undone) return
          backend
            .remove(table, id)
            .catch((e) => setError((e as Error).message))
            .finally(() => {
              pending.current[table]--
              refresh(table)
            })
        }, 5000)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 5000)
        setToast({
          message: `« ${label} » supprimé`,
          undo: () => {
            undone = true
            clearTimeout(commit)
            pending.current[table]--
            refresh(table)
            setToast(null)
          },
        })
      },
      remove: (table, id) =>
        run(
          table,
          (rows) => rows.filter((r) => r.id !== id),
          () => backend.remove(table, id),
        ),
    }),
    [data, loading, error, toast, backend, run, refresh],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore hors de DataProvider')
  return s
}
