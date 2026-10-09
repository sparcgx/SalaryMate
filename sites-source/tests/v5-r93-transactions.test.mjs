import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Execute production functions in Node with fictional inputs and callback spies.
// No browser, DOM tree, HTML parser, emulator or networking is used.
const project=fileURLToPath(new URL('../',import.meta.url));
const source=fs.readFileSync(project+'/dist/dev/v5.0.0-dev.2/stocks-ui.js','utf8');
const originalReturn='return {render,click,submit,updateTradeForm,onInput,onChange,cancelDialogRequests,';
assert.ok(source.includes(originalReturn),'production return probe anchor must exist');
function harness(){
 const counts={models:0,renders:0,applies:0,scrollRefreshes:0},listeners=new Map();
 let year=2026,currentEvents=[];
 const state={stockPortfolio:{assets:[],transactions:[],marketData:{autoRefresh:false,quoteEnabled:false}}};
 const document={hidden:true,querySelector:selector=>selector==='#appDialog'?{open:false,addEventListener(){}}:null,addEventListener(name,fn){const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows);}};
 class FormData {constructor(form){this.values=form.values||{};}get(key){return this.values[key]??null;}has(key){return Object.hasOwn(this.values,key);}}
 const context={Intl,Date,document,FormData,SalaryMateI18n:{user:value=>value,text:value=>value,apply(){counts.applies++;}},SalaryMateScrollbars:{refresh(){counts.scrollRefreshes++;}},navigator:{onLine:true},setTimeout(){throw Error('Unexpected timer');},clearTimeout(){}};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(project+'/dist/dev/v5.0.0-dev.2/stocks.js','utf8'),context);
 vm.runInContext(source.replace(originalReturn,'return {__audit:{eventTable,eventFrames,eventPages,expandFifo,changeEventPage,view},render,click,submit,updateTradeForm,onInput,onChange,cancelDialogRequests,'),context);
 let ui;
 const model=()=>{counts.models++;return {events:currentEvents,holdings:[],cost:0,pricedValue:0,unrealized:0,yearRealized:0,yearDividends:0,yearFees:0,missing:0};};
 const api={state:()=>state,year:()=>year,today:()=>'2026-10-09',model,legacyTotal:()=>0,render(){counts.renders++;},toast(){}};
 ui=context.SalaryMateStocksUI.create(api);
 return {ui,probe:ui.__audit,counts,listeners,api,setYear(value){year=value;},setEvents(value){currentEvents=value;},toggle(details){for(const fn of listeners.get('toggle')||[])fn({target:details});}};
}
function fixture(count,type='buy'){
 const asset={id:'asset',symbol:'FIX',name:'Fictional asset',market:'TW',currency:'TWD',account:'Fictional account'};
 return Array.from({length:count},(_,i)=>({id:'tx'+i,type,date:'2026-01-01',time:'12:00',assetId:asset.id,asset,quantity:1,price:1,fee:.125,tax:0,fx:1,amount:1,ratio:1,cash:-1.125,realized:0,costBasisTwd:1.125,matchedLots:[],inYear:true,note:'Fictional transaction '+i}));
}
const ids=html=>Array.from(html.matchAll(/data-stock="transaction" data-id="([^"]+)"/g),match=>match[1]);
const rows=html=>(html.match(/<tr>/g)||[]).length-(html.includes('<thead>')?1:0);
function sectionSpy(scope){
 let html='';const operations=[],oldScroller={scrollLeft:71},newScroller={scrollLeft:0},focus={options:null,focus(options){this.options=options;}};
 const children=[{auditChild:'table'},{auditChild:'pager'}];
 const section={dataset:{stockEventScope:scope},firstElementChild:{childNodes:children},replaceChildren(...value){operations.push(['replace',value]);},querySelector(selector){if(selector==='.stock-table-wrap')return operations.some(row=>row[0]==='html')?newScroller:oldScroller;if(selector.startsWith('[data-stock="event-page"]'))return focus;return null;}};
 Object.defineProperty(section,'innerHTML',{get(){return html;},set(value){html=value;operations.push(['html',value]);}});
 return {section,operations,oldScroller,newScroller,focus,get html(){return html;}};
}
function pageButton(h,scope,page,{generation,isConnected=true,hostScope=scope}={}){
 const host=sectionSpy(hostScope),frame=h.probe.eventFrames.get(scope);
 const button={dataset:{scope,page:String(page),generation:String(generation??frame?.generation)},isConnected,closest:selector=>selector==='[data-stock-event-scope]'?host.section:null};
 host.button=button;return host;
}
function disclosure(h,scope,id,{generation,open=true,isConnected=true,loaded='false'}={}){
 let html='';const counts={writes:0};const content={dataset:{loaded}};
 Object.defineProperty(content,'innerHTML',{get(){return html;},set(value){html=value;counts.writes++;}});
 const frame=h.probe.eventFrames.get(scope),details={open,isConnected,dataset:{fifoScope:scope,fifoId:id,fifoGeneration:String(generation??frame?.generation)},matches:selector=>selector==='.stock-fifo',querySelector:selector=>selector==='[data-stock-fifo]'?content:null};
 return {details,content,counts,get html(){return html;}};
}

