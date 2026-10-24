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

export type Category = (typeof CATEGORIES)[number]['id']

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
}

export type TableName = keyof Tables
