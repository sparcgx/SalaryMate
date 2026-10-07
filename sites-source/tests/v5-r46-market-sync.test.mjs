import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';

const NOW=Date.parse('2026-10-05T02:00:00Z'),today='2026-10-05';
const source=name=>fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/'+name,import.meta.url),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
const asset=(extra={})=>({id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'private account',quotePrice:100,quoteDate:'2026-10-02',quoteFx:1,quoteMode:'auto',...extra});
const portfolio=(extra={})=>({assets:[asset()],transactions:[{id:'buy',assetId:'a',type:'buy',date:'2026-10-01',time:'12:00',quantity:10,price:80,fx:1,fee:2,tax:0}],...extra});
const quote=(extra={})=>({market:'TW',symbol:'2330',currency:'TWD',price:120,date:today,quoteAt:'2026-10-05T09:59:58+08:00',providerTime:'2026-10-05 09:59:58',source:'TWSE 最新成交',...extra});
const snapshot=(extra={})=>({quotes:[quote()],fx:{rate:31.839,date:today},fetchedAt:new Date(NOW).toISOString(),errors:[],...extra});
const settle=()=>new Promise(r=>setImmediate(r));
function harness(initial=portfolio(),fetcher){
  let now=NOW,current={stockPortfolio:clone(initial)},hidden=false,editing=false,onPage=true,online=true,save=true,commits=0;
  let lastHTML='',opened='';const timers=new Map(),listeners=new Map(),pending=[];let timerId=0;
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const document={activeElement:null,documentElement:{},get hidden(){return hidden;},addEventListener:(type,fn)=>listeners.set(type,fn),querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>null}),querySelector:s=>s==='.stock-view'?onPage?{}:null:s==='#appDialog'?{open:editing,addEventListener(){}}:null};
  const c=vm.createContext({Date:FixedDate,Intl,console,AbortController,navigator:{get onLine(){return online;},language:'en',languages:['en']},fetch:fetcher||(()=>{}),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),document,FormData:class{constructor(form){this.values=form.values;}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}},SalaryMateI18n:{user:s=>s,text:s=>s,apply(){}},addEventListener(){}});
  for(const file of ['stocks.js','stocks-integrations.js','stocks-ui.js'])vm.runInContext(source(file),c);
  if(!fetcher)c.SalaryMateStockServices.fetchQuotes=(assets,path,signal)=>new Promise((resolve,reject)=>pending.push({assets:clone(assets),path,signal,resolve,reject}));
  const api={state:()=>current,year:()=>2026,today:()=>today,legacyTotal:()=>0,id:()=>String(++timerId),begin(){},assert:()=>true,validate:()=>true,close(){},error:(form,message)=>{throw Error(message);},open:(title,html)=>{opened=html;},toast(){},commit:fn=>{if(!save)return false;fn();commits++;return true;},render:()=>{lastHTML=ui.render('');}};
  const ui=c.SalaryMateStocksUI.create(api);
  const click=stock=>ui.click({dataset:{stock},closest:()=>null});
  return {c,ui,click,timers,pending,document,core:c.SalaryMateStocks,services:c.SalaryMateStockServices,
    state:()=>current.stockPortfolio,render:()=>lastHTML=ui.render(''),html:()=>lastHTML,opened:()=>opened,commits:()=>commits,
    setHidden:v=>hidden=v,setEditing:v=>editing=v,setPage:v=>onPage=v,setOnline:v=>online=v,setSave:v=>save=v,
    advance:ms=>now+=ms,visibility:()=>listeners.get('visibilitychange')?.(),
    fire:()=>{const [id,t]=timers.entries().next().value||[];if(t){timers.delete(id);t.fn();}return t;}};
}

test('old data stays compatible; manual prices and funds are excluded; preferences survive restore',()=>{
  const h=harness(),c=h.core,p=h.state();assert.deepEqual(clone(c.normalize(p)),p);
  assert.equal(c.marketPreferences(p).autoRefresh,true);
  assert.equal(c.quoteEligible(asset({quoteMode:'manual'})),false);
  assert.equal(c.quoteEligible(asset({quoteMode:'manual',quotePrice:null})),true);
  assert.equal(c.quoteEligible(asset({priceUpdateMode:'manual'})),false);
  assert.equal(c.quoteEligible(asset({priceUpdateMode:'auto',typeOverride:'fund'})),false);
  const next={...p,marketData:{autoRefresh:false,quoteEnabled:false,fx:{rate:31.839,date:today}}};
  assert.deepEqual(clone(c.normalize(next)),next);
  assert.throws(()=>c.validate({...p,marketData:{autoRefresh:'yes'}}),/連動/);
});

