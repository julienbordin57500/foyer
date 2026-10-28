import { daysBetween, parseISODate, today } from './dates'

const pad = (n: number) => String(n).padStart(2, '0')

/** jj/mm */
export const ddmm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`

export const longDate = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

export const greeting = (d = new Date()) => {
  const h = d.getHours()
  if (h < 5 || h >= 18) return 'Bonsoir'
  return 'Bonjour'
}

/** « à l'instant », « il y a 5 min », « il y a 2 h », « hier », « le 12/10 ». */
export function ago(iso: string) {
  const d = new Date(iso)
  const min = Math.round((Date.now() - d.getTime()) / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const days = daysBetween(new Date(d.getFullYear(), d.getMonth(), d.getDate()), today())
  if (days === 0) return `il y a ${Math.round(min / 60)} h`
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  return `le ${ddmm(d)}`
}

/** Échéance d'une tâche : libellé + état. */
export function dueLabel(iso: string) {
  const days = daysBetween(today(), parseISODate(iso))
  const late = days < 0
  let text: string
  if (days === 0) text = "Aujourd'hui"
  else if (days === 1) text = 'Demain'
  else if (days === -1) text = 'Hier'
  else if (late) text = `Depuis le ${ddmm(parseISODate(iso))}`
  else if (days < 7)
    text = parseISODate(iso)
      .toLocaleDateString('fr-FR', { weekday: 'long' })
      .replace(/^./, (c) => c.toUpperCase())
  else text = `Le ${ddmm(parseISODate(iso))}`
  return { text, late, days }
}

/** « 6 œufs », « œufs x6 », « œufs ×6 », « crème fraîche 5 », « riz 2 kg » → quantité + nom. */
export function splitQuantity(input: string): { name: string; quantity: string | null } {
  const s = input.trim().replace(/\s+/g, ' ')
  let m = s.match(/^(\d+(?:[.,]\d+)?\s?(?:kg|g|l|cl|ml)?)\s+(.+)$/i)
  if (m) return { quantity: m[1], name: m[2] }
  m = s.match(/^(.+?)\s*[x×]\s?(\d+)$/i)
  if (m) return { quantity: m[2], name: m[1] }
  // Nombre à la fin, sauf s'il fait partie du nom (« couches taille 3 », « lait 1er âge »…).
  m = s.match(/^(.+?)\s(\d+(?:[.,]\d+)?\s?(?:kg|g|l|cl|ml)?)$/i)
  if (m && !/\b(taille|t|n°|no|num[ée]ro|[âa]ge|[ée]tape|type|mois|ans)$/i.test(m[1])) return { quantity: m[2], name: m[1] }
  return { name: s, quantity: null }
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
/** 1 234,50 € */
export const euros = (n: number) => eur.format(n)

/** « 12,5 » ou « 12.5 » → 12.5 */
export const parseAmount = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.').replace('€', ''))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}
