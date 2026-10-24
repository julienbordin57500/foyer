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

export interface Todo {
  id: string
  title: string
  assignee: string | null // null = tous les deux
  due_date: string | null // yyyy-mm-dd
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

export interface ListItem {
  id: string
  list_id: string
  text: string
  done: boolean
  done_by: string | null
  added_by: string
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
}

export type TableName = keyof Tables
