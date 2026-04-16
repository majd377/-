const CACHE_NAME = 'rahab-v2';
const STATIC_FILES = [
  './',
  './index.html',
  './quran.html',
  './azkar.html',
  './duaa.html',
  './topics.html',
  './styles.css',
  './main.js',
  './preview.webp',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;900&family=Scheherazade+New:wght@400;700&display=swap'
];

// Install: cache all static files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .catch(err => console.warn('Cache addAll partial fail:', err))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Quran API — network first, fallback to cache
  if (url.hostname === 'api.alquran.cloud') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Google Fonts — cache first
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then(r => r || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }))
    );
    return;
  }

  // Everything else — cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(r => r || fetch(event.request))
      .catch(() => caches.match('./index.html'))
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.visibilityState === 'visible');
      if (existing) return existing.focus();
      return clients.openWindow('./index.html');
    })
  );
});

// Listen for messages from the page (e.g., request to download Quran for offline)
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data && data.type === 'DOWNLOAD_QURAN') {
    (async () => {
      const total = 114;
      const cache = await caches.open(CACHE_NAME);
      for (let i = 1; i <= total; i++) {
        try {
          const reqUrl = `https://api.alquran.cloud/v1/surah/${i}`;
          const res = await fetch(reqUrl);
          if (res && res.ok) await cache.put(reqUrl, res.clone());
        } catch (e) {
          // ignore individual failures, continue
        }
        // broadcast progress to all clients
        const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
        clientsList.forEach(c => c.postMessage({ type: 'DOWNLOAD_PROGRESS', done: i, total }));
      }
      const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
      clientsList.forEach(c => c.postMessage({ type: 'DOWNLOAD_COMPLETE' }));
    })();
  }
});
