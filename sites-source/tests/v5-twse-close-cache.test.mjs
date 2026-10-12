import test from 'node:test';
import assert from 'node:assert/strict';
import {createTwseCloseLookup} from '../server/twse-close.mjs';

const SATURDAY=Date.parse('2026-10-10T09:15:00Z');
// Small public samples observed at the official endpoint on 2026-10-10.
const raw=(changes={})=>({Date:'1151008',Code:'0050',Name:'元大台灣50',TradeVolume:'99877876',ClosingPrice:'114.95',Change:'-1.1000',...changes});
const response=(rows=[raw()],init)=>new Response(JSON.stringify(rows),init);
function harness(reply=()=>response(),time=SATURDAY){
  const calls=[];
  const lookup=createTwseCloseLookup((url,init)=>{calls.push({url,init});return reply(calls.length);},()=>time);
  return {lookup,calls,advance:ms=>{time+=ms;},setTime:value=>{time=value;}};
}

test('TWSE close preserves observed leading zeros, alphanumeric ETFs and actual trade date over a holiday weekend',async()=>{
  const h=harness(()=>response([
    raw(),raw({Code:'00400A',Name:'主動國泰動能高息',ClosingPrice:'16.15',Change:'0.0000',TradeVolume:'28722889'}),
    raw({Code:'00631L',Name:'元大台灣50正2',ClosingPrice:'40.90',Change:'-0.8500',TradeVolume:'148411561'}),
    raw({Code:'00682U',Name:'期元大美元指數',ClosingPrice:'',Change:'0.0000',TradeVolume:'81'})
  ]));
  const out=await h.lookup({ignoredPrivateHoldings:'must not be sent'});
  assert.equal(out.status,'fresh');assert.equal(out.tradeDate,'2026-10-08');assert.equal(out.fetchedAt,new Date(SATURDAY).toISOString());
  assert.deepEqual(out.rows.map(r=>r.symbol),['0050','00400A','00631L','00682U']);
  assert.equal(out.rows[0].price,114.95);assert.equal(out.rows[3].price,null);assert.equal(out.rows[3].volume,81);
  assert.equal(out.rows[3].changePercent,null);
  for(const r of out.rows){assert.equal(r.market,'TW');assert.equal(r.exchange,'TWSE');assert.equal(r.currency,'TWD');assert.equal(r.priceKind,'close');assert.equal(r.source,'TWSE 上市收盤');assert.equal(r.providerTime,r.date);}
  const {url,init}=h.calls[0];assert.equal(url,'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
  assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');
  assert.deepEqual(init.headers,{accept:'application/json'});
});

test('TWSE close constructs an upstream Request using the redirect mode supported by workerd',async()=>{
  let request;
  const lookup=createTwseCloseLookup((url,init)=>{
    request=new Request(url,init);
    // Node also supports error, so assert the narrower real workerd contract.
    assert.equal(request.redirect,'manual');
    return response();
  },()=>SATURDAY);
  const result=await lookup();assert.equal(result.status,'fresh');
  assert.equal(request.url,'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
  assert.equal(request.method,'GET');assert.equal(request.body,null);assert.equal(request.credentials,'omit');
  assert.equal(request.headers.get('authorization'),null);assert.equal(request.headers.get('cookie'),null);
  assert.equal(result.tradeDate,'2026-10-08');
});

test('TWSE close never follows same-origin or foreign redirects and preserves cache/backoff until recovery',async()=>{
  for(const status of [301,302,303,304,307,308])for(const location of ['https://openapi.twse.com.tw/other','https://unrelated.example/collect'])for(const primed of [false,true]){
    let redirect=false,cancelled=0;
    const h=harness(()=>{
      if(!redirect)return response();
      const body=status===304?null:new ReadableStream({cancel(){cancelled++;}});
      return new Response(body,{status,headers:{location}});
    });
    const first=primed?await h.lookup():null;if(primed)h.advance(300000);
    redirect=true;const failed=await h.lookup();
    assert.equal(failed.status,primed?'stale':'unavailable');assert.equal(failed.error,'TWSE_CLOSE_HTTP_ERROR');
    assert.deepEqual(failed.rows,first?.rows||[]);assert.equal(failed.fetchedAt,first?.fetchedAt||null);
    assert.equal(cancelled,status===304?0:1);
    const reads=h.calls.length;h.advance(59999);assert.equal((await h.lookup()).status,failed.status);assert.equal(h.calls.length,reads);
    redirect=false;h.advance(1);const recovered=await h.lookup();assert.equal(recovered.status,'fresh');assert.equal(recovered.tradeDate,'2026-10-08');assert.equal(h.calls.length,reads+1);
    for(const call of h.calls){assert.equal(call.url,'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');assert.equal(call.init.redirect,'manual');}
  }
});

test('TWSE close treats blank, nonnumeric, nonfinite, zero and negative prices as null rather than zero',async()=>{
  const invalid=['',' ','--','N/A','NaN','Infinity','1e3','5oops','1,234.00','0','0.00','-1',null,true,Infinity,NaN];
  const h=harness(()=>response([raw(),...invalid.map((value,i)=>raw({Code:String(1000+i),ClosingPrice:value,TradeVolume:''}))]));
  const out=await h.lookup();assert.equal(out.status,'fresh');
  for(const row of out.rows.slice(1)){assert.equal(row.price,null);assert.equal(row.volume,null);assert.equal(row.changePercent,null);}
});

test('TWSE close computes change percentage from previous close and keeps missing values null',async()=>{
  const values=['5','-5','0','100','150','','--','5oops','Infinity'];
  const h=harness(()=>response(values.map((value,i)=>raw({Code:String(1000+i),ClosingPrice:'100',Change:value}))));
  const rows=(await h.lookup()).rows;
  assert.ok(Math.abs(rows[0].changePercent-5/95*100)<1e-12);
  assert.ok(Math.abs(rows[1].changePercent+5/105*100)<1e-12);assert.equal(rows[1].change,-5);assert.equal(rows[2].changePercent,0);
  for(const row of rows.slice(3))assert.equal(row.changePercent,null);
  for(const row of rows.slice(5))assert.equal(row.change,null);
  const huge=harness(()=>response([raw({ClosingPrice:1e308,Change:-1e308,TradeVolume:'9007199254740992'})]));
  const row=(await huge.lookup()).rows[0];assert.equal(row.changePercent,null);assert.equal(row.volume,null);
});

test('TWSE close strictly validates ROC dates, leap days and the Taipei calendar boundary',async()=>{
  for(const Date of ['1150229','1150431','1150001','1150100','0000101','1151011','20261008','115/10/08',' 1151008',1151008]){
    const h=harness(()=>response([raw({Date})]));const out=await h.lookup();assert.equal(out.status,'unavailable',String(Date));assert.equal(out.error,'TWSE_CLOSE_INVALID_DATE');
  }
  assert.equal((await harness(()=>response([raw({Date:'1130229'})])).lookup()).tradeDate,'2024-02-29');
  const before=harness(()=>response([raw({Date:'1151010'})]),Date.parse('2026-10-09T15:59:59Z'));
  assert.equal((await before.lookup()).status,'unavailable');
  const after=harness(()=>response([raw({Date:'1151010'})]),Date.parse('2026-10-09T16:00:00Z'));
  assert.equal((await after.lookup()).tradeDate,'2026-10-10');
});

test('TWSE close rejects mixed dates, duplicate symbols, malformed shapes, empty batches and no valid closing prices',async()=>{
  for(const rows of [[],{}, {data:[raw()]},[null],[[]],[raw({Code:50})],[raw({Name:''})],[raw({Code:'bad code'})],
    [raw(),raw({Code:'2330',Date:'1151007'})],[raw(),raw()],[raw({ClosingPrice:''})],[{Date:'1151008',Code:'0050',Name:'fixture'}]]){
    const out=await harness(()=>response(rows)).lookup();assert.equal(out.status,'unavailable');assert.deepEqual(out.rows,[]);assert.equal(out.fetchedAt,null);assert.equal(out.tradeDate,null);
  }
});

test('TWSE close cache expires at exactly five minutes and valid same-day refresh updates fetchedAt',async()=>{
  const h=harness();const first=await h.lookup();h.advance(299999);assert.equal((await h.lookup()).fetchedAt,first.fetchedAt);assert.equal(h.calls.length,1);
  h.advance(1);const next=await h.lookup();assert.equal(h.calls.length,2);assert.equal(next.status,'fresh');assert.equal(next.tradeDate,first.tradeDate);assert.notEqual(next.fetchedAt,first.fetchedAt);
});

test('TWSE close shares one in-flight request while isolating concurrent caller rows and later cache reads',async()=>{
  let resolve;const h=harness(()=>new Promise(done=>{resolve=done;}));
  const a=h.lookup(),b=h.lookup();assert.equal(h.calls.length,1);resolve(response());const [first,second]=await Promise.all([a,b]);
  assert.notEqual(first,second);assert.notEqual(first.rows,second.rows);assert.notEqual(first.rows[0],second.rows[0]);
  first.rows[0].price=999;first.rows[0].nav={value:1};first.rows.push({symbol:'fake'});second.rows[0].name='changed';
  const cached=await h.lookup();assert.equal(cached.rows.length,1);assert.equal(cached.rows[0].price,114.95);assert.equal(cached.rows[0].name,'元大台灣50');assert.equal(cached.rows[0].nav,undefined);assert.equal(h.calls.length,1);
});

test('TWSE close offline failure returns unavailable and retries only at the sixty-second backoff boundary',async()=>{
  const h=harness(()=>{throw Error('private upstream detail');});
  const first=await h.lookup();assert.equal(first.status,'unavailable');assert.equal(first.error,'TWSE_CLOSE_FETCH_FAILED');assert.equal(first.fetchedAt,null);
  h.advance(59999);await h.lookup();assert.equal(h.calls.length,1);h.advance(1);await h.lookup();assert.equal(h.calls.length,2);
});

test('TWSE close expiry failure preserves last valid snapshot and its original fetchedAt during retry backoff',async()=>{
  let fail=false;const h=harness(()=>fail?new Response('unavailable',{status:503}):response());
  const first=await h.lookup();h.advance(300000);fail=true;const stale=await h.lookup();
  assert.equal(stale.status,'stale');assert.equal(stale.error,'TWSE_CLOSE_HTTP_ERROR');assert.equal(stale.fetchedAt,first.fetchedAt);assert.deepEqual(stale.rows,first.rows);
  h.advance(59999);assert.equal((await h.lookup()).status,'stale');assert.equal(h.calls.length,2);
  h.advance(1);fail=false;const next=await h.lookup();assert.equal(h.calls.length,3);assert.equal(next.status,'fresh');assert.equal(next.error,undefined);
});

test('TWSE close malformed JSON, empty or invalid snapshots never replace a previous good snapshot',async()=>{
  for(const bad of [()=>new Response('<html>gateway error</html>'),()=>response([]),()=>response([raw({ClosingPrice:''})]),()=>response([raw({Date:'1150431'})]),()=>response([raw(),raw({Code:'2330',Date:'1151007'})])]){
    let fail=false;const h=harness(()=>fail?bad():response());const good=await h.lookup();fail=true;h.advance(300000);const stale=await h.lookup();
    assert.equal(stale.status,'stale');assert.equal(stale.fetchedAt,good.fetchedAt);assert.deepEqual(stale.rows,good.rows);
  }
});

test('TWSE close rejects a regressing dataset without refreshing the previous cache timestamp',async()=>{
  let date='1151008';const h=harness(()=>response([raw({Date:date})]));const first=await h.lookup();h.advance(300000);date='1151007';
  const stale=await h.lookup();assert.equal(stale.status,'stale');assert.equal(stale.error,'TWSE_CLOSE_OLDER_DATE');assert.equal(stale.tradeDate,'2026-10-08');assert.equal(stale.fetchedAt,first.fetchedAt);
  h.advance(60000);date='1151008';assert.equal((await h.lookup()).status,'fresh');assert.equal(h.calls.length,3);
});

test('TWSE close clock rollback expires freshness and resets failed-retry timing instead of keeping either indefinitely',async()=>{
  let fail=false;const h=harness(()=>{if(fail)throw Error('offline');return response();});const good=await h.lookup();fail=true;
  h.advance(-1000);const stale=await h.lookup();assert.equal(stale.status,'stale');assert.equal(stale.fetchedAt,good.fetchedAt);assert.equal(h.calls.length,2);
  await h.lookup();assert.equal(h.calls.length,2);h.advance(-1000);await h.lookup();assert.equal(h.calls.length,3);
  fail=false;h.advance(60000);assert.equal((await h.lookup()).status,'fresh');
});

test('TWSE close caps declared response length and actual UTF-8 bytes without awaiting a stalled cancellation',async()=>{
  const max=2*1024*1024;let cancelled=false;
  const h=harness(()=>new Response(new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{});}}),{headers:{'content-length':String(max+1)}}));
  assert.equal((await h.lookup()).error,'TWSE_CLOSE_TOO_LARGE');assert.equal(cancelled,true);
  const overflow=harness(()=>new Response('一'.repeat(Math.floor(max/3)+1),{headers:{'content-length':'1'}}));
  assert.equal((await overflow.lookup()).error,'TWSE_CLOSE_TOO_LARGE');
  const json=JSON.stringify([raw()]),exact=harness(()=>new Response(json+' '.repeat(max-Buffer.byteLength(json))));
  assert.equal((await exact.lookup()).status,'fresh');
  const oneMore=harness(()=>new Response(json+' '.repeat(max-Buffer.byteLength(json)+1)));assert.equal((await oneMore.lookup()).error,'TWSE_CLOSE_TOO_LARGE');
});

