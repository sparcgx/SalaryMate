import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {translationHarness} from './helpers/v5-performance-native.mjs';

// Direct production-function execution with native promises, Responses and
// callback spies. No browser, DOM implementation, user data or network traffic.
const repository=process.env.SALARYMATE_REPOSITORY||path.resolve(import.meta.dirname,'..');
const base=path.join(repository,'dist/dev/v5.0.0-dev.2');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const source=read('app.js'),swSource=read('sw.js');
const version=source.match(/const APP_VERSION\s*=\s*'([^']+)'/)?.[1];
assert.ok(version,'production version marker');
const between=(text,start,end)=>{const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a,`${start} production boundaries`);return text.slice(a,b);};
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((y,n)=>{resolve=y;reject=n;});return {promise,resolve,reject};};

function fixture({protocol='https:',portable=false,initialHtml,appendError=false,serviceWorkerReady}={}){
 const scripts=[],timers=new Map(),swEvents=new Map(),calls={applications:[],focus:0,closes:0,stops:0,removed:0,posts:[]};let timerId=0;
 const i18n=translationHarness({'i18n-en.js':read('i18n-en.js'),'i18n.js':read('i18n.js')},'zh');
 const dialog={open:false,classList:{toggle(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;calls.closes++;},contains:()=>false};
 const content={innerHTML:''},focus={focus:()=>calls.focus++};
 const document={baseURI:protocol==='file:'?'file:///fixture/SalaryMate.html':'https://fixture.test/dev/v5.0.0-dev.2/index.html',activeElement:focus,
  createElement:name=>{assert.equal(name,'script');return {src:'',async:false,onload:null,onerror:null,remove(){calls.removed++;this.removed=true;}};},
  head:{append(script){if(appendError)throw Error('fixture append failure');scripts.push(script);}}};
 const $=selector=>selector==='#appDialog'?dialog:selector==='#dialogContent'?content:selector==='#legalLoadState'?(content.innerHTML.includes('id="legalLoadState"')?{}:null):focus;
 const context={Promise,URL,Error,document,location:{protocol},APP_VERSION:version,$,ui:{},stocksUI:{cancelDialogRequests(){}},
  escapeHtml:String,enhanceFormAccessibility(){},v5Clean(){},enhanceVisualHierarchy(){},captureDialogBaseline(){},clearDraftScope(){},
  setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
  navigator:{serviceWorker:{ready:serviceWorkerReady||Promise.resolve({active:{postMessage:value=>calls.posts.push(value)}}),
   addEventListener(name,fn,options){if(!swEvents.has(name))swEvents.set(name,[]);swEvents.get(name).push({fn,options});},
   removeEventListener(name,fn){swEvents.set(name,(swEvents.get(name)||[]).filter(entry=>entry.fn!==fn));}}}};
 context.window={scrollY:0,scrollTo(){},matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>fn(),
  SalaryMateCompanion:{stop:()=>calls.stops++},SalaryMateI18n:{apply:()=>calls.applications.push({language:i18n.api.language(),body:content.innerHTML})},
  SalaryMatePortable:portable?{}:undefined,SalaryMateLegal:initialHtml===undefined?undefined:{html:initialHtml}};
 const opening=between(source,'    const dialogShell =','    const dialogFocusableElements =');
 const closing=between(source,'    const closeDialog =','    const interfaceStylePreview =');
 vm.createContext(context);vm.runInContext(opening+'\n'+closing+'\nglobalThis.api={loadLegalContent,legalHtml,retainLegalForOffline,openLegal,openDialog,closeDialog,revision:()=>dialogRevision,pending:()=>legalPending};',context);
 const success=(html='<h3>薪資與加班試算</h3><p>說明全文。</p>')=>{context.window.SalaryMateLegal={html};const script=scripts.at(-1);assert.ok(script?.onload);script.onload();return html;};
 const dispatchSw=name=>{for(const entry of [...(swEvents.get(name)||[])]){entry.fn();if(entry.options?.once)context.navigator.serviceWorker.removeEventListener(name,entry.fn);}};
 return {context,api:context.api,dialog,content,scripts,timers,calls,i18n,success,swEvents,dispatchSw};
}

test('R93 legal loading uses the versioned same-origin URL, one pending Promise, then memory on reopening',async()=>{
 const h=fixture(),a=h.api.loadLegalContent(),b=h.api.loadLegalContent();assert.equal(a,b);assert.equal(h.scripts.length,1);
 assert.equal(h.scripts[0].src,'https://fixture.test/dev/v5.0.0-dev.2/legal-data.js?v='+version);assert.equal(h.scripts[0].async,true);
 const html=h.success();assert.equal(await a,html);await tick();assert.equal(h.api.pending(),null);assert.equal(h.timers.size,0);assert.equal(h.scripts[0].onload,null);assert.equal(h.scripts[0].onerror,null);assert.equal(h.scripts[0].removed,true);
 assert.equal(await h.api.loadLegalContent(),html);await h.api.openLegal();assert.match(h.content.innerHTML,/說明全文/);h.api.closeDialog();await h.api.openLegal();assert.equal(h.scripts.length,1);
});

test('R93 legal load error and invalid payload can retry with a new script and clear old callbacks',async()=>{
 for(const mode of ['error','invalid']){
  const h=fixture(),a=h.api.loadLegalContent();const rejected=assert.rejects(a);const first=h.scripts[0];
  if(mode==='error')first.onerror();else{h.context.window.SalaryMateLegal={html:'   '};first.onload();}
  await rejected;await tick();assert.equal(h.api.pending(),null);assert.equal(h.timers.size,0);assert.equal(first.onload,null);assert.equal(first.onerror,null);
  const next=h.api.loadLegalContent();assert.equal(h.scripts.length,2);assert.notEqual(next,a);h.success();await next;
 }
});

test('R93 legal timeout cleans up and permits retry; late handlers cannot settle the new load',async()=>{
 const h=fixture(),a=h.api.loadLegalContent();const rejected=assert.rejects(a,/timed out/),first=h.scripts[0],late=first.onload;
 const timer=[...h.timers.values()][0];assert.equal(timer.delay,20000);timer.fn();await rejected;await tick();assert.equal(h.timers.size,0);assert.equal(h.api.pending(),null);
 const next=h.api.loadLegalContent();assert.equal(h.scripts.length,2);late();assert.equal(h.api.pending(),next);h.success();await next;
});

test('R93 synchronous script insertion failure rejects and removes timer and callbacks',async()=>{
 const h=fixture({appendError:true});await assert.rejects(h.api.loadLegalContent(),/append failure/);await tick();assert.equal(h.api.pending(),null);assert.equal(h.timers.size,0);assert.equal(h.calls.removed,1);
});

test('R93 openLegal keeps the loading state, renders retry on failure, then recovers',async()=>{
 const h=fixture(),first=h.api.openLegal();assert.equal(h.dialog.open,true);assert.match(h.content.innerHTML,/legalLoadState/);assert.match(h.content.innerHTML,/role="status"/);
 h.scripts[0].onerror();await first;assert.match(h.content.innerHTML,/說明載入失敗/);assert.match(h.content.innerHTML,/data-action="open-legal"/);
 const next=h.api.openLegal();assert.equal(h.scripts.length,2);h.success();await next;assert.match(h.content.innerHTML,/說明全文/);
});

test('R93 closing or replacing the legal dialog ignores late success and late failure',async()=>{
 for(const replacement of ['closed','other-dialog'])for(const result of ['success','failure']){
  const h=fixture(),pending=h.api.openLegal(),revision=h.api.revision();
  if(replacement==='closed')h.api.closeDialog();else h.api.openDialog('另一個視窗','<p>保留其他表單</p>');
  assert.ok(h.api.revision()>revision);const preserved=h.content.innerHTML,applications=h.calls.applications.length;
  if(result==='success')h.success();else h.scripts[0].onerror();await pending;
  assert.equal(h.content.innerHTML,preserved);assert.equal(h.calls.applications.length,applications);assert.equal(h.dialog.open,replacement==='other-dialog');
 }
});

test('R93 consecutive legal opens share one request and only the current dialog replaces loading content',async()=>{
 const h=fixture(),one=h.api.openLegal(),two=h.api.openLegal();assert.equal(h.scripts.length,1);assert.equal(h.calls.applications.length,2);
 h.success();await Promise.all([one,two]);assert.equal(h.calls.applications.length,3);assert.match(h.content.innerHTML,/說明全文/);
});

test('R93 language switched while loading is applied at completion; loading/retry/errors retain full catalog entries',async()=>{
 const h=fixture(),one=h.api.openLegal();assert.equal(h.calls.applications.at(-1).language,'zh');h.i18n.api.set('en');h.success();await one;assert.equal(h.calls.applications.at(-1).language,'en');
 for(const label of ['正在載入授權與隱私說明…','說明載入失敗，請檢查連線後重試。','完整離線版缺少授權內容，請重新下載完整檔案。','重試'])assert.notEqual(h.i18n.api.text(label),label,label);
 h.i18n.api.set('zh');await h.api.openLegal();assert.equal(h.calls.applications.at(-1).language,'zh');
});

test('R93 full offline payload always opens from memory; missing portable/file payload never creates external scripts',async()=>{
 const context={window:{}};vm.runInNewContext(read('legal-data.js'),context);const html=context.window.SalaryMateLegal.html;assert.ok(html.length>200000);
 for(const options of [{portable:true,protocol:'https:'},{portable:false,protocol:'file:'}]){
  const complete=fixture({...options,initialHtml:html});assert.equal(await complete.api.loadLegalContent(),html);await complete.api.openLegal();assert.ok(complete.content.innerHTML.includes(html));assert.equal(complete.scripts.length,0);assert.equal(complete.timers.size,0);
  const incomplete=fixture(options);await assert.rejects(incomplete.api.loadLegalContent(),/缺少授權內容/);await incomplete.api.openLegal();assert.match(incomplete.content.innerHTML,/缺少授權內容/);assert.equal(incomplete.scripts.length,0);assert.equal(incomplete.timers.size,0);
 }
});

test('R93 legal retention waits for first-page SW ready and does not delay rendering or prefetch before use',async()=>{
 const ready=deferred(),h=fixture({serviceWorkerReady:ready.promise});assert.equal(h.calls.posts.length,0);assert.equal(h.scripts.length,0);
 const pending=h.api.openLegal();h.success();await pending;assert.match(h.content.innerHTML,/說明全文/);assert.equal(h.calls.posts.length,0);
 ready.resolve({active:{postMessage:value=>h.calls.posts.push(value)}});await tick();assert.equal(h.calls.posts.length,1);assert.equal(h.calls.posts[0].type,'salarymate:cache-legal');
});

test('R93 legal retention tolerates rejected ready and skips portable/file/http without external work',async()=>{
 const ready=deferred(),h=fixture({serviceWorkerReady:ready.promise}),pending=h.api.openLegal();h.success();await pending;ready.reject(Error('fixture registration rejected'));await tick();assert.match(h.content.innerHTML,/說明全文/);assert.equal(h.calls.posts.length,0);
 for(const options of [{portable:true},{protocol:'file:'},{protocol:'http:'}]){const h=fixture(options);h.api.retainLegalForOffline();await tick();assert.equal(h.calls.posts.length,0);assert.equal(h.swEvents.size,0);}
});

test('R93 legal retention repeats the cache message when a new SW controller replaces the previous release',async()=>{
 const h=fixture(),pending=h.api.openLegal();h.success();await pending;await tick();assert.equal(h.calls.posts.length,1);
 const current=[];h.context.navigator.serviceWorker.controller={postMessage:value=>current.push(value)};
 h.dispatchSw('controllerchange');await tick();assert.equal(current.length,1);assert.equal(current[0].type,'salarymate:cache-legal');
 h.dispatchSw('controllerchange');await tick();assert.equal(current.length,1,'only one controller-change resend');
});

function workerFixture(){
 const handlers=new Map(),cacheMaps=new Map(),calls={network:0,adds:[],puts:[]};let offline=false,networkGate,putFailure;
 const lookup=name=>{if(!cacheMaps.has(name))cacheMaps.set(name,new Map());const contents=cacheMaps.get(name);return {
  async match(url){return contents.get(typeof url==='string'?url:url.url)?.clone();},
  async put(url,response){const key=typeof url==='string'?url:url.url;if(putFailure?.(name,key))throw Error('fixture cache put failure');calls.puts.push(key);contents.set(key,response.clone());},
  async addAll(urls){calls.adds.push(...urls);}
 };};
 const context={URL,Response,Promise,Map,Set,
  self:{location:{href:'https://fixture.test/dev/v5.0.0-dev.2/sw.js'},addEventListener(name,callback){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(callback);},skipWaiting(){},clients:{claim(){}}},
  caches:{open:async name=>lookup(name),keys:async()=>[...cacheMaps.keys()],delete:async name=>cacheMaps.delete(name),async match(url){for(const name of cacheMaps.keys()){const value=await lookup(name).match(url);if(value)return value;}}},
  async fetch(url){calls.network++;if(offline)throw Error('fixture offline');if(networkGate)await networkGate.promise;return new Response('fixture legal module',{headers:{'content-type':'text/javascript; charset=utf-8'}});}};
 vm.createContext(context);vm.runInContext(swSource+'\nglobalThis.probe={OPTIONAL,SHELL,CACHE,BASE,VERSIONED_URLS};',context);
 const dispatch=async(name,parts={})=>{const pending=[];let response;const event={...parts,waitUntil:promise=>pending.push(promise),respondWith:promise=>{response=promise;}};for(const fn of handlers.get(name)||[])fn(event);await Promise.all(pending);return response?await response:undefined;};
 return {context,calls,handlers,dispatch,probe:context.probe,setOffline:value=>offline=value,setGate:value=>networkGate=value,setPutFailure:value=>putFailure=value};
}

test('R93 website manifest and SW install omit both legal payloads while OPTIONAL remains versioned',async()=>{
 const html=read('index.html'),modules=[...html.matchAll(/<script defer src="([^\"]+)"><\/script>/g)];assert.equal(modules.length,14);assert.ok(!modules.some(match=>match[1].includes('legal-data')));
 const h=workerFixture();assert.equal(h.probe.OPTIONAL.length,1);assert.match(h.probe.OPTIONAL[0],/^\.\/legal-data\.js\?v=/);assert.equal(h.probe.VERSIONED_URLS.has(new URL(h.probe.OPTIONAL[0],h.probe.BASE).href),true);
 assert.ok(!h.probe.SHELL.some(url=>/legal/.test(url)));await h.dispatch('install');assert.ok(h.calls.adds.length>0);assert.ok(!h.calls.adds.some(url=>/legal/.test(url)));assert.equal(h.calls.network,0);
});

test('R93 on-demand versioned legal response caches once and serves offline through the production fetch path',async()=>{
 const h=workerFixture(),url=new URL(h.probe.OPTIONAL[0],h.probe.BASE).href;let response=await h.dispatch('fetch',{request:new Request(url)});assert.equal(await response.text(),'fixture legal module');assert.equal(h.calls.network,1);assert.deepEqual(h.calls.puts,[url]);
 h.setOffline(true);response=await h.dispatch('fetch',{request:new Request(url)});assert.equal(await response.text(),'fixture legal module');assert.equal(h.calls.network,1);
 const fresh=workerFixture();fresh.setOffline(true);await assert.rejects(fresh.dispatch('fetch',{request:new Request(url)}),/offline/);
});

test('R93 concurrent legal cache requests deduplicate network work and preserve independently readable responses',async()=>{
 const h=workerFixture(),gate=deferred(),url=new URL(h.probe.OPTIONAL[0],h.probe.BASE).href;h.setGate(gate);const one=h.dispatch('fetch',{request:new Request(url)}),two=h.dispatch('fetch',{request:new Request(url)});await tick();assert.equal(h.calls.network,1);gate.resolve();const a=await one,b=await two;assert.notEqual(a,b);assert.equal(await a.text(),'fixture legal module');assert.equal(await b.text(),'fixture legal module');assert.equal(h.calls.puts.length,1);
});

test('R93 cache-legal messages accept only the current same-origin Site scope and retain first-page legal response',async()=>{
 const h=workerFixture(),data={type:'salarymate:cache-legal'};
 for(const source of [undefined,{url:'https://other.test/dev/v5.0.0-dev.2/'},{url:'https://fixture.test/dev/v5.0.0-dev.1/'}])await h.dispatch('message',{data,source});
 await h.dispatch('message',{data:{type:'unknown'},source:{url:'https://fixture.test/dev/v5.0.0-dev.2/'}});assert.equal(h.calls.network,0);
 await h.dispatch('message',{data,source:{url:'https://fixture.test/dev/v5.0.0-dev.2/index.html'}});assert.equal(h.calls.network,1);assert.equal(h.calls.puts.length,1);
 h.setOffline(true);await h.dispatch('message',{data,source:{url:'https://fixture.test/dev/v5.0.0-dev.2/'}});assert.equal(h.calls.network,1);
 const url=new URL(h.probe.OPTIONAL[0],h.probe.BASE).href;const response=await h.dispatch('fetch',{request:new Request(url)});assert.equal(await response.text(),'fixture legal module');assert.equal(h.calls.network,1);
});

test('R93 SW activation migrates only the exact current optional URL without fetching or overwriting a newer cache entry',async()=>{
 for(const alreadyCurrent of [false,true]){
  const h=workerFixture(),url=new URL(h.probe.OPTIONAL[0],h.probe.BASE).href,oldUrl=url.replace(/\?v=[^?]+$/,'?v=5.0.0-dev.2-R92'),oldName='salarymate-v5-full-5.0.0-dev.2-R92';
  const old=await h.context.caches.open(oldName);await old.put(url,new Response('downloaded current content'));await old.put(oldUrl,new Response('obsolete R92 content'));
  if(alreadyCurrent){const current=await h.context.caches.open(h.probe.CACHE);await current.put(url,new Response('already current content'));}
  h.setOffline(true);await h.dispatch('activate');assert.equal(h.calls.network,0);assert.equal((await h.context.caches.keys()).includes(oldName),false);
  const current=await h.context.caches.open(h.probe.CACHE);assert.equal(await (await current.match(url)).text(),alreadyCurrent?'already current content':'downloaded current content');assert.equal(await current.match(oldUrl),undefined);
  const result=await h.dispatch('fetch',{request:new Request(url)});assert.equal(await result.text(),alreadyCurrent?'already current content':'downloaded current content');assert.equal(h.calls.network,0);
 }
});

test('R93 SW activation does not substitute obsolete legal bytes and preserves old cache if current migration fails',async()=>{
 const h=workerFixture(),url=new URL(h.probe.OPTIONAL[0],h.probe.BASE).href,oldUrl=url.replace(/\?v=[^?]+$/,'?v=5.0.0-dev.2-R92'),oldName='salarymate-v5-full-5.0.0-dev.2-R92';
 const old=await h.context.caches.open(oldName);await old.put(oldUrl,new Response('obsolete R92 content'));h.setOffline(true);await h.dispatch('activate');const current=await h.context.caches.open(h.probe.CACHE);assert.equal(await current.match(url),undefined);assert.equal(h.calls.network,0);await assert.rejects(h.dispatch('fetch',{request:new Request(url)}),/offline/);
 const failed=workerFixture(),prior=await failed.context.caches.open(oldName);await prior.put(url,new Response('downloaded current content'));failed.setPutFailure((name,key)=>name===failed.probe.CACHE&&key===url);failed.setOffline(true);await failed.dispatch('activate');assert.equal(failed.calls.network,0);assert.equal((await failed.context.caches.keys()).includes(oldName),true);assert.equal(await (await prior.match(url)).text(),'downloaded current content');
});

test('R93 production Worker optional legal URL has immutable headers only for the exact current version',async()=>{
 const builder=fs.readFileSync(path.join(repository,'scripts/build-stock-worker.mjs'),'utf8'),optional=JSON.parse(swSource.match(/const OPTIONAL=(\[[^\n;]*\]);/)?.[1]);
 const versionedUrls=optional.map(asset=>'/dev/v5.0.0-dev.2/'+asset.slice(2)),route='/dev/v5.0.0-dev.2/legal-data.js',bytes=fs.readFileSync(path.join(base,'legal-data.js'));
 const context={JSON,immutableArt:[],versionedUrls,salaryMateCsp:()=>"script-src 'self'"};vm.createContext(context);vm.runInContext(between(builder,'const runtime=','\nawait mkdir')+'\nglobalThis.runtime=runtime;',context);
 const worker={URL,Response,Uint8Array,atob,STATIC_FILES:{[route]:{body:bytes.toString('base64'),type:'text/javascript; charset=utf-8'}},createStockMarket:()=>()=>{},createPortableMarket:()=>()=>{}};
 vm.createContext(worker);vm.runInContext(context.runtime.replace('export default {','globalThis.worker={'),worker);
 const exact=await worker.worker.fetch(new Request('https://fixture.test'+versionedUrls[0]));assert.equal(exact.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.equal(exact.headers.get('content-security-policy'),"script-src 'self'");assert.equal(Buffer.from(await exact.arrayBuffer()).equals(bytes),true);
 const stale=await worker.worker.fetch(new Request('https://fixture.test'+route+'?v=5.0.0-dev.2-R92'));assert.equal(stale.headers.get('cache-control'),'no-cache');
});

test('R93 portable manifest explicitly embeds legal data and Worker grants versioned OPTIONAL immutable caching',()=>{
 const builder=fs.readFileSync(path.join(repository,'scripts/build-single-html.mjs'),'utf8');assert.match(builder,/scripts\.length!==14/);assert.match(builder,/scripts\.unshift\(\['','legal-data\.js'\]\)/);assert.match(builder,/scriptHashes=scriptsInline\.map/);
 const worker=fs.readFileSync(path.join(repository,'scripts/build-stock-worker.mjs'),'utf8');assert.match(worker,/JSON\.parse\(optionalMatch\[1\]\)/);assert.match(worker,/versionedUrls\.push\(devBase\+asset\.slice\(2\)\)/);assert.match(worker,/VERSIONED_ASSETS\.has\(route\+url\.search\)/);
});

test('R93 generated portable retains byte-exact legal module and every precise CSP script hash when available',t=>{
 const portable=process.env.SALARYMATE_PORTABLE;
 if(!portable){t.skip('Set SALARYMATE_PORTABLE after generating the final artifact');return;}
 const html=fs.readFileSync(portable,'utf8'),blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];assert.equal(blocks.length,16);assert.ok(!/<script\b[^>]*\bsrc=/.test(html));
 const embedded=blocks.find(match=>match[1].includes('data-module="legal-data.js"'));assert.ok(embedded);assert.equal(embedded[2],'\n'+read('legal-data.js').replace(/<\/script/gi,'<\\/script')+'\n');
 const csp=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];assert.ok(csp);const hashes=[...csp.matchAll(/'sha256-([^']+)'/g)].map(match=>match[1]);assert.equal(hashes.length,16);for(const block of blocks)assert.ok(hashes.includes(createHash('sha256').update(block[2]).digest('base64')));
});
