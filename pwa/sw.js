/* GameForge Portal service worker.
 * Precache list and cache name are injected at build time by scripts/build-pwa.js,
 * so the cache changes whenever any shipped file changes.
 */
'use strict';

const CACHE = "gameforge-pwa-c52a0709b388";
const PRECACHE = [
  "./",
  "./app.js",
  "./components/GameCard.js",
  "./data/builds.json",
  "./data/games.json",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./pwa.css",
  "./pwa.js",
  "./screenshots/desktop.png",
  "./screenshots/mobile-top.png",
  "./styles.css"
];
const OFFLINE_URL = './offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll is atomic: one failure rejects the whole install and the old worker stays active.
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'VERSION') {
    event.source?.postMessage({ type: 'VERSION', cache: CACHE, precache: PRECACHE.length });
  }
});

/** Network-first for documents so a fresh deploy is picked up, cache as the offline fallback. */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./'));
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

/** Cache-first with background revalidation for static assets. */
async function handleAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Runtime probe endpoint is intentionally never cached: it reports live values.
  if (url.pathname.endsWith('/api/runtime')) return;

  event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : handleAsset(request));
});
