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

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

/** Prochaine date de prélèvement pour un jour du mois donné (le 31 tombe le dernier jour des mois courts). */
export const nextDebitDate = (day: number, from = today()) => {
  const y = from.getFullYear()
  const m = from.getMonth()
  const thisMonth = new Date(y, m, Math.min(day, daysInMonth(y, m)))
  if (thisMonth >= from) return thisMonth
  return new Date(y, m + 1, Math.min(day, daysInMonth(y, m + 1)))
}
