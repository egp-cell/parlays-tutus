// Service worker de Quinielas Tutus: deja la app instalable, abre sin conexión y muestra los avisos.
const CACHE = 'tutus-v29';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La app siempre intenta traer la versión nueva; si no hay internet usa la guardada.
// Los datos de ESPN no se guardan: siempre van directo a la red.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Siempre pregunta al servidor si hay versión nueva (sin usar la copia vieja del navegador)
  const fresh = e.request.mode === 'navigate' || /\/(index\.html)?$|\.(js|json|webmanifest)$/.test(url.pathname);
  e.respondWith(
    fetch(fresh ? new Request(e.request, { cache: 'no-cache' }) : e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});

// Al tocar un aviso: abre la app directo en ese partido
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const k = (e.notification.data && e.notification.data.k) || '';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
      for (const w of ws) { if ('focus' in w) { if (k) w.postMessage({ open: k }); return w.focus(); } }
      return self.clients.openWindow(k ? './?g=' + encodeURIComponent(k) : './');
    })
  );
});

// Avisos que manda el servidor aunque la app esté cerrada
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Tutus Score', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { k: d.k || '' }
  }));
});
