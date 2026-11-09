import { addDays, toISODate } from './dates'

/** Dimanche de Pâques (calcul de Meeus), pour les fêtes qui en dépendent. */
function easter(y: number) {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month - 1, day)
}

/**
 * Jours fériés en Moselle (le foyer est à Saint-Avold) : les fêtes nationales, plus le Vendredi saint
 * et la Saint-Étienne (26 décembre), propres à l'Alsace-Moselle. Calculés ici, sans service extérieur.
 */
export function holidays(year: number): Map<string, string> {
  const p = easter(year)
  const fixed = (m: number, d: number) => toISODate(new Date(year, m - 1, d))
  return new Map([
    [fixed(1, 1), "Jour de l'an"],
    [toISODate(addDays(p, -2)), 'Vendredi saint'],
    [toISODate(addDays(p, 1)), 'Lundi de Pâques'],
    [fixed(5, 1), 'Fête du Travail'],
    [fixed(5, 8), 'Victoire 1945'],
    [toISODate(addDays(p, 39)), 'Ascension'],
    [toISODate(addDays(p, 50)), 'Lundi de Pentecôte'],
    [fixed(7, 14), 'Fête nationale'],
    [fixed(8, 15), 'Assomption'],
    [fixed(11, 1), 'Toussaint'],
    [fixed(11, 11), 'Armistice'],
    [fixed(12, 25), 'Noël'],
    [fixed(12, 26), 'Saint-Étienne'],
  ])
}
