import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture,KEY} from './helpers/v5-full-dom.mjs';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
const tick=()=>new Promise(r=>setTimeout(r,10));
const until=async fn=>{for(let i=0;i<100&&!fn();i++)await tick();assert.ok(fn(),'Async operation did not settle');};
const clock=()=>Date.parse('2026-10-04T00:00:00Z');
const apiReq=(body,path='dividends',origin='https://site.test')=>new Request('https://site.test/api/stocks/'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const official=async(url,init={})=>{
 let data=[];
 if(url.includes('TWT48U'))data=[{Code:'0050',Name:'ETF',Date:'1150721',Exdividend:'息',CashDividend:''},{Code:'0050',Name:'ETF',Date:'1151015',Exdividend:'息',CashDividend:''},{Code:'0050',Date:'1150211',Exdividend:'權',CashDividend:'0'}];
 else if(url.includes('/ETF/etfDiv'))data={data:[['0050','ETF','115年07月21日','115年07月27日','115年08月10日','0.6']]};
 else if(url.includes('/api/etfExDiv')){assert.equal(init.method,'POST');assert.equal(new URLSearchParams(init.body).get('lang'),'zh-tw');data=[{stockNo:'00836B',stockName:'Bond ETF',divDate:'115年09月23日',inDate:'115年10月20日',amount:'0.382'}];}
 else if(url.includes('TWT49UDetail'))data={fields:['股票代號','股票名稱','(每股配發現金股利)除息'],data:[['2330','Stock',url.includes('20260916')?'7.000001 元／股':'1.5 元／股']]};
 else if(url.includes('TWT49U'))data={data:[['115年09月16日','2330','Stock','','','7.000001','息'],['115年08月16日','2330','Stock','','','9','權息']]};
 return new Response(JSON.stringify(data));
};
const stockSeed=()=>{const f=fixture();f.stockPortfolio={assets:[{id:'a',symbol:'0050',name:'ETF',market:'TW',currency:'TWD',account:'Private account'},{id:'b',symbol:'00836B',name:'Bond ETF',market:'TW',currency:'TWD'}],transactions:[]};return f;};
const openDividend=b=>{b.tab('investment');b.click('[data-stock="dividend"]');};
const ready=async b=>until(()=>!b.q('[data-stock="lookup-dividends"]')?.disabled);
const fields=(b,name,value)=>b.change(`#stockForm [name="${name}"]`,value);
const installAPI=b=>{const market=createStockMarket(official,clock),portable=createPortableMarket(market),sent=[];b.w.fetch=async(url,init)=>{sent.push(JSON.parse(init.body));const request=apiReq(JSON.parse(init.body),url.includes('/portable/')?'portable/dividends':'dividends',url.includes('/portable/')?'null':'https://site.test');return url.includes('/portable/')?portable(request):market(request);};return sent;};

test('R10 official API: actual ETF data, pending announcements, deduplication and TPEx POST mapping',async()=>{
 const handle=createStockMarket(official,clock);
 let d=await(await handle(apiReq({market:'TW',symbol:'0050',year:2026}))).json();assert.equal(d.announcements.length,2);
 assert.equal(d.announcements[0].cashDividend,null);assert.equal(d.announcements[0].status,'pending');const x=d.announcements[1];assert.equal(x.exDividendDate,'2026-07-21');assert.equal(x.paymentDate,'2026-08-10');assert.equal(x.cashDividend,.6);assert.match(x.source,/TWSE ETF/);
 d=await(await handle(apiReq({market:'TW',symbol:'00836B',year:2026}))).json();assert.equal(d.announcements[0].cashDividend,.382);assert.equal(d.announcements[0].paymentDate,'2026-10-20');
 d=await(await handle(apiReq({market:'TW',symbol:'2330',year:2026}))).json();assert.equal(d.announcements.length,2);assert.equal(d.announcements[0].cashDividend,7.000001);assert.equal(d.announcements[1].cashDividend,1.5);
});

test('R10 official API: unsupported markets, years, symbols and origins are safe; partial failures remain visible',async()=>{
 const handle=createStockMarket(official,clock);
 for(const body of [{market:'TW',symbol:'0050',year:1900},{market:'TW',symbol:'https://wrong',year:2026},{market:'TW',symbol:'0050',year:3000}])assert.equal((await handle(apiReq(body))).status,400);
 assert.equal((await handle(apiReq({market:'TW',symbol:'0050',year:2026},'dividends','https://other.test'))).status,403);
 const us=await(await handle(apiReq({market:'US',symbol:'AAPL',year:2026}))).json();assert.equal(us.announcements.length,0);assert.match(us.errors[0],/其他市場/);
 const partial=createStockMarket(async(...args)=>{if(args[0].includes('openapi'))throw Error('offline');return official(...args);},clock);
 const p=await(await partial(apiReq({market:'TW',symbol:'0050',year:2026}))).json();assert.equal(p.announcements.length,1);assert.ok(p.errors.length);
 const down=createStockMarket(async()=>{throw Error('offline');},clock);assert.equal((await down(apiReq({market:'TW',symbol:'0050',year:2026}))).status,503);
 const portable=createPortableMarket(handle),response=await portable(apiReq({market:'TW',symbol:'0050',year:2026},'portable/dividends','null'));assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'null');
});

