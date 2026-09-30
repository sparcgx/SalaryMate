const CACHE_NAME = 'salarymate-shell-v4.3.2-dev.4';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './styles.css?v=4.3.0', './glass.css?v=4.3.2-dev.4', './glass.js?v=4.3.2-dev.4', './bootstrap.js?v=4.3.2-dev.4', './app.js?v=4.3.2-dev.4', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
APP_SHELL.push('./reconcile.js?v=4.3.2-dev.4', './reconcile.css?v=4.3.2-dev.4');
APP_SHELL.push('./copy-month.js?v=4.3.2-dev.4');
APP_SHELL.push('./comp-time.js?v=4.3.2-dev.4');
APP_SHELL.push('./annual-analysis.js?v=4.3.2-dev.4', './annual-analysis.css?v=4.3.2-dev.4');
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('salarymate-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
