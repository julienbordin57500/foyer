const DAY = 86_400_000

export const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const parseISODate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY)

export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Samedi qui vient (aujourd'hui si on est samedi). */
export const nextSaturday = (from = today()) => addDays(from, (6 - from.getDay() + 7) % 7)

/** Prochaine échéance d'une tâche qui revient. */
export function nextOccurrence(iso: string, repeat: 'day' | 'week' | '2weeks' | 'month') {
  const d = parseISODate(iso)
  const base = d < today() ? today() : d
  if (repeat === 'day') return toISODate(addDays(base, 1))
  if (repeat === 'week') return toISODate(addDays(d < today() ? nextSameWeekday(d) : d, 7))
  if (repeat === '2weeks') return toISODate(addDays(d < today() ? nextSameWeekday(d) : d, 14))
  const m = new Date(base)
  m.setMonth(m.getMonth() + 1)
  return toISODate(m)
}

/** Le même jour de la semaine que d, au plus tôt aujourd'hui. */
const nextSameWeekday = (d: Date) => addDays(today(), (d.getDay() - today().getDay() + 7) % 7)

/** Valeur pour <input type="datetime-local"> (heure locale). */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
