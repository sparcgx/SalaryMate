const CACHE = 'salarymate-v5-worklog-5.0.0-dev.1';
const BASE = new URL('./', self.location.href);
const SHELL = ['./', './index.html', './core.js', './app.js?v=5.0.0-dev.1', './styles.css?v=5.0.0-dev.1', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('salarymate-v5-worklog-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); } return response; }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match(new URL('./index.html', BASE).href) : Response.error()))));
});
