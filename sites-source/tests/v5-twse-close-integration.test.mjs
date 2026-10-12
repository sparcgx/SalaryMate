import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createStockMarket} from '../server/stock-market.mjs';

const NOW=Date.parse('2026-10-10T02:00:00Z');
const TODAY='2026-10-10',DAY='2026-10-08';
const TWSE_URL='https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const clone=value=>JSON.parse(JSON.stringify(value));
const source=name=>fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/'+name,import.meta.url),'utf8');
const asset=(extra={})=>({id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'local-only account',quotePrice:100,quoteDate:'2026-10-07',quoteFx:1,quoteMode:'auto',priceUpdateMode:'auto',...extra});
const transaction=(assetId='a',extra={})=>({id:'buy-'+assetId,assetId,type:'buy',date:'2026-10-01',time:'12:00',quantity:10,price:80,fx:1,fee:2,tax:0,...extra});
const portfolio=(extra={})=>({assets:[asset()],transactions:[transaction()],...extra});
const close=(extra={})=>({market:'TW',symbol:'2330',name:'台積電',currency:'TWD',price:120,date:DAY,source:'TWSE 上市收盤',providerTime:DAY,priceKind:'close',exchange:'TWSE',quoteCacheStatus:'fresh',quoteCacheAt:new Date(NOW).toISOString(),...extra});
const latest=(extra={})=>({market:'TW',symbol:'2330',currency:'TWD',price:121,date:DAY,quoteAt:DAY+'T13:30:00+08:00',source:'TWSE 最新成交',providerTime:DAY+' 13:30:00',priceKind:'latest',exchange:'TWSE',...extra});
const snapshot=(extra={})=>({quotes:[close()],fx:null,fetchedAt:new Date(NOW).toISOString(),errors:[],...extra});
const wireClose=(Code='2330',ClosingPrice='120',extra={})=>({Date:'1151008',Code,Name:'測試 '+Code,ClosingPrice,Change:'1',TradeVolume:'10000',...extra});
const wireLatest=(c='2330',z='121',extra={})=>({c,z,n:'測試 '+c,y:'100',d:'20261008',t:'13:30:00',ex:'tse',...extra});
const tw=(symbol='2330')=>({market:'TW',symbol});

