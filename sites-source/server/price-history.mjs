import {marketSession,MARKET_CALENDARS} from './market-hours.mjs';

// Fixed public providers; this endpoint never accepts a URL or portfolio records.
export function createPriceHistory(read,clock=()=>Date.now(),getCalendars=()=>MARKET_CALENDARS){
  const dateOK=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  const numeric=v=>typeof v==='number'?v:typeof v==='string'&&/^[\s$\d,.]+$/.test(v)?Number(v.replace(/[$,\s]/g,'')):NaN;
  const roc=v=>{const m=String(v).match(/^(\d{3})\/(\d{2})\/(\d{2})$/);return m?`${+m[1]+1911}-${m[2]}-${m[3]}`:'';};
  const usDate=v=>{const m=String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[1]}-${m[2]}`:'';};
  function lastComplete(market,now){
    const calendars=getCalendars();
    for(let i=0;i<22;i++){
      const s=marketSession(market,now-i*86400000,calendars);
      if(!s.calendarKnown)return null;
      if(s.phase!=='holiday'&&now>=s.closesAt)return s.date;
    }
    return null;
  }
  async function taiwan(symbol,months){
    async function load(exchange){
      const outcomes=[];
      for(let i=0;i<months.length;i+=2)outcomes.push(...await Promise.allSettled(months.slice(i,i+2).map(async month=>{
        const url=exchange==='TWSE'?`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month.replaceAll('-','')}01&stockNo=${encodeURIComponent(symbol)}`:`https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock?code=${encodeURIComponent(symbol)}&date=${month.replaceAll('-','/')}/01&response=json`;
        const d=await read(url,600000,{headers:{referer:exchange==='TWSE'?'https://www.twse.com.tw/zh/trading/historical/stock-day.html':'https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html'}});
        if(exchange==='TWSE'){
          if(d?.stat!=='OK'){if(typeof d?.stat==='string'&&/沒有符合|查無|無資料/.test(d.stat))return [];throw Error('上市歷史資料暫時無法取得');}
          if(!String(d.title||'').split(/\s+/).includes(symbol)||!Array.isArray(d.data)||d.date!==month.replaceAll('-','')+'01')throw Error('上市歷史資料識別不符');
          return d.data;
        }
        if(String(d?.code||'').toUpperCase()!==symbol||String(d?.stat).toLowerCase()!=='ok'||!Array.isArray(d.tables?.[0]?.data))throw Error('上櫃歷史資料暫時無法取得');
        return d.tables[0].data;
      })));
      if(outcomes.every(r=>r.status==='rejected'))console.warn('SalaryMate history provider unavailable',exchange,outcomes.map(r=>r.reason?.providerStatus||r.reason?.name||'unavailable'));
      return {rows:outcomes.flatMap(r=>r.status==='fulfilled'?r.value:[]),partial:outcomes.some(r=>r.status==='rejected'),exchange};
    }
    let result=await load('TWSE');
    if(!result.rows.length)result=await load('TPEx');
    if(!result.rows.length)throw Error('沒有可分析的台股歷史收盤資料');
    return {...result,bars:result.rows.map(r=>({date:roc(r[0]),close:numeric(r[6]),corporateAction:String(r[9]||'').includes('**'),nonComparable:String(r[7]||'').includes('X')})),source:result.exchange+' 每日收盤',sourceUrl:result.exchange==='TWSE'?'https://www.twse.com.tw/zh/trading/historical/stock-day.html':'https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html'};
  }
  async function usa(symbol,from,to){
    for(const kind of ['stocks','etf']){
      try{
        const d=(await read(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=${kind}&fromdate=${from}&todate=${to}&limit=150`,600000))?.data;
        if(String(d?.symbol||'').toUpperCase()!==symbol||!Array.isArray(d?.tradesTable?.rows)||!d.tradesTable.rows.length)continue;
        return {bars:d.tradesTable.rows.map(r=>({date:usDate(r.date),close:numeric(r.close),corporateAction:false})),partial:false,source:'Nasdaq 每日收盤',sourceUrl:`https://www.nasdaq.com/market-activity/${kind==='etf'?'etf':'stocks'}/${encodeURIComponent(symbol.toLowerCase())}/historical`};
      }catch{}
    }
    throw Error('沒有可分析的美股歷史收盤資料');
  }
  return async ({market,symbol})=>{
    const now=clock(),session=marketSession(market,now,getCalendars()),expectedDate=lastComplete(market,now);
    const months=Array.from({length:4},(_,i)=>new Date(Date.UTC(+session.date.slice(0,4),+session.date.slice(5,7)-1-i,1)).toISOString().slice(0,7));
    const result=market==='TW'?await taiwan(symbol,months):await usa(symbol,months.at(-1)+'-01',session.date);
    const unique=new Map();let invalid=false;
    for(const b of result.bars){
      if(!dateOK(b.date)||!Number.isFinite(b.close)||b.close<=0){invalid=true;continue;}
      // Never mix the incomplete current session into daily-close indicators.
      if(b.date>session.date||expectedDate&&b.date>expectedDate)continue;
      if(unique.has(b.date)&&unique.get(b.date).close!==b.close)throw Error('來源同日價格不一致，暫停分析');
      unique.set(b.date,b);
    }
    const bars=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-120);
    if(!bars.length)throw Error('尚無有效的已收盤資料，請稍後重試');
    return {market,symbol,currency:market==='TW'?'TWD':'USD',bars,expectedDate,calendarKnown:!!expectedDate,partial:result.partial||invalid,source:result.source,sourceUrl:result.sourceUrl,adjustment:'unadjusted',fetchedAt:new Date(now).toISOString()};
  };
}
