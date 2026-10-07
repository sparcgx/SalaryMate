import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/dev/v5.0.0-dev.2/stocks.js';
import '../dist/dev/v5.0.0-dev.2/stocks-integrations.js';
import {boot,fixture,KEY} from './helpers/v5-full-dom.mjs';
const core=globalThis.SalaryMateStocks,services=globalThis.SalaryMateStockServices;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const asset=(o={})=>({id:'a',symbol:'0050',name:'ETF',market:'TW',currency:'TWD',account:'Main',...o});
const tx=(id,type,o={})=>({id,assetId:'a',type,date:'2026-09-01',time:'12:00',quantity:100,price:10,fee:0,tax:0,fx:1,...o});
const seed=(transactions=[],assets=[asset()])=>({...fixture(),stockPortfolio:{assets,transactions}});
const book=transactions=>({assets:[asset()],transactions});
const tick=()=>new Promise(r=>setTimeout(r,10));
const until=async fn=>{for(let i=0;i<150&&!fn();i++)await tick();assert.ok(fn(),'Async work did not settle');};
const click=(b,name)=>b.click(`[data-stock="${name}"]`);
const rows=b=>[...b.w.document.querySelectorAll('[data-batch-row]')];
function fill(b,row,data){for(const [name,value] of Object.entries(data))b.change(`[data-batch-row="${rows(b)[row].dataset.batchRow}"] [name="${name}"]`,String(value));}
const open=b=>{b.tab('investment');click(b,'batch');};
const announcement=(o={})=>({symbol:'0050',market:'TW',currency:'TWD',exDividendDate:'2026-07-21',paymentDate:'2026-08-10',cashDividend:.6,source:'TWSE ETF 收益分配',sourceUrl:'https://www.twse.com.tw/zh/products/securities/etf/products/div.html',checkedAt:'2026-10-04T00:00:00Z',...o});
const ann=[announcement({exDividendDate:'2026-10-15',paymentDate:'2026-11-10',cashDividend:.9}),announcement(),announcement({exDividendDate:'2026-01-20',paymentDate:'2026-02-10',cashDividend:.5})];
const install=b=>{let calls=0;b.w.fetch=async()=>{calls++;return new Response(JSON.stringify({announcements:ann,errors:[]}));};return ()=>calls;};

