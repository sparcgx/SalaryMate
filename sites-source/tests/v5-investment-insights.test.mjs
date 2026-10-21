import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createPriceHistory} from '../server/price-history.mjs';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
import {marketSession,MARKET_CALENDARS} from '../server/market-hours.mjs';
const now=Date.parse('2026-10-22T01:00:00Z');
const read=name=>fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/'+name,import.meta.url),'utf8');
const c=vm.createContext({Intl,Date,console,AbortController,setTimeout,clearTimeout,document:{hidden:false}});
for(const name of ['stocks.js','market-hours.js','stocks-icons.js','stocks-insights.js'])vm.runInContext(read(name),c);
const {analyze,rsi}=c.SalaryMateInvestmentInsights;
function series(market='US',close=i=>100+i*.12+Math.sin(i)*1.2){
 const rows=[];for(let i=140;i>=0;i--){const s=marketSession(market,now-i*86400000,MARKET_CALENDARS);if(s.phase!=='holiday'&&s.closesAt<=now)rows.push({date:s.date,close:close(rows.length),corporateAction:false});}
 return {market,symbol:market==='US'?'VOO':'2330',currency:market==='US'?'USD':'TWD',bars:rows,adjustment:'unadjusted',source:'Test official source',sourceUrl:'https://www.nasdaq.com/market-activity/etf/voo/historical',fetchedAt:new Date(now).toISOString(),partial:false};
}
test('Wilder RSI uses the published arithmetic and handles flat / one-sided markets',()=>{
 assert.ok(Math.abs(rsi([44.34,44.09,44.15,43.61,44.33,44.83,45.1,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28])-70.46413502109705)<1e-8);
 assert.equal(rsi(Array(20).fill(100)),50);assert.equal(rsi(Array.from({length:20},(_,i)=>i+1)),100);assert.equal(rsi(Array.from({length:20},(_,i)=>30-i)),0);assert.equal(rsi([1,2]),null);
});
test('Recent complete prices produce explainable buy / hold / reduce observations',()=>{
 const up=analyze(series(),{now});assert.equal(up.status,'ready');assert.equal(up.signal,'buy');assert.equal(up.reasons.length,3);assert.ok(up.metrics.sma20>up.metrics.sma60);assert.ok(up.metrics.rsi<65);
 const down=analyze(series('US',i=>200-i*.5),{now});assert.equal(down.signal,'reduce');assert.ok(down.metrics.maxDrawdown<0);
 const flat=analyze(series('US',()=>100),{now});assert.equal(flat.signal,'neutral');assert.equal(flat.metrics.volatility,0);assert.equal(flat.metrics.maxDrawdown,0);
});
test('RSI alone never creates a buy recommendation and prices are never changed',()=>{
 const h=series('US',i=>100+i*.5),copy=JSON.stringify(h),r=analyze(h,{now});assert.equal(r.signal,'wait');assert.equal(JSON.stringify(h),copy);
});
test('Ordinary non-comparable marks stay visible as event risk without masquerading as a split',()=>{
 const h=series();h.bars.at(-20).nonComparable=true;const r=analyze(h,{now});assert.equal(r.status,'ready');assert.ok(r.risks.some(x=>x.includes('不比價')));
});
test('Stale, missing, partial, invalid, split and insufficient series suppress buy/sell directions',()=>{
 for(const mutate of [h=>h.bars.pop(),h=>h.bars.splice(-8,1),h=>h.partial=true,h=>h.bars.at(-1).close=0,h=>h.bars.at(-1).close*=.5,h=>h.bars.at(-2).corporateAction=true,h=>h.bars=h.bars.slice(-59),h=>h.bars.push({...h.bars.at(-1)}),h=>h.bars.at(-1).date='2026-10-22']){
  const h=series();mutate(h);const r=analyze(h,{now});assert.equal(r.status,'unavailable');assert.equal(r.signal,undefined);assert.ok(r.issues.length);
 }
});
test('Unknown calendar years fail closed; weekend and US early-close timestamps use exchange time',()=>{
 assert.equal(analyze(series(),{now:Date.parse('2031-01-06T22:00:00Z')}).status,'unavailable');
 const close=c.SalaryMateInvestmentInsights.expectedClose;
 assert.equal(close('US',Date.parse('2026-11-27T17:59:00Z'),MARKET_CALENDARS),'2026-11-25');
 assert.equal(close('US',Date.parse('2026-11-27T18:00:00Z'),MARKET_CALENDARS),'2026-11-27');
 assert.equal(close('US',Date.parse('2026-10-24T19:00:00Z'),MARKET_CALENDARS),'2026-10-23');
});
test('Original icons infer stock / ETF / bond / dividend / technology and persist a safe preset',()=>{
 const icons=c.SalaryMateStockIcons;
 assert.equal(icons.infer({market:'TW',symbol:'0050'}),'etf');assert.equal(icons.infer({name:'20 年美債 ETF'}),'bond');assert.equal(icons.infer({name:'高股息'}),'dividend');assert.equal(icons.infer({name:'半導體'}),'tech');assert.equal(icons.infer({iconPreset:'global'}),'global');
 assert.equal(icons.presets.length,7);assert.match(icons.svg('etf'),/viewBox="0 0 64 64"/);assert.doesNotMatch(icons.svg('<script>'),/script|https:|href/);
 const p={assets:[{id:'a',name:'Test',symbol:'VOO',market:'US',currency:'USD',iconPreset:'bond'}],transactions:[]};c.SalaryMateStocks.validate(p);p.assets[0].iconPreset='evil';assert.throws(()=>c.SalaryMateStocks.validate(p),/圖示/);
});
test('Official TWSE monthly history is normalized, deduplicated, and excludes incomplete current day',async()=>{
 const h=series('TW'),calls=[];
 const lookup=createPriceHistory(async url=>{calls.push(url);const u=new URL(url),month=u.searchParams.get('date').slice(0,6),bars=h.bars.filter(b=>b.date.replaceAll('-','').startsWith(month));return {stat:'OK',title:'115年 '+u.searchParams.get('stockNo')+' 測試 各日成交資訊',date:u.searchParams.get('date'),data:bars.map(b=>[`${+b.date.slice(0,4)-1911}/${b.date.slice(5).replace('-','/')}`,'','','','','',String(b.close),'','',''])};},()=>now);
 const result=await lookup({market:'TW',symbol:'2330'});assert.equal(result.partial,false);assert.equal(result.bars.at(-1).date,'2026-10-21');assert.ok(result.bars.length>=60);assert.equal(calls.length,4);assert.equal(result.source,'TWSE 每日收盤');
});
test('TPEx fallback verifies symbol and leaves monthly failures visible',async()=>{
 const lookup=createPriceHistory(async(url,ttl,init)=>{const u=new URL(url);assert.equal(new URL(init.headers.referer).hostname,u.hostname);if(u.hostname==='www.twse.com.tw')return {stat:'很抱歉，沒有符合條件的資料!'};if(u.searchParams.get('date').includes('/09/'))throw Error('offline');return {stat:'ok',code:'6488',tables:[{data:[['115/10/21','','','','','','880','']]}]};},()=>now);
 const h=await lookup({market:'TW',symbol:'6488'});assert.equal(h.source,'TPEx 每日收盤');assert.equal(h.partial,true);assert.equal(h.bars[0].close,880);
});
test('Nasdaq ETF fallback validates identity, sorts closes and removes current-session bar',async()=>{
 const calls=[];const lookup=createPriceHistory(async url=>{calls.push(url);if(url.includes('assetclass=stocks'))return {data:null};return {data:{symbol:'VOO',tradesTable:{rows:[{date:'10/22/2026',close:'999'},{date:'10/21/2026',close:'$706.50'},{date:'10/20/2026',close:'705.0'}]}}};},()=>now);
 const h=await lookup({market:'US',symbol:'VOO'});assert.deepEqual(h.bars.map(b=>b.date),['2026-10-20','2026-10-21']);assert.equal(h.bars.at(-1).close,706.5);assert.equal(calls.length,2);
});
test('History API accepts only public identifiers; portable route keeps its CORS boundary',async()=>{
 let network=0;const handler=createStockMarket(async()=>{network++;throw Error('fixture');},()=>now);
 for(const body of [{market:'US',symbol:'AAPL',holdings:[{salary:999}]},{market:'TW',symbol:'../2330'},{market:'OTHER',symbol:'TEST'}]){const r=await handler(new Request('https://example.test/api/stocks/history',{method:'POST',body:JSON.stringify(body)}));assert.equal(r.status,400);}
 assert.equal(network,0);
 let forwarded;const portable=createPortableMarket(async r=>{forwarded=r;return new Response('{}');});
 const r=await portable(new Request('https://example.test/api/stocks/portable/history',{method:'POST',headers:{origin:'null',cookie:'secret=1',authorization:'secret'},body:JSON.stringify({market:'US',symbol:'AAPL'})}));
 assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'null');assert.equal(forwarded.headers.get('cookie'),null);assert.equal(forwarded.headers.get('authorization'),null);assert.equal(new URL(forwarded.url).pathname,'/api/stocks/history');
 assert.equal((await portable(new Request('https://example.test/api/stocks/portable/history',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}))).status,403);
});
test('Analysis requests contain no account, quantity, cost or salary fields',async()=>{
 let sent;const scope=vm.createContext({Intl,Date,AbortController,console,setTimeout,clearTimeout,navigator:{onLine:true},fetch:async(url,opts)=>{sent={url,...opts};return {ok:true,json:async()=>({history:series(),errors:[]})};}});
 for(const f of ['stocks.js','market-hours.js','stocks-integrations.js'])vm.runInContext(read(f),scope);
 await scope.SalaryMateStockServices.history({market:'US',symbol:'voo',account:'private',quantity:987,cost:765,salary:123});
 assert.deepEqual(JSON.parse(sent.body),{market:'US',symbol:'VOO'});assert.equal(sent.credentials,'omit');
});
test('Selection races and paused requests cannot replace the selected analysis',async()=>{
 const assets=[{id:'a',market:'US',symbol:'VOO',name:'Vanguard',currency:'USD'},{id:'b',market:'US',symbol:'AAPL',name:'Apple',currency:'USD'}],requests=[];let active=true;
 c.SalaryMateStockServices={history:(a,signal)=>new Promise(resolve=>requests.push({a,signal,resolve})),calendars:()=>MARKET_CALENDARS};
 const ui=c.SalaryMateInvestmentInsights.create({portfolio:()=>({assets}),model:()=>({holdings:[]}),render(){},active:()=>active,detail(){}});
 const first=ui.refresh();ui.change({target:{name:'insightAsset',value:'b'}});const second=ui.refresh();assert.equal(requests[0].signal.aborted,true);
 requests[1].resolve({...series(),symbol:'AAPL'});await second;requests[0].resolve(series());await first;
 active=false;assert.match(ui.view(),/AAPL/);ui.pause();assert.equal(requests[1].signal.aborted,false);
});
