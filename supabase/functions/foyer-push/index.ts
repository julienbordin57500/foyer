// Foyer — envoi des notifications.
// GET        : renvoie la clé publique (les clés sont créées ici au premier appel et restent sur le serveur).
// GET ?ics=1 : fichier calendrier (événement + alerte) pour « Ajouter au calendrier ».
// POST       : appelé par la base (déclencheurs, rappels chaque minute) avec le secret partagé.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const APP_URL = 'https://julienbordin57500.github.io/foyer/'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function vapidKeys() {
  const { data } = await sb.from('foyer_push_keys').select('public_key, private_key').maybeSingle()
  if (data) return data
  const k = webpush.generateVAPIDKeys()
  const { error } = await sb.from('foyer_push_keys').insert({ id: 1, public_key: k.publicKey, private_key: k.privateKey })
  if (error) {
    // Un autre appel les a créées en même temps : on relit.
    const { data: again } = await sb.from('foyer_push_keys').select('public_key, private_key').single()
    return again!
  }
  return { public_key: k.publicKey, private_key: k.privateKey }
}

type Message = { recipients: string[]; title: string; body: string; tab: string; throttle?: string }

async function buildMessage(table: string, r: Record<string, any>): Promise<Message | null> {
  const { data: members } = await sb.from('members').select('user_id, display_name').eq('household_id', r.household_id)
  if (!members?.length) return null
  const name = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? 'Quelqu’un'
  const others = (author: string) => members.filter((m) => m.user_id !== author).map((m) => m.user_id)

  if (table === 'notes') {
    return { recipients: others(r.author), title: `💌 ${name(r.author)}`, body: r.body, tab: 'accueil' }
  }
  if (table === 'grocery_items') {
    if (r.list_id) return null // liste à part : personne d'autre ne la voit
    return {
      recipients: others(r.added_by),
      title: '🛒 Courses',
      body: `${name(r.added_by)} a ajouté ${r.name}${r.quantity ? ` (× ${r.quantity})` : ''}`,
      tab: 'courses',
      throttle: 'courses', // une notification toutes les 10 minutes au plus
    }
  }
  if (table === 'todos') {
    const to = r.assignee ? (r.assignee === r.added_by ? [] : [r.assignee]) : others(r.added_by)
    return { recipients: to, title: `📝 ${name(r.added_by)}`, body: r.title, tab: 'afaire' }
  }
  if (table === 'pings') {
    return {
      recipients: others(r.author),
      title: `🛒 ${name(r.author)} part faire les courses`,
      body: 'Ajoute vite ce qui manque à la liste !',
      tab: 'courses',
      throttle: 'ping',
    }
  }
  if (table === 'bills') {
    // Les prélèvements qui se renouvellent tout seuls ne valent pas une notification.
    if (r.auto_debit) return null
    return {
      recipients: others(r.added_by),
      title: `💶 ${name(r.added_by)} a ajouté une facture`,
      body: `${r.title} · ${euros(r.amount)} avant le ${ddmm(r.due_date)}`,
      tab: 'factures',
    }
  }
  if (table === 'note_reactions') {
    const { data: note } = await sb.from('notes').select('author, body').eq('id', r.note_id).single()
    if (!note || note.author === r.user_id) return null
    return { recipients: [note.author], title: `${r.emoji} ${name(r.user_id)}`, body: `a réagi à « ${note.body.slice(0, 60)} »`, tab: 'accueil' }
  }
  return null
}

async function allowed(user: string, kind: string) {
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data } = await sb.from('foyer_push_log').select('sent_at').eq('user_id', user).eq('kind', kind).gte('sent_at', since).maybeSingle()
  if (data) return false
  await sb.from('foyer_push_log').upsert({ user_id: user, kind, sent_at: new Date().toISOString() })
  return true
}