for(const count of [0,1,49,50,51,101,10000])test(`R93 production renders every ${count}-event page once, without missing or duplicated transactions`,()=>{
 const h=harness(),events=fixture(count),collected=[];let html=h.probe.eventTable(events,true,{scope:'transactions',signature:'fictional-query'});
 assert.equal(rows(html),Math.min(50,count));assert.equal(html.includes('stock-event-pages'),count>50);
 const pageCount=Math.max(1,Math.ceil(count/50));
 for(let page=0;page<pageCount;page++){
  if(page){const action=pageButton(h,'transactions',page);h.probe.changeEventPage(action.button);html=action.html;assert.equal(action.newScroller.scrollLeft,71);assert.equal(action.focus.options.preventScroll,true);assert.equal(action.operations.filter(row=>row[0]==='replace').length,1);}
  assert.ok(rows(html)<=50);collected.push(...ids(html));
 }
 assert.deepEqual(collected,events.map(event=>event.id).reverse());assert.equal(new Set(collected).size,count);assert.equal(h.counts.renders,0);assert.equal(h.counts.models,0);
});

test('R93 signatures reset annual/search/type queries and page indices clamp after deletion',()=>{
 const h=harness(),events=fixture(101);h.probe.eventTable(events,true,{signature:'year=2026;search=;filter=all'});h.probe.changeEventPage(pageButton(h,'transactions',2).button);assert.equal(h.probe.eventPages.get('transactions').page,2);
 const clamped=h.probe.eventTable(events.slice(0,51),true,{signature:'year=2026;search=;filter=all'});assert.equal(h.probe.eventPages.get('transactions').page,1);assert.deepEqual(ids(clamped),['tx0']);
 for(const signature of ['year=2025;search=;filter=all','year=2025;search=FIX;filter=all','year=2025;search=FIX;filter=sell']){
  h.probe.changeEventPage(pageButton(h,'transactions',1).button);const html=h.probe.eventTable(events,true,{signature});assert.equal(h.probe.eventPages.get('transactions').page,0);assert.equal(ids(html)[0],'tx100');
 }
 const empty=h.probe.eventTable([],true,{signature:'same'});assert.equal(h.probe.eventPages.get('transactions').page,0);assert.equal(h.probe.eventPages.get('transactions').pages,1);assert.equal(rows(empty),0);
});

test('R93 tab and submit actions reset event pagination; actual year signature resets during render',()=>{
 const h=harness(),events=fixture(101);h.setEvents(events);h.ui.click({dataset:{stock:'tab',id:'transactions'},closest:()=>null});h.ui.render('');h.probe.changeEventPage(pageButton(h,'transactions',1).button);assert.equal(h.probe.eventPages.get('transactions').page,1);
 h.setYear(2025);h.ui.render('');assert.equal(h.probe.eventPages.get('transactions').page,0);
 h.probe.changeEventPage(pageButton(h,'transactions',1).button);h.ui.submit({id:'stockSearchForm',values:{search:'FIX',filter:'buy'}});assert.equal(h.probe.eventPages.size,0);h.ui.render('');assert.equal(h.probe.eventPages.get('transactions').page,0);
 h.ui.click({dataset:{stock:'tab',id:'income'},closest:()=>null});assert.equal(h.probe.eventPages.size,0);
});

test('R93 dividend columns and date heading stay based on the whole filtered range',()=>{
 const h=harness(),events=fixture(101);events[0]={...events[0],type:'dividend',exDividendDate:'2025-12-31',cashDividend:.12345678};
 let html=h.probe.eventTable(events,true,{scope:'transactions'}),heads=html.match(/<thead>.*?<\/thead>/)[0];assert.match(heads,/日期／時間/);assert.match(heads,/除息日期/);assert.match(heads,/現金股利/);
 for(const page of [1,2]){const action=pageButton(h,'transactions',page);h.probe.changeEventPage(action.button);html=action.html;assert.equal(html.match(/<thead>.*?<\/thead>/)[0],heads);}
 const dividends=h.probe.eventTable(fixture(51,'dividend'),true,{scope:'income'});assert.match(dividends,/<th scope="col">入帳日期／時間<\/th>/);assert.match(dividends,/除息日期/);
});

