const CACHE = 'zt-__VERSION__';
const FILES = __FILES__;

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return; // API always goes to network
  if (url.origin === location.origin) {
    const key = e.request.mode === 'navigate' ? '/' : e.request;
    e.respondWith(caches.match(key, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { // fonts: cache on first use
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => (c.put(e.request, res.clone()), res)))));
  }
});