test('TWSE close timeout bounds an ignored-abort fetch and late results cannot replace the cache',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let late,cancelled=false;
  const h=harness(count=>count===1?new Promise(resolve=>{late=resolve;}):response());
  const pending=h.lookup();t.mock.timers.tick(10000);const failed=await pending;
  assert.equal(failed.status,'unavailable');assert.equal(failed.error,'TWSE_CLOSE_TIMEOUT');assert.equal(h.calls[0].init.signal.aborted,true);
  h.advance(60000);const good=await h.lookup();assert.equal(good.status,'fresh');
  late(new Response(new ReadableStream({cancel(){cancelled=true;}})));await Promise.resolve();await Promise.resolve();
  assert.equal(cancelled,true);assert.deepEqual(await h.lookup(),good);assert.equal(h.calls.length,2);
});

test('TWSE close timeout remains active after headers while body stalls, preserving stale data',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let stalled=false,cancelled=false;
  const h=harness(()=>stalled?new Response(new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{});}})):response());
  const good=await h.lookup();h.advance(300000);stalled=true;const pending=h.lookup();await Promise.resolve();
  t.mock.timers.tick(10000);const stale=await pending;assert.equal(stale.status,'stale');assert.equal(stale.error,'TWSE_CLOSE_TIMEOUT');assert.equal(stale.fetchedAt,good.fetchedAt);assert.equal(cancelled,true);
});
