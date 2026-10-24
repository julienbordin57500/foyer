import type { SupabaseClient } from '@supabase/supabase-js'
import type { Place, TableName, Tables } from '../lib/types'

export type Data = { [T in TableName]: Tables[T][] }
/** Champs remplis par la base (id, dates, auteur) exclus. */
export type NewRow<T extends TableName> = {
  grocery_items: Pick<Tables['grocery_items'], 'name' | 'quantity' | 'category' | 'place'>
  todos: Pick<Tables['todos'], 'title' | 'assignee' | 'due_date'> & Partial<Pick<Tables['todos'], 'repeat' | 'remind_at' | 'remind_to'>>
  notes: Pick<Tables['notes'], 'body'>
  lists: Pick<Tables['lists'], 'title' | 'emoji'>
  list_items: Pick<Tables['list_items'], 'list_id' | 'text'>
  note_reactions: Pick<Tables['note_reactions'], 'note_id' | 'emoji'>
  pings: Pick<Tables['pings'], 'kind' | 'place'>
}[T]
export type Patch<T extends TableName> = Partial<Omit<Tables[T], 'id' | 'created_at'>>

export interface Backend {
  /** Identifiant de l'utilisateur courant (auteur des ajouts). */
  me: string
  load(): Promise<Data>
  reload<T extends TableName>(table: T): Promise<Tables[T][]>
  insert<T extends TableName>(table: T, row: NewRow<T> & { id: string }): Promise<void>
  insertMany<T extends TableName>(table: T, rows: (NewRow<T> & { id: string })[]): Promise<void>
  update<T extends TableName>(table: T, id: string, patch: Patch<T>): Promise<void>
  remove(table: TableName, id: string): Promise<void>
  /** Appelé quand l'autre téléphone modifie une table. */
  subscribe(onChange: (table: TableName) => void): () => void
}

export const TABLES: TableName[] = ['grocery_items', 'todos', 'notes', 'lists', 'list_items', 'note_reactions', 'pings']

