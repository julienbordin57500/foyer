import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableName, Tables } from '../lib/types'

export type Data = { [T in TableName]: Tables[T][] }
export type NewRow<T extends TableName> = Omit<Tables[T], 'id'>

export interface Backend {
  load(): Promise<Data>
  reload<T extends TableName>(table: T): Promise<Tables[T][]>
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<void>
  update<T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>): Promise<void>
  remove(table: TableName, id: string): Promise<void>
  adjustStock(id: string, delta: number): Promise<void>
  /** Appelé quand l'autre téléphone modifie une table. */
  subscribe(onChange: (table: TableName) => void): () => void
}

export const TABLES: TableName[] = ['products', 'subscriptions', 'charges', 'incomes']

const ORDER: Record<TableName, string> = {
  products: 'name',
  subscriptions: 'debit_day',
  charges: 'amount',
  incomes: 'amount',
}

// numeric Postgres → string côté JS : on normalise.
const normalize = <T>(rows: Record<string, unknown>[]): T[] =>
  rows.map((r) => ('amount' in r ? { ...r, amount: Number(r.amount) } : r) as T)

export function supabaseBackend(sb: SupabaseClient, householdId: string): Backend {
  const check = ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(error.message)
  }

  const reload = async <T extends TableName>(table: T) => {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .eq('household_id', householdId)
      .order(ORDER[table], { ascending: table === 'products' || table === 'subscriptions' })
    if (error) throw new Error(error.message)
    return normalize<Tables[T]>(data ?? [])
  }

  return {
    reload,
    async load() {
      const [products, subscriptions, charges, incomes] = await Promise.all(TABLES.map(reload))
      return { products, subscriptions, charges, incomes } as Data
    },
    async insert(table, row) {
      check(await sb.from(table).insert({ ...row, household_id: householdId } as never))
    },
    async update(table, id, patch) {
      check(await sb.from(table).update(patch as never).eq('id', id))
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq('id', id))
    },
    async adjustStock(id, delta) {
      check(await sb.rpc('adjust_stock', { p_id: id, p_delta: delta }))
    },
    subscribe(onChange) {
      const channel = sb.channel(`foyer-${householdId}`)
      for (const table of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange(table))
      }
      channel.subscribe()
      return () => {
        sb.removeChannel(channel)
      }
    },
  }
}

// ─── Mode démo : localStorage, synchronisé entre onglets ───────────────────

const KEY = 'foyer-demo-v1'
const uid = () => crypto.randomUUID()

const seed = (): Data => {
  const in_ = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const day = (offset: number) => ((new Date().getDate() + offset - 1) % 28) + 1
  return {
    products: [
      { id: uid(), name: 'Lait', stock: 1, threshold: 2 },
      { id: uid(), name: 'Café', stock: 0, threshold: 1 },
      { id: uid(), name: 'Pâtes', stock: 4, threshold: 2 },
      { id: uid(), name: 'Papier toilette', stock: 6, threshold: 4 },
      { id: uid(), name: 'Œufs', stock: 12, threshold: 6 },
      { id: uid(), name: 'Liquide vaisselle', stock: 1, threshold: 1 },
    ],
    subscriptions: [
      { id: uid(), name: 'Netflix', amount: 13.49, debit_day: day(2), cancel_deadline: null },
      { id: uid(), name: 'Box internet', amount: 34.99, debit_day: day(5), cancel_deadline: in_(12) },
      { id: uid(), name: 'Salle de sport', amount: 29.9, debit_day: day(15), cancel_deadline: in_(45) },
      { id: uid(), name: 'Spotify Duo', amount: 16.99, debit_day: day(20), cancel_deadline: null },
    ],
    charges: [
      { id: uid(), label: 'Loyer', category: 'Logement', amount: 950, debit_day: day(3) },
      { id: uid(), label: 'Électricité', category: 'Énergie', amount: 85, debit_day: day(9) },
      { id: uid(), label: 'Assurance habitation', category: 'Assurance', amount: 22, debit_day: day(12) },
      { id: uid(), label: 'Crédit auto', category: 'Transport', amount: 210, debit_day: day(6) },
      { id: uid(), label: 'Courses', category: 'Alimentation', amount: 500, debit_day: null },
      { id: uid(), label: 'Mutuelle', category: 'Santé', amount: 64, debit_day: day(18) },
    ],
    incomes: [
      { id: uid(), label: 'Salaire 1', amount: 2100 },
      { id: uid(), label: 'Salaire 2', amount: 1850 },
    ],
  }
}

export function demoBackend(): Backend {
  const read = (): Data => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* stockage indisponible : on repart des données d'exemple */
    }
    const d = seed()
    write(d)
    return d
  }
  const write = (d: Data) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d))
    } catch {
      /* ignoré */
    }
  }
  const edit = (fn: (d: Data) => void) => {
    const d = read()
    fn(d)
    write(d)
  }

  return {
    load: async () => read(),
    reload: async (table) => read()[table],
    async insert(table, row) {
      edit((d) => {
        ;(d[table] as unknown[]).push({ ...row, id: uid() })
      })
    },
    async update(table, id, patch) {
      edit((d) => {
        d[table] = d[table].map((r) => (r.id === id ? { ...r, ...patch } : r)) as never
      })
    },
    async remove(table, id) {
      edit((d) => {
        d[table] = d[table].filter((r) => r.id !== id) as never
      })
    },
    async adjustStock(id, delta) {
      edit((d) => {
        d.products = d.products.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p))
      })
    },
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key === KEY) TABLES.forEach(onChange)
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
