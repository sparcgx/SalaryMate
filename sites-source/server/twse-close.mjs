// Official public closing-price snapshot. Never send symbols or holdings upstream.
export function createTwseCloseLookup(fetcher=fetch, clock=()=>Date.now()) {
  const URL='https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
  const TTL=300000, RETRY_DELAY=60000, TIMEOUT=10000, MAX_BYTES=2*1024*1024, MAX_ROWS=10000;
  let cache=null, failure=null, pending=null;
  const problem=code=>Object.assign(new Error(code),{code});
  const elapsedWithin=(now,then,limit)=>now>=then&&now-then<limit;
  const cancel=stream=>{try{void stream?.cancel().catch(()=>{});}catch{}};
  const now=()=>{
    const value=clock();
    if(typeof value!=='number'||!Number.isFinite(new Date(value).getTime()))throw problem('TWSE_CLOSE_INVALID_CLOCK');
    return value;
  };
  const numeric=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value!=='string'||!/^[-+]?\d+(?:\.\d+)?$/.test(value.trim()))return null;
    const result=Number(value.trim());return Number.isFinite(result)?result:null;
  };
  function tradeDate(value,today) {
    if(typeof value!=='string'||!/^\d{7}$/.test(value)||Number(value.slice(0,3))===0)return null;
    const year=Number(value.slice(0,3))+1911,month=Number(value.slice(3,5)),day=Number(value.slice(5));
    const parsed=new Date(Date.UTC(year,month-1,day));
    if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)return null;
    const date=parsed.toISOString().slice(0,10);return date<=today?date:null;
  }
  function parse(data,at) {
    if(!Array.isArray(data)||!data.length||data.length>MAX_ROWS)throw problem('TWSE_CLOSE_INVALID_DATA');
    const today=new Date(at+8*3600000).toISOString().slice(0,10),symbols=new Set();
    let date=null,validPrices=0;
    const rows=data.map(row=>{
      if(!row||typeof row!=='object'||Array.isArray(row))throw problem('TWSE_CLOSE_INVALID_DATA');
      const day=tradeDate(row.Date,today);
      // Reject a mixed or malformed batch, rather than silently combining days.
      if(!day||(date&&date!==day))throw problem('TWSE_CLOSE_INVALID_DATE');
      date=day;
      if(typeof row.Code!=='string'||typeof row.Name!=='string'||!Object.hasOwn(row,'ClosingPrice'))throw problem('TWSE_CLOSE_INVALID_DATA');
      const symbol=row.Code.trim().toUpperCase(),name=row.Name.trim();
      if(!/^[0-9A-Z]{2,12}$/.test(symbol)||!name||name.length>200||symbols.has(symbol))throw problem('TWSE_CLOSE_INVALID_DATA');
      symbols.add(symbol);
      const closing=numeric(row.ClosingPrice),price=closing>0?closing:null,change=numeric(row.Change),traded=numeric(row.TradeVolume);
      if(price!==null)validPrices++;
      const previous=price!==null&&change!==null?price-change:null;
      const percent=Number.isFinite(previous)&&previous>0?change/previous*100:null;
      return {market:'TW',symbol,name,currency:'TWD',price,date:day,source:'TWSE 上市收盤',providerTime:day,
        priceKind:'close',exchange:'TWSE',change,changePercent:Number.isFinite(percent)?percent:null,
        volume:Number.isSafeInteger(traded)&&traded>=0?traded:null};
    });
    if(!validPrices)throw problem('TWSE_CLOSE_NO_VALID_PRICE');
    return {rows,tradeDate:date};
  }
  async function read() {
    const controller=new AbortController();let timer,reader,response;
    const deadline=new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();cancel(reader||response?.body);reject(problem('TWSE_CLOSE_TIMEOUT'));},TIMEOUT);
    });
    const request=(async()=>{
      // workerd accepts manual/follow only; manual also keeps 3xx outside our fixed-source policy.
      response=await fetcher(URL,{method:'GET',headers:{accept:'application/json'},credentials:'omit',redirect:'manual',signal:controller.signal});
      if(controller.signal.aborted){cancel(response?.body);throw problem('TWSE_CLOSE_TIMEOUT');}
      if(!response?.ok)throw problem('TWSE_CLOSE_HTTP_ERROR');
      const declared=response.headers?.get('content-length');
      if(declared&&/^\d+$/.test(declared)&&Number(declared)>MAX_BYTES)throw problem('TWSE_CLOSE_TOO_LARGE');
      if(!response.body?.getReader)throw problem('TWSE_CLOSE_INVALID_DATA');
      reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
      while(true){
        const {done,value}=await reader.read();
        if(controller.signal.aborted)throw problem('TWSE_CLOSE_TIMEOUT');
        if(done)break;
        bytes+=value.byteLength;if(bytes>MAX_BYTES)throw problem('TWSE_CLOSE_TOO_LARGE');
        text+=decoder.decode(value,{stream:true});
      }
      try{return JSON.parse(text+decoder.decode());}catch{throw problem('TWSE_CLOSE_INVALID_DATA');}
    })();
    try{return await Promise.race([request,deadline]);}
    finally{clearTimeout(timer);cancel(reader||response?.body);}
  }
  const result=(status,error)=>({rows:cache?.rows||[],status,fetchedAt:cache?.fetchedAt||null,tradeDate:cache?.tradeDate||null,...(error?{error}:{})});
  const copy=value=>({...value,rows:value.rows.map(row=>({...row}))});
  async function refresh(startedAt) {
    try{
      const data=await read(),at=now(),parsed=parse(data,at);
      if(cache&&parsed.tradeDate<cache.tradeDate)throw problem('TWSE_CLOSE_OLDER_DATE');
      cache={...parsed,at,fetchedAt:new Date(at).toISOString()};failure=null;
      return result('fresh');
    }catch(error){
      const code=typeof error?.code==='string'&&error.code.startsWith('TWSE_CLOSE_')?error.code:'TWSE_CLOSE_FETCH_FAILED';
      let at=startedAt;try{at=now();}catch{}
      failure={at,error:code};return result(cache?'stale':'unavailable',code);
    }
  }
  return async function lookup() {
    let at;try{at=now();}catch(error){return copy(result(cache?'stale':'unavailable',error.code));}
    if(pending)return copy(await pending);
    if(cache&&elapsedWithin(at,cache.at,TTL))return copy(result('fresh'));
    if(failure&&elapsedWithin(at,failure.at,RETRY_DELAY))return copy(result(cache?'stale':'unavailable',failure.error));
    const work=refresh(at);pending=work;
    try{return copy(await work);}finally{if(pending===work)pending=null;}
  };
}
