// Service Worker Network-First (Limpa caches antigos para garantir atualização imediata pelo Supabase)
var APP_CACHE = 'vidamoderna-shell-v5';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== APP_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // Nunca faz cache de chamadas do Supabase ou APIs externas
  if (req.url.indexOf('supabase.co') !== -1 || req.url.indexOf('rss2json') !== -1 || req.url.indexOf('/api/') !== -1 || req.url.indexOf('state.json') !== -1) {
    return;
  }

  // Network-First: tenta buscar sempre a versão mais nova da internet; só usa cache se estiver sem internet
  event.respondWith(
    fetch(req).then(function (netResp) {
      if (netResp && netResp.status === 200) {
        var clone = netResp.clone();
        caches.open(APP_CACHE).then(function (cache) {
          cache.put(req, clone);
        });
      }
      return netResp;
    })['catch'](function () {
      return caches.match(req);
    })
  );
});