export function supabaseBackend(sb: SupabaseClient, householdId: string, me: string): Backend {
  const check = ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(error.message)
  }

  const reload = async <T extends TableName>(table: T) => {
    let q = sb
      .from(table)
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: table === 'list_items' })
    // Les petits mots s'accumulent : seuls les plus récents servent.
    if (table === 'notes') q = q.limit(30)
    // « Je pars faire les courses » : seuls les derniers comptent.
    if (table === 'pings') q = q.gte('created_at', new Date(Date.now() - 86_400_000).toISOString()).limit(5)
    // Tâches faites : on ne garde que les 30 derniers jours.
    if (table === 'todos') q = q.or(`done_at.is.null,done_at.gte.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data ?? []) as Tables[T][]
  }

  return {
    me,
    reload,
    async load() {
      const [grocery_items, todos, notes, lists, list_items, note_reactions, pings] = await Promise.all(TABLES.map(reload))
      return { grocery_items, todos, notes, lists, list_items, note_reactions, pings } as Data
    },
    async insert(table, row) {
      check(await sb.from(table).insert({ ...row, household_id: householdId } as never))
    },
    async insertMany(table, rows) {
      if (rows.length) check(await sb.from(table).insert(rows.map((r) => ({ ...r, household_id: householdId })) as never))
    },
    async update(table, id, patch) {
      check(await sb.from(table).update(patch as never).eq('id', id))
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq('id', id))
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

const KEY = 'foyer-demo-v5'
const uid = () => crypto.randomUUID()
export const DEMO_ME = 'demo-1'
export const DEMO_OTHER = 'demo-2'

const seed = (): Data => {
  const noReminder = { remind_at: null, remind_to: null, reminded_at: null }
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  const inDays = (d: number) => {
    const x = new Date()
    x.setDate(x.getDate() + d)
    return x.toISOString().slice(0, 10)
  }
  const item = (name: string, category: GroceryCat, added_by: string, extra: Partial<Tables['grocery_items']> = {}) => ({
    id: uid(),
    name,
    quantity: null,
    category,
    place: 'store' as Place,
    status: 'todo' as const,
    added_by,
    bought_at: null,
    created_at: ago(Math.random() * 600),
    ...extra,
  })
  return {
    grocery_items: [
      item('Tomates cerises', 'Fruits & légumes', DEMO_OTHER),
      item('Avocats', 'Fruits & légumes', DEMO_ME, { quantity: '3' }),
      item('Lait demi-écrémé', 'Frais', DEMO_OTHER, { place: 'both', quantity: '6' }),
      item('Comté', 'Frais', DEMO_ME),
      item('Pâtes', 'Épicerie', DEMO_ME, { place: 'drive', status: 'ordered' }),
      item('Café en grains', 'Épicerie', DEMO_OTHER, { place: 'drive' }),
      item('Eau pétillante', 'Boissons', DEMO_ME, { place: 'drive', quantity: '2 packs' }),
      item('Liquide vaisselle', 'Maison & hygiène', DEMO_OTHER),
      item('Couches taille 3', 'Bébé', DEMO_OTHER, { place: 'drive' }),
      item('Bananes', 'Fruits & légumes', DEMO_ME, { status: 'bought', bought_at: ago(1500) }),
      item('Beurre', 'Frais', DEMO_OTHER, { status: 'bought', bought_at: ago(3000) }),
    ],
    todos: [
      { id: uid(), title: 'Appeler le garage pour la révision', assignee: DEMO_ME, due_date: inDays(1), added_by: DEMO_OTHER, done_by: null, done_at: null, created_at: ago(200), repeat: null, ...noReminder },
      { id: uid(), title: 'Réserver le resto pour samedi', assignee: null, due_date: inDays(4), added_by: DEMO_ME, done_by: null, done_at: null, created_at: ago(400), repeat: null, ...noReminder, remind_at: inHours(3) },
      { id: uid(), title: 'Monter l’étagère du salon', assignee: null, due_date: null, added_by: DEMO_OTHER, done_by: null, done_at: null, created_at: ago(900), repeat: null, ...noReminder },
      { id: uid(), title: 'Sortir les poubelles', assignee: DEMO_ME, due_date: inDays(2), added_by: DEMO_OTHER, done_by: null, done_at: null, created_at: ago(950), repeat: 'week', ...noReminder },
      { id: uid(), title: 'Renvoyer le colis Zalando', assignee: DEMO_OTHER, due_date: inDays(-1), added_by: DEMO_OTHER, done_by: null, done_at: null, created_at: ago(2000), repeat: null, ...noReminder },
      { id: uid(), title: 'Acheter un cadeau pour Léa', assignee: null, due_date: null, added_by: DEMO_ME, done_by: DEMO_OTHER, done_at: ago(120), created_at: ago(3000), repeat: null, ...noReminder },
    ],
    lists: [
      { id: 'demo-list-valise', title: 'Valise week-end', emoji: '🧳', added_by: DEMO_OTHER, created_at: ago(5000) },
      { id: 'demo-list-ikea', title: 'Ikea', emoji: '🛋️', added_by: DEMO_ME, created_at: ago(3000) },
    ],
    list_items: [
      ...['Brosses à dents', 'Chargeurs', 'Pyjamas', 'Doudou de Noah', 'Couches', 'Papiers d’identité'].map((text, i) => ({
        id: uid(), list_id: 'demo-list-valise', text, done: i < 2, done_by: i < 2 ? DEMO_OTHER : null, added_by: DEMO_OTHER, created_at: ago(5000 - i), ...noReminder,
      })),
      ...['Étagère KALLAX blanche', 'Boîtes de rangement ×4', 'Lampe de chevet'].map((text, i) => ({
        id: uid(), list_id: 'demo-list-ikea', text, done: false, done_by: null, added_by: DEMO_ME, created_at: ago(3000 - i), ...noReminder,
      })),
    ],
    pings: [{ id: uid(), author: DEMO_OTHER, kind: 'shopping', place: 'store', created_at: ago(8) }],
    note_reactions: [{ id: uid(), note_id: 'demo-note-2', user_id: DEMO_OTHER, emoji: '❤️', created_at: ago(1400) }],
    notes: [
      { id: uid(), body: 'Bonne journée mon cœur, pense à prendre ton parapluie ☔️', author: DEMO_OTHER, created_at: ago(35) },
      { id: 'demo-note-2', body: 'J’ai réservé pour samedi soir, surprise 😉', author: DEMO_ME, created_at: ago(1440) },
    ],
  }
}
type GroceryCat = Tables['grocery_items']['category']

/** Valeurs que la base remplit elle-même : utilisées pour l'affichage immédiat (optimiste). */
export function rowDefaults(table: TableName, me: string) {
  const now = new Date().toISOString()
  if (table === 'grocery_items') return { status: 'todo', added_by: me, bought_at: null, created_at: now }
  if (table === 'todos')
    return { added_by: me, done_by: null, done_at: null, repeat: null, remind_at: null, remind_to: null, reminded_at: null, created_at: now }
  if (table === 'lists') return { added_by: me, created_at: now }
  if (table === 'list_items')
    return { done: false, done_by: null, added_by: me, remind_at: null, remind_to: null, reminded_at: null, created_at: now }
  if (table === 'pings') return { author: me, created_at: now }
  if (table === 'note_reactions') return { user_id: me, created_at: now }
  return { author: me, created_at: now }
}

export function demoBackend(): Backend {
  const write = (d: Data) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d))
    } catch {
      /* ignoré */
    }
  }
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
  const edit = (fn: (d: Data) => void) => {
    const d = read()
    fn(d)
    write(d)
  }
  const defaults = (table: TableName) => rowDefaults(table, DEMO_ME)

  return {
    me: DEMO_ME,
    load: async () => read(),
    reload: async (table) => read()[table],
    async insert(table, row) {
      edit((d) => {
        const rows = d[table] as unknown[]
        const full = { ...defaults(table), ...row }
        if (table === 'list_items') rows.push(full)
        else rows.unshift(full)
      })
    },
    async insertMany(table, rows) {
      for (const row of rows) await this.insert(table, row)
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
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key === KEY) TABLES.forEach(onChange)
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
