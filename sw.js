/* ============================================================
   Service Worker - CARHYCE Saisie Terrain — v3
   ------------------------------------------------------------
   Stratégie :
   - Ressources locales (HTML/CSS/JS/manifest/icon) → network-first
     avec timeout court et fallback cache. Garantit que les MAJ
     poussées sur GitHub Pages arrivent immédiatement quand
     l'utilisateur est en ligne, tout en gardant l'autonomie
     totale hors-ligne sur le terrain.
   - CDN externe (jsdelivr / SheetJS) → cache-first car figé.
   - skipWaiting + clients.claim → la nouvelle version prend le
     contrôle dès qu'elle est installée, sans nécessiter de
     fermer/rouvrir l'app.
   ============================================================ */

const CACHE_VERSION = 'carhyce-v3';
const NETWORK_TIMEOUT_MS = 3000;

const PRECACHE_URLS = [
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

// ----- Installation : pré-cache des fichiers de base
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('SW precache skip:', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ----- Activation : suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ----- Fetch : routage des stratégies
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Origines différentes (CDN externes) : cache-first
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Ressources locales : network-first
  event.respondWith(networkFirst(event.request));
});

// Network-first : on tente toujours le réseau en premier, avec un timeout court.
// En cas d'échec (offline ou timeout), on retourne la version cachée.
async function networkFirst(request) {
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Ressource indisponible (hors ligne)', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// Cache-first : on retourne le cache immédiatement, et on met à jour en arrière-plan.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Mise à jour silencieuse en tâche de fond
    fetch(request).then(response => {
      if (response && response.status === 200) {
        caches.open(CACHE_VERSION).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Ressource externe indisponible', { status: 503 });
  }
}

function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(request).then(r => { clearTimeout(id); resolve(r); }, err => { clearTimeout(id); reject(err); });
  });
}

// Permet à l'app de demander à un SW en attente de prendre le contrôle immédiatement
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
