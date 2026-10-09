// Lastes inn i service workeren (se workbox.importScripts i vite.config.ts).
// Viser varselet når en klokke i kokemodus er ferdig, også når telefonen er
// låst. Push-meldingen sendes av Supabase (supabase/functions/send-timer-push).

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tiden er ute', {
      body: data.body || '',
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 600],
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