test('a sync preserves manual holdings, ledger costs and transaction FX; counts actual price updates',()=>{
  const h=harness(),p=portfolio({assets:[asset(),asset({id:'manual',symbol:'0050',priceUpdateMode:'manual'}),asset({id:'fund',symbol:'FUND',market:'OTHER'})]});
  const before=h.core.calculate(p,2026),r=h.services.applyQuotes(p,snapshot({quotes:[quote(),quote({symbol:'0050'})]}),today);
  assert.deepEqual(clone(r.next.transactions),p.transactions);assert.equal(h.core.calculate(r.next,2026).cost,before.cost);
  assert.equal(r.next.assets[0].quotePrice,120);assert.deepEqual(clone(r.next.assets.slice(1)),p.assets.slice(1));
  assert.equal(r.next.marketData.updated,1);assert.equal(r.next.marketData.requested,1);assert.equal(r.next.marketData.status,'success');
  assert.equal(r.next.marketData.fx.rate,31.839);assert.equal(p.assets[0].quotePrice,100);
});

test('FX-only sync never updates any stock even if a response contains quotes',()=>{
  const h=harness(),p=portfolio({marketData:{quoteEnabled:false,autoRefresh:true}}),r=h.services.applyQuotes(p,snapshot(),today);
  assert.deepEqual(clone(r.next.assets),p.assets);assert.equal(r.next.marketData.updated,0);assert.equal(r.next.marketData.requested,0);assert.equal(r.next.marketData.status,'success');
});

test('partial and failed updates retain unavailable values; a NAV status is not a price update',()=>{
  const h=harness(),p=portfolio({assets:[asset({typeOverride:'etf'})],marketData:{fx:{rate:32,date:'2026-10-02'},lastSyncAt:'2026-10-02T08:00:00Z'}});
  const r=h.services.applyQuotes(p,snapshot({quotes:[quote({price:null,intradayNavStatus:'unavailable'})]}),today);
  assert.equal(r.next.assets[0].quotePrice,100);assert.equal(r.updated.length,1);assert.equal(r.priceUpdated.length,0);assert.equal(r.next.marketData.updated,0);assert.equal(r.next.marketData.status,'partial');
  const failed=h.services.applyQuotes(p,snapshot({quotes:[],fx:null,errors:[{market:'TW',symbol:'2330',message:'offline'}]}),today);
  assert.deepEqual(clone(failed.next.assets),p.assets);assert.equal(failed.next.marketData.fx.rate,32);assert.equal(failed.next.marketData.lastSyncAt,p.marketData.lastSyncAt);assert.equal(failed.next.marketData.status,'error');
});

test('older intraday quotes and same-day closing fallbacks cannot replace a saved later trade',()=>{
  const h=harness(),p=portfolio({assets:[asset({quoteDate:today,quoteMarketAt:'2026-10-05T09:59:59+08:00'})]});
  for(const q of [quote(),quote({quoteAt:undefined}),quote({date:'2026-10-06'})]){
    const r=h.services.applyQuotes(p,snapshot({quotes:[q]}),today);assert.equal(r.next.assets[0].quotePrice,100);assert.equal(r.priceUpdated.length,0);
  }
  const r=h.services.applyQuotes(p,snapshot({quotes:[quote({quoteAt:'2026-10-05T10:00:00+08:00'})]}),today);assert.equal(r.next.assets[0].quotePrice,120);
});

test('freshness uses source times and never substitutes a recent fetch for an older trade',()=>{
  const c=harness().core,a=asset({quoteCheckedAt:new Date(NOW).toISOString(),quoteMarketAt:'2026-10-02T13:30:00+08:00'});
  assert.equal(c.priceFreshness(a,NOW),'older');assert.equal(c.priceFreshness({...a,quoteMarketAt:'2026-10-05T09:59:00+08:00'},NOW),'recent');
  assert.equal(c.priceFreshness({...a,quoteMarketAt:'',quoteDate:'2026-10-04'},NOW),'unknown');
  assert.equal(c.priceFreshness({...a,quoteCheckedAt:''},NOW),'unknown');assert.equal(c.priceFreshness({...a,priceUpdateMode:'manual'},NOW),'manual');
});

