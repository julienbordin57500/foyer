import { useMemo } from 'react'
import type { Tab } from '../App'
import { useMember } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { addDays, addMonths, daysBetween, parseISODate, toISODate, today } from './dates'
import { holidays } from './holidays'
import { euros } from './format'
import type { CalendarEvent } from './types'

export type AgendaKind = 'event' | 'memo' | 'todo' | 'bill' | 'list' | 'courses' | 'holiday'

export type AgendaItem = {
  key: string
  kind: AgendaKind
  tab: Tab
  emoji: string
  text: string
  meta?: string
  /** hh:mm, pour trier la journée (les choses sans heure passent en premier). */
  time?: string
  /** Couleur de sa pastille : celle de son calendrier iPhone, sinon celle de sa sorte. */
  color: string
  /** Pour masquer d'un appui dans la légende : le calendrier iPhone d'origine, sinon la sorte. */
  group: string
  /** Événement sur plusieurs jours : ce jour en est-il le premier, le dernier ? (barre continue) */
  span?: { first: boolean; last: boolean }
  event?: CalendarEvent
}

/** Une couleur par sorte, la même partout (points du calendrier, légende). */
export const AGENDA_COLORS: Record<AgendaKind, string> = {
  event: '#7c83ff',
  memo: '#f783ac',
  todo: '#ffc65c',
  bill: '#5ec8f2',
  list: '#c4b5fd',
  courses: '#4ade9b',
  holiday: '#94a3b8',
}

/** Couleurs proposées pour les événements et les calendriers de l'iPhone. */
export const FEED_COLORS = ['#7c83ff', '#ff6b6b', '#ffa94d', '#ffd43b', '#51cf66', '#22d3ee', '#4dabf7', '#b197fc', '#f783ac']

export const AGENDA_LEGEND: { kind: AgendaKind; label: string }[] = [
  { kind: 'event', label: 'Événement' },
  { kind: 'memo', label: 'Pense-bête' },
  { kind: 'todo', label: 'Tâche' },
  { kind: 'bill', label: 'Facture' },
  { kind: 'list', label: 'Liste' },
  { kind: 'courses', label: 'Courses' },
  { kind: 'holiday', label: 'Fériés' },
]

/** Dates de début d'un événement (une seule, ou chaque semaine / mois / année) dans la fenêtre. */
function occurrences(date: string, repeat: CalendarEvent['repeat'], from: Date, to: Date): Date[] {
  const first = parseISODate(date)
  if (!repeat) return [first]
  const out: Date[] = []
  for (let i = 0; out.length < 400; i++) {
    const d = repeat === 'week' ? addDays(first, 7 * i) : addMonths(first, repeat === 'year' ? 12 * i : i)
    if (d > to) break
    if (d >= from) out.push(d)
  }
  return out
}

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

    // Fenêtre affichée : un an en arrière, deux ans devant (pour les répétitions).
    const from = addDays(today(), -366)
    const to = addDays(today(), 731)
    for (const e of data.calendar_events) {
      const length = e.end_date ? Math.min(62, Math.max(0, daysBetween(parseISODate(e.date), parseISODate(e.end_date)))) : 0
      for (const start of occurrences(e.date, e.repeat, from, to))
        for (let d = 0; d <= length; d++)
          add(toISODate(addDays(start, d)), {
            key: `${e.id}|${toISODate(start)}|${d}`,
            kind: e.kind,
            group: e.feed_id ?? e.kind,
            tab: 'accueil',
            emoji: e.kind === 'memo' ? '📌' : '📅',
            text: e.title,
            meta: e.note ?? undefined,
            time: d === 0 ? e.time?.slice(0, 5) : undefined,
            color: e.color ?? AGENDA_COLORS[e.kind],
            span: length ? { first: d === 0, last: d === length } : undefined,
            event: e,
          })
    }
    for (let y = today().getFullYear() - 1; y <= today().getFullYear() + 2; y++)
      for (const [iso, name] of holidays(y))
        add(iso, {
          key: `ferie-${iso}`,
          kind: 'holiday',
          group: 'holiday',
          tab: 'accueil',
          emoji: '🇫🇷',
          text: name,
          meta: 'Jour férié',
          color: AGENDA_COLORS.holiday,
        })
    for (const t of data.todos)
      if (!t.done_at && t.due_date)
        add(t.due_date, {
          key: t.id,
          kind: 'todo',
          group: 'todo',
          color: AGENDA_COLORS.todo,
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
          group: 'list',
          color: AGENDA_COLORS.list,
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
          group: 'bill',
          color: AGENDA_COLORS.bill,
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
          group: 'courses',
          color: AGENDA_COLORS.courses,
          tab: 'courses',
          emoji: '🛒',
          text: `${g.name} revient sur la liste`,
        })

    for (const items of byDay.values()) items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    return (iso: string) => byDay.get(iso) ?? []
  }, [data, member])
}
