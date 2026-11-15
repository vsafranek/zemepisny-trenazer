// Writes dist/sw.js: precaches the built app (incl. flags and data) so the quiz works offline.
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const dist = new URL('../dist/', import.meta.url);
const files = [];
const walk = d => fs.readdirSync(new URL(d, dist), { withFileTypes: true }).forEach(e =>
  e.isDirectory() ? walk(d + e.name + '/') : files.push(d + e.name));
walk('');
const precache = files.filter(f => f !== 'sw.js');
const hash = createHash('sha1');
for (const f of precache) hash.update(f).update(fs.readFileSync(new URL(f, dist)));

const FILES = ['/', ...precache.filter(f => f !== 'index.html').map(f => '/' + f)]; // index.html is served as /
fs.writeFileSync(new URL('sw.js', dist), `const CACHE = 'zt-${hash.digest('hex').slice(0, 10)}';
const FILES = ${JSON.stringify(FILES)};

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return; // API always goes to network
  if (url.origin === location.origin) {
    const key = e.request.mode === 'navigate' ? '/' : e.request;
    e.respondWith(caches.match(key, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  } else if (/fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)) { // fonts: cache on first use
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => (c.put(e.request, res.clone()), res)))));
  }
});
`);
console.log(`sw.js: ${FILES.length} precached files`);