test('R11 FIFO: cross-lot sales release each original fee/tax/FX basis and preserve accounting identity',()=>{
 const p={assets:[asset({market:'US',currency:'USD'})],transactions:[tx('a1','buy',{quantity:100,price:10,fee:10,tax:2,fx:30}),tx('a2','buy',{date:'2026-09-02',quantity:50,price:20,fee:5,fx:32}),tx('s1','sell',{date:'2026-09-03',quantity:120,price:30,fee:7,tax:3,fx:33})]};
 const original=JSON.stringify(p),m=core.calculate(core.validate(p)),s=m.events.at(-1);
 near(s.costBasis,1414);near(s.costBasisTwd,43224);near(s.realized,75246);near(m.cost,19296);near(m.holdings[0].quantity,30);near(m.holdings[0].average,20.1);
 assert.deepEqual(s.matchedLots.map(l=>[l.transactionId,l.quantity]),[['a1',100],['a2',20]]);
 near(m.cost+s.costBasisTwd,1012*30+1005*32);assert.equal(JSON.stringify(p),original);
});
test('R11 FIFO: splits, reverse splits, same-day order, separate accounts and fractional full closes',()=>{
 const p=book([tx('b1','opening',{quantity:10,price:100,time:'09:00'}),tx('b2','buy',{quantity:10,price:200,time:'10:00'}),tx('split','split',{ratio:2,time:'11:00'}),tx('sell','sell',{quantity:30,price:120,time:'12:00'}),tx('reverse','split',{ratio:.5,time:'13:00'})]);
 const m=core.calculate(core.validate(p));near(m.cost,1000);near(m.realized,1600);near(m.holdings[0].quantity,5);near(m.holdings[0].average,200);assert.deepEqual(m.events[3].matchedLots.map(x=>x.quantity),[20,10]);
 const f=core.calculate(core.validate(book([tx('b1','buy',{quantity:.1}),tx('b2','buy',{quantity:.2}),tx('s','sell',{quantity:.3})])));assert.equal(f.cost,0);assert.equal(f.holdings[0].lots.length,0);
 const legacy=book([tx('b','buy'),tx('s','sell',{quantity:100+5e-9})]);assert.doesNotThrow(()=>core.validate(legacy));assert.equal(core.calculate(legacy).cost,0);
 const accounts={assets:[asset(),asset({id:'b',account:'Other'})],transactions:[tx('b1','buy'),tx('s1','sell',{assetId:'b'})]};assert.throws(()=>core.validate(accounts),/超過/);
});
test('R11 FIFO: historical edit and as-of calculations use only available lots; batch oversell stays atomic',()=>{
 const p=book([tx('b1','buy'),tx('b2','buy',{date:'2026-09-02',price:20}),tx('s','sell',{date:'2026-09-03',quantity:150,price:30})]);
 const m=core.calculate(p,2026,'2026-09-01');assert.equal(m.holdings[0].quantity,100);assert.equal(m.realized,0);
 p.transactions[0].price=8;near(core.calculate(p).realized,2700);near(core.calculate(p).cost,1000);
 const before=JSON.stringify(p);assert.throws(()=>core.prepareBatch(p,[tx('x','sell',{date:'2026-09-04',quantity:51})],'2026-10-04'),/超過/);assert.equal(JSON.stringify(p),before);
});
test('R11 SmartPortfolio: FIFO or legacy average snapshots replay, explicit same-day times retained',()=>{
 for(const avgPrice of [15,20]){
 const value={schemaVersion:3,holdings:[{id:'h',symbol:'0050',name:'ETF',category:'台股',shares:100,avgPrice,currentPrice:30}],transactions:[{id:'s',symbol:'0050',name:'ETF',category:'台股',type:'SELL',date:'2026-09-01',time:'13:00',shares:100,price:30},{id:'b2',symbol:'0050',name:'ETF',category:'台股',type:'BUY',date:'2026-09-01',time:'10:00',shares:100,price:20},{id:'b1',symbol:'0050',name:'ETF',category:'台股',type:'BUY',date:'2026-09-01',time:'09:00',shares:100,price:10}]};
 const r=services.prepareSmart(value,core.empty(),{snapshotDate:'2026-10-04',token:'test'}),m=core.calculate(r.next);near(m.cost,2000);near(m.realized,2000);assert.equal(r.next.transactions.at(-1).time,'13:00');assert.match(r.warnings.join(),/FIFO/);
 }
});
test('R11 dividends: automatic latest paid match, date changes, period changes and manual edits',async()=>{
 const b=boot(seed());install(b);b.tab('investment');click(b,'dividend');await until(()=>!b.q('[data-stock="lookup-dividends"]').disabled);
 assert.equal(b.q('[name="cashDividend"]').value,'0.6');assert.equal(b.q('[name="exDividendDate"]').value,'2026-07-21');
 b.change('#stockForm [name="date"]','2026-03-01');assert.equal(b.q('[name="cashDividend"]').value,'0.5');b.change('#stockForm [name="date"]','2026-10-01');assert.equal(b.q('[name="cashDividend"]').value,'0.6');
 b.change('#stockDividendPeriod','2');assert.equal(b.q('[name="cashDividend"]').value,'0.5');
 b.change('#stockForm [name="cashDividend"]','0.7');assert.equal(b.q('[name="autoDividend"]').checked,false);click(b,'lookup-dividends');await until(()=>!b.q('[data-stock="lookup-dividends"]').disabled);assert.equal(b.q('[name="cashDividend"]').value,'0.7');
 b.change('#stockForm [name="amount"]','700');b.submit('#stockForm');assert.equal(b.state().stockPortfolio.transactions[0].cashDividend,.7);assert.equal(b.state().stockPortfolio.transactions[0].dividendAnnouncement,null);assert.deepEqual(b.errors,[]);b.close();
});
test('R11 dividends: future, pending and conflicting announcements never guess; pending response respects manual input',async()=>{
 assert.equal(services.dividendPeriod([ann[0]],'2026-10-04'),-1);assert.equal(services.dividendPeriod([announcement({cashDividend:null})],'2026-10-04'),-1);
 assert.equal(services.dividendPeriod([announcement(),announcement({cashDividend:.7})],'2026-10-04'),-1);
 assert.equal(services.dividendPeriod([announcement({paymentDate:''})],'2026-10-04'),0);
 const b=boot(seed());let release;b.w.fetch=()=>new Promise(r=>release=r);b.tab('investment');click(b,'dividend');b.change('#stockForm [name="cashDividend"]','0.8');release(new Response(JSON.stringify({announcements:ann,errors:[]})));await until(()=>!b.q('[data-stock="lookup-dividends"]').disabled);assert.equal(b.q('[name="cashDividend"]').value,'0.8');assert.deepEqual(b.errors,[]);b.close();
});
test('R11 batch: paste, edit, copy, delete, FIFO review and atomic save/reload preserve payroll',()=>{
 const b=boot(seed()),payroll=JSON.stringify(b.state().records);open(b);
 b.change('#stockBatchPaste','買入\t2026-09-01\t09:00\t0050\t100\t10\t10\t0\t1\tMain\n買入\t2026-09-02\t09:00\t0050\t100\t20\t20\t0\t1\tMain\n賣出\t2026-09-03\t09:00\t0050\t150\t30\t5\t9\t1\tMain');click(b,'batch-paste');assert.equal(rows(b).length,3);
 click(b,'batch-copy');assert.equal(rows(b).length,4);rows(b).at(-1).querySelector('[data-stock="batch-remove"]').click();assert.equal(rows(b).length,3);
 click(b,'batch-preview');assert.equal(b.state().stockPortfolio.transactions.length,0);assert.match(b.q('#stockBatchPreview').textContent,/FIFO/);assert.equal(b.q('#stockBatchForm [type="submit"]').disabled,false);
 b.submit('#stockBatchForm');const p=b.state().stockPortfolio,m=core.calculate(p);assert.equal(p.transactions.length,3);near(m.cost,1010);near(m.realized,2466);assert.equal(JSON.stringify(b.state().records),payroll);assert.equal(b.q('#appDialog').open,false);
 const c=boot(b.raw());assert.equal(c.state().stockPortfolio.transactions.length,3);c.tab('investment');b.close();assert.deepEqual(c.errors,[]);c.close();
});
test('R11 batch: oversell prevents all writes, edited preview invalidates, duplicates require explicit acknowledgment',()=>{
 const b=boot(seed([tx('b','buy')]));open(b);fill(b,0,{type:'sell',date:'2026-09-02',quantity:101,price:30});click(b,'batch-preview');assert.match(b.q('#stockBatchForm').textContent,/超過/);assert.equal(b.q('#stockBatchForm [type="submit"]').disabled,true);assert.equal(b.state().stockPortfolio.transactions.length,1);
 fill(b,0,{quantity:10});click(b,'batch-preview');assert.equal(b.q('#stockBatchForm [type="submit"]').disabled,false);fill(b,0,{price:31});assert.equal(b.q('#stockBatchForm [type="submit"]').disabled,true);b.submit('#stockBatchForm');assert.equal(b.state().stockPortfolio.transactions.length,1);
 fill(b,0,{type:'buy',date:'2026-09-01',time:'12:00',quantity:100,price:10});click(b,'batch-preview');assert.ok(b.q('#stockBatchDuplicates'));assert.equal(b.q('#stockBatchForm [type="submit"]').disabled,true);b.click('#stockBatchDuplicates');assert.equal(b.q('#stockBatchForm [type="submit"]').disabled,false);b.submit('#stockBatchForm');assert.equal(b.state().stockPortfolio.transactions.length,2);assert.deepEqual(b.errors,[]);b.close();
});
test('R11 batch: stale-tab and failed persistence cannot partially save a batch',()=>{
 for(const mode of ['stale','quota']){
 const b=boot(seed());open(b);fill(b,0,{date:'2026-09-01',price:10});click(b,'batch-copy');click(b,'batch-preview');b.click('#stockBatchDuplicates');
 const before=b.raw();if(mode==='stale')b.w.localStorage.setItem(KEY,JSON.stringify({...b.state(),updatedAt:'external'}));else{const original=b.w.Storage.prototype.setItem;b.w.Storage.prototype.setItem=function(k,v){if(k===KEY)throw Error('QuotaExceeded');return original.call(this,k,v);};}
 b.submit('#stockBatchForm');assert.equal(b.state().stockPortfolio.transactions.length,0);assert.equal(b.q('#appDialog').open,true);assert.equal(rows(b).length,2);if(mode==='quota')assert.equal(b.raw(),before);else assert.match(b.raw(),/external/);assert.deepEqual(b.errors,[]);b.close();
 }
});
test('R11 batch: dividend auto-fill is shared by symbol, keeps gross total, and saved trades remain editable/deletable',async()=>{
 const b=boot(seed());const calls=install(b);open(b);fill(b,0,{type:'dividend',date:'2026-09-01',amount:600});await until(()=>rows(b)[0].querySelector('[name="cashDividend"]').value==='0.6');click(b,'batch-copy');await until(()=>!rows(b)[1]._dividendPending);assert.equal(calls(),1);fill(b,1,{amount:300});
 click(b,'batch-preview');b.submit('#stockBatchForm');const list=b.state().stockPortfolio.transactions;assert.equal(list.length,2);assert.equal(list[0].amount,600);assert.equal(list[0].cashDividend,.6);assert.equal(list[1].amount,300);
 b.click(`[data-stock="transaction"][data-id="${list[0].id}"]`);b.change('#stockForm [name="amount"]','650');b.submit('#stockForm');assert.equal(b.state().stockPortfolio.transactions[0].amount,650);
 b.click(`[data-stock="delete-transaction"][data-id="${list[1].id}"]`);b.click('[data-action="confirm-action"]');assert.equal(b.state().stockPortfolio.transactions.length,1);await tick();assert.deepEqual(b.errors,[]);b.close();
});
test('R11 batch: ambiguous pasted accounts and malformed rows reject entire paste; English interface preserves values',()=>{
 const f=seed([],[asset(),asset({id:'b',account:'Other'})]);f.companies.forEach((c,i)=>c.name='Company '+i);const b=boot(f,{language:'en-US'});open(b);
 b.change('#stockBatchPaste','buy\t2026-09-01\t09:00\t0050\t10\t20');click(b,'batch-paste');assert.equal(rows(b).length,1);assert.equal(rows(b)[0].querySelector('[name="price"]').value,'');
 b.change('#stockBatchPaste','buy\t2026-09-01\t09:00\t0050\t10\t20\t0\t0\t1\tMain');click(b,'batch-paste');assert.equal(rows(b).length,1);click(b,'batch-preview');b.w.SalaryMateI18n.apply();assert.doesNotMatch(b.q('#stockBatchForm').textContent,/\p{Script=Han}/u);b.w.SalaryMateI18n.set('zh');assert.equal(rows(b)[0].querySelector('[name="price"]').value,'20');assert.deepEqual(b.errors,[]);b.close();
});