// Every upstream call is replaced here. Unknown feeds fail locally instead of
// reaching the network; ETF NAV enrichment is deliberately unavailable.
function upstream(options={}){
  const calls=[];
  const fetcher=async(url,init={})=>{
    const u=String(url);calls.push({url:u,init});
    if(u===TWSE_URL){
      if(options.closeGate)await options.closeGate;
      if(options.failClose)throw Error('synthetic TWSE outage');
      return Response.json(options.closes||[wireClose()]);
    }
    if(u.includes('getStockInfo.jsp'))return Response.json({msgArray:options.latest||[]});
    if(u.includes('tpex_mainboard_daily_close_quotes'))return Response.json(options.tpex||[]);
    if(u.includes('t187ap03_L'))return Response.json([{'公司代號':'2330','產業別':'24'}]);
    if(u.includes('mopsfin_t187ap03_O'))return Response.json([{SecuritiesCompanyCode:'6488',SecuritiesIndustryCode:'24'}]);
    if(u.includes('t187ap47_L'))return Response.json([{'基金代號':'0050'},{'基金代號':'00632R'}]);
    if(u.includes('ajaxEtfInfoChart'))return Response.json({netPrice:[],atmps:[]});
    if(u.includes('api.nasdaq.com'))return Response.json({data:{symbol:'AAPL',companyName:'Synthetic US stock',exchange:'NASDAQ',primaryData:{lastSalePrice:'$150',lastTradeTimestamp:'Oct 08, 2026',netChange:'1',percentageChange:'0.67%'}}});
    if(u.includes('frankfurter.dev'))return Response.json({rate:32,date:DAY});
    throw Error('No test fixture for '+u);
  };
  return {fetcher,calls,options,closeReads:()=>calls.filter(x=>x.url===TWSE_URL).length};
}
async function request(handler,instruments=[tw()],path='quotes'){
  const body=path==='lookup'?instruments[0]:{instruments};
  const response=await handler(new Request('https://salarymate.test/api/stocks/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
  assert.equal(response.status,200);
  return response.json();
}

// Run the shipped browser core/services/UI, with a fixed clock and a minimal
// document. Timers are recorded, never run, and fetch cannot leave this process.
function harness(initial=portfolio()){
  let current={stockPortfolio:clone(initial)},lastHTML='',id=0;
  const errors=[],timers=new Map();
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[NOW]));}static now(){return NOW;}}
  const document={activeElement:null,documentElement:{},hidden:false,addEventListener(){},querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>null}),querySelector:s=>s==='.stock-view'?{}:s==='#appDialog'?{open:false,addEventListener(){}}:null};
  const context=vm.createContext({Date:FixedDate,Intl,console,AbortController,document,navigator:{onLine:true,language:'en',languages:['en']},fetch:async()=>{throw Error('Unexpected browser network call');},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:key=>timers.delete(key),addEventListener(){},FormData:class{constructor(form){this.values=form.values;}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}},SalaryMateI18n:{user:s=>s,text:s=>s,apply(){}}});
  for(const file of ['stocks.js','stocks-integrations.js','stocks-ui.js'])vm.runInContext(source(file),context,{filename:file});
  const api={state:()=>current,year:()=>2026,today:()=>TODAY,legacyTotal:()=>0,id:()=>String(++id),begin(){},assert:()=>true,validate:()=>true,close(){},open(){},error:(_form,message)=>errors.push(message),toast(){},commit:fn=>{fn();return true;},render:()=>{lastHTML=ui.render('');}};
  const ui=context.SalaryMateStocksUI.create(api);
  return {ui,errors,core:context.SalaryMateStocks,services:context.SalaryMateStockServices,state:()=>current.stockPortfolio,render:()=>lastHTML=ui.render('')};
}
const savedQuote=a=>Object.fromEntries(Object.entries(a).filter(([key])=>key.startsWith('quote')));
function saveLookup(h,q,changes={}){
  const a=h.state().assets[0];
  h.ui.submit({id:'stockForm',dataset:{kind:'asset',id:a.id},values:{symbol:a.symbol,name:a.name,market:a.market,currency:a.currency,account:a.account||'',note:'',group:'',typeOverride:'',exchangeOverride:'',industryOverride:'',iconMode:'auto',priceUpdateMode:'auto',...changes},_lookupQuote:q});
  assert.deepEqual(h.errors,[],'asset save must remain usable when lookup price is rejected');
}

test('TWSE close wins a same-day MIS tie; leading-zero/letter ETFs, TPEx and US keep their own policy',async()=>{
  const f=upstream({closes:[wireClose(),wireClose('0050','60'),wireClose('00632R','12')],latest:[wireLatest(),wireLatest('0050','61'),wireLatest('00632R','13'),wireLatest('6488','250',{ex:'otc'})],tpex:[{SecuritiesCompanyCode:'6488',CompanyName:'測試上櫃',Date:'1151008',Close:'240',Change:'1',TradingShares:'50'}]});
  const data=await request(createStockMarket(f.fetcher,()=>NOW),[tw(),tw('0050'),tw('00632R'),tw('6488'),{market:'US',symbol:'AAPL'}]);
  for(const [symbol,price] of [['2330',120],['0050',60],['00632R',12]]){
    const q=data.quotes.find(x=>x.symbol===symbol);
    assert.equal(q.price,price);assert.equal(q.source,'TWSE 上市收盤');assert.equal(q.priceKind,'close');
    assert.equal(q.date,DAY);assert.equal(q.providerTime,DAY);assert.equal(q.quoteAt,undefined);
    assert.equal(q.quoteCacheStatus,'fresh');assert.equal(q.quoteCacheAt,new Date(NOW).toISOString());
  }
  const otc=data.quotes.find(x=>x.symbol==='6488');
  assert.equal(otc.price,250);assert.equal(otc.exchange,'TPEx');assert.equal(otc.priceKind,'latest');
  const us=data.quotes.find(x=>x.symbol==='AAPL');
  assert.equal(us.price,150);assert.equal(us.currency,'USD');assert.equal(us.source,'Nasdaq 最新行情');
  assert.equal(data.fx.rate,32);assert.equal(f.closeReads(),1);
});

