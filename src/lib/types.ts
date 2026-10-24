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

export interface GroceryItem {
  id: string
  name: string
  quantity: string | null
  category: Category
  drive: boolean
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
}

export type TableName = keyof Tables