test('automatic sync starts once, uses five minutes, and paused mode still permits Update now',async()=>{
  const h=harness();h.render();assert.equal(h.fire().ms,1500);assert.equal(h.pending.length,1);
  h.click('refresh');assert.equal(h.pending.length,1);h.pending[0].resolve(snapshot());await settle();
  assert.equal(h.commits(),1);assert.equal([...h.timers.values()][0].ms,300000);
  h.click('toggle-market-auto');assert.equal(h.state().marketData.autoRefresh,false);assert.equal(h.timers.size,0);
  const restored=harness(h.state());restored.render();assert.equal(restored.timers.size,0);
  h.click('refresh');assert.equal(h.pending.length,2);h.pending[1].resolve(snapshot());await settle();assert.equal(h.timers.size,0);
});

test('automatic requests pause when hidden, editing, off-page, offline or focused in a form',()=>{
  for(const reason of ['hidden','editing','off-page','offline','focused']){
    const h=harness();h.render();
    if(reason==='hidden')h.setHidden(true);if(reason==='editing')h.setEditing(true);if(reason==='off-page')h.setPage(false);if(reason==='offline')h.setOnline(false);if(reason==='focused')h.document.activeElement={closest:()=>({}),matches:()=>true};
    h.fire();assert.equal(h.pending.length,0,reason);
  }
});

test('in-flight replies cannot overwrite edits or be applied after hiding, navigation or disabling sync',async()=>{
  for(const reason of ['editing','changed','hidden','off-page','disabled']){
    const h=harness();h.render();h.fire();
    if(reason==='editing')h.setEditing(true);if(reason==='changed')h.state().assets[0].note='new edit';if(reason==='hidden'){h.setHidden(true);h.visibility();h.setHidden(false);h.visibility();}if(reason==='off-page')h.setPage(false);if(reason==='disabled')h.click('toggle-market-quotes');
    h.pending[0].resolve(snapshot());await settle();assert.equal(h.state().assets[0].quotePrice,100,reason);
    if(reason==='changed')assert.equal(h.state().assets[0].note,'new edit');
  }
});

test('failed storage and connection keep prices; disabling quotes requests only FX, including empty portfolios',async()=>{
  const h=harness();h.render();h.fire();h.setSave(false);h.pending[0].resolve(snapshot());await settle();assert.equal(h.state().assets[0].quotePrice,100);assert.match(h.render(),/更新失敗/);
  const fx=harness(portfolio({marketData:{quoteEnabled:false}}));fx.render();fx.fire();assert.equal(fx.pending[0].assets.length,0);fx.pending[0].reject(Error('offline'));await settle();assert.equal(fx.state().assets[0].quotePrice,100);
  const empty=harness({assets:[],transactions:[]});empty.render();empty.fire();assert.equal(empty.pending[0].assets.length,0);empty.pending[0].resolve(snapshot({quotes:[]}));await settle();assert.equal(empty.state().marketData.fx.rate,31.839);
});

const req=(instruments,extra={})=>new Request('https://site.test/api/stocks/quotes',{method:'POST',body:JSON.stringify({instruments,...extra})});
function official(latest,fail=false){return async url=>{
  if(url.includes('getStockInfo')){if(fail)throw Error('down');return Response.json({msgArray:latest});}
  if(url.includes('STOCK_DAY_ALL'))return Response.json([{Code:'2330',Name:'台積電',Date:'1151002',ClosingPrice:'100',Change:'1'}]);
  if(url.includes('frankfurter'))return Response.json({rate:31.839,date:today});
  if(url.includes('t187ap03_L'))return Response.json([{'公司代號':'2330','產業別':'24'}]);
  return Response.json([]);
};}
test('TWSE latest trade is source-dated; unavailable, future or missing trade values fall back to closing data',async()=>{
  const row={c:'2330',n:'台積電',z:'120',y:'100',d:'20261005',t:'09:59:58',ex:'tse'};
  const handler=createStockMarket(official([row]),()=>NOW),r=await(await handler(req([{market:'TW',symbol:'2330'}],{includeFx:true}))).json();
  assert.equal(r.quotes[0].price,120);assert.equal(r.quotes[0].quoteAt,'2026-10-05T09:59:58+08:00');assert.equal(r.quotes[0].change,20);assert.equal(r.fx.rate,31.839);
  for(const [bad,fail] of [[{...row,z:'-'},false],[{...row,d:'20261006'},false],[row,true]]){
    const h=createStockMarket(official([bad],fail),()=>NOW),d=await(await h(req([{market:'TW',symbol:'2330'}]))).json();
    assert.equal(d.quotes[0].price,100);assert.equal(d.quotes[0].date,'2026-10-02');assert.equal(d.quotes[0].quoteAt,undefined);
  }
});