test('newer-date MIS and valid MIS over an invalid close retain latest-trade semantics without close-cache flags',async()=>{
  for(const closes of [[wireClose('2330','120',{Date:'1151007'})],[wireClose('2330','--'),wireClose('0050','60')]]){
    const f=upstream({closes,latest:[wireLatest()]});
    const q=(await request(createStockMarket(f.fetcher,()=>NOW))).quotes[0];
    assert.equal(q.price,121);assert.equal(q.date,DAY);assert.equal(q.priceKind,'latest');
    assert.equal(q.quoteAt,DAY+'T13:30:00+08:00');
    assert.equal(q.quoteCacheStatus,undefined);assert.equal(q.quoteCacheAt,undefined);
    assert.equal(harness().services.quoteIssue(asset(),q,TODAY,NOW),'');
  }
});

test('Saturday fetch preserves the supplied trading date and cannot turn fetch time into a trade timestamp',async()=>{
  assert.equal(new Date(NOW).getUTCDay(),6);
  const f=upstream(),data=await request(createStockMarket(f.fetcher,()=>NOW));
  const h=harness(),result=h.services.applyQuotes(portfolio(),data,TODAY),a=result.next.assets[0];
  assert.equal(data.fetchedAt,new Date(NOW).toISOString());assert.equal(a.quoteDate,DAY);
  assert.equal(a.quoteProviderTime,DAY);assert.equal(a.quoteMarketAt,'');
  assert.equal(a.quoteCheckedAt,data.fetchedAt);assert.equal(h.core.priceFreshness(a),'older');
  assert.equal(h.services.quoteMarketAt(close({quoteAt:data.fetchedAt}),NOW),'');
});

test('missing, malformed, impossible or future official dates never fall back to the fetch date',async()=>{
  for(const Date of [undefined,'','2026-10-08','1150230','1151011']){
    const f=upstream({closes:[wireClose('2330','120',{Date})]});
    const data=await request(createStockMarket(f.fetcher,()=>NOW));
    assert.equal(data.quotes.length,0,'invalid provider date must not produce a usable quote');
    assert.ok(data.errors.some(e=>e.source==='TWSE 上市收盤'));
    const p=portfolio(),r=harness().services.applyQuotes(p,data,TODAY);
    assert.deepEqual(clone(r.next.assets),p.assets);assert.deepEqual(clone(r.next.transactions),p.transactions);
  }
});

test('concurrent quote batches and lookup share one fixed-URL TWSE read, then reuse it inside five minutes',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const f=upstream({closeGate:gate,closes:[wireClose(),wireClose('0050','60'),wireClose('00632R','12')]});
  let now=NOW;const handler=createStockMarket(f.fetcher,()=>now);
  const all=Promise.all([request(handler),request(handler,[tw('0050')]),request(handler,[tw('00632R')],'lookup')]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.closeReads(),1);release();
  const results=await all;assert.equal(results.length,3);
  now+=299999;await request(handler);assert.equal(f.closeReads(),1);
  now+=1;await request(handler);assert.equal(f.closeReads(),2);
  for(const {url,init} of f.calls.filter(x=>x.url===TWSE_URL)){
    assert.equal(url,TWSE_URL);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');
  }
});

test('expired close cache plus outage reports a source-level error and preserves every saved quote field and transaction',async()=>{
  const f=upstream();let now=NOW;const handler=createStockMarket(f.fetcher,()=>now);
  await request(handler);now+=300001;f.options.failClose=true;
  const data=await request(handler),q=data.quotes[0];
  assert.equal(q.quoteCacheStatus,'stale');assert.equal(q.quoteCacheAt,new Date(NOW).toISOString());
  assert.equal(q.price,null,'older Android clients must also reject stale rows without understanding the new cache flag');
  assert.equal(q.date,DAY);assert.equal(f.closeReads(),2);
  assert.ok(data.errors.some(e=>e.source==='TWSE 上市收盤'&&!e.symbol&&e.message));
  const p=portfolio({assets:[asset({quotePrice:130,quoteDate:DAY,quoteSource:'saved source',quoteProviderTime:DAY,quoteCheckedAt:'2026-10-08T08:00:00Z',quoteMarketAt:DAY+'T13:31:00+08:00'})]});
  const h=harness(p),r=h.services.applyQuotes(p,data,TODAY);
  assert.deepEqual(clone(r.next.assets),p.assets);assert.deepEqual(clone(r.next.transactions),p.transactions);
  assert.equal(r.priceUpdated.length,0);assert.equal(r.next.marketData.status,'error');
  assert.ok(r.errors.some(e=>e.includes('TWSE')));
  // A new client must reject a positive stale price even from an older server.
  const positiveStale=h.services.applyQuotes(p,{...data,quotes:[{...q,price:999}]},TODAY);
  assert.deepEqual(clone(positiveStale.next.assets),p.assets);assert.equal(positiveStale.priceUpdated.length,0);
});

