import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/dev/v5.0.0-dev.2/stocks.js';
import '../dist/dev/v5.0.0-dev.2/stocks-integrations.js';
import {boot,fixture,KEY} from './helpers/v5-full-dom.mjs';
import {createStockMarket} from '../server/stock-market.mjs';
const core=globalThis.SalaryMateStocks,svc=globalThis.SalaryMateStockServices;
const clock=new Date(),today=`${clock.getFullYear()}-${String(clock.getMonth()+1).padStart(2,'0')}-${String(clock.getDate()).padStart(2,'0')}`,day=n=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const asset=(o={})=>({id:'a',symbol:'0050',name:'ETF',market:'TW',currency:'TWD',account:'Main',...o});
const tx=(id,type,o={})=>({id,assetId:'a',type,date:day(-10),time:'12:00',quantity:1000,price:20,fee:0,tax:0,fx:1,...o});
const ann=(o={})=>({symbol:'0050',market:'TW',currency:'TWD',exDividendDate:day(5),paymentDate:day(25),cashDividend:.6,source:'TWSE ETF 收益分配',sourceUrl:'https://www.twse.com.tw/zh/products/securities/etf/products/div.html',checkedAt:new Date().toISOString(),...o});
const cache=(announcements=[ann()])=>({checkedAt:new Date().toISOString(),announcements,errors:[]});
const seed=(p={assets:[asset()],transactions:[tx('b','buy')]})=>({...fixture(),stockPortfolio:p});
const tick=()=>new Promise(r=>setTimeout(r,10));
const until=async fn=>{for(let i=0;i<200&&!fn();i++)await tick();assert.ok(fn(),'Async work did not settle');};
const click=(b,action)=>b.click(`[data-stock="${action}"]`);
const income=b=>{b.tab('investment');b.click('[data-stock="tab"][data-id="income"]');};
const install=(b,rows=[ann()])=>{const sent=[];b.w.fetch=async(url,init)=>{sent.push(JSON.parse(init.body));return new Response(JSON.stringify({announcements:rows,errors:[],checkedAt:new Date().toISOString()}));};return sent;};