test('R10 dividend form: choose official period, retain gross receipt, save provenance, reject pending and clear edited provenance',async()=>{
 const b=boot(stockSeed()),sent=installAPI(b);openDividend(b);await ready(b);
 fields(b,'date','2026-09-16');fields(b,'amount','90');fields(b,'fee','5');b.click('[data-stock="apply-dividend"]');
 assert.equal(b.q('[name="exDividendDate"]').value,'2026-07-21');assert.equal(b.q('[name="cashDividend"]').value,'0.6');assert.equal(b.q('[name="amount"]').value,'90');assert.match(b.q('#stockDividendSource').textContent,/TWSE/);
 assert.deepEqual(Object.keys(sent[0]).sort(),['market','symbol','year']);b.submit('#stockForm');let saved=b.state().stockPortfolio.transactions[0];assert.equal(saved.cashDividend,.6);assert.equal(saved.amount,90);assert.equal(saved.dividendAnnouncement.source,'TWSE ETF 收益分配');assert.equal(b.w.SalaryMateStocks.calculate(b.state().stockPortfolio,2026).yearDividends,85);
 b.click('[data-stock="tab"][data-id="transactions"]');b.click(`[data-stock="transaction"][data-id="${saved.id}"]`);await ready(b);
 b.change('#stockDividendPeriod','0');assert.equal(b.q('[data-stock="apply-dividend"]').disabled,true);
 fields(b,'cashDividend','0.7');b.submit('#stockForm');saved=b.state().stockPortfolio.transactions[0];assert.equal(saved.cashDividend,.7);assert.equal(saved.dividendAnnouncement,null);assert.deepEqual(b.errors,[]);b.close();
});

test('R10 dividend form: exact payment date auto-fills blanks; network failure retains entered values',async()=>{
 const b=boot(stockSeed());installAPI(b);openDividend(b);await ready(b);
 fields(b,'date','2026-08-10');b.click('[data-stock="lookup-dividends"]');await ready(b);assert.equal(b.q('[name="exDividendDate"]').value,'2026-07-21');assert.equal(b.q('[name="cashDividend"]').value,'0.6');
 fields(b,'cashDividend','0.8');b.w.fetch=async()=>{throw Error('offline');};b.click('[data-stock="lookup-dividends"]');await ready(b);assert.equal(b.q('[name="cashDividend"]').value,'0.8');assert.match(b.q('#stockDividendStatus').textContent,/失敗/);assert.deepEqual(b.errors,[]);b.close();
});

test('R10 dividend form: stale response cannot fill another stock or revive a closed dialog',async()=>{
 const b=boot(stockSeed());let release;b.w.fetch=()=>new Promise(r=>release=r);openDividend(b);
 const first=release;fields(b,'assetId','b');first(new Response(JSON.stringify({market:'TW',symbol:'0050',announcements:[{market:'TW',symbol:'0050',currency:'TWD',cashDividend:.6,exDividendDate:'2026-07-21',paymentDate:'2026-10-04'}],errors:[]})));await tick();assert.equal(b.q('[name="cashDividend"]').value,'');
 const second=release;b.click('[data-action="close-dialog"]');second(new Response(JSON.stringify({announcements:[],errors:[]})));await tick();assert.equal(b.q('#appDialog').open,false);assert.deepEqual(b.errors,[]);b.close();
});