test('expired TWSE cache with otherwise valid MIS cannot downgrade saved closes, including on older clients',async()=>{
  const f=upstream();let now=NOW;const handler=createStockMarket(f.fetcher,()=>now);
  await request(handler);now+=300001;f.options.failClose=true;f.options.latest=[wireLatest()];
  const data=await request(handler),q=data.quotes[0];
  assert.equal(q.priceKind,'close');assert.equal(q.price,null);assert.equal(q.quoteCacheStatus,'stale');
  assert.equal(data.quotes.some(row=>row.exchange==='TWSE'&&row.price>0),false);
  const p=portfolio({assets:[asset({quotePrice:130,quoteDate:DAY,quoteSource:'TWSE 上市收盤',quoteMarketAt:''})]}),r=harness().services.applyQuotes(p,data,TODAY);
  assert.deepEqual(clone(r.next.assets),p.assets);assert.equal(r.priceUpdated.length,0);
  assert.equal(r.next.marketData.status,'error');assert.ok(r.errors.some(e=>e.includes('TWSE')));
});

test('initial TWSE outage suppresses valid TWSE MIS but preserves TPEx MIS, US and saved TWSE prices',async()=>{
  const f=upstream({failClose:true,latest:[wireLatest(),wireLatest('6488','250',{ex:'otc'})],tpex:[{SecuritiesCompanyCode:'6488',CompanyName:'測試上櫃',Date:'1151008',Close:'240',Change:'1',TradingShares:'50'}]});
  const data=await request(createStockMarket(f.fetcher,()=>NOW),[tw(),tw('6488'),{market:'US',symbol:'AAPL'}]);
  assert.equal(data.quotes.some(q=>q.symbol==='2330'),false);
  assert.equal(data.quotes.find(q=>q.symbol==='6488').price,250);
  assert.equal(data.quotes.find(q=>q.symbol==='6488').priceKind,'latest');
  assert.equal(data.quotes.find(q=>q.symbol==='AAPL').price,150);
  assert.ok(data.errors.some(e=>e.source==='TWSE 上市收盤'));
  const p=portfolio(),r=harness().services.applyQuotes(p,data,TODAY);
  assert.deepEqual(clone(r.next.assets),p.assets);assert.deepEqual(clone(r.next.transactions),p.transactions);
});

test('shared acceptance guard rejects invalid prices, dates, stale cache and malformed/future/mismatched intraday timestamps',()=>{
  const h=harness(),s=h.services,p=portfolio();
  const invalid=[
    ...[undefined,null,0,-1,NaN,Infinity,'120'].map(price=>close({price})),
    ...['','2026-02-30','2026-10-11','2026-10-06'].map(date=>close({date})),
    close({currency:'USD'}),close({quoteCacheStatus:'stale'}),close({quoteCacheStatus:'unavailable'}),
    latest({quoteAt:'not-a-date'}),latest({quoteAt:DAY+'T25:00:00+08:00'}),
    latest({quoteAt:'2026-10-07T13:30:00+08:00'}),
    latest({date:TODAY,quoteAt:TODAY+'T13:30:00+08:00'})
  ];
  for(const q of invalid){
    assert.ok(s.quoteIssue(p.assets[0],q,TODAY,NOW),'quote must be rejected: '+JSON.stringify(q));
    const r=s.applyQuotes(p,snapshot({quotes:[q]}),TODAY);
    assert.deepEqual(clone(r.next.assets),p.assets);assert.deepEqual(clone(r.next.transactions),p.transactions);
    assert.equal(r.priceUpdated.length,0);
  }
  assert.equal(s.quoteIssue(asset(),close(),TODAY,NOW),'');
  assert.equal(s.quoteMarketAt(latest(),NOW),DAY+'T13:30:00+08:00');
  assert.equal(s.quoteMarketAt(close({quoteAt:DAY+'T13:30:00+08:00'}),NOW),'');
});

