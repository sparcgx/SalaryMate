import test from 'node:test';import assert from 'node:assert/strict';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
import '../dist/dev/v5.0.0-dev.2/stocks.js';
import '../dist/dev/v5.0.0-dev.2/stocks-integrations.js';
const core=globalThis.SalaryMateStocks,service=globalThis.SalaryMateStockServices;
const clock=()=>Date.parse('2026-10-05T06:00:00Z');
const request=()=>new Request('https://site.test/api/stocks/quotes',{method:'POST',body:JSON.stringify({instruments:[{market:'TW',symbol:'00919'},{market:'TW',symbol:'2330'}]})});
const official=async (url,init)=>{
 let data=[];
 if(url.includes('STOCK_DAY_ALL'))data=[{Code:'00919',Name:'群益台灣精選高息',ClosingPrice:'31.63',Date:'1151005'},{Code:'2330',Name:'台積電',ClosingPrice:'120',Date:'1151005'}];
 if(url.includes('t187ap47_L'))data=[{'基金代號':'00919'}];
 if(url.includes('t187ap03_L'))data=[{'公司代號':'2330','產業別':'24'}];
 if(url.includes('ajaxEtfInfoChart')){
  const params=new URLSearchParams(init.body);assert.equal(params.get('id'),'00919');assert.equal(params.get('type'),'fundPric');
  data={netPrice:[{date:'2026/10/02',count:31.48},{date:'2026/10/06',count:999},{date:'2026/10/03',count:0}],atmps:[{date:'2026/10/02',count:0.22},{date:'2026/10/05',count:8}]};
 }
 return new Response(JSON.stringify(data));
};
const asset=()=>({id:'a',market:'TW',symbol:'00919',name:'群益',currency:'TWD',account:'',quotePrice:30,quoteDate:'2026-10-01',quoteFx:1});
test('official NAV uses valid latest publication, matching premium date; stock price remains separate',async()=>{
 const h=createStockMarket(official,clock),d=await(await h(request())).json();
 const q=d.quotes.find(x=>x.symbol==='00919');assert.equal(q.price,31.63);assert.equal(q.netAssetValue.value,31.48);assert.equal(q.netAssetValue.date,'2026-10-02');assert.equal(q.netAssetValue.premiumPercent,0.22);assert.equal(q.navStatus,'available');assert.equal(d.quotes.find(x=>x.symbol==='2330').netAssetValue,undefined);
 const old={assets:[asset()],transactions:[]},r=service.applyQuotes(old,d,'2026-10-05');assert.equal(r.updated.length,1);assert.equal(r.next.assets[0].quotePrice,31.63);assert.equal(r.next.assets[0].netAssetValue.date,'2026-10-02');assert.equal(old.assets[0].netAssetValue,undefined);
 assert.deepEqual(core.normalize(JSON.parse(JSON.stringify(r.next))),r.next);
});
test('NAV outage preserves previous NAV and permits price refresh',async()=>{
 const h=createStockMarket(async(...args)=>{if(args[0].includes('ajaxEtfInfoChart'))throw Error('offline');return official(...args);},clock);const d=await(await h(request())).json();
 assert.equal(d.quotes[0].navStatus,'unavailable');const a=asset();a.netAssetValue={value:31.48,date:'2026-10-02',premiumPercent:0.22,currency:'TWD',source:'TWSE e添富'};
 const r=service.applyQuotes({assets:[a],transactions:[]},d,'2026-10-05');assert.equal(r.next.assets[0].quotePrice,31.63);assert.deepEqual(r.next.assets[0].netAssetValue,a.netAssetValue);assert.ok(r.errors.some(x=>x.includes('淨值')));
});
test('older, future, invalid and mismatched currency NAV cannot replace saved NAV',()=>{
 const a=asset();a.netAssetValue={value:31.48,date:'2026-10-02',premiumPercent:0.22,currency:'TWD',source:'TWSE e添富'};
 for(const over of [{date:'2026-10-01'},{date:'2026-10-06'},{value:0},{currency:'USD'},{premiumPercent:NaN}]){
 const q={market:'TW',symbol:'00919',price:32,date:'2026-10-05',currency:'TWD',navStatus:'available',netAssetValue:{...a.netAssetValue,...over}};
 const r=service.applyQuotes({assets:[a],transactions:[]},{quotes:[q],errors:[]},'2026-10-05');assert.deepEqual(r.next.assets[0].netAssetValue,a.netAssetValue);
 }
});
test('missing same-date premium stays unknown; zero premium is retained',async()=>{
 for(const atmps of [[],[{date:'2026/10/02',count:0}]]){
 const h=createStockMarket((u,i)=>u.includes('ajaxEtfInfoChart')?Promise.resolve(new Response(JSON.stringify({netPrice:[{date:'2026/10/02',count:31.48}],atmps}))):official(u,i),clock);
 const d=await(await h(request())).json();assert.equal(d.quotes[0].netAssetValue.premiumPercent,atmps.length?0:null);
 }
});
test('single HTML portable endpoint forwards the same public NAV data',async()=>{
 const h=createPortableMarket(createStockMarket(official,clock));const r=await h(new Request('https://site.test/api/stocks/portable/quotes',{method:'POST',headers:{origin:'null'},body:await request().text()}));assert.equal(r.headers.get('access-control-allow-origin'),'null');assert.equal((await r.json()).quotes[0].netAssetValue.value,31.48);
});