test('R10 month reconciliation: all-equal shortcut saves every amount and source fingerprint without payroll edits',()=>{
 const b=boot(fixture());b.tab('records');b.click('[data-action="toggle-record"][data-id="r1"]');b.click('[data-action="reconcile-record"][data-id="r1"]');
 const before=b.state().records.find(r=>r.id==='r1');assert.equal(b.q('[data-action="reconcile-match"]').disabled,false);b.click('[data-action="reconcile-match"]');const after=b.state().records.find(r=>r.id==='r1');
 assert.equal(after.reconciliation.reviewed,true);assert.ok(after.reconciliation.fingerprint);for(const row of b.w.SalaryMateReconcile.rows(after))assert.equal(after.reconciliation.actual[row.key],row.expected);delete after.reconciliation;delete before.reconciliation;assert.deepEqual(after,before);assert.deepEqual(b.errors,[]);b.close();
});

test('R10 month reconciliation: explicit differences, missing source and concurrent edits prevent shortcut completion',()=>{
 for(const kind of ['difference','source','concurrent']){
  const f=fixture();if(kind==='source')f.records[0].overtime=100;
  const b=boot(f);b.tab('records');b.click('[data-action="toggle-record"][data-id="r1"]');b.click('[data-action="reconcile-record"][data-id="r1"]');
  if(kind==='difference')b.change('[data-reconcile-key="baseSalary"]','47999');
  if(kind==='concurrent'){const changed=JSON.parse(b.raw());changed.records[0].baseSalary=50000;b.w.localStorage.setItem(KEY,JSON.stringify(changed));}
  const before=b.raw();if(kind!=='concurrent')assert.equal(b.q('[data-action="reconcile-match"]').disabled,true);b.click('[data-action="reconcile-match"]');assert.equal(b.raw(),before);assert.deepEqual(b.errors,[]);b.close();
 }
});

test('R10 desktop scrollbars: mounted before tables, synchronized both ways, keyboard scroll and stale control cleanup',()=>{
 const b=boot(stockSeed());b.tab('investment');b.click('[data-stock="tab"][data-id="watchlist"]');const box=b.q('.stock-table-wrap');Object.defineProperties(box,{scrollWidth:{value:1600,configurable:true},clientWidth:{value:800,configurable:true}});
 b.w.SalaryMateScrollbars.refresh();const bar=box.previousElementSibling;assert.ok(bar.classList.contains('table-top-scroll'));assert.equal(bar.hidden,false);assert.equal(bar.firstElementChild.style.width,'1600px');
 bar.scrollLeft=200;bar.dispatchEvent(new b.w.Event('scroll'));assert.equal(box.scrollLeft,200);box.scrollLeft=450;box.dispatchEvent(new b.w.Event('scroll'));assert.equal(bar.scrollLeft,450);
 bar.dispatchEvent(new b.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(box.scrollLeft,530);b.w.SalaryMateScrollbars.refresh();assert.equal(b.w.document.querySelectorAll('.table-top-scroll').length,1);
 b.tab('dashboard');b.w.SalaryMateScrollbars.refresh();assert.equal(bar.isConnected,false);assert.deepEqual(b.errors,[]);b.close();
});

test('R10 official and quick-review controls translate while preserving announcement values',async()=>{
 const f=stockSeed();f.companies.forEach((c,i)=>c.name='Company '+i);const b=boot(f,{language:'en-US'});installAPI(b);openDividend(b);await ready(b);
 b.click('[data-stock="apply-dividend"]');b.w.SalaryMateI18n.apply();assert.doesNotMatch(b.q('#dialogContent').textContent,/\p{Script=Han}/u);assert.doesNotMatch(b.q('#dialogTitle').textContent,/\p{Script=Han}/u);
 const cash=b.q('[name="cashDividend"]').value;b.w.SalaryMateI18n.set('zh');assert.equal(b.q('[name="cashDividend"]').value,cash);assert.match(b.q('#stockDividendSource').textContent,/已帶入/);
 b.click('[data-action="close-dialog"]');b.w.SalaryMateI18n.set('en');b.tab('records');b.click('[data-action="toggle-record"][data-id="r1"]');b.click('[data-action="reconcile-record"][data-id="r1"]');b.w.SalaryMateI18n.apply();assert.doesNotMatch(b.q('.reconcile-quick').textContent,/\p{Script=Han}/u);assert.deepEqual(b.errors,[]);b.close();
});