test('date-only same-day close preserves a saved intraday price; a later-date close can replace it',()=>{
  const h=harness(),p=portfolio({assets:[asset({quotePrice:125,quoteDate:DAY,quoteMarketAt:DAY+'T13:31:00+08:00'})]});
  const skipped=h.services.applyQuotes(p,snapshot(),TODAY);
  assert.deepEqual(clone(skipped.next.assets),p.assets);assert.equal(skipped.priceUpdated.length,0);
  assert.ok(skipped.errors.some(e=>e.includes('保留')));
  const accepted=h.services.applyQuotes(p,snapshot({quotes:[close({date:'2026-10-09'})]}),TODAY);
  assert.equal(accepted.next.assets[0].quotePrice,120);assert.equal(accepted.next.assets[0].quoteDate,'2026-10-09');
  assert.equal(accepted.next.assets[0].quoteMarketAt,'');
});

test('saved TWSE close cannot downgrade to same-day MIS through sync or lookup save, but later-day MIS can update it',()=>{
  for(const quoteSource of ['TWSE 上市收盤','TWSE 收盤']){
    const a=asset({quotePrice:120,quoteDate:DAY,quoteSource,quoteMarketAt:''}),p=portfolio({assets:[a]});
    const q=latest({price:110,quoteAt:DAY+'T10:00:00+08:00',providerTime:DAY+' 10:00:00'}),h=harness(p);
    assert.ok(h.services.quoteIssue(a,q,TODAY,NOW));
    const r=h.services.applyQuotes(p,snapshot({quotes:[q]}),TODAY);
    assert.deepEqual(clone(r.next.assets),p.assets);assert.equal(r.priceUpdated.length,0);
    saveLookup(h,q);assert.deepEqual(savedQuote(h.state().assets[0]),savedQuote(a));
    const nextDay=latest({date:'2026-10-09',quoteAt:'2026-10-09T10:00:00+08:00',providerTime:'2026-10-09 10:00:00'});
    assert.equal(h.services.quoteIssue(a,nextDay,TODAY,NOW),'');
    const updated=h.services.applyQuotes(p,snapshot({quotes:[nextDay]}),TODAY);
    assert.equal(updated.next.assets[0].quotePrice,121);assert.equal(updated.next.assets[0].quoteDate,'2026-10-09');
    saveLookup(h,nextDay);assert.equal(h.state().assets[0].quotePrice,121);assert.equal(h.state().assets[0].quoteDate,'2026-10-09');
  }
});

test('mixed portfolio valuation changes only from accepted prices/FX, never rewrites trades, costs or manual prices',()=>{
  const assets=[asset(),asset({id:'etf',symbol:'0050',typeOverride:'etf'}),asset({id:'inverse',symbol:'00632R',typeOverride:'etf'}),asset({id:'otc',symbol:'6488'}),asset({id:'us',symbol:'AAPL',market:'US',currency:'USD',quoteFx:30}),asset({id:'manual',symbol:'MANUAL',market:'OTHER',quotePrice:5,quoteMode:'manual',priceUpdateMode:'manual'})];
  const transactions=[transaction(),transaction('etf',{quantity:2,price:40,fee:0}),transaction('inverse',{quantity:3,price:10,fee:0}),transaction('otc',{quantity:1,price:200,fee:0}),transaction('us',{quantity:2,price:100,fx:30,fee:0}),transaction('manual',{quantity:4,price:4,fee:0})];
  const p=portfolio({assets,transactions}),h=harness(p),before=h.core.calculate(p,2026,TODAY);
  const data=snapshot({quotes:[close(),close({symbol:'0050',price:60}),close({symbol:'00632R',price:12}),latest({symbol:'6488',price:250,exchange:'TPEx'}),{market:'US',symbol:'AAPL',currency:'USD',price:150,date:DAY,source:'Nasdaq 最新行情',priceKind:'latest'},close({market:'OTHER',symbol:'MANUAL',price:999})],fx:{rate:32,date:DAY}});
  const r=h.services.applyQuotes(p,data,TODAY),after=h.core.calculate(r.next,2026,TODAY);
  assert.deepEqual(clone(r.next.transactions),transactions);assert.equal(after.cost,before.cost);assert.equal(after.cost,7128);
  assert.equal(after.value,11226);assert.equal(after.unrealized,4098);
  assert.equal(r.priceUpdated.length,5);assert.deepEqual(clone(r.next.assets[5]),assets[5]);
  assert.equal(r.next.assets[4].quoteFx,32);assert.equal(r.next.transactions[4].fx,30);
  assert.equal(p.assets[0].quotePrice,100,'input portfolio must not be mutated');
});

