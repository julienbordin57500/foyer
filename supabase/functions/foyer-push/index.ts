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
    return {
      recipients: others(r.added_by),
      title: '🧺 Courses',
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
    const where = r.place === 'drive' ? 'récupérer le drive' : 'faire les courses'
    return {
      recipients: others(r.author),
      title: `🛒 ${name(r.author)} part ${where}`,
      body: 'Ajoute vite ce qui manque à la liste !',
      tab: 'courses',
      throttle: 'ping',
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
