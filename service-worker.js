const CACHE_NAME = 'rahab-v3';
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

// ── Install ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .catch(err => console.warn('Cache addAll partial fail:', err))
  );
  self.skipWaiting();
});

// ── Activate ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Quran text API — network first, fallback cache
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

  // Audio APIs — cache first (if downloaded), then network
  if (url.hostname === 'everyayah.com' || url.hostname === 'download.quranicaudio.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        });
      }).catch(() => caches.match(event.request))
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

  // Everything else — cache first then network
  event.respondWith(
    caches.match(event.request)
      .then(r => r || fetch(event.request))
      .catch(() => caches.match('./index.html'))
  );
});

// ── Notification click ──
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

// ── helper: broadcast to all clients ──
async function broadcast(msg) {
  const list = await self.clients.matchAll({ includeUncontrolled: true });
  list.forEach(c => c.postMessage(msg));
}

// ── Messages ──
self.addEventListener('message', event => {
  const data = event.data || {};

  // ══ تنزيل نص السور الكاملة ══
  if (data.type === 'DOWNLOAD_QURAN') {
    (async () => {
      const total = 114;
      const cache = await caches.open(CACHE_NAME);
      for (let i = 1; i <= total; i++) {
        try {
          const reqUrl = `https://api.alquran.cloud/v1/surah/${i}`;
          const res = await fetch(reqUrl);
          if (res && res.ok) await cache.put(reqUrl, res.clone());
        } catch (e) { /* تجاهل */ }
        await broadcast({ type: 'DOWNLOAD_PROGRESS', done: i, total });
      }
      await broadcast({ type: 'DOWNLOAD_COMPLETE' });
    })();
  }

  // ══ تنزيل التلاوة الصوتية كاملة ══
  if (data.type === 'DOWNLOAD_AUDIO') {
    (async () => {
      const total = 114;
      const cache = await caches.open(CACHE_NAME);

      for (let i = 1; i <= total; i++) {
        const surahUrl = `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${String(i).padStart(3,'0')}.mp3`;
        try {
          const existing = await cache.match(surahUrl);
          if (!existing) {
            const res = await fetch(surahUrl);
            if (res && res.ok) await cache.put(surahUrl, res.clone());
          }
        } catch(e) { /* تجاهل */ }

        await broadcast({ type: 'AUDIO_DOWNLOAD_PROGRESS', done: i, total });
        // استراحة قصيرة لتجنب الضغط على الشبكة
        await new Promise(r => setTimeout(r, 200));
      }

      await broadcast({ type: 'AUDIO_DOWNLOAD_COMPLETE' });
    })();
  }

  // ══ تنزيل سورة واحدة بعينها ══
  if (data.type === 'DOWNLOAD_SINGLE_SURAH') {
    const surahNum = data.surahNum;
    (async () => {
      const surahUrl = `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${String(surahNum).padStart(3,'0')}.mp3`;
      try {
        const cache = await caches.open(CACHE_NAME);
        // احذف القديم لو موجود (للإعادة)
        await cache.delete(surahUrl).catch(() => {});
        const res = await fetch(surahUrl);
        if (res && res.ok) {
          await cache.put(surahUrl, res.clone());
          await broadcast({ type: 'SINGLE_SURAH_DONE', surahNum });
        } else {
          await broadcast({ type: 'SINGLE_SURAH_ERROR', surahNum });
        }
      } catch(e) {
        await broadcast({ type: 'SINGLE_SURAH_ERROR', surahNum });
      }
    })();
  }
});