test('lookup form save repeats the quote guard and preserves protected quote fields while allowing metadata edits',()=>{
  const cases=[close({quoteCacheStatus:'stale'}),close({price:0}),close({date:'2026-10-06'}),latest({quoteAt:'invalid'}),latest({quoteAt:'2026-10-07T13:30:00+08:00'}),latest({date:TODAY,quoteAt:TODAY+'T13:30:00+08:00'}),close({symbol:'0050'}),close({market:'US'})];
  for(const q of cases){
    const h=harness(),before=clone(h.state()),quotes=savedQuote(before.assets[0]);
    saveLookup(h,q,{name:'已修改名稱'});
    assert.equal(h.state().assets[0].name,'已修改名稱');assert.deepEqual(savedQuote(h.state().assets[0]),quotes);
    assert.deepEqual(clone(h.state().transactions),before.transactions);
  }
  const protectedAsset=asset({quoteDate:DAY,quoteMarketAt:DAY+'T13:31:00+08:00'}),h=harness(portfolio({assets:[protectedAsset]}));
  saveLookup(h,close());assert.deepEqual(savedQuote(h.state().assets[0]),savedQuote(protectedAsset));
  const valid=harness();saveLookup(valid,close({quoteAt:new Date(NOW).toISOString(),providerTime:new Date(NOW).toISOString()}));
  assert.equal(valid.state().assets[0].quotePrice,120);assert.equal(valid.state().assets[0].quoteDate,DAY);
  assert.equal(valid.state().assets[0].quoteProviderTime,DAY);assert.equal(valid.state().assets[0].quoteMarketAt,'');
  const manual=harness();saveLookup(manual,close(),{priceUpdateMode:'manual'});
  assert.equal(manual.state().assets[0].quotePrice,100,'lookup cannot override a manually maintained price');
});

test('collapsed market card still shows a visible failure warning and the holding shows source plus actual data date',()=>{
  const h=harness(portfolio({assets:[asset({quoteSource:'TWSE 上市收盤',quoteDate:DAY,quoteProviderTime:new Date(NOW).toISOString()})],marketData:{status:'partial',updated:0,requested:1,lastSyncAt:new Date(NOW).toISOString()}}));
  const html=h.render(),details=html.indexOf('id="stockMarketDetails"');
  assert.match(html,/<div id="stockMarketDetails"[^>]*\bhidden\b/);
  const warning=html.match(/<p class="([^"]*stock-market-update-warning[^"]*)"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(warning,'failure warning must exist without expanding market details');
  assert.ok(html.indexOf(warning[0])<details,'failure warning must be outside the collapsed details');
  assert.doesNotMatch(warning[0],/\bhidden\b|sr-only/);assert.match(warning[2],/失敗.*保留/);
  const metadata=html.match(/<small class="[^"]*stock-close-meta[^"]*">([\s\S]*?)<\/small>/);
  assert.ok(metadata,'holding price must have visible close metadata');
  assert.match(metadata[1],/TWSE 上市收盤/);assert.match(metadata[1],/資料日期/);assert.match(metadata[1],/2026-10-08/);
  assert.doesNotMatch(metadata[1],/2026-10-10/);
});