const euros = (n: number | string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n))
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const parisNow = () => {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {})
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const addMonthsISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.toISOString().slice(0, 10)
}
const nextBillDate = (iso: string, repeat: string) => addMonthsISO(iso, repeat === 'year' ? 12 : repeat === 'quarter' ? 3 : 1)

/** Factures : rappel 3 jours avant, puis le jour même ; les prélèvements se cochent seuls le jour J. */
async function billReminders(recipientsOf: (h: string, to: string | null) => Promise<string[]>) {
  const { day, hour } = parisNow()
  if (hour < 9 || hour > 20) return 0
  let sent = 0
  const cols = 'id, household_id, title, amount, due_date, assignee, repeat, auto_debit, shared, added_by'

  const { data: due } = await sb
    .from('bills')
    .update({ reminded_due: true, reminded_soon: true })
    .is('paid_at', null)
    .eq('auto_debit', false)
    .eq('reminded_due', false)
    .lte('due_date', day)
    .select(cols)
  for (const b of due ?? [])
    sent += await send(
      await recipientsOf(b.household_id, b.assignee),
      b.due_date < day ? '💶 Facture en retard' : "💶 À payer aujourd'hui",
      `${b.title} · ${euros(b.amount)}`,
      'factures',
    )

  const { data: soon } = await sb
    .from('bills')
    .update({ reminded_soon: true })
    .is('paid_at', null)
    .eq('auto_debit', false)
    .eq('reminded_soon', false)
    .lte('due_date', addDaysISO(day, 3))
    .select(cols)
  for (const b of soon ?? [])
    sent += await send(await recipientsOf(b.household_id, b.assignee), '💶 Facture à payer bientôt', `${b.title} · ${euros(b.amount)} avant le ${ddmm(b.due_date)}`, 'factures')

  // Prélèvements : payés tout seuls le jour J, et la prochaine échéance se crée.
  const { data: auto } = await sb
    .from('bills')
    .update({ paid_at: new Date().toISOString() })
    .is('paid_at', null)
    .eq('auto_debit', true)
    .lte('due_date', day)
    .select(cols)
  for (const b of auto ?? [])
    if (b.repeat)
      await sb.from('bills').insert({
        household_id: b.household_id,
        title: b.title,
        amount: b.amount,
        due_date: nextBillDate(b.due_date, b.repeat),
        assignee: b.assignee,
        repeat: b.repeat,
        auto_debit: true,
        shared: b.shared,
        added_by: b.added_by,
      })
  return sent
}

/** Le point du matin, à 9 h (Paris) : une seule notification par personne, seulement s'il y a quelque chose. */
async function morningDigest() {
  const { day, hour } = parisNow()
  if (hour !== 9) return 0
  const { data: members } = await sb
    .from('members')
    .update({ digest_sent_on: day })
    .eq('morning_digest', true)
    .or(`digest_sent_on.is.null,digest_sent_on.lt.${day}`)
    .select('user_id, household_id')
  let sent = 0
  for (const m of members ?? []) {
    const h = m.household_id
    const [todos, bills, groceries] = await Promise.all([
      sb.from('todos').select('due_date, assignee').eq('household_id', h).is('done_at', null).lte('due_date', day),
      sb.from('bills').select('title, due_date').eq('household_id', h).is('paid_at', null).lte('due_date', addDaysISO(day, 1)),
      sb.from('grocery_items').select('id', { count: 'exact', head: true }).eq('household_id', h).is('list_id', null).neq('status', 'bought'),
    ])
    const mine = (todos.data ?? []).filter((t) => !t.assignee || t.assignee === m.user_id)
    const late = mine.filter((t) => t.due_date < day).length
    const parts: string[] = []
    if (mine.length) parts.push(`${mine.length} chose${mine.length > 1 ? 's' : ''} à faire${late ? ` (dont ${late} en retard)` : ''}`)
    for (const b of bills.data ?? []) parts.push(`${b.title} ${b.due_date < day ? 'en retard' : b.due_date === day ? "aujourd'hui" : 'demain'}`)
    if (groceries.count) parts.push(`${groceries.count} article${groceries.count > 1 ? 's' : ''} en courses`)
    if (parts.length) sent += await send([m.user_id], '☀️ Aujourd’hui', parts.join(' · '), mine.length ? 'afaire' : 'accueil')
  }
  return sent
}

