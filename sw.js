/* Service worker – יומן מסע 2027 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const DATA = 'data';
const TILES = 'osm-tiles';
const IMAGES = 'images';
const MAX_TILES = 800; // only tiles the user actually viewed – no bulk download (OSM policy)

const SHELL_FILES = [
  './', 'index.html', 'css/app.css', 'js/app.js', 'manifest.json',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png',
  'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'
];
const DATA_FILES = ['data/trip.json', 'data/credits.json'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    await (await caches.open(DATA)).addAll(DATA_FILES);
    // images listed in credits.json are cached on first visit
    try {
      const credits = await (await fetch('data/credits.json')).json();
      const imgs = Object.values(credits.points || {}).flat().map(c => c.file);
      const c = await caches.open(IMAGES);
      await Promise.allSettled(imgs.map(u => c.add(u)));
    } catch (_) { /* no images yet */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trimTiles() {
  const c = await caches.open(TILES); const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // OSM tiles: cache what was viewed
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(e.request);
      if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') { c.put(e.request, r.clone()); trimTiles(); } return r; }
      catch { return new Response('', { status: 504 }); }
    })());
    return;
  }
  // Weather: network only (app keeps last result in localStorage)
  if (url.hostname.endsWith('open-meteo.com')) return;
  if (url.origin !== location.origin) return;

  // Data: network first, fall back to cache
  if (url.pathname.includes('/data/')) {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      try { const r = await fetch(e.request, { cache: 'no-store' }); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch { return (await c.match(e.request)) || new Response('{}', { headers: { 'Content-Type': 'application/json' } }); }
    })());
    return;
  }
  // Shell + images: cache first
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(e.request);
      if (r.ok && url.pathname.includes('/assets/img/')) (await caches.open(IMAGES)).put(e.request, r.clone());
      return r;
    } catch { return (await caches.match('index.html')) || Response.error(); }
  })());
});

// "Save everything offline" button
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-all') return;
  const port = e.ports[0];
  e.waitUntil((async () => {
    const list = [...SHELL_FILES.map(f => [SHELL, f]), ...DATA_FILES.map(f => [DATA, f]), ...(e.data.extra || []).map(f => [IMAGES, f])];
    let done = 0, failed = 0;
    for (const [cacheName, f] of list) {
      try { const r = await fetch(f, { cache: 'reload' }); if (!r.ok) throw 0; await (await caches.open(cacheName)).put(f, r); }
      catch { failed++; }
      done++; port.postMessage({ done, total: list.length });
    }
    port.postMessage({ done, total: list.length, finished: true, failed });
  })());
});
