import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';

// Native object fixtures and returned HTML only; no browser, DOM emulator or network.
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const sources=['stocks.js','stocks-integrations.js','stocks-ui.js'].map(n=>fs.readFileSync(new URL(n,base),'utf8'));
const today='2026-10-09',turn=()=>new Promise(setImmediate);
function harness(count=1){
 const assets=Array.from({length:count},(_,i)=>({id:'a'+i,symbol:'00'+(50+i),name:'Fixture ETF '+i,market:'TW',currency:'TWD',account:'Fixture',quotePrice:25,quoteDate:today,quoteFx:1,quoteMode:'auto'}));
 const state={stockPortfolio:{assets,transactions:assets.map((a,i)=>({id:'b'+i,assetId:a.id,type:'buy',date:'2026-10-01',time:'10:00',quantity:100,price:20,fee:0,tax:0,fx:1})),marketData:{autoRefresh:false,quoteEnabled:false}}};
 const timers=new Map(),listeners=new Map(),windowListeners=new Map(),dialogListeners=new Map(),requests=[],messages=[];let serial=0,page=null,ui,html='',commits=0,paintCount=0;
 const add=(map,name,fn)=>{const list=map.get(name)||[];list.push(fn);map.set(name,list);};
 const dialog={open:false,addEventListener:(name,fn)=>add(dialogListeners,name,fn)};
 const card={outerHTML:''};
 const document={hidden:false,addEventListener:(name,fn)=>add(listeners,name,fn),querySelector:selector=>selector==='.stock-view'?page:selector==='#appDialog'?dialog:selector==='[data-market-card]'?card:null};
 const context={Intl,Date,URL,console,AbortController,document,navigator:{onLine:true},FormData:class extends Map{constructor(form){super(Object.entries(form.values||{}));}},setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>add(windowListeners,name,fn),fetch(){throw Error('Unexpected HTTP request');},SalaryMateI18n:{user:v=>v,text:v=>v,apply(){}},SalaryMateScrollbars:{refresh(){}}};
 vm.createContext(context);for(const s of sources)vm.runInContext(s,context);
 const core=context.SalaryMateStocks;core.validate(state.stockPortfolio);
 context.SalaryMateStockServices.forecasts=(market,symbol,year,signal)=>new Promise((resolve,reject)=>requests.push({market,symbol,year,signal,resolve,reject}));
 function paint(){
  html=ui.render('');paintCount++;
  const tab=html.match(/data-stock-tab="([^"]+)"/)?.[1]||html.match(/data-id="([^"]+)" aria-current="page"/)?.[1];
  const keys=[...html.matchAll(/data-stock-scroll="([^"]+)"/g)].map(m=>m[1]);if(!keys.length&&html.includes('stock-table-wrap'))keys.push('legacy');
  const boxes=keys.map(key=>({dataset:{stockScroll:key},scrollLeft:0,scrollTop:0}));
  page={dataset:{stockTab:tab},querySelectorAll:selector=>selector==='.stock-table-wrap'?boxes:[],boxes};
 }
 ui=context.SalaryMateStocksUI.create({state:()=>state,year:()=>2026,today:()=>today,legacyTotal:()=>0,id:p=>p+serial,render:paint,commit(fn){fn();commits++;return true;},toast:m=>messages.push(m)});paint();
 return {ui,context,state,requests,timers,messages,dialog,core,get html(){return html;},get page(){return page;},get commits(){return commits;},get paintCount(){return paintCount;},
  click(action,id=''){ui.click({dataset:{stock:action,id},closest:()=>null});},
  emit(name){for(const fn of listeners.get(name)||[])fn({});},emitWindow(name){for(const fn of windowListeners.get(name)||[])fn({});},closeDialog(){dialog.open=false;for(const fn of dialogListeners.get('close')||[])fn({});},
  leave(){page=null;ui.suspend?.();},
  run(ms){for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}},
  data(request){return {announcements:[{market:'TW',symbol:request.symbol,currency:'TWD',exDividendDate:'2026-10-15',paymentDate:'2026-11-05',cashDividend:.5,source:'TWSE ETF 收益分配',sourceUrl:'https://www.twse.com.tw/zh/products/securities/etf/products/div.html',checkedAt:new Date().toISOString()}],errors:[],checkedAt:new Date().toISOString()};}
 };
}

test('R84 table position survives favorite/filter refresh and resets when changing investment tab',()=>{
 const h=harness();h.click('tab','stocks');h.page.boxes[0].scrollLeft=840;h.page.boxes[0].scrollTop=36;h.click('favorite','a0');
 assert.equal(h.page.boxes[0].scrollLeft,840);assert.equal(h.page.boxes[0].scrollTop,36);assert.equal(h.state.stockPortfolio.assets[0].favorite,true);
 h.ui.submit({id:'stockListForm',values:{search:'Fixture'}});assert.equal(h.page.boxes[0].scrollLeft,840);
 h.click('tab','overview');assert.equal(h.page.boxes[0].scrollLeft,0);
});

