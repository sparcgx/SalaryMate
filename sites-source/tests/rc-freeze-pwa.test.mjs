import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root));
const walk=(relative='dist')=>fs.readdirSync(new URL(relative+'/',root),{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(relative+'/'+item.name):[relative+'/'+item.name]).sort();

test('RC：全部執行期資產僅版本字串改變，功能與 dev.4 凍結內容一致',()=>{
  const freeze=JSON.parse(read('release-evidence/v4.3.2-RC.1_freeze.json'));
  assert.deepEqual(walk(),Object.keys(freeze.assets).sort());
  for(const [path,expected] of Object.entries(freeze.assets)) {
    const buffer=read(path);
    const normalized=buffer.includes(0)?buffer:Buffer.from(buffer.toString().replaceAll('4.3.2-RC.1','__RC_VERSION__').replaceAll('4.3.2-dev.4','__RC_VERSION__'));
    assert.equal(createHash('sha256').update(normalized).digest('hex'),expected,path+' changed beyond release identity');
  }
});

const worker=(options={})=>{
  const events=new Map(),removed=[],cached=[],writes=[],flags={skip:false,claim:false};
  const self={location:{origin:'https://salarymate.example'},clients:{claim(){flags.claim=true;}},skipWaiting(){flags.skip=true;},addEventListener:(type,handler)=>events.set(type,handler)};
  const caches={
    open:async name=>({addAll:async assets=>cached.push(...assets),put:async(request,response)=>writes.push([name,request,response])}),
    keys:async()=>['salarymate-shell-v4.3.2-dev.4','salarymate-shell-v4.3.2-RC.1','unrelated-app'],
    delete:async name=>{removed.push(name);return true;},match:async request=>options.match?.(request)
  };
  vm.runInNewContext(read('dist/sw.js').toString(),{self,caches,URL,Response,fetch:options.fetch||(()=>Promise.reject(new Error('offline')))});
  const dispatch=async(type,request)=>{const waits=[];let response;events.get(type)({request,waitUntil:p=>waits.push(p),respondWith:p=>{response=p;}}); const result=await response; await Promise.all(waits); return result;};
  return {dispatch,removed,cached,writes,flags};
};

test('RC：PWA 安裝完整快取所有功能模組與入口',async()=>{
  const runtime=worker();await runtime.dispatch('install');
  for(const name of ['app.js','bootstrap.js','glass.js','reconcile.js','copy-month.js','comp-time.js','annual-analysis.js','annual-analysis.css'])assert(runtime.cached.includes(`./${name}?v=4.3.2-RC.1`));
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
