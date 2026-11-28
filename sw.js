const CACHE_NAME = 'still-shell-v4'
const SHELL = ['./', './manifest.webmanifest', './icons/still.svg', './icons/still-192.png', './icons/still-512.png']
const SHELL_URL = new URL('./', self.registration.scope).href
const VERSION_PATH = new URL('app-version.json', self.registration.scope).pathname

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const indexResponse = await fetch('./', { cache: 'reload' })
    const html = await indexResponse.clone().text()
    await cache.put(SHELL_URL, indexResponse)
    const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], self.registration.scope))
      .filter((url) => url.origin === self.location.origin)
      .map((url) => url.href)
    await Promise.all([...new Set([...SHELL, ...discovered])].map(async (asset) => {
      try { await cache.add(asset) } catch { /* optional asset; core index is already cached */ }
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith('still-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === VERSION_PATH) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-cache' }).then((response) => {
      if (!response.ok) return caches.match(SHELL_URL).then((cached) => cached || response)
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, copy))
      return response
    }).catch(() => caches.match(SHELL_URL)))
    return
  }

  event.respondWith(caches.match(request.url, { ignoreVary: true }).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
    }
    return response
  })))
})
