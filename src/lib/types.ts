export const CATEGORIES = [
  'Logement',
  'Énergie',
  'Assurance',
  'Transport',
  'Alimentation',
  'Loisirs',
  'Santé',
  'Autre',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface Product {
  id: string
  name: string
  stock: number
  threshold: number
}

export interface Subscription {
  id: string
  name: string
  amount: number
  debit_day: number
  cancel_deadline: string | null // ISO yyyy-mm-dd
}

export interface Charge {
  id: string
  label: string
  category: Category
  amount: number
  debit_day: number | null
}

export interface Income {
  id: string
  label: string
  amount: number
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
  products: Product
  subscriptions: Subscription
  charges: Charge
  incomes: Income
}

export type TableName = keyof Tables