test('R93 stale, detached, invalid and unrelated pagination actions cannot mutate any current page',()=>{
 const h=harness(),events=fixture(101);h.probe.eventTable(events,true,{signature:'first'});const oldGeneration=h.probe.eventFrames.get('transactions').generation;h.probe.eventTable(events,true,{signature:'second'});
 for(const [page,options] of [[1,{generation:oldGeneration}],[1,{isConnected:false}],[1,{hostScope:'detail'}],[-1,{}],[3,{}],[1.5,{}],['NaN',{}],[0,{}]]){
  const action=pageButton(h,'transactions',page,options);h.probe.changeEventPage(action.button);assert.equal(action.operations.length,0);assert.equal(h.probe.eventPages.get('transactions').page,0);
 }
});

test('R93 closed FIFO does not read lots; first toggle uses the rendered snapshot, reopens reuse content',()=>{
 const h=harness(),events=fixture(1,'sell');let lotReads=0;
 const lots=[{date:'2025-12-30',time:'08:01',quantity:.012345678901,costTwd:.123456789},{date:'2026-01-02',time:'13:45',quantity:123.45678901,costTwd:12345.555444211}];
 events[0].costBasisTwd=12345.678901;Object.defineProperty(events[0],'matchedLots',{get(){lotReads++;return lots;}});
 const html=h.probe.eventTable(events,true,{scope:'detail',signature:'asset'});assert.equal(lotReads,0);assert.match(html,/<summary>FIFO 成本 \$12,345\.68<\/summary>/);assert.doesNotMatch(html,/<li>/);
 h.api.model=()=>{throw Error('FIFO must never re-read the current model');};h.setEvents(fixture(1,'sell'));
 const d=disclosure(h,'detail','tx0',{open:false});h.toggle(d.details);assert.equal(lotReads,0);d.details.open=true;h.toggle(d.details);
 assert.equal(d.html,'<ul><li>2025-12-30 08:01 · 0.01234568 股 · $0.12 TWD</li><li>2026-01-02 13:45 · 123.45678901 股 · $12,345.56 TWD</li></ul>');assert.equal(lotReads,1);assert.equal(d.counts.writes,1);assert.equal(d.content.dataset.loaded,'true');
 d.details.open=false;h.toggle(d.details);d.details.open=true;h.toggle(d.details);assert.equal(lotReads,1);assert.equal(d.counts.writes,1);
});

test('R93 detached, stale-generation, unknown and non-visible FIFO toggles never build hidden content',()=>{
 const h=harness(),events=fixture(101,'sell');h.probe.eventTable(events,true,{scope:'transactions'});const old=disclosure(h,'transactions','tx100');h.probe.changeEventPage(pageButton(h,'transactions',1).button);
 const stale=[old,disclosure(h,'transactions','tx50',{isConnected:false}),disclosure(h,'transactions','tx100'),disclosure(h,'transactions','missing')];
 for(const d of stale){h.toggle(d.details);assert.equal(d.counts.writes,0);assert.equal(d.content.dataset.loaded,'false');}
});

test('R93 batch preview retains all 100 unsaved transactions and its own FIFO snapshot',()=>{
 const h=harness(),events=fixture(100,'sell');events[99].costBasisTwd=12.375;events[99].matchedLots=[{date:'2026-01-01',time:'12:00',quantity:1,costTwd:12.375}];
 const html=h.probe.eventTable(events,false,{scope:'batch',paged:false,signature:'draft'});assert.equal(rows(html),100);assert.doesNotMatch(html,/stock-event-pages/);assert.doesNotMatch(html,/data-stock="transaction"/);assert.equal(h.probe.eventFrames.get('batch').sales.size,100);
 h.probe.eventTable(fixture(51,'sell'),true,{scope:'transactions'});const d=disclosure(h,'batch','tx99');h.toggle(d.details);assert.equal(d.html,'<ul><li>2026-01-01 12:00 · 1 股 · $12.38 TWD</li></ul>');assert.equal(h.counts.models,0);
});

test('R93 10,000-event first page reads zero hidden FIFO lots and preserves source data',()=>{
 const h=harness(),events=fixture(10000,'sell');let lotReads=0;const before=events.map(event=>({...event}));
 for(const event of events)Object.defineProperty(event,'matchedLots',{get(){lotReads++;return [];}});
 const html=h.probe.eventTable(events,true,{scope:'transactions'});assert.equal(rows(html),50);assert.equal(lotReads,0);assert.equal(h.probe.eventFrames.get('transactions').sales.size,50);
 assert.deepEqual(events.map(({matchedLots,...event})=>event),before.map(({matchedLots,...event})=>event));
});
