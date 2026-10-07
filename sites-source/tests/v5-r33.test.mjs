import test from 'node:test';
import assert from 'node:assert/strict';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
import '../dist/dev/v5.0.0-dev.2/stocks.js';
import '../dist/dev/v5.0.0-dev.2/stocks-integrations.js';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const core=globalThis.SalaryMateStocks,services=globalThis.SalaryMateStockServices;
const asset=(over={})=>({id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'',note:'',quotePrice:100,quoteFx:1,quoteDate:'2026-10-02',...over});
const req=(path,body)=>new Request('https://site.test/api/stocks/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const quote={market:'TW',symbol:'2330',name:'台積電',currency:'TWD',price:120,date:'2026-10-02',change:2,changePercent:2/118*100,exchange:'TWSE',industry:'半導體',instrumentType:'stock',source:'TWSE 上市收盤'};
const fake=async url=>new Response(JSON.stringify(url.includes('STOCK_DAY_ALL')?[{Code:'2330',Name:'台積電',ClosingPrice:'120',Change:'+2',TradeVolume:'9000',Date:'1151002'},{Code:'0050',Name:'元大台灣50',ClosingPrice:'30',Change:'0',TradeVolume:'15000',Date:'1151002'}]:url.includes('tpex_mainboard')?[{SecuritiesCompanyCode:'6182',CompanyName:'合晶',Close:'50',Change:'-2',TradingShares:'100',Date:'1151002'},{SecuritiesCompanyCode:'12345A',CompanyName:'測試權證',Close:'1',Date:'1151002'}]:url.includes('t187ap03_L')?[{'公司代號':'2330','產業別':'24'}]:url.includes('t187ap03_O')?[{SecuritiesCompanyCode:'6182',SecuritiesIndustryCode:'24'}]:url.includes('t187ap47_L')?[{'基金代號':'0050'}]:[]));
const tick=()=>new Promise(r=>setTimeout(r,10));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.ok(check(),'Async operation did not finish');}
test('R33 official profiles, signed changes, ETF and catalog exclude unclassified warrants',async()=>{
 const h=createStockMarket(fake),d=await (await h(req('catalog',{query:''}))).json();
 assert.equal(d.total,3);assert.deepEqual(d.quotes.map(q=>q.symbol),['0050','2330','6182']);
 assert.equal(d.quotes[0].instrumentType,'etf');assert.equal(d.quotes[0].changePercent,0);
 assert.equal(d.quotes[1].industry,'半導體');assert.equal(d.quotes[1].changePercent,2/118*100);
 assert.equal(d.quotes[2].exchange,'TPEx');assert.equal(d.quotes[2].changePercent,-2/52*100);
 assert.equal((await (await h(req('catalog',{query:'半導體'}))).json()).total,2);
 assert.equal((await h(req('catalog',{query:[]}))).status,400);
 const portable=createPortableMarket(h);const r=await portable(new Request('https://site.test/api/stocks/portable/catalog',{method:'POST',headers:{origin:'null'},body:JSON.stringify({query:'0050'})}));
 assert.equal(r.headers.get('access-control-allow-origin'),'null');assert.equal((await r.json()).quotes[0].symbol,'0050');
});
test('R33 daily changes are unknown when absent; updates preserve custom classifications and icons',()=>{
 const a=asset({group:'長期',industryOverride:'自訂產業',favorite:true,iconMode:'symbol'}),p={assets:[a],transactions:[]};
 const next=services.applyQuotes(p,{quotes:[quote],errors:[],fetchedAt:'2026-10-02T10:00:00Z'},'2026-10-04').next;
 assert.equal(next.assets[0].quoteChange,2);assert.equal(next.assets[0].industryOverride,'自訂產業');assert.equal(next.assets[0].marketInfo.industry,'半導體');assert.equal(next.assets[0].favorite,true);
 const oldQuote={...quote};delete oldQuote.change;delete oldQuote.changePercent;
 const r=services.applyQuotes(next,{quotes:[oldQuote],errors:[]},'2026-10-04');assert.equal(r.next.assets[0].quoteChange,null);assert.equal(r.next.assets[0].quoteChangePercent,null);
 assert.deepEqual(core.normalize(next),next);assert.equal(a.quotePrice,100);
 assert.throws(()=>core.validate({assets:[asset({iconData:'data:image/svg+xml;base64,evil'})],transactions:[]}));
});
test('R33 CRUD, favorites, filters and full backup reload preserve all asset presentation fields',()=>{
 const b=boot(fixture());b.tab('investment');b.click('[data-stock="asset"]');
 b.change('#stockForm [name="symbol"]','CUSTOM');b.change('#stockForm [name="market"]','OTHER');b.change('#stockForm [name="name"]','我的標的');b.change('#stockForm [name="group"]','長期');b.change('#stockForm [name="typeOverride"]','fund');b.click('#stockForm [name="favorite"]');b.change('#stockForm [name="iconMode"]','symbol');b.submit('#stockForm');
 let a=b.state().stockPortfolio.assets[0];assert.ok(a);assert.equal(a.group,'長期');assert.equal(a.favorite,true);assert.equal(a.typeOverride,'fund');assert.equal(b.q('[data-stock="tab"][data-id="stocks"]').getAttribute('aria-current'),'page');
 b.click('[data-stock="favorite"]');assert.equal(b.state().stockPortfolio.assets[0].favorite,false);
 b.change('#stockListForm [name="category"]','長期');b.submit('#stockListForm');assert.equal(b.w.document.querySelectorAll('.stock-compact-list>li').length,1);
 b.click('#stockListForm [name="favorites"]');b.submit('#stockListForm');assert.equal(b.w.document.querySelectorAll('.stock-compact-list>li').length,0);
 const restored=boot(b.raw());assert.deepEqual(restored.state().stockPortfolio,b.state().stockPortfolio);assert.deepEqual(restored.state().records,b.state().records);restored.close();
 b.click('[data-stock="tab"][data-id="stocks"]');b.click('.stock-list-actions [data-stock="asset"]');b.change('#stockForm [name="group"]','');b.change('#stockForm [name="name"]','已編輯');b.submit('#stockForm');assert.equal(b.state().stockPortfolio.assets[0].group,'');
 b.click('.stock-list-actions [data-stock="delete-asset"]');b.q('#appDialog .btn-danger')?.click();if(b.state().stockPortfolio.assets.length){const buttons=[...b.w.document.querySelectorAll('#appDialog button')];buttons.find(x=>x.textContent.trim()==='刪除')?.click();}assert.equal(b.state().stockPortfolio.assets.length,0);assert.deepEqual(b.errors,[]);b.close();
});
test('R33 official catalog adds a reviewed asset without shares and persists latest classification/quote',async()=>{
 const b=boot(fixture());let sent;
 b.w.fetch=async(path,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({quotes:[quote],total:1,errors:[]})};};
 b.tab('investment');b.click('[data-stock="tab"][data-id="stocks"]');b.click('[data-stock="catalog"]');await until(()=>b.q('[data-stock="catalog-add"]'));
 assert.deepEqual(sent,{query:''});b.click('[data-stock="catalog-add"]');assert.equal(b.q('#stockForm [name="name"]').value,'台積電');b.submit('#stockForm');
 const p=b.state().stockPortfolio;assert.equal(p.assets.length,1);assert.equal(p.assets[0].marketInfo.industry,'半導體');assert.equal(p.assets[0].quoteChange,2);assert.equal(p.assets[0].quotePrice,120);assert.equal(p.transactions.length,0);assert.equal(core.calculate(p).holdings[0].quantity,0);assert.deepEqual(b.errors,[]);b.close();
});
test('R33 changed symbol clears old quote and metadata instead of carrying over another security',()=>{
 const seed=fixture();seed.stockPortfolio={assets:[asset({marketInfo:{industry:'半導體'},quoteChange:2})],transactions:[]};const b=boot(seed);b.tab('investment');b.click('[data-stock="tab"][data-id="stocks"]');b.click('.stock-list-actions [data-stock="asset"]');b.change('#stockForm [name="symbol"]','9999');b.change('#stockForm [name="name"]','新股票');b.submit('#stockForm');
 const a=b.state().stockPortfolio.assets[0];assert.equal(a.quotePrice,null);assert.equal(a.quoteChange,null);assert.deepEqual(a.marketInfo,{});assert.deepEqual(b.errors,[]);b.close();
});
test('R33 latest catalog query wins; closing or switching forms cannot apply stale results',async()=>{
 const b=boot(fixture()),pending=[];b.w.fetch=(path,o)=>new Promise(resolve=>pending.push({resolve,query:JSON.parse(o.body).query}));
 b.tab('investment');b.click('[data-stock="tab"][data-id="stocks"]');b.click('[data-stock="catalog"]');
 b.change('#stockCatalogForm [name="query"]','0050');b.submit('#stockCatalogForm');assert.equal(pending[1].query,'0050');
 pending[1].resolve({ok:true,json:async()=>({quotes:[{...quote,symbol:'0050',name:'元大台灣50'}],total:1,errors:[]})});await until(()=>b.q('[data-stock="catalog-add"]'));
 pending[0].resolve({ok:true,json:async()=>({quotes:[quote],total:1,errors:[]})});await tick();assert.match(b.q('#stockCatalogResults').textContent,/0050/);assert.doesNotMatch(b.q('#stockCatalogResults').textContent,/2330/);
 b.click('[data-stock="catalog-add"]');assert.equal(b.q('#stockForm [name="symbol"]').value,'0050');assert.deepEqual(b.errors,[]);b.close();
});
test('R33 icons survive backup and can be removed; unsupported files are rejected and English controls work',async()=>{
 const data='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6FOsAAAAASUVORK5CYII=';
 const seed=fixture();seed.stockPortfolio={assets:[asset({iconMode:'custom',iconData:data,favorite:true,group:'長期'})],transactions:[]};
 const b=boot(seed,{language:'en'});b.tab('investment');b.click('[data-stock="tab"][data-id="stocks"]');assert.equal(b.q('.stock-avatar img').getAttribute('src'),data);assert.match(b.q('#stockListForm').textContent,/Favorites only/);
 const restored=boot(b.raw());assert.equal(restored.state().stockPortfolio.assets[0].iconData,data);restored.close();
 b.click('.stock-list-actions [data-stock="asset"]');const input=b.q('#stockIconFile');Object.defineProperty(input,'files',{value:[{type:'image/svg+xml',size:10}]});input.dispatchEvent(new b.w.Event('change',{bubbles:true}));await tick();assert.match(b.q('#stockIconStatus').textContent,/PNG/);assert.equal(b.state().stockPortfolio.assets[0].iconData,data);
 b.click('[data-stock="clear-icon"]');b.submit('#stockForm');assert.equal(b.state().stockPortfolio.assets[0].iconData,'');assert.equal(b.state().stockPortfolio.assets[0].iconMode,'auto');assert.deepEqual(b.errors,[]);b.close();
});