test('R12 official forecast API includes previous-year entitlement and next-year announcements without changing historical lookup',async()=>{
 const seen=[];const server=createStockMarket(async url=>{seen.push(url);return new Response(JSON.stringify(url.includes('/ETF/etfDiv')?{data:[['0050','ETF','114年12月20日','','115年01月10日','0.5'],['0050','ETF','116年01月05日','','116年02月10日','0.6']]}:[]));},()=>Date.UTC(2026,9,4));
 const call=forecast=>server(new Request('https://local.test/api/stocks/dividends',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({market:'TW',symbol:'0050',year:2026,forecast})}));
 const forecast=await (await call(true)).json();assert.ok(forecast.announcements.some(r=>r.exDividendDate==='2027-01-05'));assert.ok(forecast.announcements.some(r=>r.exDividendDate==='2025-12-20'));assert.ok(seen.some(url=>url.includes('startDate=20250101&endDate=20271231')));
 const historical=await (await call(false)).json();assert.ok(!historical.announcements.some(r=>r.exDividendDate==='2027-01-05'));assert.equal((await call('bad')).status,400);
});
test('R12 entitlement: pre-ex-date shares survive ex-date sale; ex-date purchases excluded and accounts isolated',()=>{
 const a=asset({dividendForecast:cache([ann({exDividendDate:today,paymentDate:day(10)})])});
 const p={assets:[a,asset({id:'b',account:'Other',dividendForecast:a.dividendForecast})],transactions:[tx('buy','buy'),tx('sell','sell',{date:today,quantity:1000}),tx('new','buy',{date:today,time:'13:00',quantity:300}),tx('other','buy',{assetId:'b',date:day(-5),quantity:400})]};
 const rows=core.dividendForecasts(core.validate(p),today);assert.deepEqual(rows.map(r=>[r.asset.id,r.quantity,r.amount]),[['a',1000,600],['b',400,240]]);assert.equal(core.calculate(p).dividends,0);
});
test('R12 forecast estimates: future holdings recalculate, zero holdings omitted, missing announcement and opening history remain unknown',()=>{
 const p={assets:[asset({dividendForecast:cache()})],transactions:[tx('buy','buy'),tx('sell','sell',{date:day(-1),quantity:250})]};assert.equal(core.dividendForecasts(p,today)[0].amount,450);assert.equal(core.dividendForecasts(p,today)[0].estimated,true);
 p.assets[0].dividendForecast=cache([ann({cashDividend:null})]);assert.equal(core.dividendForecasts(p,today)[0].amount,null);
 p.transactions.push(tx('close','sell',{date:today,quantity:750}));assert.equal(core.dividendForecasts(p,today).length,0);p.assets[0].dividendPlanOverrides={[day(5)]:{quantity:0}};assert.equal(core.dividendForecasts(p,today)[0].quantity,0);delete p.assets[0].dividendPlanOverrides;
 p.transactions=[tx('opening','opening',{date:today,quantity:500})];p.assets[0].dividendForecast=cache([ann({exDividendDate:day(-5),paymentDate:day(10)})]);const row=core.dividendForecasts(p,today)[0];assert.equal(row.quantity,null);assert.equal(row.amount,null);assert.equal(row.historyUnknown,true);
});
test('R12 cache: partial outages retain cached events; unknown/zero amounts stay distinct; conflicting values cannot create a guessed total',()=>{
 const prior=cache([ann({exDividendDate:day(-20),paymentDate:day(-1)})]),fresh=svc.forecastCache(prior,{announcements:[ann({cashDividend:null})],errors:['partial']},today);assert.equal(fresh.announcements.length,2);
 const p={assets:[asset({dividendForecast:cache([ann(),ann({cashDividend:.7})])})],transactions:[tx('b','buy')]};assert.equal(core.dividendForecasts(p,today)[0].amount,null);p.assets[0].dividendForecast=cache([ann({cashDividend:0})]);assert.equal(core.dividendForecasts(p,today)[0].amount,0);
 assert.throws(()=>core.validate({assets:[asset({dividendForecast:cache([ann({paymentDate:'invalid'})])})],transactions:[]}),/公告日期/);
});
test('R12 automatic entry: income view fetches public identifiers only, persists once, shares symbol lookup and never adds actual income',async()=>{
 const b=boot(seed({assets:[asset(),asset({id:'other',account:'Other'})],transactions:[tx('b','buy'),tx('b2','buy',{assetId:'other',quantity:500})]}));const sent=install(b);const before=b.state().records;income(b);await until(()=>b.state().stockPortfolio.assets.every(a=>a.dividendForecast));
 assert.equal(sent.length,1);assert.deepEqual(Object.keys(sent[0]).sort(),['forecast','market','symbol','year']);assert.equal(sent[0].forecast,true);assert.equal(b.w.SalaryMateStocks.dividendForecasts(b.state().stockPortfolio,today).length,2);assert.equal(b.state().stockPortfolio.transactions.length,2);assert.equal(core.calculate(b.state().stockPortfolio).dividends,0);assert.deepEqual(b.state().records,before);
 click(b,'refresh-forecasts');await until(()=>!b.q('[data-stock="refresh-forecasts"]').disabled);assert.equal(b.state().stockPortfolio.assets[0].dividendForecast.announcements.length,1);assert.deepEqual(b.errors,[]);b.close();
});
test('R12 forecast CRUD: edit persists against refresh, delete is suppressed across reload, restore and reset resume official data',async()=>{
 const b=boot(seed({assets:[asset({dividendForecast:cache()})],transactions:[tx('b','buy')]}));install(b);income(b);click(b,'edit-forecast');b.change('#stockForm [name="quantity"]','2000');b.change('#stockForm [name="cashDividend"]','0.8');b.submit('#stockForm');assert.equal(core.dividendForecasts(b.state().stockPortfolio,today)[0].amount,1600);
 click(b,'refresh-forecasts');await until(()=>!b.q('[data-stock="refresh-forecasts"]').disabled);assert.equal(core.dividendForecasts(b.state().stockPortfolio,today)[0].amount,1600);click(b,'delete-forecast');b.click('[data-action="confirm-action"]');assert.equal(core.dividendForecasts(b.state().stockPortfolio,today).length,0);
 click(b,'refresh-forecasts');await until(()=>!b.q('[data-stock="refresh-forecasts"]').disabled);assert.equal(core.dividendForecasts(b.state().stockPortfolio,today).length,0);
 const c=boot(b.raw());income(c);assert.equal(c.q('[data-stock="edit-forecast"]'),null);click(c,'restore-forecasts');c.click('[data-action="confirm-action"]');assert.equal(core.dividendForecasts(c.state().stockPortfolio,today)[0].amount,1600);click(c,'edit-forecast');click(c,'reset-forecast');assert.equal(core.dividendForecasts(c.state().stockPortfolio,today)[0].amount,600);
 for(const app of [b,c]){assert.deepEqual(app.errors,[]);app.close();}
});
test('R12 receipts: confirmation creates one actual dividend with source, actual fees, and hides only the matching forecast',async()=>{
 const announcement=ann({exDividendDate:day(-3),paymentDate:today}),b=boot(seed({assets:[asset({dividendForecast:cache([announcement,ann()])})],transactions:[tx('b','buy')]}));install(b,[announcement,ann()]);income(b);click(b,'receive-forecast');assert.equal(b.q('#stockForm [name="amount"]').value,'600');assert.equal(b.q('#stockForm [name="autoDividend"]').checked,false);b.change('#stockForm [name="fee"]','10');b.submit('#stockForm');const p=b.state().stockPortfolio;
 assert.equal(p.transactions.length,2);assert.equal(p.transactions.at(-1).dividendPlanKey,'a:'+day(-3));assert.equal(core.calculate(p).dividends,590);assert.equal(p.transactions.at(-1).dividendAnnouncement.cashDividend,.6);assert.equal(core.dividendForecasts(p,today).length,1);assert.equal(b.q('[data-stock="receive-forecast"]').disabled,true);await tick();assert.deepEqual(b.errors,[]);b.close();
});
test('R12 existing receipts: exact ex-date removes forecast; missing metadata on the same payment date requires review',()=>{
 const a=asset({dividendForecast:cache([ann({exDividendDate:day(-3),paymentDate:today})])}),p={assets:[a],transactions:[tx('b','buy'),tx('d','dividend',{date:today,amount:600,exDividendDate:day(-3)})]};assert.equal(core.dividendForecasts(p,today).length,0);delete p.transactions[1].exDividendDate;
 const b=boot(seed(p));income(b);assert.equal(b.q('[data-stock="receive-forecast"]').disabled,true);assert.match(b.q('.stock-forecast-panel').textContent,/核對原紀錄/);assert.equal(core.dividendForecasts(p,today)[0].possibleReceiptId,'d');b.close();
});
test('R12 asynchronous refresh: waits for open drafts, preserves manual adjustments and protects concurrent external storage',async()=>{
 const b=boot(seed({assets:[asset({dividendForecast:cache()})],transactions:[tx('b','buy')]}));income(b);let release;b.w.fetch=()=>new Promise(r=>release=r);click(b,'refresh-forecasts');click(b,'edit-forecast');b.change('#stockForm [name="quantity"]','1500');release(new Response(JSON.stringify({announcements:[ann({cashDividend:.7})],errors:[]})));await tick();assert.equal(b.state().stockPortfolio.assets[0].dividendForecast.announcements[0].cashDividend,.6);
 b.submit('#stockForm');await until(()=>b.state().stockPortfolio.assets[0].dividendForecast.announcements[0].cashDividend===.7);assert.equal(core.dividendForecasts(b.state().stockPortfolio,today)[0].quantity,1500);
 click(b,'refresh-forecasts');const external=JSON.stringify({...b.state(),updatedAt:'external'});b.w.localStorage.setItem(KEY,external);release(new Response(JSON.stringify({announcements:[ann({cashDividend:.9})],errors:[]})));await until(()=>!b.q('[data-stock="refresh-forecasts"]').disabled);assert.equal(b.w.localStorage.getItem(KEY),external);assert.equal(b.state().stockPortfolio.assets[0].dividendForecast.announcements[0].cashDividend,.7);assert.deepEqual(b.errors,[]);b.close();
});
test('R12 forecast backup: copied accounts keep announcement/adjustment state, encrypted backups preserve pending amounts, English form has no untranslated UI',async()=>{
 const p={assets:[asset({dividendForecast:cache([ann({cashDividend:null})]),dividendPlanOverrides:{[day(5)]:{quantity:800,excluded:false}}})],transactions:[tx('b','buy')]},f=seed(p);f.companies.forEach((c,i)=>c.name='Company '+i);const b=boot(f,{language:'en-US'});income(b);b.w.SalaryMateI18n.apply();assert.doesNotMatch(b.q('.stock-forecast-panel').textContent,/\p{Script=Han}/u);click(b,'edit-forecast');b.w.SalaryMateI18n.apply();assert.doesNotMatch(b.q('#stockForm').textContent,/\p{Script=Han}/u);
 const state=b.state(),copy=b.w.SalaryMateBackup.merge(state,state,'copy','forecast-copy').next;assert.equal(core.dividendForecasts(copy.stockPortfolio,today).length,2);assert.equal(copy.stockPortfolio.assets[1].dividendForecast.announcements[0].cashDividend,null);
 const encrypted=await b.w.SalaryMateBackup.encrypt(state,'test-password');const decoded=await b.w.SalaryMateBackup.decrypt(encrypted,'test-password');assert.deepEqual(JSON.parse(JSON.stringify(decoded.stockPortfolio)),state.stockPortfolio);assert.deepEqual(b.errors,[]);b.close();
});
