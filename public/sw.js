// Service worker mínimo: deixa o app instalável e mostra uma página amigável sem internet.
// Dados (API) nunca ficam em cache, para não mostrar leituras velhas como se fossem atuais.
const CACHE = 'ws-v3';
const OFFLINE = '/offline.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, '/icons/icon-192.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).pathname.startsWith('/api/')) return;
  if (r.mode === 'navigate') e.respondWith(fetch(r).catch(() => caches.match(OFFLINE)));
});

// Notificações push (alertas de temperatura, umidade e bateria)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Estação meteorológica', {
    body: d.body || '',
    icon: '/icons/icon-192.png',   // ícone grande, dentro da notificação
    badge: '/icons/badge-96.png',  // silhueta branca com fundo transparente: ícone pequeno da barra de status (Android)
    tag: d.tag,
    renotify: !!d.tag,
    data: { url: d.url || '/painel' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/painel';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});
