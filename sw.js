const CACHE_NAME = 'leeto-v3';
const STATIC_ASSETS = ['./', './leeto-admin.html'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (url.hostname.includes('unpkg.com')) {
    e.respondWith(caches.match(request).then(cached => cached || fetch(request).then(r => { const clone = r.clone(); caches.open(CACHE_NAME).then(c => c.put(request, clone)); return r; })));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(request).then(cached => cached || fetch(request).then(r => { if (request.method === 'GET' && r.status === 200) { const clone = r.clone(); caches.open(CACHE_NAME).then(c => c.put(request, clone)); } return r; }).catch(() => request.destination === 'document' ? new Response('<h1>Leeto is offline</h1><p>Reconnect to access admin and driver features.</p>', { headers: { 'Content-Type': 'text/html' } }) : undefined)));
    return;
  }
  e.respondWith(fetch(request));
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'leeto-location-sync') {
    e.waitUntil(self.clients.matchAll().then(clients => clients.forEach(c => c.postMessage({ type: 'SYNC_LOCATION' }))));
  }
});

self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(data.title || 'Leeto', { body: data.body || 'Update from your route.', icon: data.icon || '', badge: data.badge || '', tag: data.tag || 'leeto-default', requireInteraction: false }));
});
