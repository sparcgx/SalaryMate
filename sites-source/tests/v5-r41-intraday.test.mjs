import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
import '../dist/dev/v5.0.0-dev.2/stocks.js';
import '../dist/dev/v5.0.0-dev.2/stocks-integrations.js';
const core=globalThis.SalaryMateStocks,services=globalThis.SalaryMateStockServices;
const now=Date.parse('2026-10-05T02:00:00Z'),clock=()=>now;
const symbols=['00919','006208','0050','2330'];
const req=(path='quotes',list=symbols)=>new Request('https://site.test/api/stocks/'+path,{method:'POST',body:JSON.stringify({instruments:list.map(symbol=>({market:'TW',symbol}))})});
const capital={stocNo:'00919',stockDollarname:'台幣',date1:'2026/10/05',time1:'09:59:50',nav:31.56,price:'31.63',diffRatio:'0.221800',workDay:'Y'};
const fubonRow=(symbol='006208',time='09:59:45',value='266.25')=>`<tr><td class="name_txt">${symbol}<br />富邦台50</td><td>258.52<br />(10/02)</td><td>${value}</td><td>+7.73<br />(+2.99%)</td><td>258.30<br />(10/02)</td><td>265.35</td><td>+7.05<br />(+2.73%)</td><td>-0.34%</td><td>0%</td><td>2026/10/05<br />${time}</td><td>Y</td></tr>`;
function official({cap=capital,fubon=fubonRow(),failure='',calls=[]}={}){
  return async(url,init)=>{
    calls.push({url,init});if(failure&&url.includes(failure))throw Error('offline');
    let data=[];
    if(url.includes('STOCK_DAY_ALL'))data=[['00919','群益台灣精選高息','31.55'],['006208','富邦台50','258.30'],['0050','元大台灣50','70'],['2330','台積電','1000']].map(([Code,Name,ClosingPrice])=>({Code,Name,ClosingPrice,Date:'1151002'}));
    if(url.includes('t187ap47_L'))data=symbols.slice(0,3).map(symbol=>({'基金代號':symbol}));
    if(url.includes('t187ap03_L'))data=[{'公司代號':'2330','產業別':'24'}];
    if(url.includes('ajaxEtfInfoChart'))data={netPrice:[{date:'2026/10/02',count:31.48}],atmps:[{date:'2026/10/02',count:0.22}]};
    if(url.includes('CFWeb/api/etf/nav')){assert.equal(init.body,'null');data={code:200,data:[cap]};}
    if(url.includes('Estimate.aspx'))return new Response(fubon,{headers:{'content-type':'text/html'}});
    return new Response(JSON.stringify(data));
  };
}
const asset=(over={})=>({id:'a',market:'TW',symbol:'00919',name:'群益',currency:'TWD',account:'私人帳戶',quotePrice:30,quoteDate:'2026-10-02',quoteFx:1,quoteMode:'manual',marketInfo:{instrumentType:'etf'},...over});
const nav=(over={})=>({provider:'capital',value:31.56,at:'2026-10-05T09:59:50+08:00',currency:'TWD',marketPrice:31.63,premiumPercent:0.2218,businessDay:true,...over});
const snapshot=(n=nav(),over={})=>({fetchedAt:new Date(now).toISOString(),quotes:[{market:'TW',symbol:'00919',currency:'TWD',intradayNav:n,intradayNavStatus:'available',...over}],errors:[]});
test('official issuer estimates carry source time and matched price, separate from daily NAV and closing quote',async()=>{
  const calls=[],h=createStockMarket(official({calls}),clock),d=await(await h(req())).json();
  const cap=d.quotes.find(q=>q.symbol==='00919'),fb=d.quotes.find(q=>q.symbol==='006208');
  assert.equal(cap.price,31.55);assert.equal(cap.netAssetValue.value,31.48);assert.deepEqual(cap.intradayNav,nav());
  assert.equal(fb.intradayNav.value,266.25);assert.equal(fb.intradayNav.marketPrice,265.35);assert.equal(fb.intradayNav.premiumPercent,-0.34);assert.equal(fb.intradayNav.provider,'fubon');
  assert.equal(d.quotes.find(q=>q.symbol==='0050').intradayNavStatus,'unsupported');assert.equal(d.quotes.find(q=>q.symbol==='2330').intradayNav,undefined);
  assert.equal(calls.filter(c=>c.url.includes('CFWeb/api/etf/nav')).length,1);
  assert.ok(calls.every(c=>!String(c.init.body).includes('私人帳戶')));
});
test('dedicated intraday route skips daily NAV requests and shares issuer cache',async()=>{
  const calls=[],h=createStockMarket(official({calls}),clock);
  for(let i=0;i<2;i++){const d=await(await h(req('nav'))).json();assert.equal(d.quotes[0].netAssetValue,undefined);assert.equal(d.quotes[0].intradayNav.value,31.56);}
  assert.equal(calls.filter(c=>c.url.includes('ajaxEtfInfoChart')).length,0);
  assert.equal(calls.filter(c=>c.url.includes('STOCK_DAY_ALL')||c.url.includes('t187ap47_L')).length,0);
  assert.equal(calls.filter(c=>c.url.includes('CFWeb/api/etf/nav')).length,1);
  assert.equal(calls.filter(c=>c.url.includes('Estimate.aspx')).length,1);
});
test('issuer outage leaves closing quote and daily publication available; client retains old estimate',async()=>{
  const h=createStockMarket(official({failure:'CFWeb'}),clock),d=await(await h(req())).json(),a=asset({priceUpdateMode:'auto',intradayNav:nav(),intradayNavStatus:'available'});
  assert.equal(d.quotes[0].intradayNavStatus,'unavailable');assert.equal(d.quotes[0].price,31.55);assert.equal(d.quotes[0].netAssetValue.value,31.48);
  const r=services.applyQuotes({assets:[a],transactions:[]},d,'2026-10-05');assert.deepEqual(r.next.assets[0].intradayNav,a.intradayNav);assert.equal(r.next.assets[0].quotePrice,31.55);assert.equal(core.intradayState(r.next.assets[0],now),'unavailable');
  const isolated=await(await h(req('nav',['00919','006208']))).json();assert.equal(isolated.quotes[0].intradayNavStatus,'unavailable');assert.equal(isolated.quotes[1].intradayNavStatus,'available');
});
test('invalid, future, non-TWD and missing issuer timestamp records cannot be marked available',async()=>{
  for(const over of [{nav:0},{date1:'2026/02/30'},{date1:'2026/10/06'},{time1:''},{time1:'12:00:00'},{stockDollarname:'美元'}]){
    const h=createStockMarket(official({cap:{...capital,...over}}),clock),d=await(await h(req('nav',['00919']))).json();assert.equal(d.quotes[0].intradayNav,undefined);assert.equal(d.quotes[0].intradayNavStatus,'unavailable');
  }
  const h=createStockMarket(official({fubon:'<table>'+fubonRow('006208','09:59:45','—')+'</table>'}),clock),d=await(await h(req('nav',['006208']))).json();assert.equal(d.quotes[0].intradayNavStatus,'unavailable');
});
test('intraday update preserves manual quotes, FIFO amounts, transactions and daily NAV; survives JSON restore',()=>{
  const a=asset({netAssetValue:{value:31.48,date:'2026-10-02',currency:'TWD',premiumPercent:0.22,source:'TWSE e添富'}}),p={assets:[a],transactions:[{id:'buy',assetId:'a',type:'buy',date:'2026-09-01',time:'12:00',quantity:100,price:25,fee:5,tax:0,fx:1}]};
  const before=JSON.stringify(p),r=services.applyIntraday(p,snapshot(),'2026-10-05'),saved=core.normalize(JSON.parse(JSON.stringify(r.next)));
  assert.equal(JSON.stringify(p),before);assert.deepEqual(saved,r.next);assert.equal(saved.assets[0].quotePrice,30);assert.equal(saved.assets[0].quoteMode,'manual');assert.deepEqual(saved.assets[0].netAssetValue,a.netAssetValue);assert.deepEqual(saved.transactions,p.transactions);
  const one=core.calculate(p,2026),two=core.calculate(saved,2026);for(const k of ['value','cost','unrealized','yearRealized','yearDividends'])assert.equal(one[k],two[k]);
});
test('incoming older, malformed, foreign-currency or future estimate cannot overwrite previous estimate',()=>{
  const a=asset({intradayNav:nav(),intradayNavStatus:'available'});
  for(const over of [{at:'2026-10-02T13:30:00+08:00'},{at:'2026-10-06T09:00:00+08:00'},{at:'2026-10-05T11:00:00+08:00'},{at:'2026-10-05'},{value:-1},{currency:'USD'},{provider:'unknown'},{provider:'__proto__'},{premiumPercent:NaN}]){
    const r=services.applyIntraday({assets:[a],transactions:[]},snapshot(nav(over)),'2026-10-05');assert.deepEqual(r.next.assets[0].intradayNav,a.intradayNav);assert.equal(r.next.assets[0].intradayNavStatus,'unavailable');assert.equal(r.updated.length,1);
  }
  assert.throws(()=>core.validate({assets:[asset({intradayNav:nav({at:'2026-02-30T09:00:00+08:00'})})],transactions:[]}),/盤中/);
});
test('source time controls live, stale, closed, pre-open and non-trading labels',()=>{
  const a=asset({intradayNav:nav(),intradayNavStatus:'available'});
  assert.equal(core.intradayState(a,now),'live');assert.equal(core.intradayState(a,now+240000),'stale');
  assert.equal(core.intradayState(a,Date.parse('2026-10-05T05:30:00Z')),'closed');
  assert.equal(core.intradayState({...a,intradayNav:nav({at:'2026-10-05T08:30:00+08:00'})},Date.parse('2026-10-05T00:45:00Z')),'preopen');
  assert.equal(core.intradayState({...a,intradayNav:nav({businessDay:false})},now),'nontrading');
  assert.equal(core.intradayState(a,now+86400000),'stale');assert.equal(core.intradayState({...a,intradayNavStatus:'unavailable'},now),'unavailable');
});
test('portable HTML can read intraday NAV while other origins and US requests are rejected',async()=>{
  const h=createPortableMarket(createStockMarket(official(),clock)),body=await req('nav',['00919']).text();
  const r=await h(new Request('https://site.test/api/stocks/portable/nav',{method:'POST',headers:{origin:'null'},body}));assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'null');assert.equal((await r.json()).quotes[0].intradayNav.value,31.56);
  assert.equal((await h(new Request('https://site.test/api/stocks/portable/nav',{method:'POST',headers:{origin:'https://other.test'},body}))).status,403);
  const direct=createStockMarket(official(),clock);assert.equal((await direct(new Request('https://site.test/api/stocks/nav',{method:'POST',body:JSON.stringify({instruments:[{market:'US',symbol:'AAPL'}]})}))).status,400);
});
function uiSetup(){
  let current={stockPortfolio:{assets:[asset({priceUpdateMode:'auto',intradayNav:nav(),intradayNavStatus:'available'})],transactions:[{id:'opening',assetId:'a',type:'opening',date:'2026-10-02',time:'12:00',quantity:100,price:25,fee:0,tax:0,fx:1}]}},editing=false,hidden=false,onPage=true,fetches=0,commits=0,resolver;
  const timers=new Map();let id=0;
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context=vm.createContext({Date:FixedDate,Intl,console,AbortController,fetch:()=>{},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),document:{addEventListener(){},get hidden(){return hidden;},querySelector:s=>s==='.stock-view'?onPage?{}:null:s==='#appDialog'?{open:editing,addEventListener(){}}:null,querySelectorAll:()=>[]},SalaryMateI18n:{user:s=>s},SalaryMateStockServices:{fetchQuotes:()=>{fetches++;return new Promise(r=>resolver=r);}}});
  for(const name of ['stocks.js','stocks-ui.js'])vm.runInContext(fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/'+name,import.meta.url),'utf8'),context);
  context.SalaryMateStockServices.applyQuotes=(...args)=>services.applyQuotes(...args);
  const api={state:()=>current,year:()=>2026,today:()=> '2026-10-05',legacyTotal:()=>0,id:()=> 'sync',commit:fn=>{commits++;fn();return true;},render:()=>{},toast:()=>{}};
  const ui=context.SalaryMateStocksUI.create(api);
  return {ui,timers,setHidden:v=>hidden=v,setEditing:v=>editing=v,setPage:v=>onPage=v,change:()=>current.stockPortfolio.assets[0].note='editing',resolve:()=>resolver(snapshot()),fetches:()=>fetches,commits:()=>commits};
}
test('automatic queries stop when hidden, off-page, disabled or editing; request completing during editing is discarded',async()=>{
  for(const blocked of ['hidden','editing','off-page','disabled']){
    const b=uiSetup();b.ui.render('');assert.equal([...b.timers.values()][0].ms,1500);
    if(blocked==='hidden')b.setHidden(true);if(blocked==='editing')b.setEditing(true);if(blocked==='off-page')b.setPage(false);if(blocked==='disabled')b.ui.click({dataset:{stock:'toggle-market-auto'}});
    const timer=[...b.timers.values()][0];b.timers.clear();timer?.fn();assert.equal(b.fetches(),0);
    if(b.timers.size)assert.equal([...b.timers.values()][0].ms,15000);
  }
  for(const change of ['editing','portfolio']){
    const b=uiSetup();b.ui.render('');const t=[...b.timers.values()][0];b.timers.clear();t.fn();assert.equal(b.fetches(),1);
    if(change==='editing')b.setEditing(true);else b.change();b.resolve();await new Promise(r=>setImmediate(r));assert.equal(b.commits(),0);
  }
  const b=uiSetup();b.ui.render('');const t=[...b.timers.values()][0];b.timers.clear();t.fn();b.resolve();await new Promise(r=>setImmediate(r));assert.equal(b.commits(),1);
});
test('render only shows latest NAV and its timestamp without changing schema or data key',()=>{
  const b=uiSetup(),html=b.ui.render('');assert.match(html,/最新淨值（預估）/);assert.match(html,/2026-10-05 09:59:50/);assert.doesNotMatch(html,/data-nav-state=/);assert.doesNotMatch(html,/stock-nav-note/);assert.match(html,/aria-pressed="true"/);
  const app=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js',import.meta.url),'utf8');assert.ok(app.includes('const SCHEMA_VERSION = 15'));assert.ok(app.includes("const STORAGE_KEY = 'salarymate_v5_full_state'"));
  const english=fs.readFileSync(new URL('../locales/en.tsv',import.meta.url),'utf8');assert.ok(english.includes('盤中預估淨值 | Intraday estimated NAV'));assert.ok(english.includes('資料已過期 | Data is stale'));
});
