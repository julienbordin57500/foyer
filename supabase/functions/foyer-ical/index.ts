// Foyer — import des calendriers de l'iPhone (lien iCloud « Calendrier public »).
// POST, appelé par l'appli avec la connexion de la personne : on n'agit qu'en son nom (règles d'accès de la base),
// on ne lit que ses propres liens, et on n'accepte que des adresses icloud.com.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const DAY = 86_400_000
const MAX_BYTES = 5_000_000
const MAX_EVENTS = 800

type Feed = { id: string; household_id: string; name: string; url: string; private: boolean }
type Occurrence = { uid: string; title: string; date: string; time: string | null; note: string | null }

// ─── Lecture du fichier .ics ───────────────────────────────────────────────
const unfold = (ics: string) =>
  ics
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
const unescape = (s: string) =>
  s
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim()

/** Date de début → jour et heure à Paris. Les heures « flottantes » ou avec fuseau sont prises telles quelles. */
function parseStart(params: string, value: string): { date: string; time: string | null } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, , z] = m
  if (params.includes('VALUE=DATE') || !h) return { date: `${y}-${mo}-${d}`, time: null }
  if (!z) return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` }
  const utc = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
  const p = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(utc)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {})
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const atNoon = (s: string) => new Date(`${s}T12:00:00Z`)
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Répétitions simples (tous les jours, semaines, mois, ans), limitées à la fenêtre d'import. */
function expand(start: string, rule: string | null, exdates: Set<string>, from: Date, to: Date): string[] {
  if (!rule) return [start]
  const r = Object.fromEntries(rule.split(';').map((kv) => kv.split('=')))
  const freq = r.FREQ
  const interval = Math.max(1, Number(r.INTERVAL ?? 1))
  const count = r.COUNT ? Number(r.COUNT) : Infinity
  const until = r.UNTIL ? atNoon(`${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}`) : to
  const byday: string[] = freq === 'WEEKLY' && r.BYDAY ? r.BYDAY.split(',').map((x: string) => x.slice(-2)) : []
  const out: string[] = []
  let n = 0
  const first = atNoon(start)
  for (let i = 0; n < count && out.length < MAX_EVENTS; i++) {
    let days: Date[]
    if (freq === 'DAILY') days = [new Date(first.getTime() + i * interval * DAY)]
    else if (freq === 'WEEKLY') {
      const week = new Date(first.getTime() + i * interval * 7 * DAY)
      days = byday.length ? byday.map((w) => new Date(week.getTime() + ((WEEKDAYS.indexOf(w) - week.getUTCDay() + 7) % 7) * DAY)) : [week]
    } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
      const d = new Date(first)
      d.setUTCMonth(d.getUTCMonth() + i * interval * (freq === 'YEARLY' ? 12 : 1))
      if (d.getUTCDate() !== first.getUTCDate()) continue // pas de 31 février
      days = [d]
    } else return [start]
    for (const d of days.sort((a, b) => a.getTime() - b.getTime())) {
      if (d < first) continue
      if (d > until || d > to || n >= count) return out
      n++
      const s = iso(d)
      if (d >= from && !exdates.has(s)) out.push(s)
    }
  }
  return out
}

function parseIcs(ics: string, from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = []
  let ev: Record<string, string> | null = null
  let exdates = new Set<string>()
  for (const line of unfold(ics)) {
    if (line === 'BEGIN:VEVENT') {
      ev = {}
      exdates = new Set()
      continue
    }
    if (line === 'END:VEVENT' && ev) {
      const start = ev.DTSTART ? parseStart(ev.DTSTART_PARAMS ?? '', ev.DTSTART) : null
      if (start && ev.SUMMARY && ev.STATUS !== 'CANCELLED' && !ev['RECURRENCE-ID'])
        for (const date of expand(start.date, ev.RRULE ?? null, exdates, from, to))
          if (atNoon(date) >= from && atNoon(date) <= to)
            out.push({
              uid: `${ev.UID ?? ev.SUMMARY}|${date}`.slice(0, 400),
              title: unescape(ev.SUMMARY).slice(0, 80) || 'Événement',
              date,
              time: start.time,
              note: unescape([ev.LOCATION, ev.DESCRIPTION].filter(Boolean).join(' · ')).slice(0, 300) || null,
            })
      ev = null
      if (out.length >= MAX_EVENTS) break
      continue
    }
    if (!ev) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const [name, ...params] = line.slice(0, i).split(';')
    const value = line.slice(i + 1)
    if (name === 'EXDATE') for (const v of value.split(',')) exdates.add(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`)
    else if (!(name in ev)) {
      ev[name] = value
      if (name === 'DTSTART') ev.DTSTART_PARAMS = params.join(';')
    }
  }
  return out
}

// ─── Import ────────────────────────────────────────────────────────────────
async function download(url: string) {
  const u = new URL(url.replace(/^webcal:/i, 'https:'))
  if (u.protocol !== 'https:' || !/(^|\.)icloud\.com$/i.test(u.hostname)) throw new Error('Ce lien ne vient pas d’iCloud.')
  const res = await fetch(u, { signal: AbortSignal.timeout(15_000), redirect: 'follow' })
  if (!res.ok) throw new Error('iCloud ne répond pas pour ce lien (est-il toujours public ?).')
  const text = await res.text()
  if (text.length > MAX_BYTES) throw new Error('Calendrier trop gros.')
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Ce lien n’est pas un calendrier.')
  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Méthode non prise en charge' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Non connecté' }, 401)

  // On agit au nom de la personne connectée : la base n'autorise que ses propres liens et son foyer.
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: user } = await sb.auth.getUser()
  if (!user.user) return json({ error: 'Non connecté' }, 401)

  const { data: feeds, error } = await sb.from('calendar_feeds').select('id, household_id, name, url, private')
  if (error) return json({ error: error.message }, 400)

  const from = new Date(Date.now() - 30 * DAY)
  const to = new Date(Date.now() + 365 * DAY)
  const results = []
  for (const f of (feeds ?? []) as Feed[]) {
    try {
      const events = parseIcs(await download(f.url), from, to)
      const rows = events.map((e) => ({
        household_id: f.household_id,
        title: e.title,
        kind: 'event',
        date: e.date,
        time: e.time,
        note: e.note,
        private: f.private,
        feed_id: f.id,
        source_uid: e.uid,
        added_by: user.user.id,
      }))
      for (let i = 0; i < rows.length; i += 200) {
        const { error: upErr } = await sb.from('calendar_events').upsert(rows.slice(i, i + 200), { onConflict: 'feed_id,source_uid' })
        if (upErr) throw new Error(upErr.message)
      }
      // Ce qui a disparu de l'iPhone disparaît aussi de Foyer (seulement dans la fenêtre importée).
      const keep = new Set(rows.map((r) => r.source_uid))
      const { data: existing } = await sb.from('calendar_events').select('id, source_uid').eq('feed_id', f.id).gte('date', iso(from))
      const gone = (existing ?? []).filter((e) => !keep.has(e.source_uid)).map((e) => e.id)
      for (let i = 0; i < gone.length; i += 100)
        await sb
          .from('calendar_events')
          .delete()
          .in('id', gone.slice(i, i + 100))
      await sb.from('calendar_feeds').update({ synced_at: new Date().toISOString() }).eq('id', f.id)
      results.push({ name: f.name, imported: rows.length, removed: gone.length })
    } catch (e) {
      results.push({ name: f.name, error: (e as Error).message })
    }
  }
  return json({ results })
})
