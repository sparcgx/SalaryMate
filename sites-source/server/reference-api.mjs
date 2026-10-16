// Public FX only. No payroll, balances, transaction amounts or account identifiers.
export function createReferenceApi({fetcher=fetch,now=()=>Date.now()}={}){
 const cache=new Map(),pending=new Map(),limits=new Map();
 const currencies=new Set(['TWD','USD','EUR','JPY','GBP','CNY','HKD','AUD','CAD','CHF','SGD','KRW']);
 const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 return async request=>{
  const u=new URL(request.url),origin=request.headers.get('origin');
  if(origin&&!['null',u.origin,'https://sparcgx.github.io'].includes(origin))return new Response('Origin not allowed',{status:403});
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
  if(origin)headers['access-control-allow-origin']=origin;
  const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(request.method!=='GET')return reply({error:'Method not allowed'},405);
  const date=u.searchParams.get('date')||'',base=u.searchParams.get('base')||'',quote=u.searchParams.get('quote')||'';
  if([...u.searchParams.keys()].length!==3||!validDate(date)||date<'1999-01-01'||date>new Date(now()).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})||!currencies.has(base)||!currencies.has(quote))return reply({error:'Invalid date or currency'},400);
  const ip=request.headers.get('cf-connecting-ip')||'unknown',minute=Math.floor(now()/60000);
  for(const key of ['all',ip]){const record=limits.get(key);const count=record?.minute===minute?record.count+1:1;limits.set(key,{minute,count});if(count>(key==='all'?600:30))return reply({error:'Too many requests'},429);}
  if(limits.size>1000)for(const [key,value] of limits)if(value.minute!==minute)limits.delete(key);
  const key=[date,base,quote].join(':'),hit=cache.get(key);
  if(hit&&now()-hit.time<86400000)return reply(hit.value);
  if(base===quote)return reply({date,requestedDate:date,base,quote,rate:1,source:'identity'});
  let task=pending.get(key);
  if(!task){
   if(pending.size>=8)return reply({error:'Busy; retry later'},503);
   task=(async()=>{
    const response=await fetcher(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}?date=${date}`,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'},redirect:'error'});
    if(!response.ok)throw Error('Source unavailable');
    const text=await response.text();if(text.length>4096)throw Error('Oversized result');
    const data=JSON.parse(text);
    if(data.base!==base||data.quote!==quote||!validDate(data.date)||data.date>date||Date.parse(date)-Date.parse(data.date)>7*86400000||typeof data.rate!=='number'||!Number.isFinite(data.rate)||data.rate<=0)throw Error('Invalid rate');
    const value={date:data.date,requestedDate:date,base,quote,rate:data.rate,source:'Frankfurter',retrievedAt:new Date(now()).toISOString()};
    cache.set(key,{time:now(),value});while(cache.size>100)cache.delete(cache.keys().next().value);return value;
   })();pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});
  }
  try{return reply(await task);}catch{return reply({error:'Reference rate unavailable; existing data unchanged'},502);}
 };
}
