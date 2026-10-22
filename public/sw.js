const APP_CACHE = 'vidamoderna-shell-v2';
const MEDIA_CACHE = 'vidamoderna-media-cache-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './css/player.css',
  './css/admin.css',
  './js/db.js',
  './js/player.js',
  './js/admin.js',
  './assets/logo-modern-life.png',
  './assets/cartela-exemplo-1.svg',
  './assets/news-bg-default.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResp) => {
      const networkFetch = fetch(req)
        .then((netResp) => {
          if (netResp && netResp.status === 200) {
            const clone = netResp.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(req, clone));
          }
          return netResp;
        })
        .catch(() => cachedResp);

      return cachedResp || networkFetch;
    })
  );
});