// ─── Calendrier ────────────────────────────────────────────────────────────
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n').slice(0, 200)

function calendar(url: URL) {
  const title = url.searchParams.get('title') ?? 'Rappel Foyer'
  const start = new Date(url.searchParams.get('start') ?? '')
  if (isNaN(start.getTime())) return json({ error: 'Date invalide' }, 400)
  const end = new Date(start.getTime() + 15 * 60_000)
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Foyer//FR',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@foyer`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`,
    `URL:${APP_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return new Response(body, {
    headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="foyer.ics"' },
  })
}

// ─── Envoi ─────────────────────────────────────────────────────────────────
async function send(recipients: string[], title: string, body: string, tab: string) {
  if (!recipients.length) return 0
  const keys = await vapidKeys()
  webpush.setVapidDetails(APP_URL, keys.public_key, keys.private_key)
  const { data: subs } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', recipients)
  let sent = 0
  const payload = JSON.stringify({ title, body, url: `${APP_URL}#${tab}` })
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 })
        sent++
      } catch (e) {
        // Téléphone désinscrit ou appli supprimée : on oublie cet abonnement.
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }),
  )
  return sent
}

/** Rappels arrivés à échéance : on les « réserve » d'abord (reminded_at) pour ne jamais les envoyer deux fois. */
async function sendReminders() {
  const now = new Date().toISOString()
  const { data: todos } = await sb
    .from('todos')
    .update({ reminded_at: now })
    .lte('remind_at', now)
    .is('reminded_at', null)
    .is('done_at', null)
    .select('household_id, title, remind_to')
  const { data: items } = await sb
    .from('list_items')
    .update({ reminded_at: now })
    .lte('remind_at', now)
    .is('reminded_at', null)
    .eq('done', false)
    .select('household_id, text, remind_to, list_id')

  const recipientsOf = async (household: string, to: string | null) => {
    if (to) return [to]
    const { data } = await sb.from('members').select('user_id').eq('household_id', household)
    return (data ?? []).map((m) => m.user_id)
  }
  let sent = 0
  for (const t of todos ?? []) sent += await send(await recipientsOf(t.household_id, t.remind_to), '🔔 Rappel', t.title, 'afaire')
  for (const i of items ?? []) {
    const { data: list } = await sb.from('lists').select('title, emoji').eq('id', i.list_id).maybeSingle()
    sent += await send(await recipientsOf(i.household_id, i.remind_to), `🔔 ${list ? `${list.emoji} ${list.title}` : 'Rappel'}`, i.text, 'listes')
  }
  sent += await billReminders(recipientsOf)
  sent += await morningDigest()
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method === 'GET') {
    const url = new URL(req.url)
    if (url.searchParams.has('ics')) return calendar(url)
    return json({ publicKey: (await vapidKeys()).public_key })
  }
  if (req.method !== 'POST') return json({ error: 'Méthode non prise en charge' }, 405)

  const { data: secret } = await sb.rpc('foyer_push_secret')
  if (!secret || req.headers.get('x-foyer-secret') !== secret) return json({ error: 'Non autorisé' }, 401)

  const { table, record } = await req.json()
  if (table === 'reminders') return json({ sent: await sendReminders() })
  const msg = await buildMessage(table, record)
  if (!msg || msg.recipients.length === 0) return json({ sent: 0 })

  const recipients = []
  for (const u of msg.recipients) if (!msg.throttle || (await allowed(u, msg.throttle))) recipients.push(u)
  if (!recipients.length) return json({ sent: 0, throttled: true })

  const sent = await send(recipients, msg.title, msg.body, msg.tab)
  return json({ sent })
})
