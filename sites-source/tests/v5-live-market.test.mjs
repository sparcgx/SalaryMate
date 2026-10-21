import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKET_CALENDARS,marketSession,marketPlan,parseNasdaqTime,quoteTiming,mergeMarketCalendars} from '../server/market-hours.mjs';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
import {harness,asset,portfolio,quote,snapshot,settle,NOW} from './helpers/live-market-ui.mjs';
const ms=Date.parse;
const mixed=()=>portfolio({assets:[asset(),asset({id:'us',market:'US',symbol:'VOO',currency:'USD',quoteFx:32}),asset({id:'manual',symbol:'0050',priceUpdateMode:'manual'})]});
const req=(body,path='quotes')=>new Request('https://site.test/api/stocks/'+path,{method:'POST',body:JSON.stringify(body)});
const twRow=(extra={})=>({c:'2330',ex:'tse',n:'台積電',z:'120',y:'110',d:'20261005',t:'09:59:58',...extra});

test('Taiwan regular session boundaries, exchange-only holidays and unknown years',()=>{
  for(const [time,phase] of [['00:59:59','preopen'],['01:00:00','open'],['05:29:59','open'],['05:30:00','closing'],['05:35:00','closed']])assert.equal(marketSession('TW',ms('2026-10-05T'+time+'Z')).phase,phase);
  for(const date of ['2026-02-12','2026-02-13','2026-10-10','2026-10-26'])assert.equal(marketSession('TW',ms(date+'T02:00:00Z')).phase,'holiday');
  assert.equal(marketSession('TW',ms('2027-01-05T02:00:00Z')).phase,'unknown');
});
test('US uses New York DST and local date across Taiwan midnight',()=>{
  for(const [date,open] of [['2026-07-06','13:30'],['2026-11-02','14:30']]){
    const s=marketSession('US',ms(date+'T'+open+':00Z'));assert.equal(s.phase,'open');assert.equal(s.localTime,'09:30:00');
    assert.equal(marketSession('US',s.opensAt-1).phase,'preopen');assert.equal(marketSession('US',s.closesAt).phase,'closing');
  }
  const s=marketSession('US',ms('2026-10-05T18:00:00Z'));assert.equal(s.date,'2026-10-05');assert.equal(s.phase,'open');
});
test('US verified holidays and early closes do not invent a Dec 31 2027 holiday',()=>{
  assert.equal(marketSession('US',ms('2026-11-26T16:00:00Z')).phase,'holiday');
  const early=marketSession('US',ms('2026-11-27T17:59:59Z'));assert.equal(early.closeTime,'13:00');assert.equal(early.earlyClose,true);assert.equal(early.phase,'open');
  assert.equal(marketSession('US',early.closesAt).phase,'closing');
  assert.equal(marketSession('US',ms('2027-12-31T15:00:00Z')).phase,'open');
});
test('only open markets poll; closing confirmation occurs once after 60 seconds',()=>{
  assert.deepEqual(marketPlan(mixed().assets,NOW).assets.map(a=>a.market),['TW','TW']);
  assert.deepEqual(marketPlan(mixed().assets,ms('2026-10-05T14:00:00Z')).assets.map(a=>a.market),['US']);
  const close=ms('2026-10-05T05:30:00Z');
  assert.equal(marketPlan([asset()],close).assets.length,0);
  assert.equal(marketPlan([asset()],close+60000).closing[0].market,'TW');
  assert.equal(marketPlan([asset()],close+60000,{TW:'2026-10-05'}).assets.length,0);
  assert.equal(marketPlan([asset()],close+300000).assets.length,0);
});
test('remote calendars are bounded, validated and do not mutate bundled calendars',()=>{
  const original=JSON.stringify(MARKET_CALENDARS);
  const merged=mergeMarketCalendars(MARKET_CALENDARS,{TW:{'2027':{closed:['01-01'],open:[],early:{}}},US:{'2026':{closed:['02-30'],open:[],early:{}}}});
  assert.equal(marketSession('TW',ms('2027-01-05T02:00:00Z'),merged).phase,'open');
  assert.deepEqual(merged.US['2026'],MARKET_CALENDARS.US['2026']);assert.equal(JSON.stringify(MARKET_CALENDARS),original);
});
test('Nasdaq timestamps parse ET and explicit DST offsets without treating fetch time as trade time',()=>{
  assert.equal(parseNasdaqTime('Oct 21, 2026 9:52 AM ET'),'2026-10-21T09:52:00-04:00');
  assert.equal(parseNasdaqTime('Nov 2, 2026 4:00 PM EST'),'2026-11-02T16:00:00-05:00');
  for(const s of ['Oct 21, 2026','Feb 30, 2026 10:00 AM ET','Oct 21, 2026 9:52 AM EST','Nov 2, 2026 13:00 PM ET'])assert.equal(parseNasdaqTime(s),'',s);
});
test('source age and provider flags control live, delayed, stale, manual and closed labels',()=>{
  const a=asset({quoteMarketAt:'2026-10-05T09:59:58+08:00',quoteDataState:'latest'});
  assert.equal(quoteTiming(a,NOW),'latest');assert.equal(quoteTiming(a,NOW+240000),'stale');
  assert.equal(quoteTiming({...a,quoteDataState:'delayed'},NOW+240000),'delayed');
  assert.equal(quoteTiming({...a,priceUpdateMode:'manual'},NOW),'manual');
  assert.equal(quoteTiming(a,ms('2026-10-05T06:00:00Z')),'closed');
});
test('TW hot path survives close-feed outages, supports OTC/ETF and real last-trade fallback',async()=>{
  const calls=[];
  const h=createStockMarket(async url=>{calls.push(url);if(!url.includes('getStockInfo'))throw Error('close feeds offline');return Response.json({msgArray:[twRow(),twRow({c:'0050',n:'元大台灣50',z:'70'}),twRow({c:'00679B',ex:'otc',n:'元大美債20年',z:'-',trade:{z:'27.55',t:'09:59:45'},a:'999',b:'998'})]});},()=>NOW);
  const d=await(await h(req({instruments:['2330','0050','00679B'].map(symbol=>({market:'TW',symbol})),intraday:true}))).json();
  assert.equal(d.quotes.length,3);assert.equal(d.quotes[2].price,27.55);assert.equal(d.quotes[2].quoteAt,'2026-10-05T09:59:45+08:00');assert.equal(d.quotes[2].exchange,'TPEx');assert.equal(d.quotes[1].instrumentType,'etf');
  assert.equal(calls.length,1);assert.equal(d.errors.length,0);
});
test('TW intraday response rejects previous dates, off-session, future and bid-only records',async()=>{
  for(const patch of [{d:'20261002'},{t:'08:59:59'},{t:'14:00:00'},{t:'10:03:00'},{z:'-',a:'123',b:'122'},{ex:'unknown'}]){
    const h=createStockMarket(async()=>Response.json({msgArray:[twRow(patch)]}),()=>NOW);
    const d=await(await h(req({instruments:[{market:'TW',symbol:'2330'}],intraday:true}))).json();assert.equal(d.quotes.length,0,JSON.stringify(patch));assert.equal(d.errors.length,1);
  }
});
test('Nasdaq ETF fallback carries real source time and delayed flag; requests contain no account data',async()=>{
  const calls=[],at=ms('2026-10-05T14:00:00Z');
  const h=createStockMarket(async(url,init)=>{calls.push({url,body:init.body});if(url.includes('frankfurter'))return Response.json({rate:32,date:'2026-10-05'});return Response.json({data:url.endsWith('assetclass=stocks')?null:{symbol:'VOO',companyName:'Vanguard S&P 500 ETF',primaryData:{lastSalePrice:'$500',lastTradeTimestamp:'Oct 5, 2026 9:45 AM ET',isRealTime:false},marketStatus:'Open'}});},()=>at);
  const d=await(await h(req({instruments:[{market:'US',symbol:'VOO'}],intraday:true}))).json();
  assert.equal(d.quotes[0].quoteAt,'2026-10-05T09:45:00-04:00');assert.equal(d.quotes[0].dataState,'delayed');assert.equal(d.quotes[0].instrumentType,'etf');assert.equal(d.fx.rate,32);
  assert.equal(calls.filter(c=>c.url.includes('nasdaq')).length,2);assert.ok(calls.every(c=>c.body===undefined));
});
test('US auto response rejects premarket, previous-day, future and missing source timestamps',async()=>{
  for(const lastTradeTimestamp of ['Oct 5, 2026 9:29 AM ET','Oct 2, 2026 4:00 PM ET','Oct 5, 2026 10:03 AM ET','Oct 5, 2026']){
    const h=createStockMarket(async url=>Response.json(url.includes('frankfurter')?{rate:32,date:'2026-10-05'}:{data:{symbol:'AAPL',companyName:'Apple',primaryData:{lastSalePrice:'$200',lastTradeTimestamp}}}),()=>ms('2026-10-05T14:00:00Z'));
    const d=await(await h(req({instruments:[{market:'US',symbol:'AAPL'}],intraday:true}))).json();assert.equal(d.quotes.length,0,lastTradeTimestamp);assert.equal(d.errors.length,1);
  }
});
test('calendar endpoint refuses wrong-year source and permits safe portable access',async()=>{
  const h=createStockMarket(async()=>Response.json({stat:'ok',data:Array.from({length:5},()=>['2026-01-01','休市'])}),()=>ms('2027-01-05T02:00:00Z'));
  const d=await(await h(req({},'sessions'))).json();assert.equal(d.sessions[0].phase,'unknown');assert.equal(d.calendars.TW['2027'],undefined);
  const portable=createPortableMarket(h),r=await portable(new Request('https://site.test/api/stocks/portable/sessions',{method:'POST',headers:{origin:'null'},body:'{}'}));assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'null');
});
test('UI auto updates only the open market; manual Update can refresh both',async()=>{
  const h=harness(mixed());h.render();h.fire();assert.deepEqual(h.pending[0].assets.map(a=>a.symbol),['2330']);assert.equal(h.pending[0].options.intraday,true);
  h.pending[0].resolve(snapshot());await settle();assert.equal(h.state().assets[0].quotePrice,120);assert.equal(h.state().assets[1].quotePrice,100);assert.equal(h.state().assets[2].quotePrice,100);assert.equal(h.state().assets[1].quoteError,undefined);
  h.click('refresh');assert.deepEqual(h.pending[1].assets.map(a=>a.symbol),['2330','VOO']);assert.equal(h.pending[1].options.intraday,false);
  h.pending[1].resolve(snapshot());await settle();
});
test('UI starts US quotes in regular session and stays quiet on weekend and after early close',async()=>{
  const h=harness(mixed(),null,ms('2026-10-05T14:00:00Z'));h.render();h.fire();assert.deepEqual(h.pending[0].assets.map(a=>a.symbol),['VOO']);
  h.pending[0].resolve(snapshot({fetchedAt:'2026-10-05T14:00:00Z',quotes:[quote({market:'US',symbol:'VOO',currency:'USD',quoteAt:'2026-10-05T09:59:00-04:00',dataState:'realtime'})]}));await settle();assert.equal(h.state().assets[1].quotePrice,120);
  for(const at of ['2026-10-10T14:00:00Z','2026-11-27T18:05:00Z']){const c=harness(mixed(),null,ms(at));c.render();for(let i=0;i<4;i++){c.advance(60000);c.fire();}assert.equal(c.pending.length,0);}
});
test('UI performs one persisted closing refresh then no further price requests',async()=>{
  const h=harness(portfolio(),null,ms('2026-10-05T05:30:00Z'));h.render();h.fire();assert.equal(h.pending.length,0);
  h.advance(60000);h.fire();assert.equal(h.pending.length,1);
  h.pending[0].resolve(snapshot({fetchedAt:'2026-10-05T05:31:00Z',quotes:[quote({quoteAt:'2026-10-05T13:30:00+08:00'})]}));await settle();assert.equal(h.state().marketData.lastCloseSync.TW,'2026-10-05');
  h.advance(60000);h.fire();assert.equal(h.pending.length,1);
  const restored=harness(h.state(),null,ms('2026-10-05T05:32:00Z'));restored.render();restored.fire();assert.equal(restored.pending.length,0);
});
test('failed updates back off, retain prices and resume with a 60-second cadence after success',async()=>{
  const h=harness();h.render();h.fire();h.pending[0].resolve(snapshot({quotes:[],fx:null,errors:[{market:'TW',symbol:'2330',message:'offline'}]}));await settle();assert.equal(h.state().assets[0].quotePrice,100);assert.equal([...h.timers.values()][0].ms,120000);
  h.advance(120000);h.fire();h.pending[1].resolve(snapshot({fetchedAt:new Date(NOW+120000).toISOString(),quotes:[quote({quoteAt:'2026-10-05T10:01:59+08:00'})]}));await settle();assert.equal(h.state().assets[0].quotePrice,120);assert.equal([...h.timers.values()][0].ms,60000);
});
test('offline and page-close abort in-flight requests; later replies never change holdings',async()=>{
  for(const event of ['offline','pagehide']){const h=harness();h.render();h.fire();h.event(event);assert.equal(h.pending[0].signal.aborted,true);h.pending[0].resolve(snapshot());await settle();assert.equal(h.state().assets[0].quotePrice,100);assert.equal(h.commits(),0);}
});
test('intraday request payload sends deduplicated public symbols and flags only',async()=>{
  const sent=[],h=harness(portfolio(),async(url,init)=>{sent.push(JSON.parse(init.body));return Response.json(snapshot());});
  await h.services.fetchQuotes([asset(),asset({id:'copy',account:'secret'})],'/api/stocks/quotes',undefined,{intraday:true});
  assert.deepEqual(sent,[{instruments:[{market:'TW',symbol:'2330'}],includeFx:true,intraday:true}]);
});
