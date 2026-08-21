const CACHE_NAME = 'kardia-pwa-v2';
// index.html é intencionalmente excluído para garantir sempre a versão mais recente
const ASSETS = [
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy to ensure index.html and assets are always fresh
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Se a rede funcionar, podemos até atualizar o cache dinamicamente (opcional)
        // mas o retorno da rede já garante a versão mais recente.
        return response;
      })
      .catch(() => {
        // Fallback para o cache se estiver offline
        return caches.match(e.request);
      })
  );
});