test('R84 hidden and offline pages start no automatic or manual forecast requests',()=>{
 for(const mode of ['hidden','offline']){const h=harness();if(mode==='hidden')h.context.document.hidden=true;else h.context.navigator.onLine=false;
  h.click('tab','income');h.run(150);h.click('refresh-forecasts');assert.equal(h.requests.length,0,mode);assert.equal(h.commits,0);
 }
});

test('R84 hiding, going offline, switching tabs and leaving abort forecasts and reject late batches',async()=>{
 for(const mode of ['hidden','offline','tab','leave']){const h=harness(4),before=JSON.stringify(h.state.stockPortfolio);h.click('tab','income');h.run(150);assert.equal(h.requests.length,2);
  if(mode==='hidden'){h.context.document.hidden=true;h.emit('visibilitychange');}else if(mode==='offline'){h.context.navigator.onLine=false;h.emitWindow('offline');}else if(mode==='tab')h.click('tab','stocks');else h.leave();
  assert.ok(h.requests.every(r=>r.signal?.aborted),mode);
  for(const r of [...h.requests])r.resolve(h.data(r));await turn();assert.equal(h.requests.length,2,'no later batch: '+mode);assert.equal(JSON.stringify(h.state.stockPortfolio),before);assert.equal(h.commits,0);
 }
});

test('R84 resume ignores superseded replies and keeps successful announcements pending until the editor closes',async()=>{
 const h=harness(),originalTransactions=JSON.stringify(h.state.stockPortfolio.transactions);h.click('tab','income');h.run(150);const old=h.requests[0];
 h.context.document.hidden=true;h.emit('visibilitychange');h.context.document.hidden=false;h.emit('visibilitychange');h.run(150);assert.equal(h.requests.length,2);
 old.resolve(h.data(old));await turn();assert.equal(h.commits,0);assert.match(h.html,/data-stock="refresh-forecasts" disabled aria-busy="true"/);
 const active=h.requests[1];h.dialog.open=true;active.resolve(h.data(active));await turn();assert.equal(h.commits,0);
 h.state.stockPortfolio.assets[0].dividendPlanOverrides={'2026-10-15':{quantity:120}};
 h.closeDialog();h.run(0);await turn();assert.equal(h.commits,1);assert.equal(h.state.stockPortfolio.assets[0].dividendForecast.announcements.length,1);assert.equal(h.state.stockPortfolio.assets[0].dividendPlanOverrides['2026-10-15'].quantity,120);
 assert.equal(JSON.stringify(h.state.stockPortfolio.transactions),originalTransactions);assert.equal(h.core.calculate(h.state.stockPortfolio,2026,today).yearDividends,0);
});

test('R84 an already-cancelled request never starts HTTP or a timeout',async()=>{
 const h=harness(),controller=new AbortController();controller.abort();let sent=0;h.context.fetch=async()=>{sent++;return {ok:true,json:async()=>({announcements:[],errors:[]})};};
 // Reload just the actual service implementation, retaining the native fixture.
 vm.runInContext(sources[1],h.context);
 await assert.rejects(h.context.SalaryMateStockServices.forecasts('TW','0050',2026,controller.signal));assert.equal(sent,0);assert.equal(h.timers.size,0);
});

test('R85 same-symbol forecast accounts share a request and each keeps its own saved result',async()=>{
 const h=harness(4);h.state.stockPortfolio.assets[2].symbol='0050';h.state.stockPortfolio.assets[3].symbol='0050';h.state.stockPortfolio.assets.forEach((a,i)=>{a.account='Fixture '+i;});
 const original=JSON.stringify(h.state.stockPortfolio.transactions);h.click('tab','income');h.run(150);
 assert.equal(h.requests.length,2);assert.deepEqual(h.requests.map(r=>r.symbol),['0050','0051']);
 for(const r of h.requests)r.resolve(h.data(r));await turn();assert.equal(h.commits,1);
 for(const a of h.state.stockPortfolio.assets)assert.equal(a.dividendForecast.announcements[0].symbol,a.symbol);
 assert.equal(JSON.stringify(h.state.stockPortfolio.transactions),original);
});

test('R84 allocation stays available on small screens while retaining screen-only layout changes',()=>{
 const ast=postcss.parse(fs.readFileSync(new URL('styles.css',base),'utf8'));
 for(const width of [320,390,720,1180,1280,2560]){let display='block';
  ast.walkRules(rule=>{if(!rule.selector.split(',').some(s=>s.trim()==='.stock-allocation'))return;let matches=true,p=rule.parent;
   while(p){if(p.type==='atrule'&&p.name==='media'){if(/print/.test(p.params))matches=false;for(const m of p.params.matchAll(/\((min|max)-width:\s*(\d+)px\)/g))if(m[1]==='min'?width<+m[2]:width>+m[2])matches=false;}p=p.parent;}
   if(matches)for(const n of rule.nodes)if(n.type==='decl'&&n.prop==='display')display=n.value;
  });assert.notEqual(display,'none','allocation hidden at '+width);
 }
});
