const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eurRound = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export const money = (n: number) => eur.format(n)
export const moneyRound = (n: number) => eurRound.format(n)

const pad = (n: number) => String(n).padStart(2, '0')

/** jj/mm */
export const ddmm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`

/** jj/mm/aaaa */
export const ddmmyyyy = (d: Date) => `${ddmm(d)}/${d.getFullYear()}`

export const weekday = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')

export const monthLabel = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

/** Accepte « 12,50 » comme « 12.50 ». */
export const parseAmount = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export const relativeDays = (days: number) => {
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'demain'
  if (days < 0) return `il y a ${-days} j`
  return `dans ${days} j`
}
