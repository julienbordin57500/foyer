export const CATEGORIES = [
  { id: 'Fruits & légumes', emoji: '🥕' },
  { id: 'Frais', emoji: '🧀' },
  { id: 'Épicerie', emoji: '🍝' },
  { id: 'Surgelés', emoji: '🧊' },
  { id: 'Boissons', emoji: '🥤' },
  { id: 'Maison & hygiène', emoji: '🧴' },
  { id: 'Bébé', emoji: '🍼' },
  { id: 'Autre', emoji: '🛒' },
] as const

/** Rayons proposés d'office ; « Autre » reste toujours en dernier. */
export type BuiltinCategory = (typeof CATEGORIES)[number]['id']
/** Un rayon d'office, ou un rayon créé à la main par le foyer. */
export type Category = string

/** Rayon créé à la main : proposé ensuite pour tous les articles. */
export interface GroceryCategory {
  id: string
  name: string
  emoji: string
  created_at: string
}

/** Liste de courses à part (traiteur…), partagée avec le foyer mais séparée des courses de la maison. */
export interface GroceryList {
  id: string
  owner: string
  name: string
  emoji: string
  /** Petite note en haut de la liste : « Paella 40 pers. – samedi ». */
  note: string | null
  created_at: string
}

export type GroceryStatus = 'todo' | 'ordered' | 'bought'
/** Où l'acheter : en magasin, au drive, ou l'un ou l'autre. */
export type Place = 'store' | 'drive' | 'both'

export interface GroceryItem {
  id: string
  name: string
  quantity: string | null
  category: Category
  place: Place
  status: GroceryStatus
  /** Liste à part (traiteur…) ; null = les courses de la maison. */
  list_id: string | null
  added_by: string
  bought_at: string | null
  created_at: string
}

export type Repeat = 'day' | 'week' | '2weeks' | 'month'

/** Rappel à l'heure choisie (notification), sur une tâche ou un élément de liste. */
export interface Remindable {
  remind_at: string | null // ISO
  remind_to: string | null // null = tous les deux
  reminded_at: string | null
}

export interface Todo extends Remindable {
  id: string
  title: string
  assignee: string | null // null = tous les deux
  due_date: string | null // yyyy-mm-dd
  repeat: Repeat | null
  added_by: string
  done_by: string | null
  done_at: string | null
  created_at: string
}

export interface Note {
  id: string
  body: string
  author: string
  created_at: string
}

export const REACTIONS = ['❤️', '😂', '😘', '👍', '🥹'] as const
export type Reaction = (typeof REACTIONS)[number]

export interface NoteReaction {
  id: string
  note_id: string
  user_id: string
  emoji: Reaction
  created_at: string
}

export interface Member {
  user_id: string
  display_name: string
  gender?: 'f' | 'm' | null
}

export interface List {
  id: string
  title: string
  emoji: string
  added_by: string
  created_at: string
}

export interface ListItem extends Remindable {
  id: string
  list_id: string
  text: string
  done: boolean
  done_by: string | null
  added_by: string
  created_at: string
}

export interface Ping {
  id: string
  author: string
  kind: 'shopping'
  place: 'store' | 'drive' | null
  created_at: string
}

export type BillRepeat = 'month' | 'quarter' | 'year'

export interface Bill {
  id: string
  title: string
  amount: number
  due_date: string // yyyy-mm-dd
  assignee: string | null // null = tous les deux
  repeat: BillRepeat | null
  auto_debit: boolean
  shared: boolean
  paid_at: string | null
  paid_by: string | null
  settled: boolean
  added_by: string
  created_at: string
}

/** Catégories des charges fixes (ordre fixe : il donne aussi la couleur du graphique). */
export const CHARGE_CATEGORIES = [
  { id: 'Logement', emoji: '🏠' },
  { id: 'Énergie', emoji: '⚡' },
  { id: 'Assurance', emoji: '🛡️' },
  { id: 'Transport', emoji: '🚗' },
  { id: 'Alimentation', emoji: '🛒' },
  { id: 'Loisirs', emoji: '🎉' },
  { id: 'Santé', emoji: '🩺' },
  { id: 'Autre', emoji: '💶' },
] as const
export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number]['id']
export type Every = 1 | 2 | 3 | 6 | 12

export interface Charge {
  id: string
  label: string
  category: ChargeCategory
  amount: number
  every_months: Every
  debit_day: number | null
  created_at: string
}

export interface Household {
  id: string
  name: string
  invite_code: string
}

export interface Tables {
  grocery_items: GroceryItem
  todos: Todo
  notes: Note
  lists: List
  list_items: ListItem
  note_reactions: NoteReaction
  pings: Ping
  bills: Bill
  charges: Charge
  grocery_categories: GroceryCategory
  grocery_lists: GroceryList
}

export type TableName = keyof Tables
