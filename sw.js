const CACHE_NAME = 'salarymate-compliance-dev-v4.3.3-dev.1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './styles.css?v=4.3.0', './glass.css?v=4.3.3-dev.1', './glass.js?v=4.3.3-dev.1', './bootstrap.js?v=4.3.3-dev.1', './app.js?v=4.3.3-dev.1', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
APP_SHELL.push('./reconcile.js?v=4.3.3-dev.1', './reconcile.css?v=4.3.3-dev.1');
APP_SHELL.push('./copy-month.js?v=4.3.3-dev.1');
APP_SHELL.push('./comp-time.js?v=4.3.3-dev.1');
APP_SHELL.push('./annual-analysis.js?v=4.3.3-dev.1', './annual-analysis.css?v=4.3.3-dev.1', './release-polish.css?v=4.3.3-dev.1');
APP_SHELL.push('./legal-data.js?v=4.3.3-dev.1', './legal.html', './THIRD_PARTY_NOTICES.txt');
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('salarymate-compliance-dev-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const assetUrl=new URL(request.url);
  const versioned=APP_SHELL.some(asset=>asset.includes('?v=')&&new URL(asset,self.location.href||self.location.origin+'/').href===assetUrl.href);
  const network=()=>fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)));}
    return response;
  });
  const fallback=()=>caches.match(request).then(cached=>cached||(request.mode==='navigate'?caches.match('./index.html'):Response.error()));
  event.respondWith(versioned?caches.open(CACHE_NAME).then(cache=>cache.match(request)).then(cached=>cached||network()).catch(fallback):network().catch(fallback));
});
