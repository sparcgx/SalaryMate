import {createDividendLookup} from './dividend-market.mjs';
import {createIntradayNavLookup} from './intraday-nav.mjs';
import {createTwseCloseLookup} from './twse-close.mjs';
import {createPriceHistory} from './price-history.mjs';
import {MARKET_CALENDARS,mergeMarketCalendars,marketSession,parseNasdaqTime} from './market-hours.mjs';
// Public instruments only. No holdings, account names or transaction data leave the device.
export function createStockMarket(fetcher=fetch, clock=()=>Date.now()) {
  const cache=new Map(),clients=new Map();
  let calendars=MARKET_CALENDARS,calendarAttempt=0;
  const MAX_REQUEST_BYTES=16000,RATE_WINDOW=60000;
  let globalRate={start:clock(),count:0};
  const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  const cancelBody=body=>{try{void body?.cancel().catch(()=>{});}catch{}};
  const bodyError=code=>Object.assign(new Error(code),{code});
  async function readBody(request){
    if(!request.body)throw bodyError('INVALID_BODY');
    const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
    let size=0,text='',timer;
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(bodyError('BODY_TIMEOUT')),10000);});
    try{
      while(true){
        const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;
        size+=value.byteLength;
        if(size>MAX_REQUEST_BYTES)throw bodyError('BODY_TOO_LARGE');
        text+=decoder.decode(value,{stream:true});
      }
      return JSON.parse(text+decoder.decode());
    }finally{
      clearTimeout(timer);
      // Do not await cancellation: an unresponsive stream must not hold a reply.
      try{void reader.cancel().catch(()=>{});}catch{}
    }
  }
  function rateAllowed(request){
    const now=clock(),ip=request.headers.get('cf-connecting-ip')||'';
    // Cloudflare supplies the trusted IP in production. Missing or malformed
    // metadata shares a bounded fallback bucket, never an unlimited path.
    const key=ip.length<=45&&/^[0-9a-f:.]+$/i.test(ip)?'ip:'+ip:'unknown';
    let rate=clients.get(key);
    if(!rate||now-rate.start>=RATE_WINDOW||now<rate.start){
      if(!rate&&clients.size>=512){
        for(const [k,v] of clients)if(now-v.start>=RATE_WINDOW||now<v.start)clients.delete(k);
        if(clients.size>=512)return false;
      }
      rate={start:now,count:0};clients.set(key,rate);
    }
    if(rate.count>=30)return false;
    if(now-globalRate.start>=RATE_WINDOW||now<globalRate.start)globalRate={start:now,count:0};
    if(globalRate.count>=600)return false;
    rate.count++;globalRate.count++;return true;
  }
  const number=v=>typeof v==='number'?v:typeof v==='string'&&/^[\s$+\-\d,.%]+$/.test(v)?Number(v.replace(/[$,%\s]/g,'')):NaN;
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
  const rocDate=d=>{const s=String(d||'').replace(/\D/g,'');return s.length===7?`${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5,7)}`:'';};
  const usDate=s=>{const m=String(s||'').match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})/i);return m?`${m[3]}-${String(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase())+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`:'';};
  const industries={'01':'水泥','02':'食品','03':'塑膠','04':'紡織纖維','05':'電機機械','06':'電器電纜','08':'玻璃陶瓷','09':'造紙','10':'鋼鐵','11':'橡膠','12':'汽車','14':'建材營造','15':'航運','16':'觀光餐旅','17':'金融保險','18':'貿易百貨','19':'綜合','20':'其他','21':'化學','22':'生技醫療','23':'油電燃氣','24':'半導體','25':'電腦及週邊設備','26':'光電','27':'通信網路','28':'電子零組件','29':'電子通路','30':'資訊服務','31':'其他電子','32':'文化創意','33':'農業科技','34':'電子商務','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活'};
  const numeric=v=>{if(v==null||typeof v==='string'&&!v.trim())return null;const n=number(v);return Number.isFinite(n)?n:null;};
  async function profiles(){
    const urls=['https://openapi.twse.com.tw/v1/opendata/t187ap03_L','https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O','https://openapi.twse.com.tw/v1/opendata/t187ap47_L'];
    const all=await Promise.allSettled(urls.map(u=>read(u,86400000))),items=new Map();
    all.forEach((result,i)=>{if(result.status!=='fulfilled'||!Array.isArray(result.value))return;for(const r of result.value){
      const symbol=String(i===2?r['基金代號']:i===1?r.SecuritiesCompanyCode:r['公司代號']).trim().toUpperCase();
      if(!/^[0-9A-Z]{2,12}$/.test(symbol))continue;
      const code=String((i===1?r.SecuritiesIndustryCode:r['產業別'])||'').trim().padStart(2,'0');
      items.set(symbol,{exchange:i===1?'TPEx':'TWSE',instrumentType:i===2?'etf':'stock',industry:i===2?'ETF':industries[code]||(code==='00'?'':code),classificationSource:i===1?'TPEx 公司基本資料':i===2?'TWSE ETF 基本資料':'TWSE 公司基本資料'});
    }});
    return {items,incomplete:all.some(r=>r.status!=='fulfilled'||!Array.isArray(r.value))};
  }
  async function read(url,ttl=60000,init={},format='json') {
    const cacheKey=format+url+(init.body||'');
    const entry=cache.get(cacheKey);if(entry&&clock()-entry.at<ttl)return entry.data;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),format==='text'?20000:10000);
    try {
      const response=await fetcher(url,{...init,signal:controller.signal,headers:{accept:format==='text'?'text/html':'application/json','user-agent':'SalaryMate/5.2 stock-records','referer':url.includes('nasdaq.com')?'https://www.nasdaq.com/':'https://www.twse.com.tw/',...init.headers}});
      if(!response.ok)throw Object.assign(new Error('資料來源暫時無法使用'),{providerStatus:response.status});
      const data=format==='text'?await response.text():await response.json();
      if(format==='text'&&data.length>2000000)throw new Error('資料來源回應過大');
      if(cache.size>=100)cache.delete(cache.keys().next().value);
      cache.set(cacheKey,{data,at:clock()});return data;
    } finally {clearTimeout(timer);}
  }
  async function attachNav(rows) {
    const today = new Date(clock()+8*3600000).toISOString().slice(0,10);
    const start = new Date(Date.parse(today)-45*86400000).toISOString().slice(0,10);
    const targets=rows.filter(r=>r.instrumentType==='etf');
    for(let i=0;i<targets.length;i+=4)await Promise.all(targets.slice(i,i+4).map(async row=>{
      if(row.exchange!=='TWSE'||row.currency!=='TWD'){row.navStatus='unsupported';return;}
      try {
        const body=new URLSearchParams({id:row.symbol,startDate:start.replaceAll('-','/'),endDate:today.replaceAll('-','/'),type:'fundPric'}).toString();
        const data=await read('https://www.twse.com.tw/zh/ETFortune/ajaxEtfInfoChart',900000,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
        const entries=Array.isArray(data?.netPrice)?data.netPrice:[];
        const candidates=entries.map(x=>({date:String(x.date||'').replaceAll('/','-'),value:numeric(x.count)})).filter(x=>validDate(x.date)&&x.date>=start&&x.date<=today&&x.value>0).sort((a,b)=>b.date.localeCompare(a.date));
        const latest=candidates[0];if(!latest)throw new Error('No valid NAV');
        const premium=Array.isArray(data.atmps)?data.atmps.find(x=>String(x.date||'').replaceAll('/','-')===latest.date):null;
        row.netAssetValue={...latest,currency:'TWD',premiumPercent:premium?numeric(premium.count):null,source:'TWSE e添富'};
        row.navStatus='available';
      }catch{row.navStatus='unavailable';}
    }));
  }
  const attachIntradayNav=createIntradayNavLookup(read,clock);
  const lookupTwseClose=createTwseCloseLookup(fetcher,clock);
  async function marketMetadata(){
    const now=clock(),year=marketSession('TW',now,calendars).date.slice(0,4);
    if(!calendarAttempt||now-calendarAttempt>=6*3600000||now<calendarAttempt){
      calendarAttempt=now;
      try{
        const d=await read(`https://www.twse.com.tw/rwd/zh/holidaySchedule/holidaySchedule?response=json&queryYear=${year}`,6*3600000);
        if(d?.stat!=='ok'||!Array.isArray(d.data)||d.data.length<5||d.data.length>100||d.data.some(r=>!Array.isArray(r)||!validDate(r[0])||!r[0].startsWith(year+'-')))throw Error('Calendar year mismatch');
        const open=d.data.filter(r=>/開始交易|最後交易/.test(r[1])).map(r=>r[0].slice(5));
        const closed=d.data.filter(r=>!open.includes(r[0].slice(5))).map(r=>r[0].slice(5));
        calendars=mergeMarketCalendars(calendars,{TW:{[year]:{closed,open,early:{}}}});
      }catch{/* Keep the verified bundled year; unknown years remain disabled. */}
    }
    return {calendars,sessions:['TW','US'].map(m=>marketSession(m,now,calendars)),fetchedAt:new Date(now).toISOString()};
  }
  async function taiwanLatest(symbols){
    if(!symbols)return [];
    const url=new URL('https://mis.twse.com.tw/stock/api/getStockInfo.jsp');
    url.searchParams.set('ex_ch',symbols.flatMap(s=>['tse_'+s+'.tw','otc_'+s+'.tw']).join('|'));
    url.searchParams.set('json','1');url.searchParams.set('delay','0');
    try{
      const data=await read(url.href,30000,{headers:{referer:'https://mis.twse.com.tw/stock/index.jsp','user-agent':'Mozilla/5.0 SalaryMate/5.1'}});
      return (Array.isArray(data?.msgArray)?data.msgArray:[]).flatMap(r=>{
        const symbol=String(r.c||'').toUpperCase(),trade=r.z==='-'&&r.trade?.z?r.trade:null,price=numeric(trade?.z??r.z),day=String(r.d||'');
        const date=/^\d{8}$/.test(day)?day.slice(0,4)+'-'+day.slice(4,6)+'-'+day.slice(6):'';
        const time=String(trade?.t||r.t||''),quoteAt=date+'T'+time+'+08:00';
        if(!['tse','otc'].includes(r.ex)||!symbols.includes(symbol)||!(price>0)||!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)||Date.parse(quoteAt)>clock()+120000)return [];
        const previous=numeric(r.y),change=previous>0?price-previous:null;
        return [{market:'TW',symbol,name:String(r.n||symbol),currency:'TWD',price,date,quoteAt,providerTime:date+' '+time,priceKind:'latest',dataState:'latest',source:'TWSE 最新成交',exchange:r.ex==='otc'?'TPEx':'TWSE',change,changePercent:previous>0?change/previous*100:null}];
      });
    }catch{return [];}
  }
  async function taiwan(symbols) {
    const profileTask=profiles(),latestTask=taiwanLatest(symbols);
    const [twse,tpex]=await Promise.all([
      lookupTwseClose(),
      read('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes',300000).then(rows=>({rows,ok:Array.isArray(rows)})).catch(()=>({rows:[],ok:false}))
    ]);
    // Older Android clients do not recognize cache metadata. Withhold expired
    // prices on the wire so they also retain their last saved valid quote.
    const rows=twse.rows.filter(r=>!symbols||symbols.includes(r.symbol)).map(r=>({...r,price:twse.status==='fresh'?r.price:null,quoteCacheStatus:twse.status,quoteCacheAt:twse.fetchedAt}));
    for(const r of tpex.ok?tpex.rows:[]){
      const symbol=String(r.SecuritiesCompanyCode).toUpperCase();if(symbols&&!symbols.includes(symbol))continue;
      const price=number(r.Close),date=rocDate(r.Date),name=String(r.CompanyName);
      if(!name||!validDate(date))continue;
      const change=numeric(r.Change),previous=price-(change??0);
      rows.push({market:'TW',symbol,name,currency:'TWD',price:Number.isFinite(price)&&price>0?price:null,date,source:'TPEx 上櫃收盤',providerTime:date,priceKind:'close',exchange:'TPEx',change,changePercent:change!==null&&price>0&&previous>0?change/previous*100:null,volume:numeric(r.TradingShares)});
    }
    const profile=await profileTask;
    for(const q of await latestTask){
      // A legacy client cannot tell that a same-day trade predates its saved
      // close. During a TWSE close outage, keep its price rather than downgrade.
      if(q.exchange==='TWSE'&&twse.status!=='fresh')continue;
      const row=rows.find(r=>r.symbol===q.symbol&&r.exchange===q.exchange);
      // Official daily closes win same-day ties; a later trading day still uses
      // its valid latest trade. Never present an expired close cache as fresh.
      const officialClose=row?.exchange==='TWSE'&&row.price>0&&row.quoteCacheStatus==='fresh';
      if(row){if(q.date>row.date||q.date===row.date&&!officialClose){Object.assign(row,q);delete row.quoteCacheStatus;delete row.quoteCacheAt;}}else rows.push(q);
    }
    for(const row of rows){const info=profile.items.get(row.symbol);if(info&&info.exchange===row.exchange)Object.assign(row,info);}
    if(symbols)await Promise.all([attachNav(rows),attachIntradayNav(rows)]);
    const errors=twse.status==='fresh'?[]:[{source:'TWSE 上市收盤',message:'TWSE 收盤資料更新失敗，過期快取不會改寫原價格。'}];
    return {rows:symbols?rows:rows.filter(r=>profile.items.has(r.symbol)),errors,incomplete:profile.incomplete||twse.status!=='fresh'||!tpex.ok};
  }
  async function us(symbol,intraday=false) {
    for(const assetClass of ['stocks','etf']) {
      try {
        const d=(await read(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=${assetClass}`,30000))?.data;
        if(!d||String(d.symbol).toUpperCase()!==symbol||!d.companyName)continue;
        const primary=d.primaryData,price=number(primary?.lastSalePrice),date=usDate(primary?.lastTradeTimestamp);
        if(!validDate(date))continue;
        const quoteAt=parseNasdaqTime(primary.lastTradeTimestamp),session=marketSession('US',clock(),calendars);
        if(quoteAt&&Date.parse(quoteAt)>clock()+120000)continue;
        if(intraday&&(!quoteAt||date!==session.date||Date.parse(quoteAt)<session.opensAt||Date.parse(quoteAt)>session.closesAt))continue;
        return {market:'US',symbol,name:String(d.companyName),currency:'USD',price:Number.isFinite(price)&&price>0?price:null,date,quoteAt,source:'Nasdaq 最新行情',providerTime:String(primary.lastTradeTimestamp||''),priceKind:'latest',dataState:primary.isRealTime===true?'realtime':primary.isRealTime===false?'delayed':'unknown',marketStatus:String(d.marketStatus||''),exchange:String(d.exchange||''),instrumentType:assetClass==='etf'?'etf':'stock',change:numeric(primary.netChange),changePercent:numeric(primary.percentageChange)};
      }catch{}
    }
    throw new Error('美股代號不存在或行情暫時無法取得');
  }
  async function snapshot(instruments,navOnly=false,includeFx=false,intraday=false) {
    const errors=[],quotes=[],fetchedAt=new Date(clock()).toISOString();
    if(navOnly){
      const rows=instruments.map(({market,symbol})=>({market,symbol,currency:'TWD',instrumentType:'etf'}));
      await attachIntradayNav(rows,{discover:true});return {fetchedAt,quotes:rows,fx:null,errors};
    }
    const tw=instruments.filter(x=>x.market==='TW').map(x=>x.symbol),usa=instruments.filter(x=>x.market==='US');
    const twTask=tw.length?(intraday?taiwanLatest(tw).then(async rows=>{
      const session=marketSession('TW',clock(),calendars);
      const current=rows.filter(q=>q.date===session.date&&Date.parse(q.quoteAt)>=session.opensAt&&Date.parse(q.quoteAt)<=session.closesAt);
      // Keep supported issuer NAV updates separate from traded ETF prices.
      for(const row of current)if(/^00\d{2,4}[A-Z]?$/.test(row.symbol))row.instrumentType='etf';
      await attachIntradayNav(current);
      quotes.push(...current);
    }):taiwan(tw).then(({rows,errors:issues})=>{quotes.push(...rows);errors.push(...issues);})):Promise.resolve();
    const fxTask=usa.length||includeFx?read('https://api.frankfurter.dev/v2/rate/usd/twd',300000).then(d=>Number.isFinite(d.rate)&&d.rate>0&&validDate(d.date)?{rate:d.rate,date:d.date,source:'Frankfurter 參考匯率'}:null).catch(()=>null):Promise.resolve(null);
    // At most four US requests concurrently. Issuer feeds are shared across symbols.
    for(let i=0;i<usa.length;i+=4){await Promise.all(usa.slice(i,i+4).map(async item=>{try{quotes.push(await us(item.symbol,intraday));}catch(e){errors.push({market:'US',symbol:item.symbol,message:e.message});}}));}
    await twTask;
    const fx=await fxTask;
    for(const symbol of tw)if(!quotes.some(q=>q.market==='TW'&&q.symbol===symbol))errors.push({market:'TW',symbol,message:'找不到台股代號，或資料來源暫時無法使用'});
    return {fetchedAt,quotes,fx,errors,sessions:['TW','US'].map(m=>marketSession(m,clock(),calendars))};
  }
  const lookupDividends=createDividendLookup(read,clock);
  const lookupHistory=createPriceHistory(read,clock,()=>calendars);
  return async function handle(request) {
    const url=new URL(request.url),origin=request.headers.get('origin');
    if(origin&&origin!==url.origin)return json({error:'不允許的來源'},403);
    if(request.method!=='POST')return json({error:'僅接受 POST'},405);
    if(!rateAllowed(request)){cancelBody(request.body);const response=json({error:'查詢過於頻繁，請稍後重試'},429);response.headers.set('retry-after','60');return response;}
    const length=Number(request.headers.get('content-length')||0);if(length>MAX_REQUEST_BYTES){cancelBody(request.body);return json({error:'請求過大'},413);}
    let d;
    try{d=await readBody(request);}catch(error){
      if(error.code==='BODY_TOO_LARGE')return json({error:'請求過大'},413);
      if(error.code==='BODY_TIMEOUT')return json({error:'請求讀取逾時'},408);
      return json({error:'格式不正確'},400);
    }
    if(url.pathname.endsWith('/sessions'))return json({...await marketMetadata(),quotes:[],errors:[]});
    if(url.pathname.endsWith('/catalog')){
      if(!d||typeof d.query!=='string'||d.query.length>80)return json({error:'搜尋內容不正確'},400);
      try{
        const {rows,incomplete}=await taiwan(null),query=d.query.trim().toLowerCase();
        const matches=rows.filter(r=>!query||[r.symbol,r.name,r.industry].some(v=>String(v||'').toLowerCase().includes(query))).sort((a,b)=>(b.volume||0)-(a.volume||0));
        return json({quotes:matches.slice(0,60),total:matches.length,fetchedAt:new Date(clock()).toISOString(),errors:incomplete?[{message:'部分官方資料暫時無法取得，搜尋結果可能不完整。'}]:[]});
      }catch{return json({error:'股票清單暫時無法取得'},503);}
    }
    const dividendRequest=url.pathname.endsWith('/dividends');
    const historyRequest=url.pathname.endsWith('/history');
    const navRequest=url.pathname.endsWith('/nav');
    const fxRequest=url.pathname.endsWith('/quotes')&&d?.includeFx===true;
    if(d?.intraday!=null&&typeof d.intraday!=='boolean')return json({error:'行情更新方式不正確'},400);
    const input=url.pathname.endsWith('/lookup')||dividendRequest||historyRequest?[d]:d?.instruments;
    if(!Array.isArray(input)||!input.length&&!fxRequest||input.length>20)return json({error:'一次請查詢 1～20 個代號'},400);
    const items=[];
    for(const x of input){if(!x||!['TW','US'].includes(x.market)||typeof x.symbol!=='string')return json({error:'市場或代號不正確'},400);const symbol=x.symbol.trim().toUpperCase();if(!(x.market==='TW'?/^[0-9A-Z]{2,12}$/:/^[A-Z][A-Z0-9.-]{0,14}$/).test(symbol))return json({error:'股票代號格式不正確'},400);if(!items.some(i=>i.market===x.market&&i.symbol===symbol))items.push({market:x.market,symbol});}
    if(navRequest&&items.some(x=>x.market!=='TW'))return json({error:'盤中淨值查詢僅支援台股 ETF'},400);
    if(historyRequest){
      if(Object.keys(d).some(k=>!['market','symbol'].includes(k)))return json({error:'歷史行情只接受市場與代號'},400);
      try{return json({history:await lookupHistory(items[0]),errors:[]});}catch(e){return json({error:e.message},503);}
    }
    if(dividendRequest){
      if(d.forecast!=null&&typeof d.forecast!=='boolean')return json({error:'公告查詢方式不正確'},400);
      if(!Number.isInteger(d.year)||d.year<2006||d.year>new Date(clock()).getUTCFullYear()+1)return json({error:'公告年份不正確'},400);
      try{return json(await lookupDividends(items[0],d.year,{forecast:d.forecast===true}));}catch(e){return json({error:e.message},503);}
    }
    try{return json(await snapshot(items,navRequest,fxRequest,d?.intraday===true));}catch{return json({error:'行情服務暫時無法使用，請稍後重試'},503);}
  };
}
