import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root));
const walk=(relative='dist')=>fs.readdirSync(new URL(relative+'/',root),{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(relative+'/'+item.name):[relative+'/'+item.name]).sort();

test('Stable：候選執行資產與逐檔 SHA-256 凍結清單一致',()=>{
  const freeze=JSON.parse(read('release-evidence/v4.3.2-web_freeze.json'));
  assert.deepEqual(walk(),Object.keys(freeze.assets).sort());
  for(const [path,expected] of Object.entries(freeze.assets))assert.equal(createHash('sha256').update(read(path)).digest('hex'),expected,path);
});

const worker=(options={})=>{
  const events=new Map(),removed=[],cached=[],writes=[],flags={skip:false,claim:false};
  const self={location:{origin:'https://salarymate.example',href:options.workerUrl||'https://salarymate.example/sw.js'},clients:{claim(){flags.claim=true;}},skipWaiting(){flags.skip=true;},addEventListener:(type,handler)=>events.set(type,handler)};
  const caches={
    open:async name=>({addAll:async assets=>cached.push(...assets),put:async(request,response)=>writes.push([name,request,response]),match:async request=>options.currentMatch?.(request)}),
    keys:async()=>['salarymate-shell-v4.3.2-dev.4','salarymate-shell-v4.3.2','unrelated-app'],
    delete:async name=>{removed.push(name);return true;},match:async request=>options.match?.(request)
  };
  vm.runInNewContext(read('dist/sw.js').toString(),{self,caches,URL,Response,fetch:options.fetch||(()=>Promise.reject(new Error('offline')))});
  const dispatch=async(type,request)=>{const waits=[];let response;events.get(type)({request,waitUntil:p=>waits.push(p),respondWith:p=>{response=p;}}); const result=await response; await Promise.all(waits); return result;};
  return {dispatch,removed,cached,writes,flags};
};

test('RC：PWA 安裝完整快取所有功能模組與入口',async()=>{
  const runtime=worker();await runtime.dispatch('install');
  for(const name of ['app.js','bootstrap.js','glass.js','reconcile.js','copy-month.js','comp-time.js','annual-analysis.js','annual-analysis.css','release-polish.css'])assert(runtime.cached.includes(`./${name}?v=4.3.2`));
  assert(runtime.cached.includes('./index.html'));assert(runtime.flags.skip);
  for(const asset of runtime.cached){const name=asset.replace(/^\.\//,'').split('?')[0]||'index.html';assert(read('dist/'+name).length>0);}
});

test('RC：PWA 啟用只刪除 SalaryMate 舊快取，保留目前與其他應用快取',async()=>{
  const runtime=worker();await runtime.dispatch('activate');
  assert.deepEqual(runtime.removed,['salarymate-shell-v4.3.2-dev.4']);assert(runtime.flags.claim);
});

test('RC：PWA 斷線讀快取／導航入口，成功請求更新快取且略過跨站與寫入請求',async()=>{
  const request={url:'https://salarymate.example/app.js',method:'GET',mode:'cors'}, cached=new Response('cached');
  const offline=worker({match:r=>r===request?cached:undefined});assert.equal(await offline.dispatch('fetch',request),cached);
  const index=new Response('index');const navigation=worker({match:r=>r==='./index.html'?index:undefined});
  assert.equal(await navigation.dispatch('fetch',{...request,mode:'navigate'}),index);
  const online=worker({fetch:async()=>new Response('network')});
  assert.equal(await (await online.dispatch('fetch',request)).text(),'network');assert.equal(online.writes.length,1);
  assert.equal(await online.dispatch('fetch',{...request,method:'POST'}),undefined);
  assert.equal(await online.dispatch('fetch',{...request,url:'https://elsewhere.example/'}),undefined);
});

test('Stable：目前版本快取命中免網路，根目錄與 GitHub 子路徑皆適用',async()=>{
  for(const prefix of ['/','/SalaryMate/']){
    let requests=0;const cached=new Response('current');
    const runtime=worker({workerUrl:'https://salarymate.example'+prefix+'sw.js',currentMatch:()=>cached,fetch:async()=>{requests++;return new Response('network');}});
    const result=await runtime.dispatch('fetch',{url:'https://salarymate.example'+prefix+'app.js?v=4.3.2',method:'GET',mode:'cors'});
    assert.equal(result,cached);assert.equal(requests,0);
  }
});
test('Stable：版本資產缺快取才下載，舊版或其他路徑不能誤中目前版本',async()=>{
  let requests=0;const runtime=worker({currentMatch:()=>undefined,fetch:async()=>{requests++;return new Response('fresh');},match:()=>new Response('stale')});
  const request={url:'https://salarymate.example/app.js?v=4.3.2',method:'GET',mode:'cors'};
  assert.equal(await (await runtime.dispatch('fetch',request)).text(),'fresh');assert.equal(requests,1);assert.equal(runtime.writes.length,1);
  const other=worker({currentMatch:()=>new Response('current'),fetch:async()=>new Response('network')});
  assert.equal(await (await other.dispatch('fetch',{...request,url:'https://salarymate.example/app.js?v=4.3.2-RC.2'})).text(),'network');
});
