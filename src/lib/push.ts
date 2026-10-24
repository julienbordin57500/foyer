import { supabase } from './supabase'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/foyer-push`

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

export async function pushState(): Promise<PushState> {
  if (!supabase) return 'unsupported'
  // Sur iPhone, les notifications ne marchent que dans l'app installée sur l'écran d'accueil.
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Doit être appelé depuis un appui de l'utilisateur (le téléphone demande l'autorisation). */
export async function enablePush(householdId: string) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return pushState()
  const reg = await navigator.serviceWorker.ready
  const { publicKey } = await fetch(FUNCTION_URL).then((r) => r.json())
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }))
  const json = sub.toJSON()
  const { error } = await supabase!.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    household_id: householdId,
    p256dh: json.keys!.p256dh,
    auth: json.keys!.auth,
  })
  if (error) throw new Error(error.message)
  return 'on' as const
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase!.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off' as const
}
