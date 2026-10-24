import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TableName, Tables } from '../lib/types'
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
}

const EMPTY: Data = { grocery_items: [], todos: [], notes: [] }
const Ctx = createContext<Store | null>(null)

export function DataProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Écritures en vol par table : un rechargement temps réel pendant ce temps ferait clignoter l'écran.
  const pending = useRef<Record<TableName, number>>({ grocery_items: 0, todos: 0, notes: 0 })

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
        run(table, (rows) => [optimistic, ...rows], () => backend.insert(table, full))
      },
      update: (table, id, patch) =>
        run(table, (rows) => rows.map((r) => (r.id === id ? ({ ...r, ...patch } as typeof r) : r)), () => backend.update(table, id, patch)),
      remove: (table, id) => run(table, (rows) => rows.filter((r) => r.id !== id), () => backend.remove(table, id)),
    }),
    [data, loading, error, backend, run],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore hors de DataProvider')
  return s
}
