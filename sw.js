const CACHE_NAME = 'leeto-v2';
const STATIC_ASSETS = [
  './',
  './leeto-improved.html'
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(() => {
      // Graceful fallback if some assets fail
      console.log('[Leeto SW] Some assets could not be cached, continuing...');
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for same-origin, network-first for APIs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Leaflet CDN assets: cache them too for full offline maps
  if (url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // App shell: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (request.method === 'GET' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        }).catch(() => {
          // If offline and not cached, return a simple offline page
          if (request.destination === 'document') {
            return new Response('<h1>Leeto is offline</h1><p>You are currently offline. Please reconnect to find transport.</p>', {
              headers: { 'Content-Type': 'text/html' }
            });
          }
        });
      })
    );
    return;
  }

  // Default: network only
  event.respondWith(fetch(request));
});

// Background sync for driver location updates (if supported by browser)
self.addEventListener('sync', (event) => {
  if (event.tag === 'leeto-location-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_LOCATION' }));
      })
    );
  }
});

// Push notification support (basic)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Leeto', {
      body: data.body || 'Your route has been updated.',
      icon: data.icon || '',
      badge: data.badge || '',
      tag: data.tag || 'leeto-default',
      requireInteraction: false
    })
  );
});
