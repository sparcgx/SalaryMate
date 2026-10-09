import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Native request/cache fixtures; no browser, real network or personal data.
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const source=fs.readFileSync(new URL('sw.js',base),'utf8');
const origin='https://salarymate.test/dev/v5.0.0-dev.2/';
const current=source.match(/const CACHE='([^']+)'/)[1];
const version=current.slice('salarymate-v5-full-'.length);
const artCache='salarymate-v5-art-v1';
const js=origin+'app.js?v='+version;
const art=origin+'art/jingyu-flight-r73-a.png';
function runtime(){
 const handlers={},stores=new Map(),requests=[],puts=[],installed=[],pending=[];
 const flags={online:true,failRead:false,failWrite:false,failInstall:false,status:200,skipped:0,claimed:0};
 const key=value=>typeof value==='string'?new URL(value,origin).href:value.url;
 const caches={
  async open(name){if(flags.failRead)throw Error('cache unavailable');if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {
   async match(input){return store.get(key(input))?.clone();},
   async put(input,response){if(flags.failWrite)throw Error('quota');puts.push(key(input));store.set(key(input),response.clone());},
   async addAll(urls){installed.push(...urls);if(flags.failInstall)throw Error('install incomplete');for(const url of urls)store.set(key(url),new Response('installed:'+key(url)));}
  };},
  async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},
  async match(input){if(flags.failRead)throw Error('cache unavailable');for(const store of stores.values())if(store.has(key(input)))return store.get(key(input)).clone();}
 };
 vm.runInNewContext(source,{URL,Map,Set,Response,caches,self:{location:{href:origin+'sw.js'},addEventListener:(name,fn)=>{handlers[name]=fn;},skipWaiting:()=>{flags.skipped++;},clients:{claim:()=>{flags.claimed++;}}},fetch:async input=>{requests.push(key(input));if(!flags.online)throw Error('offline');return new Response('network:'+key(input),{status:flags.status});}});
 const waitUntil=promise=>pending.push(promise);
 return {stores,requests,puts,installed,flags,
  install(){handlers.install({waitUntil});},activate(){handlers.activate({waitUntil});},
  async settle(){while(pending.length)await Promise.all(pending.splice(0));},
  fetch(url,mode='cors',method='GET'){let promise;handlers.fetch({request:{url,mode,method},waitUntil,respondWith:value=>{promise=value;}});return promise;}
 };
}

test('R80 install contains the full interface but no flight, cast, spell or perched image',async()=>{
 const h=runtime();h.install();await h.settle();
 const index=fs.readFileSync(new URL('index.html',base),'utf8');
 const scripts=[...index.matchAll(/<script defer src="([^"]+)"/g)].map(match=>match[1]);
 const expected=['./','./index.html','./styles.css?v='+version,'./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',...scripts];
 assert.equal(new Set(h.installed).size,h.installed.length,'No duplicate precache entries');
 assert.deepEqual([...h.installed].sort(),expected.sort(),'Cache exactly the current interface and required assets');
 assert.ok(h.installed.every(url=>!url.includes('/art/')&&!/legal/.test(url)),'Artwork and legal content remain on demand');
 for(const [,url]of index.matchAll(/<script defer src="([^"]+)"/g))assert.ok(h.installed.includes(url));
 assert.ok(h.installed.includes('./styles.css?v='+version));
 const bytes=h.installed.reduce((total,path)=>total+fs.statSync(new URL(path.split('?')[0]==='./'?'index.html':path.split('?')[0],base)).size,0);
 assert.ok(bytes<2_100_000);assert.equal(h.flags.skipped,1);
});

