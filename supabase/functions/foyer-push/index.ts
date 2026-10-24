// Foyer — envoi des notifications.
// GET  : renvoie la clé publique (les clés sont créées ici au premier appel et restent sur le serveur).
// POST : appelé par la base (déclencheurs) avec le secret partagé ; prévient l'autre membre du foyer.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method === 'GET') return json({ publicKey: (await vapidKeys()).public_key })
  if (req.method !== 'POST') return json({ error: 'Méthode non prise en charge' }, 405)

  const { data: secret } = await sb.rpc('foyer_push_secret')
  if (!secret || req.headers.get('x-foyer-secret') !== secret) return json({ error: 'Non autorisé' }, 401)

  const { table, record } = await req.json()
  const msg = await buildMessage(table, record)
  if (!msg || msg.recipients.length === 0) return json({ sent: 0 })

  const recipients = []
  for (const u of msg.recipients) if (!msg.throttle || (await allowed(u, msg.throttle))) recipients.push(u)
  if (!recipients.length) return json({ sent: 0, throttled: true })

  const keys = await vapidKeys()
  webpush.setVapidDetails(APP_URL, keys.public_key, keys.private_key)
  const { data: subs } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', recipients)

  let sent = 0
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: `${APP_URL}#${msg.tab}` })
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
  return json({ sent })
})
