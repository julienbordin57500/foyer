import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TableName, Tables } from '../lib/types'
import { TABLES, type Backend, type Data, type NewRow } from './backends'

interface Store {
  data: Data
  loading: boolean
  error: string | null
  dismissError(): void
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<void>
  update<T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>): Promise<void>
  remove(table: TableName, id: string): Promise<void>
  adjustStock(id: string, delta: number): void
}

const EMPTY: Data = { products: [], subscriptions: [], charges: [], incomes: [] }
const Ctx = createContext<Store | null>(null)

export function DataProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Ajustements de stock en vol : on ignore les rechargements temps réel tant qu'ils ne sont pas confirmés,
  // sinon un appui rapide sur « + » ferait clignoter la valeur.
  const pendingStock = useRef(0)

  const refresh = useCallback(
    async (table: TableName) => {
      if (table === 'products' && pendingStock.current > 0) return
      try {
        const rows = await backend.reload(table)
        setData((d) => ({ ...d, [table]: rows }))
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

  const run = useCallback(
    async (table: TableName, op: () => Promise<void>) => {
      try {
        await op()
      } catch (e) {
        setError((e as Error).message)
      }
      await refresh(table)
    },
    [refresh],
  )

  const store = useMemo<Store>(
    () => ({
      data,
      loading,
      error,
      dismissError: () => setError(null),
      insert: (table, row) => run(table, () => backend.insert(table, row)),
      update: (table, id, patch) => {
        setData((d) => ({
          ...d,
          [table]: (d[table] as Tables[typeof table][]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }))
        return run(table, () => backend.update(table, id, patch))
      },
      remove: (table, id) => {
        setData((d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) }))
        return run(table, () => backend.remove(table, id))
      },
      adjustStock: (id, delta) => {
        setData((d) => ({
          ...d,
          products: d.products.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p)),
        }))
        pendingStock.current++
        backend
          .adjustStock(id, delta)
          .catch((e) => setError((e as Error).message))
          .finally(() => {
            pendingStock.current--
            if (pendingStock.current === 0) refresh('products')
          })
      },
    }),
    [data, loading, error, backend, run, refresh],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore hors de DataProvider')
  return s
}
