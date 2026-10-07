import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../dist/dev/v5.0.0-dev.2/stocks.js';
import {boot,fixture,KEY} from './helpers/v5-full-dom.mjs';
const core=globalThis.SalaryMateStocks;
const asset=(overrides={})=>({id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'主帳戶',note:'',quotePrice:120,quoteDate:'2026-09-30',quoteFx:1,...overrides});
const tx=(id,type,overrides={})=>({id,assetId:'a',date:'2026-09-01',time:'12:00',type,quantity:100,price:100,amount:0,ratio:1,fee:10,tax:0,fx:1,note:'',...overrides});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const book=(transactions=[],assets=[asset()])=>({assets,transactions});
const seed=p=>({...fixture(),stockPortfolio:p});
const fill=(b,data)=>Object.entries(data).forEach(([k,v])=>b.change(`#stockForm [name="${k}"]`,String(v)));
const action=(b,a,id)=>b.click(`[data-stock="${a}"]${id?`[data-id="${id}"]`:''}`);
test('Stocks: FIFO includes fees/tax; partial sale releases earliest purchase cost',()=>{
 const p=book([tx('b1','buy'),tx('b2','buy',{date:'2026-09-02',price:200,fee:20,tax:10}),tx('s','sell',{date:'2026-09-03',quantity:50,price:180,fee:5,tax:27})]);
 core.validate(p);const m=core.calculate(p,2026),h=m.holdings[0];
 near(h.quantity,150);near(h.average,166.9);near(h.costTwd,25035);near(m.yearRealized,3963);near(m.value,18000);near(m.unrealized,-7035);assert.equal(m.events.length,3);
});
test('Stocks: foreign FX uses historical book cost, sale FX, and current quote FX separately',()=>{
 const p=book([tx('b','buy',{quantity:10,price:100,fee:2,fx:30}),tx('s','sell',{date:'2026-09-02',quantity:4,price:120,fee:1,tax:1,fx:32}),tx('d','dividend',{date:'2026-09-03',amount:30,fee:1,tax:9,fx:31})],[asset({market:'US',currency:'USD',quotePrice:130,quoteFx:33})]);
 const m=core.calculate(core.validate(p),2026);near(m.cost,18036);near(m.yearRealized,3272);near(m.yearDividends,620);near(m.value,25740);near(m.unrealized,7704);
});
test('Stocks: full close clears cost; fractional share rebuy starts a new position',()=>{
 const p=book([tx('b','buy',{quantity:0.3,fee:0}),tx('s','sell',{date:'2026-09-02',quantity:0.3,price:110,fee:0}),tx('b2','buy',{date:'2026-09-03',quantity:0.2,price:200,fee:0})]);
 const m=core.calculate(core.validate(p),2026);near(m.holdings[0].quantity,0.2);near(m.cost,40);near(m.yearRealized,3);
});
test('Stocks: split and reverse split preserve total cost and permit correct sales',()=>{
 const p=book([tx('b','buy'),tx('sp','split',{date:'2026-09-02',ratio:2,fee:0}),tx('s','sell',{date:'2026-09-03',quantity:100,price:60}),tx('r','split',{date:'2026-09-04',ratio:0.5,fee:0})]);
 const m=core.calculate(core.validate(p),2026);near(m.holdings[0].quantity,50);near(m.cost,5005);near(m.holdings[0].average,100.1);near(m.yearRealized,985);
});
test('Stocks: chronological validation rejects overselling, deleting purchase and wrong same-day order',()=>{
 assert.throws(()=>core.validate(book([tx('s','sell')])),/超過/);
 assert.throws(()=>core.validate(book([tx('b','buy',{time:'13:00'}),tx('s','sell',{time:'12:00'})])),/超過/);
 assert.doesNotThrow(()=>core.validate(book([tx('s','sell',{time:'13:00'}),tx('b','buy',{time:'12:00'})])));
 assert.throws(()=>core.validate(book([tx('sp','split',{fee:0})])),/沒有持股/);
});
test('Stocks: missing quote is unknown, zero quote is valid, observation does not suppress totals',()=>{
 const p=book([tx('b','buy')],[asset({quotePrice:null,quoteDate:'',quoteFx:null}),asset({id:'watch',symbol:'0050',quotePrice:null})]);
 let m=core.calculate(core.validate(p),2026);assert.equal(m.value,null);assert.equal(m.unrealized,null);assert.equal(m.missing,1);
 p.assets[0]={...asset(),quotePrice:0};m=core.calculate(p,2026);assert.equal(m.value,0);assert.equal(m.unrealized,-10010);assert.equal(m.missing,0);
});
test('Stocks: yearly realized/dividend filter never resets accumulated holdings; future entries excluded at as-of',()=>{
 const p=book([tx('b','buy',{date:'2025-12-31'}),tx('s','sell',{quantity:20,date:'2026-01-01',price:150}),tx('d','dividend',{date:'2025-12-31',amount:100,fee:0}),tx('future','buy',{date:'2027-01-01'})]);
 const m=core.calculate(core.validate(p),2026,'2026-10-02');assert.equal(m.holdings[0].quantity,80);assert.equal(m.yearDividends,0);assert.equal(m.dividends,100);assert.equal(m.events.length,3);
});
test('Stocks: strict backups reject duplicate IDs, invalid dates, Infinity, missing assets, FX and excess withholding',()=>{
 const invalid=[book([tx('b','buy'),tx('b','buy')]),book([],[asset(),asset()]),book([tx('b','buy',{date:'2026-02-30'})]),book([tx('b','buy',{quantity:Infinity})]),book([tx('b','buy',{assetId:'lost'})]),book([tx('b','buy',{fx:32})]),book([tx('d','dividend',{amount:10,tax:20})]),book([],[asset({quoteFx:0})])];
 for(const p of invalid)assert.throws(()=>core.validate(p));
});
test('Stocks UI: no-company create, buy, quote refresh, partial sell, dividend and reload preserve payroll',async()=>{
 const b=boot();b.tab('investment');action(b,'asset');fill(b,{symbol:'2330',name:'台積電'});b.submit('#stockForm');const id=b.state().stockPortfolio.assets[0].id;
 action(b,'buy',id);fill(b,{date:'2026-09-01',quantity:100,price:100,fee:10});b.submit('#stockForm');assert.equal(b.state().stockPortfolio.transactions.length,1);
 assert.match(b.q('main').textContent,/待補齊股價/);b.w.fetch=async()=>({ok:true,json:async()=>({quotes:[{market:'TW',symbol:'2330',currency:'TWD',price:120,date:'2026-09-30',source:'TWSE 上市收盤'}],errors:[]})});action(b,'refresh');for(let i=0;i<40&&!b.q('.stock-sync-result');i++)await new Promise(r=>setTimeout(r,10));assert.match(b.q('main').textContent,/12,000/);
 action(b,'sell',id);fill(b,{date:'2026-09-02',quantity:40,price:150,fee:5,tax:18});b.submit('#stockForm');action(b,'dividend');fill(b,{date:'2026-09-03',amount:100,fee:0,tax:10});b.submit('#stockForm');
 const payload=b.w.SalaryMateData.exportPayload(),m=core.calculate(b.state().stockPortfolio,2026);near(m.cost,6006);near(m.yearRealized,1973);near(m.yearDividends,90);assert.equal(b.state().investmentRecords.length,0);assert.equal(b.state().companies.length,0);
 const c=boot(payload);c.tab('investment');assert.equal(c.state().stockPortfolio.transactions.length,3);assert.match(c.q('main').textContent,/7,200/);for(const app of [b,c]){assert.deepEqual(app.errors,[]);app.close();}
});
test('Stocks UI: transaction edits/deletes cannot invalidate later sales; sold asset cannot be deleted',()=>{
 const b=boot(seed(book([tx('b','buy'),tx('s','sell',{date:'2026-09-02',quantity:60})])));b.tab('investment');action(b,'tab','transactions');
 action(b,'transaction','b');fill(b,{quantity:20});b.submit('#stockForm');assert.equal(b.state().stockPortfolio.transactions[0].quantity,100);assert.match(b.q('#stockForm').textContent,/超過/);b.click('[data-action="close-dialog"]');
 action(b,'delete-transaction','b');assert.equal(b.q('#appDialog').open,false);assert.equal(b.state().stockPortfolio.transactions.length,2);
 action(b,'detail','a');action(b,'delete-asset','a');assert.equal(b.state().stockPortfolio.assets.length,1);b.click('[data-action="close-dialog"]');
 action(b,'delete-transaction','s');b.click('[data-action="confirm-action"]');assert.equal(b.state().stockPortfolio.transactions.length,1);action(b,'transaction','b');fill(b,{quantity:120});b.submit('#stockForm');assert.equal(b.state().stockPortfolio.transactions[0].quantity,120);assert.deepEqual(b.errors,[]);b.close();
});
test('Stocks UI: all five tabs, symbol/account search, sorting, CSV and detail are operational',()=>{
 const b=boot(seed(book([tx('b','buy')],[asset(),asset({id:'a2',symbol:'AAPL',name:'Apple',market:'US',currency:'USD',account:'美股',quoteFx:32})])));b.tab('investment');
 for(const tab of ['overview','transactions','income','analysis','watchlist']){action(b,'tab',tab);assert.ok(b.q(`[data-stock="tab"][data-id="${tab}"]`).classList.contains('active'));}
 assert.match(b.q('main').textContent,/Apple/);action(b,'tab','overview');b.change('#stockSearchForm [name="search"]','找不到');b.submit('#stockSearchForm');assert.match(b.q('main').textContent,/沒有符合/);b.change('#stockSearchForm [name="search"]','主帳戶');b.change('#stockSearchForm [name="sort"]','symbol');b.submit('#stockSearchForm');assert.ok(b.q('main [data-stock="detail"]'));
 action(b,'export-holdings');action(b,'tab','transactions');action(b,'export-transactions');assert.equal(b.downloads.length,2);action(b,'detail','a');assert.match(b.q('#appDialog').textContent,/全部年度紀錄/);assert.deepEqual(b.errors,[]);b.close();
});
test('Stocks UI: switching foreign asset uses explicit FX and protects currency after transactions',()=>{
 const b=boot(seed(book([],[asset(),asset({id:'us',symbol:'AAPL',market:'US',currency:'USD',quoteFx:32})])));b.tab('investment');action(b,'buy');fill(b,{assetId:'us',date:'2026-09-01',quantity:2,price:100});assert.equal(b.q('#stockForm [name="fx"]').value,'32');assert.equal(b.q('#stockForm [name="fx"]').readOnly,false);b.submit('#stockForm');assert.equal(b.state().stockPortfolio.transactions[0].fx,32);
 action(b,'detail','us');action(b,'asset','us');fill(b,{currency:'TWD'});b.submit('#stockForm');assert.match(b.q('#stockForm').textContent,/無法更換/);assert.equal(b.state().stockPortfolio.assets[1].currency,'USD');assert.deepEqual(b.errors,[]);b.close();
});
test('Stocks UI: malformed backup is read-only; valid portfolio round-trips with original income and payroll',async()=>{
 const original=seed(book([tx('b','buy'),tx('d','dividend',{date:'2026-09-02',amount:100,fee:0,tax:10})])),b=boot(original),payload=b.w.SalaryMateData.exportPayload(),c=boot();
 await c.w.SalaryMateData.importPayload(payload);assert.match(c.q('#appDialog').textContent,/1 檔股票及 2 筆股票紀錄/);c.click('[data-action="confirm-action"]');assert.deepEqual(c.state().stockPortfolio,b.state().stockPortfolio);assert.deepEqual(c.state().records,b.state().records);assert.equal(c.state().investmentRecords.length,1);
 c.tab('tax');assert.match(c.q('main').textContent,/1,090/);const before=c.raw(),bad=JSON.parse(payload);bad.stockPortfolio.transactions[0].quantity=-1;await c.w.SalaryMateData.importPayload(JSON.stringify(bad));assert.equal(c.raw(),before);
 for(const app of [b,c]){assert.deepEqual(app.errors,[]);app.close();}
});
test('Stocks UI: stale-tab save is rejected without losing draft or overwriting external data',()=>{
 const b=boot(seed(book()));b.tab('investment');action(b,'buy');fill(b,{date:'2026-09-01',quantity:10,price:100});const external={...b.state(),updatedAt:'external'};b.w.localStorage.setItem(KEY,JSON.stringify(external));b.submit('#stockForm');assert.equal(b.q('#appDialog').open,true);assert.equal(b.q('#stockForm [name="price"]').value,'100');assert.equal(b.w.localStorage.getItem(KEY),JSON.stringify(external));assert.equal(b.state().stockPortfolio.transactions.length,0);assert.deepEqual(b.errors,[]);b.close();
});
test('Stocks UI: imported labels are escaped; schema migration never touches old storage',()=>{
 const b=boot(seed(book([],[asset({symbol:'<img src=x onerror=alert(1)>',name:'<script>bad</script>'})])));b.tab('investment');action(b,'tab','watchlist');assert.equal(b.q('main img'),null);assert.equal(b.q('main script'),null);assert.equal(b.state().schemaVersion,15);assert.equal(b.w.localStorage.getItem('salarymate_v310_state'),'v4-original');assert.deepEqual(b.errors,[]);b.close();
});
test('Stocks shell includes modules in correct order and service-worker cache, desktop/mobile styles',()=>{
 const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url),html=fs.readFileSync(new URL('index.html',base),'utf8'),sw=fs.readFileSync(new URL('sw.js',base),'utf8'),css=fs.readFileSync(new URL('styles.css',base),'utf8');
 assert.ok(html.indexOf('./stocks.js')<html.indexOf('./stocks-ui.js'));assert.ok(html.indexOf('./stocks-ui.js')<html.indexOf('./app.js'));assert.match(sw,/stocks\.js/);assert.match(sw,/stocks-ui\.js/);assert.match(css,/\.stock-workspace\{display:grid/);assert.match(css,/@media\(max-width:720px\).*\.stock-stats/);
});
test('Stocks UI: stock-only historical years appear in filter and do not change current holdings',()=>{
 const b=boot(seed(book([tx('old','buy',{date:'2020-09-01'}),tx('s','sell',{quantity:10,date:'2021-09-01',price:200})])));b.tab('investment');assert.ok([...b.q('#yearFilter').options].some(x=>x.value==='2020'));b.change('#yearFilter','2021');action(b,'tab','transactions');assert.match(b.q('main').textContent,/2021-09-01/);assert.ok(![...b.q('.stock-table').querySelectorAll('tbody tr>td:first-child')].some(td=>td.textContent.includes('2020-09-01')));action(b,'tab','overview');assert.match(b.q('.stock-table').textContent,/90 股/);assert.deepEqual(b.errors,[]);b.close();
});
test('Stocks UI: split fields disable irrelevant required inputs and preserve cost',()=>{
 const b=boot(seed(book([tx('b','buy')])));b.tab('investment');action(b,'tab','transactions');action(b,'split');fill(b,{date:'2026-09-02',ratio:2});assert.equal(b.q('#stockForm [name="price"]').disabled,true);assert.equal(b.q('#stockForm [name="fee"]').disabled,true);b.submit('#stockForm');const m=core.calculate(b.state().stockPortfolio,2026);assert.equal(m.holdings[0].quantity,200);assert.equal(m.cost,10010);assert.deepEqual(b.errors,[]);b.close();
});
test('Stocks UI: invalid payroll company selection does not prevent independent stock tracking',()=>{
 const raw=seed(book());raw.companies.forEach(c=>c.isCurrent=false);const b=boot(raw);b.tab('investment');action(b,'buy');fill(b,{date:'2026-09-01',quantity:1,price:100});b.submit('#stockForm');assert.equal(b.state().stockPortfolio.transactions.length,1);assert.deepEqual(b.errors,[]);b.close();
});
