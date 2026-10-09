// Sender push-varsel når en nedtelling i kokemodus er ferdig. Kalles av
// pg_cron (se supabase/migration_kokemodus_nedtelling.sql) med en delt
// hemmelighet i x-cron-secret, derfor deployes den med verify_jwt = false.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

interface DueTimer {
  id: string
  user_id: string
  title: string
  body: string
  url: string
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: config, error: configError } = await supabase.rpc('timer_push_config')
  if (configError || !config?.cron_secret || !config.vapid_private_key) {
    return new Response('Mangler oppsett i Vault', { status: 500 })
  }
  if (req.headers.get('x-cron-secret') !== config.cron_secret) {
    return new Response('Forbidden', { status: 403 })
  }

  webpush.setVapidDetails(supabaseUrl, config.vapid_public_key, config.vapid_private_key)

  const { data: due, error } = await supabase.rpc('claim_due_cooking_timers')
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const timer of (due ?? []) as DueTimer[]) {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', timer.user_id)

    const payload = JSON.stringify({ title: timer.title, body: timer.body, tag: timer.id, url: timer.url })
    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 600, urgency: 'high' }
        )
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410: telefonen har avregistrert seg.
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('Push feilet', status, err)
        }
      }
    }
  }

  // Rydder bort klokker som ble sendt for mer enn et døgn siden.
  await supabase
    .from('cooking_timers')
    .delete()
    .lt('sent_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())

  return new Response(JSON.stringify({ timers: due?.length ?? 0, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
