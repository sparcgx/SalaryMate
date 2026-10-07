import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStockMarket} from '../server/stock-market.mjs';
import '../dist/dev/v5.0.0-dev.2/stocks.js';
import '../dist/dev/v5.0.0-dev.2/stocks-integrations.js';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const core=globalThis.SalaryMateStocks,service=globalThis.SalaryMateStockServices;
const holding=(o={})=>({id:'h1',symbol:'2330',name:'台積電',category:'台股',shares:60,avgPrice:100,currentPrice:120,priceUpdatedAt:'2026-09-30T08:00:00Z',...o});
const trade=(o={})=>({id:'t1',symbol:'2330',name:'台積電',category:'台股',type:'BUY',shares:100,price:100,date:'2026-09-01',fee:0,tax:0,...o});
const backup=(o={})=>({format:'smartportfolio-backup',backupVersion:1,appVersion:'1.12.0',exportedAt:'2026-10-02T08:00:00Z',data:{schemaVersion:3,holdings:[holding()],transactions:[trade({id:'t3',type:'DIVIDEND',date:'2026-09-03',amount:100,tax:10}),trade({id:'t2',type:'SELL',shares:40,price:150,date:'2026-09-02'}),trade()],marketData:{usdTwdRate:32},...o}});
const options={snapshotDate:'2026-10-02',token:'unique-backup'};
const asset=(o={})=>({id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'',quotePrice:100,quoteFx:1,quoteDate:'2026-09-01',...o});
const snapshot=(o={})=>({fetchedAt:'2026-10-02T10:00:00Z',quotes:[{symbol:'2330',market:'TW',currency:'TWD',name:'台積電',price:120,date:'2026-10-02',source:'TWSE 上市收盤',providerTime:'2026-10-02'}],errors:[],fx:{rate:32,date:'2026-10-02'},...o});
const request=(body,path='quotes',headers={})=>new Request('https://salary.example/api/stocks/'+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
const tick=()=>new Promise(r=>setTimeout(r,15));
async function until(check){for(let i=0;i<80;i++){if(check())return;await tick();}assert.ok(check(),'Async UI did not settle');}
test('SmartPortfolio: envelope and raw schema 3 replay preserve quantities and dividend net without doubling',()=>{
 for(const value of [backup(),backup().data]){const r=service.prepareSmart(value,core.empty(),options),m=core.calculate(r.next,2026);assert.equal(r.assets,1);assert.equal(r.transactions,3);assert.equal(m.holdings[0].quantity,60);assert.equal(m.cost,6000);assert.equal(m.yearRealized,2000);assert.equal(m.yearDividends,90);assert.equal(r.next.smartImports[0].original.format,value.format);}
});
test('SmartPortfolio: same-day history respects original newest-first ordering',()=>{
 const b=backup({transactions:[trade({id:'sell',type:'SELL',shares:40,price:150}),trade()]});const r=service.prepareSmart(b,core.empty(),options);assert.equal(core.calculate(r.next).holdings[0].quantity,60);
});
test('SmartPortfolio: incomplete history falls back to explicit opening plus read-only history; never adds shares twice',()=>{
 const b=backup({holdings:[holding({shares:500,avgPrice:80})]});assert.throws(()=>service.prepareSmart(b,core.empty(),options),/履歷與/);
 const r=service.prepareSmart(b,core.empty(),{...options,mode:'snapshot'}),m=core.calculate(r.next,2026);assert.equal(m.holdings[0].quantity,500);assert.equal(m.cost,40000);assert.equal(m.realized,0);assert.equal(m.yearDividends,90);assert.equal(r.archived,2);assert.equal(m.events.find(t=>t.type==='opening').cash,0);assert.equal(r.next.smartImports[0].original.data.transactions.length,3);
});
test('SmartPortfolio: foreign transaction FX and fallback conversion are explicit, and buy fees become cost',()=>{
 const b=backup({holdings:[holding({symbol:'AAPL',category:'美股',shares:2,avgPrice:100})],transactions:[trade({symbol:'AAPL',category:'美股',shares:2,fee:1,fxRate:30})]});const r=service.prepareSmart(b,core.empty(),options);assert.equal(core.calculate(r.next).cost,6030);assert.equal(r.fxFallbacks,0);assert.match(r.warnings.join(' '),/買入費稅/);
 delete b.data.transactions[0].fxRate;const f=service.prepareSmart(b,core.empty(),options);assert.equal(f.fxFallbacks,1);assert.match(f.warnings.join(' '),/並非原交易日匯率/);assert.equal(core.calculate(f.next).cost,6432);
 delete b.data.marketData.usdTwdRate;assert.throws(()=>service.prepareSmart(b,core.empty(),options),/缺少匯率/);
});
test('SmartPortfolio: fund holdings and sold-out assets survive import; missing price dates stay unknown',()=>{
 const b=backup({holdings:[holding({shares:10,avgPrice:20,category:'公募基金',symbol:'FUND',priceUpdatedAt:null})],transactions:[trade({shares:2}),trade({id:'sold',type:'SELL',shares:2,date:'2026-09-02'})]});const r=service.prepareSmart(b,core.empty(),{...options,mode:'snapshot'});const fund=r.next.assets.find(a=>a.symbol==='FUND');assert.equal(fund.market,'OTHER');assert.equal(fund.quotePrice,null);assert.equal(r.assets,2);assert.equal(r.archived,2);
});
test('SmartPortfolio: duplicate backup/asset, unknown schema, negative units and malformed dividends are rejected without mutation',()=>{
 const b=backup(),r=service.prepareSmart(b,core.empty(),options),before=JSON.stringify(r.next);assert.throws(()=>service.prepareSmart(b,r.next,options),/已經匯入/);assert.throws(()=>service.prepareSmart(b,r.next,{...options,token:'different'}),/已有 SmartPortfolio/);assert.equal(JSON.stringify(r.next),before);
 for(const bad of [backup({schemaVersion:4}),backup({holdings:[holding({shares:-1})]}),backup({transactions:[trade({type:'DIVIDEND',amount:10,tax:20})]}),backup({transactions:[trade(),trade()]})])assert.throws(()=>service.prepareSmart(bad,core.empty(),options));
});
test('Quote application: partial success updates matching assets; failed/older quotes and missing FX preserve prior data',()=>{
 const p={assets:[asset(),asset({id:'us',symbol:'AAPL',market:'US',currency:'USD',quoteFx:31})],transactions:[]},s=snapshot();let r=service.applyQuotes(p,s,'2026-10-02');assert.equal(r.updated.length,1);assert.equal(r.next.assets[0].quotePrice,120);assert.equal(r.next.assets[1].quotePrice,100);assert.equal(p.assets[0].quotePrice,100);
 s.quotes[0].date='2025-01-01';r=service.applyQuotes(p,s,'2026-10-02');assert.equal(r.updated.length,0);
 s.quotes=[{...snapshot().quotes[0],symbol:'AAPL',market:'US',currency:'USD'}];s.fx=null;r=service.applyQuotes(p,s,'2026-10-02');assert.equal(r.next.assets[1].quoteFx,31);assert.equal(r.updated.length,0);
});
test('Market API: parses official Taiwan feeds, Nasdaq company names, dates and FX',async()=>{
 const seen=[];const fake=async url=>{seen.push(url);return new Response(JSON.stringify(url.includes('STOCK_DAY_ALL')?[{Code:'2330',Name:'台積電',Date:'1151002',ClosingPrice:'1,200.00'}]:url.includes('tpex_')?[{SecuritiesCompanyCode:'00679B',CompanyName:'元大美債20年',Date:'1151002',Close:'30.2'}]:url.includes('frankfurter')?{rate:32,date:'2026-10-02'}:{data:{symbol:'AAPL',companyName:'Apple Inc.',primaryData:{lastSalePrice:'$200.50',lastTradeTimestamp:'Closed at Oct 2, 2026 4:00 PM ET'}}}));};
 const h=createStockMarket(fake),r=await h(request({instruments:[{market:'TW',symbol:'2330'},{market:'TW',symbol:'00679B'},{market:'US',symbol:'AAPL'}]})),d=await r.json();assert.equal(r.status,200);assert.equal(d.quotes.length,3);assert.equal(d.quotes.find(x=>x.symbol==='AAPL').name,'Apple Inc.');assert.equal(d.quotes.find(x=>x.symbol==='2330').price,1200);assert.equal(d.quotes[0].date,'2026-10-02');assert.equal(d.fx.rate,32);assert.ok(seen.every(u=>u.startsWith('https://')));
 const lookup=await h(request({market:'TW',symbol:'2330'},'lookup'));assert.equal((await lookup.json()).quotes[0].name,'台積電');
});
test('Market API: rejects foreign origins, oversized batches, URL injection, GET; upstream failures are explicit',async()=>{
 let calls=0;const h=createStockMarket(async()=>{calls++;throw new Error('offline');});
 assert.equal((await h(request({instruments:[]},'quotes',{origin:'https://evil.test'}))).status,403);
 assert.equal((await h(request({instruments:Array(21).fill({market:'TW',symbol:'2330'})}))).status,400);
 assert.equal((await h(request({market:'US',symbol:'https://evil.test'},'lookup'))).status,400);
 assert.equal((await h(new Request('https://salary.example/api/stocks/quotes'))).status,405);assert.equal(calls,0);
 const d=await (await h(request({instruments:[{market:'TW',symbol:'2330'}]}))).json();assert.equal(d.quotes.length,0);assert.equal(d.errors.length,1);
});
test('UI: one-click refresh sends only instrument identity, keeps trade FX and shows source',async()=>{
 const seed=fixture();seed.stockPortfolio={assets:[asset()],transactions:[{id:'t',assetId:'a',type:'buy',date:'2026-09-01',time:'12:00',quantity:10,price:80,fee:0,tax:0,fx:1}]};const b=boot(seed);let sent;
 b.w.fetch=async(path,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>snapshot()};};b.tab('investment');b.click('[data-stock="refresh"]');await until(()=>b.q('.stock-sync-result'));assert.deepEqual(sent,{instruments:[{market:'TW',symbol:'2330'}]});assert.equal(b.state().stockPortfolio.assets[0].quotePrice,120);assert.equal(b.state().stockPortfolio.transactions[0].fx,1);assert.match(b.q('main').textContent,/TWSE 上市收盤/);assert.deepEqual(b.errors,[]);b.close();
});
test('UI: quote failure and stale responses never replace prices or newly edited assets',async()=>{
 const seed=fixture();seed.stockPortfolio={assets:[asset()],transactions:[]};const b=boot(seed);let release;b.w.fetch=()=>new Promise(r=>release=r);b.tab('investment');b.click('[data-stock="refresh"]');b.click('[data-stock="tab"][data-id="watchlist"]');b.click('[data-stock="asset"][data-id="a"]');b.change('#stockForm [name="name"]','新名稱');b.submit('#stockForm');release({ok:true,json:async()=>snapshot()});await until(()=>b.q('.stock-sync-result'));assert.equal(b.state().stockPortfolio.assets[0].name,'新名稱');assert.equal(b.state().stockPortfolio.assets[0].quotePrice,100);assert.match(b.q('.stock-sync-result').textContent,/已變更/);assert.deepEqual(b.errors,[]);b.close();
});
test('UI: lookup fills name/currency, ignores stale symbol response and preserves manual edits',async()=>{
 const b=boot();let releases=[];b.w.fetch=()=>new Promise(r=>releases.push(r));b.tab('investment');b.click('[data-stock="asset"]');b.change('#stockForm [name="symbol"]','2330');b.click('[data-stock="lookup"]');b.change('#stockForm [name="symbol"]','0050');releases.shift()({ok:true,json:async()=>snapshot()});await tick();assert.equal(b.q('#stockForm [name="name"]').value,'');
 b.click('[data-stock="lookup"]');releases.shift()({ok:true,json:async()=>snapshot({quotes:[{...snapshot().quotes[0],symbol:'0050',name:'元大台灣50'}]})});await until(()=>b.q('#stockForm [name="name"]').value==='元大台灣50');
 b.click('[data-stock="lookup"]');b.change('#stockForm [name="name"]','我的自訂名稱');releases.shift()({ok:true,json:async()=>snapshot({quotes:[{...snapshot().quotes[0],symbol:'0050',name:'元大台灣50'}]})});await tick();assert.equal(b.q('#stockForm [name="name"]').value,'我的自訂名稱');assert.deepEqual(b.errors,[]);b.close();
});
test('UI: SmartPortfolio file previews, acknowledgement gates import, full backup reload preserves archive and payroll',async()=>{
 const b=boot(fixture()),before=b.state().records;b.tab('investment');b.click('[data-stock="import"]');const input=b.q('#smartPortfolioFile'),file={name:'SmartPortfolio.json',size:2000,text:async()=>JSON.stringify(backup({holdings:[holding({shares:500,avgPrice:80})]}))};Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new b.w.Event('change',{bubbles:true}));await until(()=>b.q('#stockImportForm'));assert.equal(b.q('#stockImportForm [name="mode"]').value,'snapshot');assert.match(b.q('#stockImportPreview').textContent,/500/);assert.equal(b.state().stockPortfolio.assets.length,0);
 b.submit('#stockImportForm');assert.equal(b.state().stockPortfolio.assets.length,0);b.click('#stockImportForm [name="ack"]');b.submit('#stockImportForm');assert.equal(b.state().stockPortfolio.assets.length,1);assert.deepEqual(b.state().records,before);assert.equal(core.calculate(b.state().stockPortfolio).holdings[0].quantity,500);
 b.click('[data-stock="archives"]');assert.match(b.q('#appDialog').textContent,/歷史留存/);b.click('[data-stock="export-smart"]');assert.ok(b.downloads.includes('SmartPortfolio_原始備份.json'));const c=boot(b.raw());assert.equal(c.state().stockPortfolio.smartImports.length,1);assert.equal(c.state().stockPortfolio.smartImports[0].original.data.holdings[0].shares,500);for(const x of [b,c]){assert.deepEqual(x.errors,[]);x.close();}
});
test('Worker: retains all existing routes/binary icons and serves only known API routes',async()=>{
 const worker=(await import('../dist/server/index.js')).default;
 for(const route of ['/','/dev/v5.0.0-dev.2/','/dev/v5.0.0-dev.2/stocks-integrations.js','/dev/v5.0.0-dev.2/icons/icon-192.png']){const r=await worker.fetch(new Request('https://site.test'+route));assert.equal(r.status,200,route);const data=await r.arrayBuffer();assert.ok(data.byteLength>100);}
 assert.equal((await worker.fetch(new Request('https://site.test/api/not-found'))).status,404);assert.equal((await worker.fetch(new Request('https://site.test/api/stocks/quotes'))).status,405);
 const html=await (await worker.fetch(new Request('https://site.test/dev/v5.0.0-dev.2/'))).text();assert.match(html,/個人薪資與投資管理/);assert.match(html,/stocks-integrations\.js/);const manifest=JSON.parse(fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/manifest.webmanifest',import.meta.url)));assert.match(manifest.name,/個人薪資與投資管理/);
});
test('Global JSON import detects SmartPortfolio and routes to additive preview instead of replacing payroll',async()=>{
 const b=boot(fixture()),before=b.state().records;await b.w.SalaryMateData.importPayload(JSON.stringify(backup()));assert.ok(b.q('#stockImportForm'));assert.equal(b.state().stockPortfolio.assets.length,0);b.click('#stockImportForm [name="ack"]');b.submit('#stockImportForm');assert.equal(b.state().stockPortfolio.assets.length,1);assert.deepEqual(b.state().records,before);assert.deepEqual(b.errors,[]);b.close();
});
