import type { Data } from '../data/backends'
import type { Product, Subscription } from './types'
import { daysBetween, nextDebitDate, parseISODate, today } from './dates'

const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)

export function totals(d: Data) {
  const income = sum(d.incomes)
  const charges = sum(d.charges)
  const subs = sum(d.subscriptions)
  return { income, charges, subs, left: income - charges - subs }
}

export interface Debit {
  id: string
  label: string
  amount: number
  date: Date
  days: number
  kind: 'Abonnement' | 'Charge'
}

export function upcomingDebits(d: Data, horizon = 7): Debit[] {
  const t = today()
  const items = [
    ...d.subscriptions.map((s) => ({ id: s.id, label: s.name, amount: s.amount, day: s.debit_day, kind: 'Abonnement' as const })),
    ...d.charges
      .filter((c) => c.debit_day != null)
      .map((c) => ({ id: c.id, label: c.label, amount: c.amount, day: c.debit_day!, kind: 'Charge' as const })),
  ]
  return items
    .map(({ day, ...rest }) => {
      const date = nextDebitDate(day, t)
      return { ...rest, date, days: daysBetween(t, date) }
    })
    .filter((x) => x.days <= horizon)
    .sort((a, b) => a.days - b.days || b.amount - a.amount)
}

export type DeadlineTone = 'urgent' | 'soon' | 'past' | null

export function deadlineInfo(s: Subscription): { days: number; date: Date; tone: DeadlineTone } | null {
  if (!s.cancel_deadline) return null
  const date = parseISODate(s.cancel_deadline)
  const days = daysBetween(today(), date)
  const tone: DeadlineTone = days < 0 ? 'past' : days <= 14 ? 'urgent' : days <= 60 ? 'soon' : null
  return { days, date, tone }
}

export function upcomingDeadlines(d: Data, horizon = 60) {
  return d.subscriptions
    .map((s) => ({ sub: s, info: deadlineInfo(s) }))
    .filter((x): x is { sub: Subscription; info: NonNullable<ReturnType<typeof deadlineInfo>> } =>
      !!x.info && x.info.days >= 0 && x.info.days <= horizon,
    )
    .sort((a, b) => a.info.days - b.info.days)
}

export const isLow = (p: Product) => p.stock <= p.threshold

/** Stock bas en tête (ruptures d'abord), puis ordre alphabétique. */
export function sortProducts(ps: Product[]) {
  return [...ps].sort((a, b) => {
    const la = isLow(a)
    const lb = isLow(b)
    if (la !== lb) return la ? -1 : 1
    if (la && a.stock !== b.stock) return a.stock - b.stock
    return a.name.localeCompare(b.name, 'fr')
  })
}
