import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {salaryMateCsp} from '../server/security-policy.mjs';
const content=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/stocks-integrations.js',import.meta.url),'utf8');
const clientSource=content.slice(content.indexOf('// R66:'));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(respond){
 const timers=new Map(),sockets=[],requests=[],now=Date.now()-60000;let next=0;
 class Socket {constructor(url){this.url=url;this.sent=[];sockets.push(this);}send(s){this.sent.push(JSON.parse(s));}close(){this.closed=true;}}
 const env={WebSocket:Socket,AbortController,setTimeout:(f,n)=>{timers.set(++next,{f,n});return next;},clearTimeout:id=>timers.delete(id),fetch:async(url,init)=>{requests.push({url,init});if(respond)return respond(url,init);return Response.json(url.includes('tickers')?{type:'INDEX',data:[{symbol:'IX0002',name:'Test index'}]}:url.includes('candles')?{type:'INDEX',symbol:'IX0001',data:[{date:new Date(now-60000).toISOString(),close:99},{date:new Date(now).toISOString(),close:100}]}:{type:'INDEX',symbol:'IX0001',lastUpdated:now*1000,closePrice:100,previousClose:100,isClose:true});}};
 const context=vm.createContext({Date,Promise});vm.runInContext(clientSource,context);const client=context.SalaryMateIndices.create(()=>{},env);
 const receive=m=>sockets.at(-1).onmessage({data:JSON.stringify(m)});
 const open=()=>{client.setActive(true);assert.equal(client.connect('synthetic-secret'),true);sockets.at(-1).onopen();};
 return {client,env,timers,sockets,requests,now,receive,open};
}
test('personal key goes only to Fugle auth/API and is never in exported snapshots',async()=>{
 const f=fixture();f.open();assert.equal(f.sockets.length,1);assert.equal(f.sockets[0].url,'wss://api.fugle.tw/marketdata/v1.0/stock/streaming');assert.deepEqual(f.sockets[0].sent,[{event:'auth',data:{apikey:'synthetic-secret'}}]);
 f.receive({event:'authenticated'});await turn();assert.deepEqual(f.sockets[0].sent[1],{event:'subscribe',data:{channel:'indices',symbol:'IX0001'}});
 assert.equal(f.requests.length,4);for(const r of f.requests){assert.equal(new URL(r.url).origin,'https://api.fugle.tw');assert.equal(r.init.credentials,'omit');assert.equal(r.init.redirect,'error');assert.equal(r.init.body,undefined);assert.equal(r.init.headers['X-API-KEY'],'synthetic-secret');}
 assert.ok(!JSON.stringify(f.client.snapshot()).includes('synthetic-secret'));assert.equal(f.client.snapshot().percent,0);assert.equal(f.client.snapshot().points.length,2);
 f.client.disconnect();assert.equal(f.client.snapshot().hasKey,false);assert.equal(f.sockets[0].closed,true);
});
test('malformed, wrong-symbol and out-of-order ticks do not corrupt chart or quote',async()=>{
 const f=fixture();f.open();f.receive({event:'authenticated'});await turn();
 f.receive({event:'data',channel:'indices',data:{type:'INDEX',symbol:'IX0001',index:105,time:(f.now+20000)*1000}});
 const prior=JSON.stringify(f.client.snapshot());for(const d of [{symbol:'IX0002',index:999,time:f.now*1000},{symbol:'IX0001',index:0,time:f.now*1000},{symbol:'IX0001',index:90,time:(f.now-10000)*1000},{symbol:'IX0001',index:109,time:'invalid'}])f.receive({event:'data',channel:'indices',data:{type:'INDEX',...d}});
 assert.equal(JSON.stringify(f.client.snapshot()),prior);assert.equal(f.client.snapshot().value,105);assert.equal(f.client.snapshot().change,5);
});
test('new trading day resets prior close instead of showing fabricated daily changes',async()=>{
 const f=fixture();f.open();f.receive({event:'authenticated'});await turn();// Use a past day then current date to avoid future ticks
 const old=f.now-86400000;const g=fixture(async url=>Response.json(url.includes('tickers')?{type:'INDEX',data:[]}:url.includes('candles')?{symbol:'IX0001',type:'INDEX',data:[]}:{symbol:'IX0001',type:'INDEX',lastUpdated:old*1000,closePrice:90,previousClose:85}));
 g.open();g.receive({event:'authenticated'});await turn();g.receive({event:'data',channel:'indices',data:{symbol:'IX0001',type:'INDEX',index:100,time:f.now*1000}});
 assert.equal(g.client.snapshot().previous,null);assert.equal(g.client.snapshot().percent,null);assert.equal(g.client.snapshot().points.length,1);
});
test('pause closes connections, resume opens one, and stale callbacks are ignored',async()=>{
 const f=fixture();f.open();const old=f.sockets[0],callback=old.onmessage;f.client.setActive(false);assert.equal(old.closed,true);
 callback({data:JSON.stringify({event:'data',channel:'indices',data:{symbol:'IX0001',type:'INDEX',index:99,time:f.now*1000}})});assert.equal(f.client.snapshot().value,null);
 f.client.setActive(true);f.client.setActive(true);assert.equal(f.sockets.length,2);f.client.disconnect();f.client.setActive(false);f.client.setActive(true);assert.equal(f.sockets.length,2);
});
test('authentication error cannot retry-loop or leak provider error text',()=>{
 const f=fixture();f.open();f.receive({event:'error',data:{message:'synthetic-secret <script>'}});assert.equal(f.client.snapshot().status,'auth-error');assert.equal(f.sockets[0].closed,true);assert.ok(!JSON.stringify(f.client.snapshot()).includes('synthetic-secret'));assert.equal([...f.timers.values()].filter(x=>x.n>=2000).length,0);
});
test('catalog validates selected symbols and failed history is not drawn as zero',async()=>{
 const f=fixture(async url=>url.includes('tickers')?Response.json({type:'INDEX',data:[{symbol:'IX0002',name:'Other'},{symbol:'https://evil.test',name:'invalid'}]}):new Response('',{status:503}));f.open();f.receive({event:'authenticated'});await turn();assert.equal(f.client.snapshot().value,null);assert.equal(f.client.snapshot().points.length,0);assert.equal(f.client.snapshot().partial,true);
 f.client.select('https://evil.test');assert.equal(f.client.snapshot().symbol,'IX0001');f.client.select('IX0002');assert.equal(f.client.snapshot().symbol,'IX0002');assert.equal(f.sockets.length,2);
});
test('hosted and portable CSP allow direct Fugle connections without relaxing scripts',()=>{
 for(const p of [salaryMateCsp(),salaryMateCsp({portable:true,marketOrigin:'https://site.test',scriptHashes:["'sha256-test'"]})]){assert.ok(p.includes('https://api.fugle.tw wss://api.fugle.tw'));assert.ok(p.includes("script-src-attr 'none'"));assert.ok(!p.includes('https://*.fugle.tw'));}
});
