import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Native Node fixtures only: no browser, DOM emulator, user data or live network.
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const css=fs.readFileSync(new URL('styles.css',base),'utf8');
const sw=fs.readFileSync(new URL('sw.js',base),'utf8');
const origin='https://salarymate.test/dev/v5.0.0-dev.2/';
const ids=['canyon','forest','harbor','aurora','sky','macaron'];
const scene=id=>origin+'art/background-'+id+'-r79.webp';
const manifest=JSON.parse(fs.readFileSync(new URL('../R79-BACKGROUND-ASSETS.json',import.meta.url)));

test('six scenes retain exact R78 bytes and all CSS selectors while removing embedded payloads',()=>{
  const old=execFileSync('git',['show',manifest.source_commit+':'+manifest.source],{cwd:new URL('..',import.meta.url),maxBuffer:3_000_000,encoding:'utf8'});
  let restored=css;
  for(const asset of manifest.assets){
    const bytes=fs.readFileSync(new URL('../'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.equal(bytes.length,asset.bytes);
    const encoded='data:image/webp;base64,'+bytes.toString('base64');
    assert.ok(old.includes(asset.property+':url("'+encoded+'")'));
    restored=restored.replace('./art/'+asset.path.split('/').at(-1),encoded);
  }
  assert.equal(restored,old);
  assert.equal(manifest.assets.length,6);
  assert.ok(Buffer.byteLength(css)<260000);
  assert.ok(!css.includes('data:image/'));
  assert.equal([...css.matchAll(/url\("\.\/art\/background-/g)].length,6);
});

function worker({failPut=false}={}){
  const handlers={},stores=new Map(),requests=[],precache=[],pending=[];
  let online=true;
  const key=value=>typeof value==='string'?value:value.url;
  const caches={
    async open(name){
      if(!stores.has(name))stores.set(name,new Map());
      const store=stores.get(name);
      return {
        async match(input){return store.get(key(input))?.clone();},
        async put(input,response){if(failPut)throw Error('quota');store.set(key(input),response.clone());},
        async addAll(urls){precache.push(...urls);}
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);},
    async match(input){for(const store of stores.values())if(store.has(key(input)))return store.get(key(input)).clone();}
  };
  const context={URL,Map,Set,Response,caches,self:{location:{href:origin+'sw.js'},addEventListener:(name,fn)=>{handlers[name]=fn;},skipWaiting:()=>{},clients:{claim:()=>{}}},fetch:async input=>{requests.push(key(input));if(!online)throw Error('offline');return new Response('image:'+key(input));}};
  vm.runInNewContext(sw,context);
  const waitUntil=promise=>pending.push(promise);
  return {stores,requests,precache,online:value=>{online=value;},
    async settle(){while(pending.length)await Promise.all(pending.splice(0));},
    install(){handlers.install({waitUntil});},activate(){handlers.activate({waitUntil});},
    message(sceneId,source=origin,type='salarymate:cache-background'){handlers.message({data:{type,scene:sceneId},source:{url:source},waitUntil});},
    fetch(url){let result;handlers.fetch({request:new Request(url),waitUntil,respondWith:promise=>{result=promise;}});return result;}
  };
}

test('install does not prefetch any scene; selected first-page scene alone is retained',async()=>{
  const w=worker();w.install();await w.settle();
  assert.ok(!w.precache.some(url=>url.includes('background-')));
  w.message('forest');await w.settle();
  assert.deepEqual(w.requests,[scene('forest')]);
  assert.equal(w.stores.get('salarymate-v5-backgrounds-r79').size,1);
});

test('switching loads only requested scenes; repeats and offline revisits use retained bytes',async()=>{
  const w=worker();
  for(const id of ids)assert.equal(await(await w.fetch(scene(id))).text(),'image:'+scene(id));
  assert.deepEqual(w.requests,ids.map(scene));
  w.online(false);
  for(const id of ids)assert.equal(await(await w.fetch(scene(id))).text(),'image:'+scene(id));
  assert.equal(w.requests.length,6);
  w.stores.set('salarymate-v5-full-5.0.0-dev.2-R78',new Map());
  w.activate();await w.settle();
  assert.ok(!w.stores.has('salarymate-v5-full-5.0.0-dev.2-R78'));
  assert.equal(w.stores.get('salarymate-v5-backgrounds-r79').size,6);
});

test('background cache messages are scoped; simultaneous first-use requests share a fetch',async()=>{
  const w=worker();
  for(const id of ['unknown','constructor','__proto__','https://outside.test/image'])w.message(id);
  w.message('forest','https://outside.test/');w.message('forest','https://salarymate.test/');w.message('forest',origin,'wrong-type');await w.settle();
  assert.equal(w.requests.length,0);
  const responses=await Promise.all([w.fetch(scene('forest')),w.fetch(scene('forest'))]);
  assert.equal(w.requests.length,1);
  assert.deepEqual(await Promise.all(responses.map(r=>r.text())),['image:'+scene('forest'),'image:'+scene('forest')]);
  const q=worker({failPut:true});assert.equal((await q.fetch(scene('sky'))).status,200);
});

test('unseen offline scene can retry later; existing app fetch behavior stays network-first',async()=>{
  const w=worker();w.online(false);
  await assert.rejects(w.fetch(scene('aurora')),/offline/);
  w.online(true);assert.equal((await w.fetch(scene('aurora'))).status,200);
  const app=origin+'app.js?v=5.0.0-dev.2-R79';
  await w.fetch(app);await w.settle();await w.fetch(app);await w.settle();
  assert.equal(w.requests.filter(url=>url===app).length,2);
  w.online(false);assert.equal((await w.fetch(app)).status,200);
});

test('first-page cache notification follows selected style and is disabled in portable files',async()=>{
  const first=fs.readFileSync(new URL('bootstrap.js',base),'utf8').split('// Desktop horizontal')[0];
  for(const [style,background,expected,portable]of [['pixel','sky','sky',false],['macaron','sky','macaron',false],['glass','sky',null,false],['pixel','forest',null,true]]){
    const events={},sent=[];
    const context={window:{SalaryMatePortable:portable,addEventListener:(event,fn)=>{events[event]=fn;}},document:{body:{dataset:{interfaceStyle:style,hd2dBackground:background}}},navigator:{serviceWorker:{register:async()=>{},ready:Promise.resolve({active:{postMessage:message=>sent.push(message)}})}},location:{protocol:'https:'}};
    vm.runInNewContext(first,context);await events.load?.();
    assert.deepEqual(sent.map(m=>m.scene),expected?[expected]:[]);
  }
});
