/* 오프라인 저장 기능을 없앴다. 이전에 이 기기에 등록된 워커와 저장본을 지우고 스스로 등록을 해제한다. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('church-offline-')) await caches.delete(key);
  await self.registration.unregister();
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) client.navigate(client.url);
})()));