test('FX-only requests and standalone origin work without a dummy instrument',async()=>{
  const h=createStockMarket(official([]),()=>NOW);
  const r=await h(req([],{includeFx:true}));assert.equal(r.status,200);assert.equal((await r.json()).fx.rate,31.839);
  assert.equal((await h(req([]))).status,400);
  const portable=createPortableMarket(h),r2=await portable(new Request('https://site.test/api/stocks/portable/quotes',{method:'POST',headers:{origin:'null'},body:JSON.stringify({instruments:[],includeFx:true})}));
  assert.equal(r2.status,200);assert.equal(r2.headers.get('access-control-allow-origin'),'null');assert.equal((await r2.json()).quotes.length,0);
});

test('outbound payload contains only eligible, deduplicated symbols and the FX flag',async()=>{
  const sent=[],h=harness(portfolio(),async(url,init)=>{sent.push({url,body:JSON.parse(init.body)});return Response.json(snapshot());});
  const assets=[asset(),asset({id:'copy',account:'another private account'}),asset({id:'manual',symbol:'0050',priceUpdateMode:'manual'}),asset({id:'fund',symbol:'FUND',market:'OTHER'})];
  await h.services.fetchQuotes(assets);assert.deepEqual(sent[0].body,{instruments:[{market:'TW',symbol:'2330'}],includeFx:true});assert.doesNotMatch(JSON.stringify(sent),/account|quantity|salary/);
  await h.services.fetchQuotes([]);assert.deepEqual(sent[1].body,{instruments:[],includeFx:true});
});

test('the compact market card and manual-mode editor have complete English labels; NAV stays compact',()=>{
  const h=harness(),html=h.render();assert.match(html,/市場資料連動/);assert.match(html,/每 5 分鐘自動更新/);assert.doesNotMatch(html,/stock-nav-toolbar|每 60 秒/);
  h.click('quotes');assert.match(h.opened(),/mode-a/);assert.match(h.opened(),/手動維護價格／淨值/);
  h.c.localStorage={getItem:()=> 'en'};h.c.MutationObserver=class{observe(){}disconnect(){}};h.c.NodeFilter={SHOW_TEXT:4};
  vm.runInContext(source('i18n-en.js'),h.c);vm.runInContext(source('i18n.js'),h.c);
  const card=html.split('<section class="stock-panel stock-market-card"')[1].split('</section>')[0];
  const labels=[...card.matchAll(/>([^<>]+)</g)].map(x=>x[1]).filter(s=>/\p{Script=Han}/u.test(s));
  for(const label of labels)assert.doesNotMatch(h.c.SalaryMateI18n.text(label),/\p{Script=Han}/u,label);
});

test('manual-price editor saves only manual rows and preserves automatically maintained prices',()=>{
  const h=harness(portfolio({assets:[asset(),asset({id:'manual',symbol:'0050',priceUpdateMode:'manual'})]}));
  h.ui.submit({id:'stockForm',dataset:{kind:'quotes',id:''},values:{'mode-a':'auto','mode-manual':'manual','price-manual':'77.25','date-manual':today,'fx-manual':'1'}});
  assert.equal(h.state().assets[0].quotePrice,100);assert.equal(h.state().assets[0].priceUpdateMode,'auto');
  assert.equal(h.state().assets[1].quotePrice,77.25);assert.equal(h.state().assets[1].priceUpdateMode,'manual');assert.equal(h.core.quoteEligible(h.state().assets[1]),false);
});
test('older or missing USD reference FX cannot replace current quote valuations',()=>{
  const h=harness(),p=portfolio({assets:[asset({market:'US',symbol:'AAPL',currency:'USD',quoteFx:32})],marketData:{fx:{rate:32,date:today}}});
  for(const fx of [null,{rate:31,date:'2026-10-02'}]){
    const r=h.services.applyQuotes(p,snapshot({quotes:[quote({market:'US',symbol:'AAPL',currency:'USD'})],fx}),today);
    assert.equal(r.next.assets[0].quotePrice,100);assert.equal(r.next.assets[0].quoteFx,32);assert.equal(r.next.marketData.fx.rate,32);
  }
});
