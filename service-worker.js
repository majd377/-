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

  // Audio APIs — cache first (if already downloaded), then network
  if (url.hostname === 'everyayah.com' || url.hostname === 'download.quranicaudio.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          // cache audio responses automatically when fetched
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

// ── Messages from page ──
self.addEventListener('message', event => {
  const data = event.data || {};

  // ── تنزيل نص السور ──
  if (data.type === 'DOWNLOAD_QURAN') {
    (async () => {
      const total = 114;
      const cache = await caches.open(CACHE_NAME);
      for (let i = 1; i <= total; i++) {
        try {
          const reqUrl = `https://api.alquran.cloud/v1/surah/${i}`;
          const res = await fetch(reqUrl);
          if (res && res.ok) await cache.put(reqUrl, res.clone());
        } catch (e) { /* تجاهل الأخطاء الفردية */ }
        const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
        clientsList.forEach(c => c.postMessage({ type: 'DOWNLOAD_PROGRESS', done: i, total }));
      }
      const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
      clientsList.forEach(c => c.postMessage({ type: 'DOWNLOAD_COMPLETE' }));
    })();
  }

  // ── تنزيل التلاوة الصوتية — حسام الدين عبادي ──
  if (data.type === 'DOWNLOAD_AUDIO') {
    (async () => {
      const total = 114;
      const cache = await caches.open(CACHE_NAME);
      let done = 0;

      const broadcast = async (msg) => {
        const list = await self.clients.matchAll({ includeUncontrolled: true });
        list.forEach(c => c.postMessage(msg));
      };

      for (let i = 1; i <= total; i++) {
        // نزّل ملف السورة كاملة (quranicaudio)
        const surahUrl = `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${String(i).padStart(3,'0')}.mp3`;
        try {
          // تحقق إذا كان مخزناً
          const existing = await cache.match(surahUrl);
          if (!existing) {
            const res = await fetch(surahUrl);
            if (res && res.ok) await cache.put(surahUrl, res.clone());
          }
        } catch(e) { /* تجاهل */ }

        done++;
        await broadcast({ type: 'AUDIO_DOWNLOAD_PROGRESS', done, total });

        // استراحة قصيرة لتجنب الضغط على الشبكة
        await new Promise(r => setTimeout(r, 25));
      }

      await broadcast({ type: 'AUDIO_DOWNLOAD_COMPLETE' });
    })();
  }
});
