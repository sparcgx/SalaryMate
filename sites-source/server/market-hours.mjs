// Exchange calendars verified 2026-10-21. Unknown years fail closed for automatic polling.
// TW: https://www.twse.com.tw/zh/trading/holiday.html
// US: https://www.nyse.com/trade/hours-calendars (regular stock/ETF sessions only).
export const MARKET_CALENDARS={
  TW:{'2026':{closed:['01-01','02-12','02-13','02-15','02-16','02-17','02-18','02-19','02-20','02-27','02-28','04-03','04-04','04-05','04-06','05-01','06-19','09-25','09-28','10-09','10-10','10-25','10-26','12-25'],early:{},open:[]}},
  US:{
    '2026':{closed:['01-01','01-19','02-16','04-03','05-25','06-19','07-03','09-07','11-26','12-25'],early:{'11-27':'13:00','12-24':'13:00'},open:[]},
    '2027':{closed:['01-01','01-18','02-15','03-26','05-31','06-18','07-05','09-06','11-25','12-24'],early:{'11-26':'13:00'},open:[]},
    '2028':{closed:['01-17','02-21','04-14','05-29','06-19','07-04','09-04','11-23','12-25'],early:{'07-03':'13:00','11-24':'13:00'},open:[]}
  }
};
export const MARKET_ZONES={TW:'Asia/Taipei',US:'America/New_York'};
const formatters=new Map();
export function marketLocal(at,zone){
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  const p=Object.fromEntries(formatters.get(zone).formatToParts(new Date(at)).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}:${p.second}`};
}
export function zonedMarketTime(date,time,zone){
  const wall=Date.parse(date+'T'+time+(time.length===5?':00':'')+'Z');
  if(!Number.isFinite(wall))return NaN;
  let at=wall;
  for(let i=0;i<3;i++){const p=marketLocal(at,zone);at+=wall-Date.parse(p.date+'T'+p.time+'Z');}
  const p=marketLocal(at,zone);
  return p.date===date&&p.time===(time.length===5?time+':00':time)?at:NaN;
}
export function calendarValid(value,year){
  const valid=day=>typeof day==='string'&&/^\d{2}-\d{2}$/.test(day)&&new Date(`${year}-${day}T00:00:00Z`).toISOString().slice(0,10)===`${year}-${day}`;
  try{return value&&Array.isArray(value.closed)&&value.closed.length<=100&&value.closed.every(valid)&&Array.isArray(value.open)&&value.open.length<=30&&value.open.every(valid)&&value.early&&typeof value.early==='object'&&!Array.isArray(value.early)&&Object.entries(value.early).length<=30&&Object.entries(value.early).every(([d,t])=>valid(d)&&/^1[0-5]:[0-5]\d$/.test(t));}catch{return false;}
}
export function mergeMarketCalendars(base,extra){
  const result={TW:{...base.TW},US:{...base.US}};
  for(const market of ['TW','US'])for(const [year,value] of Object.entries(extra?.[market]||{}))if(/^20\d{2}$/.test(year)&&calendarValid(value,year))result[market][year]={closed:[...value.closed],open:[...value.open],early:{...value.early}};
  return result;
}
export function marketSession(market,now=Date.now(),calendars=MARKET_CALENDARS){
  const zone=MARKET_ZONES[market];if(!zone)throw Error('Unsupported market');
  const local=marketLocal(now,zone),year=local.date.slice(0,4),day=local.date.slice(5),calendar=calendars[market]?.[year];
  const openTime=market==='TW'?'09:00':'09:30',closeTime=calendar?.early?.[day]||(market==='TW'?'13:30':'16:00');
  const opensAt=zonedMarketTime(local.date,openTime,zone),closesAt=zonedMarketTime(local.date,closeTime,zone);
  const weekday=new Date(local.date+'T12:00:00Z').getUTCDay();
  const holiday=calendar?.closed?.includes(day)||([0,6].includes(weekday)&&!calendar?.open?.includes(day));
  const phase=!calendar?'unknown':holiday?'holiday':now<opensAt?'preopen':now<closesAt?'open':now<closesAt+5*60000?'closing':'closed';
  return {market,zone,date:local.date,localTime:local.time,openTime,closeTime,opensAt,closesAt,phase,earlyClose:!!calendar?.early?.[day],calendarKnown:!!calendar};
}
export function marketPlan(assets,now=Date.now(),lastClose={},calendars=MARKET_CALENDARS){
  const sessions=['TW','US'].map(m=>marketSession(m,now,calendars));
  const wanted=new Set(assets.map(a=>a.market));
  const active=sessions.filter(s=>wanted.has(s.market)&&(s.phase==='open'||s.phase==='closing'&&now>=s.closesAt+60000&&lastClose[s.market]!==s.date));
  const activeMarkets=new Set(active.map(s=>s.market));
  const deadlines=sessions.filter(s=>wanted.has(s.market)).flatMap(s=>s.phase==='preopen'?[s.opensAt]:s.phase==='open'?[Math.min(now+60000,s.closesAt)]:s.phase==='closing'&&lastClose[s.market]!==s.date?[Math.max(now+1000,s.closesAt+60000)]:[]);
  return {sessions,assets:assets.filter(a=>activeMarkets.has(a.market)),closing:active.filter(s=>s.phase==='closing'),wakeIn:Math.max(1000,Math.min(60000,...deadlines.map(x=>x-now)))};
}
export function parseNasdaqTime(text){
  const m=String(text||'').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s+(ET|EST|EDT)\b/i);
  if(!m)return '';
  const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase())+1;
  if(+m[4]<1||+m[4]>12||+m[5]>59||+(m[6]||0)>59)return '';
  const date=`${m[3]}-${String(month).padStart(2,'0')}-${m[2].padStart(2,'0')}`,hour=(+m[4]%12)+(m[7].toUpperCase()==='PM'?12:0);
  const time=`${String(hour).padStart(2,'0')}:${m[5]}:${m[6]||'00'}`;
  const at=zonedMarketTime(date,time,MARKET_ZONES.US);if(!Number.isFinite(at))return '';
  const offset=(Date.parse(date+'T'+time+'Z')-at)/3600000;
  if(m[8].toUpperCase()==='EST'&&offset!==-5||m[8].toUpperCase()==='EDT'&&offset!==-4)return '';
  return `${date}T${time}${offset===-4?'-04:00':'-05:00'}`;
}
export function quoteTiming(asset,now=Date.now(),calendars=MARKET_CALENDARS){
  if(!MARKET_ZONES[asset.market])return 'manual';
  if(asset.priceUpdateMode==='manual'||asset.quoteMode==='manual')return 'manual';
  const session=marketSession(asset.market,now,calendars),at=Date.parse(asset.quoteMarketAt||asset.quoteAt);
  if(!Number.isFinite(at))return asset.quotePriceKind==='close'||asset.priceKind==='close'?'close':'unknown';
  if(at>now+120000)return 'unknown';
  const date=marketLocal(at,session.zone).date;
  if(session.phase==='open'&&(date!==session.date||now-at>3*60000))return asset.quoteDataState==='delayed'||asset.dataState==='delayed'?'delayed':'stale';
  if(session.phase!=='open')return 'closed';
  return asset.quoteDataState||asset.dataState||'unknown';
}
