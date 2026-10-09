import { supabase } from './supabaseClient'
import { timerLabel, type CookingTimer } from './cookingTimers'

// Push-varsel når en klokke i kokemodus er ferdig, også når telefonen er
// låst og appen ikke kjører. Appen lagrer sluttidspunktet i cooking_timers,
// og Supabase sender varselet (se supabase/migration_kokemodus_nedtelling.sql
// og supabase/functions/send-timer-push).

// Offentlig VAPID-nøkkel. Den private ligger i Supabase Vault.
const VAPID_PUBLIC_KEY = 'BNsA-6iwkxuwuCoXZRmdT5NwHM49MKoxI4L5AycG5meWgi6xxhxjTX00zrApsg5woDmTD0iSAhkxK1cGilFAWiI'

export type PushState = 'unsupported' | 'denied' | 'default' | 'granted'

export function pushState(): PushState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

// Ber om lov til varsler (første gang) og registrerer telefonen for push.
// Kalles når en klokke startes, siden nettleseren bare spør etter et trykk.
export async function ensurePushSubscription(): Promise<PushState> {
  let state = pushState()
  if (state === 'unsupported' || state === 'denied') return state
  if (state === 'default') {
    state = await Notification.requestPermission()
    if (state !== 'granted') return state
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))
    const json = subscription.toJSON()
    const { data } = await supabase.auth.getSession()
    if (data.session && json.endpoint && json.keys?.p256dh && json.keys.auth) {
      await supabase.from('push_subscriptions').upsert({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      })
    }
  } catch (err) {
    // Uten push virker klokkene fortsatt mens appen er åpen.
    console.warn('Kunne ikke registrere push-varsler', err)
  }
  return state
}

// Holder cooking_timers i Supabase i takt med klokkene: en klokke som går
// har en rad med sluttidspunktet, en klokke på pause eller som er stoppet har ingen.
export async function syncTimerToServer(timer: CookingTimer | null, id: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    if (timer && timer.endsAt !== null && !timer.ringing) {
      await supabase.from('cooking_timers').upsert({
        id,
        title: 'Tiden er ute',
        body: `${timerLabel(timer)}${timer.recipeTitle ? ` (${timer.recipeTitle})` : ''}`,
        url: `/oppskrift/${timer.recipeId}/kok`,
        ends_at: new Date(timer.endsAt).toISOString(),
        sent_at: null,
      })
    } else {
      await supabase.from('cooking_timers').delete().eq('id', id)
    }
  } catch (err) {
    console.warn('Kunne ikke lagre klokka for push-varsel', err)
  }
}
