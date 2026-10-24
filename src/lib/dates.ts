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
