/* IWAT POS service worker — keeps the app opening and selling with no connection. */
const VERSION = '__VERSION__';
const SHELL = `iwat-shell-${VERSION}`;
const RUNTIME = 'iwat-runtime';
const PRECACHE = self.__PRECACHE__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('iwat-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // API reads: network first, then the last good answer so screens still load offline.
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || new Response(JSON.stringify({ error: 'You are offline and this screen has not been opened before.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // Page navigations: try the network quickly, fall back to the cached app.
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(req), new Promise((_, rej) => setTimeout(rej, 3500))])
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static files: cache first.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
