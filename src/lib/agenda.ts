import { useMemo } from 'react'
import type { Tab } from '../App'
import { useMember } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { addMonths, toISODate } from './dates'
import { euros } from './format'
import type { CalendarEvent } from './types'

export type AgendaKind = 'event' | 'memo' | 'todo' | 'bill' | 'list' | 'courses'

export type AgendaItem = {
  key: string
  kind: AgendaKind
  tab: Tab
  emoji: string
  text: string
  meta?: string
  /** hh:mm, pour trier la journée (les choses sans heure passent en premier). */
  time?: string
  event?: CalendarEvent
}

/** Une couleur par sorte, la même partout (points du calendrier, légende). */
export const AGENDA_COLORS: Record<AgendaKind, string> = {
  event: '#ffffff',
  memo: '#ff9ad5',
  todo: '#ffc65c',
  bill: '#5ec8f2',
  list: '#c4b5fd',
  courses: '#4ade9b',
}

export const AGENDA_LEGEND: { kind: AgendaKind; label: string }[] = [
  { kind: 'event', label: 'Événement' },
  { kind: 'memo', label: 'Pense-bête' },
  { kind: 'todo', label: 'Tâche' },
  { kind: 'bill', label: 'Facture' },
  { kind: 'list', label: 'Liste' },
  { kind: 'courses', label: 'Courses' },
]

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * Tout ce qui a une date dans le foyer, rangé par jour (yyyy-mm-dd) : événements et pense-bêtes,
 * tâches, rappels de listes, factures à payer, et courses qui reviennent toutes seules.
 */
export function useAgenda() {
  const { data } = useStore()
  const member = useMember()
  return useMemo(() => {
    const byDay = new Map<string, AgendaItem[]>()
    const add = (iso: string, item: AgendaItem) => byDay.set(iso, [...(byDay.get(iso) ?? []), item])

    for (const e of data.calendar_events)
      add(e.date, {
        key: e.id,
        kind: e.kind,
        tab: 'accueil',
        emoji: e.kind === 'memo' ? '📌' : '📅',
        text: e.title,
        meta: e.note ?? undefined,
        time: e.time?.slice(0, 5),
        event: e,
      })
    for (const t of data.todos)
      if (!t.done_at && t.due_date)
        add(t.due_date, {
          key: t.id,
          kind: 'todo',
          tab: 'afaire',
          emoji: '📝',
          text: t.title,
          meta: t.assignee ? `Pour ${member(t.assignee).isMe ? 'moi' : member(t.assignee).name}` : undefined,
          time: t.remind_at ? hhmm(new Date(t.remind_at)) : undefined,
        })
    for (const i of data.list_items)
      if (!i.done && i.remind_at) {
        const at = new Date(i.remind_at)
        const list = data.lists.find((l) => l.id === i.list_id)
        add(toISODate(at), {
          key: i.id,
          kind: 'list',
          tab: 'listes',
          emoji: list?.emoji ?? '🔔',
          text: i.text,
          meta: list?.title,
          time: hhmm(at),
        })
      }
    for (const b of data.bills)
      if (!b.paid_at)
        add(b.due_date, {
          key: b.id,
          kind: 'bill',
          tab: 'factures',
          emoji: '💶',
          text: `${b.title} · ${euros(b.amount)}`,
          meta: b.auto_debit ? 'Prélevé tout seul' : 'À payer',
        })
    for (const g of data.grocery_items)
      if (g.status === 'bought' && g.repeat_months && g.bought_at)
        add(toISODate(addMonths(new Date(g.bought_at), g.repeat_months)), {
          key: g.id,
          kind: 'courses',
          tab: 'courses',
          emoji: '🛒',
          text: `${g.name} revient sur la liste`,
        })

    for (const items of byDay.values()) items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    return (iso: string) => byDay.get(iso) ?? []
  }, [data, member])
}
