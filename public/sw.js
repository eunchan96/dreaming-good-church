/* Deliberately caches only the standalone offline page and an explicitly saved public snapshot. */
const CACHE = 'church-offline-v1';
const MAX_AGE = 24 * 60 * 60 * 1000;
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html'))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('church-offline-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
async function publicJson(path) {
  // Keep this origin's deployment-access cookie. Public API handlers still read
  // Supabase anonymously; no application bearer token is sent from this worker.
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error('조회 실패');
  return response.json();
}
self.addEventListener('message', event => {
  if (!event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      if (event.data === 'CLEAR') { await cache.delete('/offline-data.json'); event.ports[0].postMessage({ ok: true }); return; }
      if (event.data !== 'SAVE_PUBLIC') return;
      const list = await publicJson('/api/bulletins');
      const latest = list.bulletins[0];
      const [bulletin, church] = await Promise.all([latest ? publicJson(`/api/bulletins?id=${encodeURIComponent(latest.id)}`) : null, publicJson('/api/church')]);
      const snapshot = { savedAt: Date.now(), bulletin: bulletin ? { service_date: bulletin.service_date, issue_number: bulletin.issue_number, items: bulletin.items.filter(item => item.kind !== 'image').map(item => ({ title: item.title, body: item.body, kind: item.kind, content: item.content })) } : null, fields: church.fields };
      await cache.put('/offline-data.json', new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } }));
      event.ports[0].postMessage({ ok: true, savedAt: snapshot.savedAt });
    } catch { await cache.delete('/offline-data.json'); event.ports[0].postMessage({ ok: false }); }
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname === '/offline-data.json') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE), response = await cache.match('/offline-data.json');
      if (response) { const data = await response.clone().json(); if (Date.now() - data.savedAt < MAX_AGE && Date.now() >= data.savedAt) return response; await cache.delete('/offline-data.json'); }
      return Response.json({ savedAt: null });
    })()); return;
  }
  if (event.request.mode !== 'navigate') return;
  const publicPage = ['/', '/church', '/notices', '/events', '/bulletins', '/offline.html'].includes(url.pathname) || /^\/bulletins\/\d{4}-\d{2}-\d{2}$/.test(url.pathname);
  if (!publicPage) return;
  event.respondWith(fetch(event.request).catch(async () => (await (await caches.open(CACHE)).match('/offline.html')) || new Response('인터넷 연결을 확인해 주세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
});
