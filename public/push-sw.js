// Notifications du foyer : ajouté au service worker généré par vite-plugin-pwa.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data && event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Foyer', {
      body: data.body || '',
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      data: { url: data.url || self.registration.scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if (url) client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url || self.registration.scope)
    }),
  )
})
