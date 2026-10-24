import { addDays, daysBetween, today } from './dates'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/foyer-push`

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** « Aujourd'hui 18:30 », « Demain 09:00 », « Sam. 12/10 · 09:00 ». */
export function reminderLabel(iso: string) {
  const d = new Date(iso)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const n = daysBetween(today(), day)
  if (n === 0) return `Aujourd'hui ${hhmm(d)}`
  if (n === 1) return `Demain ${hhmm(d)}`
  if (n === -1) return `Hier ${hhmm(d)}`
  const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${hhmm(d)}`
}

/** Rappel proche (moins de 2 h) ou dépassé : on le fait ressortir. */
export const isUrgent = (iso: string) => new Date(iso).getTime() - Date.now() < 2 * 3_600_000

export type QuickReminder = 'hour' | 'tonight' | 'tomorrow'

export function quickReminder(q: QuickReminder) {
  const now = new Date()
  if (q === 'hour') return new Date(now.getTime() + 3_600_000).toISOString()
  if (q === 'tonight') {
    const d = new Date(now)
    d.setHours(19, 0, 0, 0)
    // Après 19 h, « ce soir » devient 21 h, puis demain soir.
    if (d <= now) d.setHours(21, 0, 0, 0)
    return (d <= now ? new Date(addDays(d, 1).setHours(19, 0, 0, 0)) : d).toISOString()
  }
  const d = addDays(today(), 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

/** Lien qui ouvre un événement avec alerte dans le calendrier du téléphone. */
export const calendarUrl = (title: string, iso: string) =>
  `${FUNCTION_URL}?ics=1&title=${encodeURIComponent(title)}&start=${encodeURIComponent(iso)}`