test('R80 versioned interface is cache-first on reopen and offline; other versions cannot match it',async()=>{
 const h=runtime();h.install();await h.settle();
 assert.equal(await(await h.fetch(js)).text(),'installed:'+js);assert.equal(h.requests.length,0);
 h.flags.online=false;assert.equal((await h.fetch(js)).status,200);assert.equal(h.requests.length,0);
 assert.equal((await h.fetch(origin+'app.js?v=5.0.0-dev.2-R79')).type,'error');
 h.flags.online=true;await h.fetch(origin+'app.js');await h.settle();await h.fetch(origin+'app.js');await h.settle();
 assert.equal(h.requests.filter(url=>url===origin+'app.js').length,2);
});

test('R80 cached art is reused without download or rewrite, including concurrent requests',async()=>{
 const h=runtime();const pair=await Promise.all([h.fetch(art),h.fetch(art)]);
 assert.deepEqual(await Promise.all(pair.map(r=>r.text())),['network:'+art,'network:'+art]);
 assert.equal(h.requests.length,1);assert.equal(h.puts.length,1);
 h.flags.online=false;assert.equal(await(await h.fetch(art)).text(),'network:'+art);
 assert.equal(h.requests.length,1);assert.equal(h.puts.length,1);
});

test('R80 activation migrates already-cached art without network and preserves background cache',async()=>{
 const h=runtime(),previous='salarymate-v5-full-5.0.0-dev.2-R79';
 h.stores.set(previous,new Map([[art,new Response('R79 original art')],[origin+'index.html',new Response('old HTML')]]));
 h.stores.set('salarymate-v5-backgrounds-r79',new Map());
 h.install();await h.settle();h.activate();await h.settle();
 assert.equal(h.flags.claimed,1);assert.ok(!h.stores.has(previous));
 assert.ok(h.stores.has(current));assert.ok(h.stores.has('salarymate-v5-backgrounds-r79'));
 h.flags.online=false;assert.equal(await(await h.fetch(art)).text(),'R79 original art');assert.equal(h.requests.length,0);
 assert.ok(h.stores.get(artCache).has(art));
});

test('R80 migration quota failure keeps old art recoverable; cache errors still allow network images',async()=>{
 const h=runtime(),previous='salarymate-v5-full-5.0.0-dev.2-R79';
 h.stores.set(previous,new Map([[art,new Response('original')]]));h.flags.failWrite=true;
 h.activate();await h.settle();assert.ok(h.stores.has(previous));
 h.flags.online=false;assert.equal(await(await h.fetch(art)).text(),'original');assert.equal(h.requests.length,0);
 const inaccessible=runtime();inaccessible.flags.failRead=true;assert.equal((await inaccessible.fetch(art)).status,200);
 assert.equal(inaccessible.requests.length,1);
});

test('R80 failed image requests are retryable and error responses never become permanent cache hits',async()=>{
 const h=runtime();h.flags.online=false;await assert.rejects(h.fetch(art),/offline/);
 h.flags.online=true;h.flags.status=404;assert.equal((await h.fetch(art)).status,404);
 h.flags.status=200;assert.equal((await h.fetch(art)).status,200);assert.equal(h.requests.length,3);
 assert.equal((await h.fetch(art)).status,200);assert.equal(h.requests.length,3);
});

test('R80 release HTML keeps checking updates and has offline fallback; APIs stay outside cache scope',async()=>{
 const h=runtime();h.install();await h.settle();
 const url=origin+'?action=add-record';await h.fetch(url,'navigate');await h.settle();
 assert.deepEqual(h.requests,[url]);
 h.flags.online=false;assert.equal((await h.fetch(origin+'?action=another','navigate')).status,200);
 assert.equal(h.fetch('https://salarymate.test/api/stocks/quotes'),undefined);
 assert.equal(h.fetch('https://outside.test/image.png'),undefined);
 assert.equal(h.fetch(js,'cors','POST'),undefined);
});

test('R80 an incomplete interface install does not take over the previous offline version',async()=>{
 const h=runtime();h.flags.failInstall=true;h.install();await assert.rejects(h.settle(),/install incomplete/);
 assert.equal(h.flags.skipped,0);assert.equal(h.flags.claimed,0);
});
