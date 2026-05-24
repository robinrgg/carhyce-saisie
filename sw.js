/* ============================================================
   Service Worker - CARHYCE Saisie Terrain
   Cache l'application pour utilisation hors-ligne sur le terrain
   ============================================================ */

const CACHE_VERSION = 'carhyce-v1';
const CACHE_FILES = [
  './',
  './index.html',
  './styles.css',
  './nomenclatures.js',
  './db.js',
  './app.js',
  './export.js',
  './manifest.webmanifest',
  './icon.svg',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
];

// Installation : mise en cache des ressources de base
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // addAll échoue si une ressource ne répond pas ; on cache individuellement
      return Promise.all(
        CACHE_FILES.map(url =>
          cache.add(url).catch(err => console.warn('SW cache fail:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activation : suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch : cache-first avec mise à jour réseau en tâche de fond
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);  // hors ligne : on retourne le cache même si pas frais
      return cached || networkFetch;
    })
  );
});
