const CACHE='salarymate-v5-full-5.0.0-dev.2-R79';
const BASE=new URL('./',self.location.href);
// R79: backgrounds are fetched only when used. Keep their immutable files in a
// small separate cache so routine app upgrades do not discard visited scenes.
const SCENE_CACHE='salarymate-v5-backgrounds-r79';
const SCENES=new Map(['canyon','forest','harbor','aurora','sky','macaron'].map(id=>[id,new URL(`./art/background-${id}-r79.webp`,BASE).href]));
const SCENE_URLS=new Set(SCENES.values());
const sceneRequests=new Map();
async function cachedScene(url){
  if(sceneRequests.has(url))return (await sceneRequests.get(url)).clone();
  const pending=(async()=>{
    const cache=await caches.open(SCENE_CACHE),cached=await cache.match(url);
    if(cached)return cached;
    const response=await fetch(url);
    if(response.ok)try{await cache.put(url,response.clone());}catch{}
    return response;
  })();
  sceneRequests.set(url,pending);
  try{return (await pending).clone();}finally{if(sceneRequests.get(url)===pending)sceneRequests.delete(url);}
}
self.addEventListener('message',event=>{
  if(event.data?.type!=='salarymate:cache-background'||!SCENES.has(event.data.scene)||!event.source?.url)return;
  const source=new URL(event.source.url);
  if(source.origin!==BASE.origin||!source.pathname.startsWith(BASE.pathname))return;
  event.waitUntil(cachedScene(SCENES.get(event.data.scene)).catch(()=>{}));
});
const LOCALES=['./i18n-en.js?v=5.0.0-dev.2-R79','./i18n.js?v=5.0.0-dev.2-R79'];
const STOCKS=['./google-drive.js?v=5.0.0-dev.2-R79','./google-drive-ui.js?v=5.0.0-dev.2-R79','./backup.js?v=5.0.0-dev.2-R79','./stocks.js?v=5.0.0-dev.2-R79','./stocks-integrations.js?v=5.0.0-dev.2-R79','./stocks-ui.js?v=5.0.0-dev.2-R79'];
const SHELL=['./','./index.html','./styles.css?v=5.0.0-dev.2-R79','./bootstrap.js?v=5.0.0-dev.2-R79','./app.js?v=5.0.0-dev.2-R79','./reconcile.js?v=5.0.0-dev.2-R79','./copy-month.js?v=5.0.0-dev.2-R79','./comp-time.js?v=5.0.0-dev.2-R79','./annual-analysis.js?v=5.0.0-dev.2-R79','./legal-data.js?v=5.0.0-dev.2-R79','./legal.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./art/jingyu-hd2d-r74.png','./art/jingyu-wind-bullet-r78.png','./art/jingyu-wind-spear-r78.png','./art/jingyu-wind-vortex-r78.png','./art/jingyu-cast-r76.png','./art/jingyu-wind-blade-r75.png','./art/jingyu-wind-tornado-r75.png','./art/jingyu-flight-r73-a.png','./art/jingyu-flight-r73-b.png','./art/jingyu-flight-r73-c.png','./art/jingyu-flight-r73-d.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll([...SHELL,...STOCKS,...LOCALES])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('salarymate-v5-full-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;if(SCENE_URLS.has(url.href)){e.respondWith(cachedScene(url.href));return;}e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request).then(c=>c||(e.request.mode==='navigate'?caches.match(new URL('index.html',BASE).href):Response.error()))));});
