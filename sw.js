/* Service worker do Enxoval da Alice — deixa o app abrir sem internet. */
const CACHE = 'enxoval-alice-v2';
const ARQUIVOS = ['.', 'index.html', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'icone-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Rede primeiro (para receber atualizações), cache como reserva (para funcionar offline).
   Chamadas para fora (ex.: a IA que lê etiquetas) passam direto, sem cache. */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))
      )
  );
});
