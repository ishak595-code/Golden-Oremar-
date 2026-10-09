// Golden Oremar: the web service worker must never run inside the Android or
// iOS app. There the web files ship inside the app itself; a service worker
// left over from an earlier version kept serving that version's cached pages,
// so a freshly installed update still opened the old screens. In the app
// (https://localhost with no port on Android) this worker clears every cache,
// unregisters itself and reloads the open screen from the installed files.
// On the website (and the local preview, which has a port) it does nothing.
if (self.location.hostname === 'localhost' && self.location.port === '') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      for (const client of windows) client.navigate(client.url).catch(() => undefined);
    })());
  });
}
