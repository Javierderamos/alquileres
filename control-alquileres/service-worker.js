/* Service worker: guarda la aplicación en caché para que funcione sin conexión.
   No intercepta ni envía datos del usuario: los datos viven en IndexedDB del navegador. */
const CACHE = 'control-alquileres-v1';
const FILES = [
  './', './index.html', './styles.css', './manifest.json',
  './js/util.js', './js/db.js', './js/calc.js', './js/ui.js', './js/forms.js', './js/views.js', './js/ficha.js', './js/demo.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* Red primero (para recibir actualizaciones) y, si no hay conexión, la copia en caché. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
