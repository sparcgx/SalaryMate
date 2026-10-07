(function(root){
 'use strict';
 const core=root.SalaryMateStocks,copy=x=>JSON.parse(JSON.stringify(x));
 const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 const nneg=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const fail=message=>{throw new Error(message);};
 const key=x=>`${x.category}:${x.symbol.trim().toUpperCase()}`;
 const dateFrom=s=>{const date=typeof s==='string'?s.slice(0,10):'';return core.dateOK(date)?date:'';};
 function dividendPeriod(rows,date) {
   if(!core.dateOK(date))return -1;
   let eligible=rows.map((r,i)=>({r,i})).filter(({r})=>r.cashDividend!=null&&r.exDividendDate<=date&&(!r.paymentDate||r.paymentDate<=date));
   const exact=eligible.filter(({r})=>r.paymentDate===date);if(exact.length)eligible=exact;
   if(!eligible.length)return -1;
   const latest=eligible.map(({r})=>r.paymentDate||r.exDividendDate).sort().at(-1);
   const matches=eligible.filter(({r})=>(r.paymentDate||r.exDividendDate)===latest);
   if(new Set(matches.map(({r})=>r.exDividendDate+':'+r.cashDividend)).size!==1)return -1;
   return matches[0].i;
 }
 function forecastCache(previous,data,today) {
   if(!data||!Array.isArray(data.announcements)||!Array.isArray(data.errors))fail('預計配息公告格式不正確。');
   const recent=new Date(today+'T00:00:00Z');recent.setUTCDate(recent.getUTCDate()-60);
   const prior=previous?.announcements||[],tracked=new Set(prior.map(r=>r.exDividendDate));
   const rows=data.announcements.filter(r=>core.dateOK(r.exDividendDate)&&(!r.paymentDate||core.dateOK(r.paymentDate)&&r.paymentDate>=r.exDividendDate)&&(r.cashDividend===null||nneg(r.cashDividend))&&(tracked.has(r.exDividendDate)||r.exDividendDate>=today||r.paymentDate>=today||!r.paymentDate&&r.exDividendDate>=recent.toISOString().slice(0,10)));
   if(data.errors.length)for(const r of prior)if(!rows.some(x=>x.exDividendDate===r.exDividendDate))rows.push(r);
   return {checkedAt:data.checkedAt||new Date().toISOString(),announcements:copy(rows.slice(0,200)),errors:data.errors.map(String)};
 }
 function parseSmart(value) {
   if(!value||typeof value!=='object'||Array.isArray(value))fail('不是有效的 SmartPortfolio 備份。');
   if(value.format&&value.format!=='smartportfolio-backup')fail('這不是 SmartPortfolio 備份格式。');
   if(value.format&&value.backupVersion!==1)fail('不支援此 SmartPortfolio 備份版本。');
   const d=value.format?value.data:value;
   if(!d||![1,2,3].includes(d.schemaVersion)||!Array.isArray(d.holdings)||!Array.isArray(d.transactions))fail('備份缺少持股、交易或支援的資料版本（1～3）。');
   const ids=new Set(),keys=new Set(),tids=new Set();
   const check=x=>{if(!x||typeof x.id!=='string'||!x.id.trim()||typeof x.symbol!=='string'||!x.symbol.trim()||typeof x.name!=='string'||!x.name.trim()||!['台股','美股','公募基金'].includes(x.category))fail('持股或交易的識別碼、代號、名稱、類別不完整。');};
   for(const h of d.holdings){check(h);if(ids.has(h.id)||keys.has(key(h)))fail('備份有重複的持股識別碼或標的。');ids.add(h.id);keys.add(key(h));if(![h.shares,h.avgPrice,h.currentPrice].every(nneg))fail(`${h.symbol} 的持股或價格不正確。`);}
   for(const t of d.transactions){check(t);if(tids.has(t.id))fail('備份有重複的交易識別碼。');tids.add(t.id);if(!core.dateOK(t.date)||!['BUY','SELL','DIVIDEND'].includes(t.type))fail(`${t.symbol} 的交易日期或類型不正確。`);if(t.type==='DIVIDEND'?!nneg(t.amount):!positive(t.shares)||!nneg(t.price))fail(`${t.symbol} 的交易金額或股數不正確。`);if(![t.fee??0,t.tax??0].every(nneg))fail('費用與稅額不可為負數。');if(t.type==='DIVIDEND'&&(t.fee||0)+(t.tax||0)>t.amount)fail(`${t.symbol} 的股息費稅超過總額。`);if(t.fxRate!=null&&!positive(t.fxRate))fail(`${t.symbol} 的匯率不正確。`);}
   return {data:copy(d),appVersion:String(value.appVersion||'未標示'),exportedAt:String(value.exportedAt||''),raw:copy(value)};
 }
 function prepareSmart(value,current,{mode='history',snapshotDate,fallbackFx,token='preview',conflict='reject',copyToken='copy'}={}) {
   const parsed=parseSmart(value),d=parsed.data,today=snapshotDate;
   if(!core.dateOK(today))fail('請填寫有效的期初持股日期。');
   const fx=positive(fallbackFx)?fallbackFx:d.marketData?.usdTwdRate;
   if((d.holdings.some(h=>h.category==='美股')||d.transactions.some(t=>t.category==='美股'&&t.fxRate==null))&&!positive(fx))fail('美股資料缺少匯率，請輸入匯入換算用的 USD/TWD 匯率。');
   if(!['history','snapshot'].includes(mode))fail('匯入方式不正確。');
   if(!['reject','overwrite','copy'].includes(conflict))fail('請選擇重複資料處理方式。');
   if(conflict==='reject'&&current.smartImports?.some(i=>i.token===token))fail('這份備份已經匯入，已阻止重複新增。');
   const groups=new Map(),warnings=[],held=new Map(d.holdings.map(h=>[key(h),h]));
   for(const row of [...d.holdings,...d.transactions])if(!groups.has(key(row)))groups.set(key(row),{...row,symbol:row.symbol.trim().toUpperCase()});
   let account='SmartPortfolio',replaced=0,replacedTransactions=0;
   if(conflict==='copy'){
     let n=1;while(current.assets.some(a=>a.account===`SmartPortfolio（匯入副本 ${n}）`))n++;
     account=`SmartPortfolio（匯入副本 ${n}）`;
     warnings.push('新增至獨立帳戶副本；總覽會同時計入原資料及副本的持股與收入。');
   }
   if(conflict==='overwrite'){
     const ids=new Set(current.assets.filter(a=>a.account==='SmartPortfolio'&&[...groups.values()].some(r=>a.market===(r.category==='台股'?'TW':r.category==='美股'?'US':'OTHER')&&a.symbol.toUpperCase()===r.symbol)).map(a=>a.id));
     replaced=ids.size;replacedTransactions=current.transactions.filter(t=>ids.has(t.assetId)).length;
     current=copy(current);current.assets=current.assets.filter(a=>!ids.has(a.id));current.transactions=current.transactions.filter(t=>!ids.has(t.assetId));
     current.smartImports=(current.smartImports||[]).filter(i=>i.token!==token).map(i=>({...i,assets:i.assets.filter(id=>!ids.has(id))}));
     if(replaced)warnings.push(`將以備份完整取代 ${replaced} 檔相同 SmartPortfolio 標的及其 ${replacedTransactions} 筆現有帳務紀錄；包含匯入後手動新增的交易。其他標的保留。`);
   }
   const namespace='sp-'+token.slice(0,20)+(conflict==='copy'?'-'+copyToken:''),assets=[],transactions=[],archived=[];
   const idMap=new Map();let index=0,fxFallbacks=0;
   for(const [k,r] of groups){
     const market=r.category==='台股'?'TW':r.category==='美股'?'US':'OTHER',currency=market==='US'?'USD':'TWD';
     if(current.assets.some(a=>a.market===market&&a.symbol.toUpperCase()===r.symbol&&a.account===account))fail(`${r.symbol} 已有 SmartPortfolio 匯入資料；為避免重複持股，本次尚未匯入。`);
     const h=held.get(k),id=namespace+'-a'+(++index);idMap.set(k,id);
     const quoteDate=dateFrom(h?.quoteMarketTime)||dateFrom(h?.priceUpdatedAt);
     const quoted=h&&nneg(h.currentPrice)&&quoteDate;
     assets.push({id,symbol:r.symbol,name:r.name,market,currency,account,note:`來自 SmartPortfolio ${parsed.appVersion}${r.category==='公募基金'?' · 公募基金（手動淨值）':''}`,quotePrice:quoted?h.currentPrice:null,quoteDate:quoted?quoteDate:'',quoteFx:quoted?(currency==='USD'?fx:1):null,quoteSource:quoted?'SmartPortfolio 備份價格':'',quoteMode:'manual',smartSourceKey:k});
     if(h?.currentPrice&&!quoteDate)warnings.push(`${r.symbol} 的價格沒有日期，保留原檔但不作為目前估值。`);
   }
   const tradeTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time||'')?t.time:'12:00';
   const ordered=d.transactions.map((t,i)=>({...t,index:i})).sort((a,b)=>a.date.localeCompare(b.date)||tradeTime(a).localeCompare(tradeTime(b))||b.index-a.index);
   if(mode==='history')for(const [k] of groups){
     let quantity=0,cost=0;const lots=[];
     for(const t of ordered.filter(t=>key(t)===k&&t.type!=='DIVIDEND')){
       if(t.type==='BUY'){quantity+=t.shares;cost+=t.shares*t.price;lots.push({quantity:t.shares,cost:t.shares*t.price});}
       else{if(t.shares>quantity+1e-7||quantity<=0)fail(`${t.symbol} 的買賣履歷不完整，請改用「持股快照＋歷史留存」。`);cost*=Math.max(0,1-t.shares/quantity);quantity=Math.max(0,quantity-t.shares);let left=t.shares;while(left>0&&lots.length){const lot=lots[0],used=Math.min(left,lot.quantity),fraction=used/lot.quantity;left-=used;if(used===lot.quantity)lots.shift();else{lot.quantity-=used;lot.cost*=1-fraction;}}}
     }
     const h=held.get(k),expected=h?.shares||0;
     if(Math.abs(quantity-expected)>1e-7*Math.max(1,expected)||(expected>1e-7&&Math.abs(cost/quantity-h.avgPrice)>0.000051&&Math.abs(lots.reduce((n,l)=>n+l.cost,0)/quantity-h.avgPrice)>0.000051))fail(`${groups.get(k).symbol} 的履歷與持股／均價不一致，請改用「持股快照＋歷史留存」。`);
   }
   if(mode==='snapshot'){
     for(const [k,h] of held)if(h.shares>0){transactions.push({id:namespace+'-opening-'+idMap.get(k),assetId:idMap.get(k),type:'opening',date:today,time:'00:00',quantity:h.shares,price:h.avgPrice,amount:0,ratio:1,fee:0,tax:0,fx:h.category==='美股'?fx:1,note:'SmartPortfolio 期初持股；原買賣僅留存，不重複計入。'});if(h.category==='美股')fxFallbacks++;}
     warnings.push('快照方式保留原持股與均價。舊買賣僅留存，不計入本版歷史損益；原現金股息仍依實收日匯入。');
   }
   for(const t of ordered){
     if(mode==='snapshot'&&t.type!=='DIVIDEND'){archived.push(copy(t));continue;}
     if(t.date>today)fail(`${t.symbol} 有晚於期初日期的交易，請調整日期後再匯入。`);
     const rate=t.category==='美股'?(t.fxRate??fx):1;if(t.category==='美股'&&t.fxRate==null)fxFallbacks++;
     transactions.push({id:namespace+'-t-'+encodeURIComponent(t.id),assetId:idMap.get(key(t)),type:{BUY:'buy',SELL:'sell',DIVIDEND:'dividend'}[t.type],date:t.date,time:tradeTime(t),quantity:t.shares||0,price:t.price||0,amount:t.amount||0,ratio:1,fee:t.fee||0,tax:t.tax||0,fx:rate,note:[t.note,`SmartPortfolio 原紀錄 ${t.id}`,t.category==='美股'&&t.fxRate==null?'匯入時以備份／指定匯率換算':''].filter(Boolean).join(' · '),smartSourceId:t.id});
   }
   if(fxFallbacks)warnings.push(`${fxFallbacks} 筆美股紀錄使用匯入匯率 ${fx}，並非原交易日匯率；新臺幣成本／損益屬換算估計。`);
   if(mode==='history')warnings.push('完整履歷採 FIFO 重算，歷史損益與剩餘均價可能不同於原備份的移動平均結果。');
   if(mode==='history'&&transactions.some(t=>t.type==='buy'&&(t.fee||t.tax)))warnings.push('本版平均成本納入買入費稅，因此可能高於 SmartPortfolio 原顯示均價。');
   const next=copy(current);next.assets.push(...assets);next.transactions.push(...transactions);
   next.smartImports=[...(next.smartImports||[]),{token:conflict==='copy'?token+'-'+copyToken:token,mode,importedAt:today,appVersion:parsed.appVersion,conversionEstimated:fxFallbacks>0,warnings,assets:assets.map(a=>a.id),archivedTransactions:archived,original:parsed.raw}];
   core.validate(next);
   return {next,assets:assets.length,transactions:transactions.length,archived:archived.length,warnings,fxFallbacks,mode,replaced,replacedTransactions};
 }
 async function request(path,body,signal){
   if(typeof navigator!=='undefined'&&navigator.onLine===false)fail('目前離線，原有價格保持不變。');
   if(root.SalaryMatePortable)path=root.SalaryMatePortable.marketOrigin+path.replace('/api/stocks/','/api/stocks/portable/');
   const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);const abort=()=>c.abort();signal?.addEventListener('abort',abort,{once:true});
   try{const r=await fetch(path,{method:'POST',credentials:'omit',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:c.signal});if(!r.ok)fail(`行情服務暫時無法使用（${r.status}），請稍後重試。`);const d=await r.json();if(!Array.isArray(path.endsWith('/dividends')?d.announcements:d.quotes)||!Array.isArray(d.errors))fail('行情回傳格式不正確。');return d;}catch(e){if(e.name==='AbortError')fail('行情查詢逾時或已取消，原價格保持不變。');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async function fetchQuotes(assets,path='/api/stocks/quotes',signal){
   const includeFx=path.endsWith('/quotes');
   const items=[...new Map(assets.filter(a=>includeFx?core.quoteEligible(a):['TW','US'].includes(a.market)).map(a=>[a.market+':'+a.symbol.toUpperCase(),{market:a.market,symbol:a.symbol.toUpperCase()}])).values()];
   const result={quotes:[],errors:[],fx:null,fetchedAt:new Date().toISOString()};
   if(!items.length&&!includeFx)return result;
   for(let i=0;i<Math.max(1,items.length);i+=8){
     if(signal?.aborted)fail('行情更新已取消，原資料保持不變。');
     const chunk=items.slice(i,i+8);
     try{const d=await request(path,{instruments:chunk,...(includeFx?{includeFx:true}:{})},signal);result.quotes.push(...d.quotes);result.errors.push(...d.errors);if(d.fx)result.fx=d.fx;result.fetchedAt=d.fetchedAt||result.fetchedAt;}
     catch(e){result.errors.push(...(chunk.length?chunk:[{kind:'fx'}]).map(x=>({...x,message:e.message})));}
   }
   return result;
 }
 function marketInfo(q){return Object.fromEntries(['exchange','industry','instrumentType','classificationSource'].filter(k=>typeof q[k]==='string'&&q[k].trim()).map(k=>[k,q[k].trim().slice(0,100)]));}
 function updateIntraday(a,q,snapshot,today,updated,errors){
   if(a.market!=='TW'||!q?.intradayNavStatus&&!q?.intradayNav)return;
   const before=JSON.stringify([a.intradayNav,a.intradayNavStatus,a.intradayCheckedAt]),n=q?.intradayNav;
   const now=Number.isFinite(Date.parse(snapshot.fetchedAt))?Math.min(Date.parse(snapshot.fetchedAt),Date.now()):Date.now();
   if(q?.currency===a.currency&&core.intradayOK(n,a.currency)&&n.at.slice(0,10)<=today&&Date.parse(n.at)<=now+120000&&(!a.intradayNav||Date.parse(n.at)>=Date.parse(a.intradayNav.at))){
     a.intradayNav={provider:n.provider,value:n.value,at:n.at,currency:n.currency,marketPrice:n.marketPrice??null,premiumPercent:n.premiumPercent??null,businessDay:n.businessDay??null};
     a.intradayNavStatus='available';
   }else{
     a.intradayNavStatus=q?.intradayNavStatus==='unsupported'?'unsupported':'unavailable';
     if(a.intradayNavStatus==='unavailable')errors.push(`${a.symbol}：盤中淨值暫時無法更新，保留上次資料。`);
   }
   a.intradayCheckedAt=String(snapshot.fetchedAt||'');
   if(JSON.stringify([a.intradayNav,a.intradayNavStatus,a.intradayCheckedAt])!==before&&!updated.includes(a.id))updated.push(a.id);
 }
 function applyIntraday(current,snapshot,today){
   const next=copy(current),errors=[],updated=[];
   for(const a of next.assets){
     if(a.market!=='TW')continue;
     const q=snapshot.quotes.find(q=>q.market==='TW'&&q.symbol===a.symbol.toUpperCase());
     const error=snapshot.errors.find(e=>e.market==='TW'&&e.symbol===a.symbol.toUpperCase());
     updateIntraday(a,q||error&&{intradayNavStatus:'unavailable'},snapshot,today,updated,errors);
   }
   core.validate(next);return {next,updated,errors};
 }
 function applyQuotes(current,snapshot,today){
   const next=copy(current),errors=[],updated=[],priceUpdated=[];
   const targets=core.marketPreferences(current).quoteEnabled?next.assets.filter(core.quoteEligible):[];
   for(const a of targets){
     const q=snapshot.quotes.find(q=>q.market===a.market&&q.symbol===a.symbol.toUpperCase());
     const error=snapshot.errors.find(e=>e.market===a.market&&e.symbol===a.symbol.toUpperCase());
     updateIntraday(a,q||a.intradayNav&&error&&{intradayNavStatus:'unavailable'},snapshot,today,updated,errors);
     if(a.market==='TW'&&q?.currency===a.currency){
       const nav=q.netAssetValue;
       if(nav&&positive(nav.value)&&nav.currency===a.currency&&core.dateOK(nav.date)&&nav.date<=today&&(!a.netAssetValue||nav.date>=a.netAssetValue.date)&&(nav.premiumPercent==null||typeof nav.premiumPercent==='number'&&Number.isFinite(nav.premiumPercent))){
         a.netAssetValue={value:nav.value,date:nav.date,currency:nav.currency,premiumPercent:nav.premiumPercent??null,source:'TWSE e添富'};
         a.navStatus='available';a.navCheckedAt=String(snapshot.fetchedAt||'');if(!updated.includes(a.id))updated.push(a.id);
       }else if(q.navStatus||nav){
         a.navStatus=q.navStatus==='unsupported'?'unsupported':'unavailable';
         if(a.navStatus==='unavailable')errors.push(`${a.symbol}：淨值暫時無法更新，保留上次資料。`);
       }
     }

     if(!q||!positive(q.price)||q.currency!==a.currency||!core.dateOK(q.date)||q.date>today){errors.push(`${a.symbol}：${error?.message||'未取得有效股價與日期'}，保留原價格。`);continue;}
     if(a.quoteDate&&q.date<a.quoteDate){errors.push(`${a.symbol}：來源日期比現有價格舊，保留原價格。`);continue;}
     const at=typeof q.quoteAt==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(q.quoteAt)&&Number.isFinite(Date.parse(q.quoteAt))&&Date.parse(q.quoteAt)<=Date.now()+120000?q.quoteAt:'';
     if(a.quoteMarketAt&&q.date===a.quoteDate&&(!at||Date.parse(at)<Date.parse(a.quoteMarketAt))){errors.push(`${a.symbol}：行情時間較舊，保留最新成交價。`);continue;}
     const fx=a.currency==='TWD'?1:snapshot.fx?.rate;
     if(!positive(fx)||a.currency!=='TWD'&&(!core.dateOK(snapshot.fx?.date)||snapshot.fx.date>today||a.quoteFxDate&&snapshot.fx.date<a.quoteFxDate||current.marketData?.fx&&snapshot.fx.date<current.marketData.fx.date)){errors.push(`${a.symbol}：匯率查詢失敗，股價與匯率皆保留。`);continue;}
     Object.assign(a,{quotePrice:q.price,quoteDate:q.date,quoteFx:fx,quoteSource:String(q.source||''),quoteProviderTime:String(q.providerTime||q.date),quoteCheckedAt:String(snapshot.fetchedAt||''),quoteMode:'auto',quoteFxDate:a.currency==='TWD'?q.date:String(snapshot.fx?.date||''),quoteChange:typeof q.change==='number'&&Number.isFinite(q.change)?q.change:null,quoteChangePercent:typeof q.changePercent==='number'&&Number.isFinite(q.changePercent)?q.changePercent:null,marketInfo:{...a.marketInfo,...marketInfo(q)}});if(!updated.includes(a.id))updated.push(a.id);
     a.quoteMarketAt=at;priceUpdated.push(a.id);
   }
   const m=next.marketData||{},fx=snapshot.fx;
   const fxOK=positive(fx?.rate)&&core.dateOK(fx.date)&&fx.date<=today&&(!m.fx||fx.date>=m.fx.date);
   if(!fxOK)errors.push('匯率暫時無法更新，保留上次資料。');
   const useful=priceUpdated.length>0||fxOK;
   next.marketData={...m,...core.marketPreferences(current),...(fxOK?{fx:{rate:fx.rate,date:fx.date,source:String(fx.source||'Frankfurter 參考匯率')}}:{}),
     lastAttemptAt:new Date().toISOString(),...(useful?{lastSyncAt:new Date().toISOString()}:{}),requested:targets.length,updated:priceUpdated.length,status:!useful?'error':errors.length?'partial':'success'};
   core.validate(next);return {next,updated,priceUpdated,errors,useful};
 }
 root.SalaryMateStockServices={marketInfo,catalog:(query,signal)=>request('/api/stocks/catalog',{query},signal),forecasts:(market,symbol,year,signal)=>request('/api/stocks/dividends',{market,symbol,year,forecast:true},signal),forecastCache,dividendPeriod,dividends:(market,symbol,year,signal)=>request('/api/stocks/dividends',{market,symbol,year},signal),parseSmart,prepareSmart,fetchQuotes,fetchIntraday:assets=>fetchQuotes(assets.filter(a=>a.market==='TW'),'/api/stocks/nav'),applyIntraday,applyQuotes,lookup:(market,symbol,signal)=>request('/api/stocks/lookup',{market,symbol},signal)};
})(globalThis);
