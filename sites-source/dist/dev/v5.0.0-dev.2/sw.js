const CACHE='salarymate-v5-full-5.0.0-dev.2-R82';
const BASE=new URL('./',self.location.href);
const SCENE_CACHE='salarymate-v5-backgrounds-r79';
const SCENES=new Map(['canyon','forest','harbor','aurora','sky','macaron'].map(id=>[id,new URL(`./art/background-${id}-r79.webp`,BASE).href]));
const SCENE_URLS=new Set(SCENES.values());
// Named art survives app releases. No mascot art belongs to mandatory install.
const ART_CACHE='salarymate-v5-art-v1';
const ART_FILES=['jingyu-hd2d-r74.png','jingyu-flight-r70.png',...['a','b','c','d'].map(id=>`jingyu-flight-r73-${id}.png`),'jingyu-cast-r76.png',...['blade','tornado'].map(id=>`jingyu-wind-${id}-r75.png`),...['bullet','spear','vortex'].map(id=>`jingyu-wind-${id}-r78.png`)];
const ART_URLS=new Set(ART_FILES.map(file=>new URL('./art/'+file,BASE).href));
const resourceRequests=new Map();
async function cacheFirst(cacheName,url,legacy=false){
  const key=cacheName+':'+url;
  if(resourceRequests.has(key))return (await resourceRequests.get(key)).clone();
  const pending=(async()=>{
    let cache,cached;
    try{cache=await caches.open(cacheName);cached=await cache.match(url);}catch{}
    if(!cached&&legacy)try{cached=await caches.match(url);if(cached&&cache)await cache.put(url,cached.clone());}catch{}
    if(cached)return cached;
    const response=await fetch(url);
    if(response.ok&&cache)try{await cache.put(url,response.clone());}catch{}
    return response;
  })();
  resourceRequests.set(key,pending);
  try{return (await pending).clone();}finally{if(resourceRequests.get(key)===pending)resourceRequests.delete(key);}
}
self.addEventListener('message',event=>{
  if(event.data?.type!=='salarymate:cache-background'||!SCENES.has(event.data.scene)||!event.source?.url)return;
  const source=new URL(event.source.url);
  if(source.origin!==BASE.origin||!source.pathname.startsWith(BASE.pathname))return;
  event.waitUntil(cacheFirst(SCENE_CACHE,SCENES.get(event.data.scene)).catch(()=>{}));
});
const LOCALES=["./i18n-en.js?v=5.0.0-dev.2-R82","./i18n.js?v=5.0.0-dev.2-R82"];
const STOCKS=["./google-drive.js?v=5.0.0-dev.2-R82","./google-drive-ui.js?v=5.0.0-dev.2-R82","./backup.js?v=5.0.0-dev.2-R82","./stocks.js?v=5.0.0-dev.2-R82","./stocks-integrations.js?v=5.0.0-dev.2-R82","./stocks-ui.js?v=5.0.0-dev.2-R82"];
const SHELL=["./","./index.html","./styles.css?v=5.0.0-dev.2-R82","./bootstrap.js?v=5.0.0-dev.2-R82","./app.js?v=5.0.0-dev.2-R82","./reconcile.js?v=5.0.0-dev.2-R82","./copy-month.js?v=5.0.0-dev.2-R82","./comp-time.js?v=5.0.0-dev.2-R82","./annual-analysis.js?v=5.0.0-dev.2-R82","./legal-data.js?v=5.0.0-dev.2-R82","./legal.html","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
const VERSIONED_URLS=new Set([...SHELL,...STOCKS,...LOCALES].filter(path=>path.includes('?v=')).map(path=>new URL(path,BASE).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...SHELL,...STOCKS,...LOCALES])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const previous=(await caches.keys()).filter(key=>key.startsWith('salarymate-v5-full-')&&key!==CACHE);
  for(const key of previous){
    try{
      const old=await caches.open(key),art=await caches.open(ART_CACHE);
      // Retain already-downloaded R79 images without a network or image decode.
      for(const url of ART_URLS){
        if(await art.match(url))continue;
        const cached=await old.match(url);if(cached?.ok)await art.put(url,cached);
      }
      await caches.delete(key);
    }catch{} // Preserve the old cache if migration fails; art can still reuse it.
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  if(SCENE_URLS.has(url.href)){event.respondWith(cacheFirst(SCENE_CACHE,url.href));return;}
  if(ART_URLS.has(url.href)){event.respondWith(cacheFirst(ART_CACHE,url.href,true));return;}
  if(VERSIONED_URLS.has(url.href)){event.respondWith(cacheFirst(CACHE,url.href));return;}
  // HTML continues checking for releases; API routes are outside this scope.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match(new URL('index.html',BASE).href):Response.error()))));
});
