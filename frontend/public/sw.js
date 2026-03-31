// Kill-switch service worker:
// - clears all caches
// - unregisters itself
// - refreshes open windows

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    } catch (_) {
      // no-op
    }

    try {
      await self.registration.unregister()
    } catch (_) {
      // no-op
    }

    try {
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.navigate(client.url)
      }
    } catch (_) {
      // no-op
    }
  })())
})

self.addEventListener('fetch', () => {
  // no-op: let browser/network handle requests directly
})
