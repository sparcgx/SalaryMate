/* Device-local stock ledger. FIFO lots; no brokerage order API. */
(function (root) {
  'use strict';
  const empty = () => ({ assets: [], transactions: [] });
  const dateOK = x => /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x+'T00:00:00Z')) && new Date(x+'T00:00:00Z').toISOString().slice(0,10) === x;
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const nonnegative = x => finite(x) && x >= 0;
  const positive = x => finite(x) && x > 0;
  const error = message => { throw new Error(message); };
  const clone = x => JSON.parse(JSON.stringify(x));
  const marketPreferences=p=>({autoRefresh:p.marketData?.autoRefresh!==false,quoteEnabled:p.marketData?.quoteEnabled!==false});
  const quoteEligible=a=>['TW','US'].includes(a.market)&&(a.typeOverride||a.marketInfo?.instrumentType)!=='fund'&&
    (a.priceUpdateMode||((a.quoteMode==='manual'&&a.quotePrice!=null)?'manual':'auto'))==='auto';
  function priceFreshness(a,now=Date.now()) {
    if(!quoteEligible(a))return 'manual';
    if(a.quotePrice==null)return 'unknown';
    const checked=Date.parse(a.quoteCheckedAt),at=Date.parse(a.quoteMarketAt);
    if(!Number.isFinite(checked)||checked>now+120000)return 'unknown';
    if(now-checked>86400000)return 'older';
    if(Number.isFinite(at))return at>now+120000?'unknown':now-at>86400000?'older':'recent';
    // A fetch timestamp is not a trade timestamp. Date-only prices are conservative.
    if(dateOK(a.quoteDate)){
      const today=new Date(now+28800000).toISOString().slice(0,10);
      if(a.quoteDate===today)return 'recent';
      if(Date.parse(today)-Date.parse(a.quoteDate)>86400000)return 'older';
    }
    return 'unknown';
  }
  const intradaySources=Object.freeze({
    capital:Object.freeze({name:'群益投信',url:'https://www.capitalfund.com.tw/etf/transaction/networth'}),
    fubon:Object.freeze({name:'富邦投信',url:'https://websys.fsit.com.tw/FubonETF/Trade/Estimate.aspx?area=TA'})
  });
  const intradayOK=(n,currency='TWD')=>!!n&&currency==='TWD'&&n.currency===currency&&positive(n.value)&&
    typeof n.at==='string'&&/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\+08:00$/.test(n.at)&&dateOK(n.at.slice(0,10))&&
    Object.hasOwn(intradaySources,n.provider)&&(n.marketPrice==null||positive(n.marketPrice))&&
    (n.premiumPercent==null||positive(n.marketPrice)&&finite(n.premiumPercent))&&(n.businessDay==null||typeof n.businessDay==='boolean');
  function intradayState(a,now=Date.now()) {
    if(a.intradayNavStatus==='unavailable')return 'unavailable';
    if(a.intradayNavStatus==='unsupported')return 'unsupported';
    const n=a.intradayNav;if(!intradayOK(n,a.currency))return 'missing';
    const local=new Date(now+28800000),today=local.toISOString().slice(0,10),ms=Date.parse(n.at);
    if(n.at.slice(0,10)!==today||ms>now+120000)return 'stale';
    if(n.businessDay===false||[0,6].includes(local.getUTCDay()))return 'nontrading';
    const minute=local.getUTCHours()*60+local.getUTCMinutes();
    if(minute<540)return 'preopen';
    if(minute>=810)return 'closed';
    return now-ms>180000?'stale':'live';
  }
  function validate(p) {
    if (!p || !Array.isArray(p.assets) || !Array.isArray(p.transactions)) error('股票資料格式不正確。');
    if(p.marketData!=null){
      const m=p.marketData;
      if(typeof m!=='object'||Array.isArray(m))error('市場連動設定不正確。');
      for(const k of ['autoRefresh','quoteEnabled'])if(m[k]!=null&&typeof m[k]!=='boolean')error('市場連動設定不正確。');
      if(m.fx!=null&&(!positive(m.fx.rate)||!dateOK(m.fx.date)))error('參考匯率格式不正確。');
      for(const k of ['requested','updated'])if(m[k]!=null&&(!Number.isInteger(m[k])||m[k]<0))error('市場同步筆數不正確。');
      for(const k of ['lastSyncAt','lastAttemptAt'])if(m[k]!=null&&(typeof m[k]!=='string'||!Number.isFinite(Date.parse(m[k]))))error('市場同步時間不正確。');
      if(m.status!=null&&!['success','partial','error'].includes(m.status))error('市場同步狀態不正確。');
    }
    const ids = new Set(), keys = new Set(), txids = new Set(), assetsById = new Map();
    for (const a of p.assets) {
      if (!a || !a.id || ids.has(a.id) || !String(a.symbol || '').trim() || !String(a.name || '').trim()) error('股票代號、名稱或識別碼不正確。');
      if (!['TW','US','OTHER'].includes(a.market) || !['TWD','USD','HKD','JPY','EUR'].includes(a.currency)) error('股票市場或幣別不正確。');
      const key = [a.market,a.symbol.toUpperCase().trim(),String(a.account || '').trim()].join('|');
      if (keys.has(key)) error('同一帳戶已有這個股票代號。');
      if(a.favorite!=null&&typeof a.favorite!=='boolean')error('股票收藏格式不正確。');
      if(a.priceUpdateMode!=null&&!['auto','manual'].includes(a.priceUpdateMode))error('行情更新模式不正確。');
      if(a.quoteMarketAt!=null&&a.quoteMarketAt!==''&&(typeof a.quoteMarketAt!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(a.quoteMarketAt)||!Number.isFinite(Date.parse(a.quoteMarketAt))))error('行情時間格式不正確。');
      for(const key of ['group','industryOverride','exchangeOverride'])if(a[key]!=null&&(typeof a[key]!=='string'||a[key].length>60))error('股票分類內容過長。');
      if(a.typeOverride!=null&&!['','stock','etf','fund','other'].includes(a.typeOverride))error('股票類別不正確。');
      if(a.iconMode!=null&&!['auto','symbol','custom'].includes(a.iconMode))error('股票圖示格式不正確。');
      if(a.iconData!=null&&(typeof a.iconData!=='string'||a.iconData.length>140000||a.iconData!==''&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.iconData)))error('股票圖示必須是有效圖片。');
      if(a.marketInfo!=null&&(typeof a.marketInfo!=='object'||Array.isArray(a.marketInfo)||Object.entries(a.marketInfo).some(([k,v])=>!['exchange','industry','instrumentType','classificationSource'].includes(k)||typeof v!=='string'||v.length>100)))error('股票基本資料格式不正確。');
      if(a.netAssetValue!=null){
        const n=a.netAssetValue;
        if(a.market!=='TW'||!positive(n.value)||!dateOK(n.date)||n.currency!==a.currency||(n.premiumPercent!=null&&!finite(n.premiumPercent))||typeof n.source!=='string'||n.source.length>100)error('ETF 淨值資料格式不正確。');
      }
      if(a.navStatus!=null&&!['available','unavailable','unsupported'].includes(a.navStatus))error('ETF 淨值狀態不正確。');
      if(a.intradayNav!=null&&(a.market!=='TW'||!intradayOK(a.intradayNav,a.currency)))error('ETF 盤中淨值資料格式不正確。');
      if(a.intradayNavStatus!=null&&!['available','unavailable','unsupported'].includes(a.intradayNavStatus))error('ETF 盤中淨值狀態不正確。');
      for(const key of ['quoteChange','quoteChangePercent'])if(a[key]!=null&&!finite(a[key]))error('股票漲跌格式不正確。');
      if (a.quotePrice != null && (!nonnegative(a.quotePrice) || !dateOK(a.quoteDate) || !positive(a.quoteFx) || (a.currency === 'TWD' && a.quoteFx !== 1))) error('請完整填寫股價、價格日期與換算匯率。');
      if(a.dividendForecast!=null){
        const cache=a.dividendForecast;
        if(!Array.isArray(cache.announcements)||cache.announcements.length>200||typeof cache.checkedAt!=='string')error('預計配息公告格式不正確。');
        for(const r of cache.announcements)if(!r||!dateOK(r.exDividendDate)||(r.paymentDate&&(!dateOK(r.paymentDate)||r.paymentDate<r.exDividendDate))||(r.cashDividend!==null&&!nonnegative(r.cashDividend)))error('預計配息公告日期或金額不正確。');
      }
      if(a.dividendPlanOverrides!=null){
        if(typeof a.dividendPlanOverrides!=='object'||Array.isArray(a.dividendPlanOverrides))error('預計配息調整格式不正確。');
        for(const [date,r] of Object.entries(a.dividendPlanOverrides))if(!dateOK(date)||!r||typeof r!=='object'||(r.quantity!=null&&!nonnegative(r.quantity))||(r.cashDividend!=null&&!nonnegative(r.cashDividend))||(r.paymentDate&&(!dateOK(r.paymentDate)||r.paymentDate<date))||(r.excluded!=null&&typeof r.excluded!=='boolean'))error('預計配息調整日期或金額不正確。');
      }
      ids.add(a.id); keys.add(key); assetsById.set(a.id,a);
    }
    for (const t of p.transactions) {
      if (!t || !t.id || txids.has(t.id) || !ids.has(t.assetId) || !dateOK(t.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) error('交易識別碼、股票、日期或時間不正確。');
      if (!['buy','sell','dividend','split','opening'].includes(t.type)) error('不支援的股票交易類型。');
      if (!positive(t.fx) || !nonnegative(t.fee) || !nonnegative(t.tax)) error('匯率必須大於 0，費用與稅額不可為負數。');
      if (assetsById.get(t.assetId).currency === 'TWD' && t.fx !== 1) error('新臺幣匯率必須為 1。');
      if (['buy','sell','opening'].includes(t.type) && (!positive(t.quantity) || !nonnegative(t.price))) error('股數必須大於 0，成交價不可為負數。');
      if (t.type === 'opening' && (t.fee || t.tax)) error('期初持股請直接填寫含費用的平均成本。');
      if (t.type === 'dividend' && (!nonnegative(t.amount) || t.fee + t.tax > t.amount)) error('股息金額不正確，費稅不可超過股息。');
      if (t.type === 'dividend' && t.exDividendDate != null && t.exDividendDate !== '' && (!dateOK(t.exDividendDate) || t.exDividendDate > t.date)) error('除息日期必須是有效日期，且不可晚於入帳日期。');
      if (t.type === 'dividend' && t.cashDividend != null && !nonnegative(t.cashDividend)) error('每股現金股利必須是非負數。');
      if (t.type === 'split' && (!positive(t.ratio) || t.fee || t.tax)) error('分割／合併比例必須大於 0，費用及稅額應為 0。');
      txids.add(t.id);
    }
    calculate(p); // Reject edits/imports that create negative historical positions.
    return p;
  }
  function normalize(p) { return p == null ? empty() : clone(validate(p)); }
  function calculate(p, year, asOf) {
    const positions = new Map(p.assets.map(a => [a.id,{asset:a,lots:[],quantity:0,cost:0,costTwd:0,realized:0,dividends:0,yearRealized:0,yearDividends:0,feesTwd:0,yearFeesTwd:0}]));
    const events = [];
    const ordered = p.transactions.map((t,index)=>({...t,index})).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.index-b.index);
    for (const t of ordered) {
      if (asOf && t.date > asOf) continue;
      const s = positions.get(t.assetId);
      if (!s) error('交易參照不存在的股票。');
      let realized = 0, dividend = 0, cash = 0, costBasis = 0, costBasisTwd = 0;
      const matchedLots = [];
      if (t.type === 'buy' || t.type === 'opening') {
        const basis = t.quantity*t.price+t.fee+t.tax;
        s.lots.push({transactionId:t.id,date:t.date,time:t.time,quantity:t.quantity,cost:basis,costTwd:basis*t.fx});
        s.quantity += t.quantity; s.cost += basis; s.costTwd += basis*t.fx; cash = t.type === 'opening' ? 0 : -basis*t.fx;
      } else if (t.type === 'sell') {
        const tolerance = Math.max(1,s.quantity)*1e-10; // Keep the established import rounding tolerance.
        if (t.quantity > s.quantity+tolerance || s.quantity <= 0) error(`${s.asset.symbol} 在 ${t.date} 的賣出股數超過當時持股。請先補登買入，或調整同日交易時間。`);
        const fullSale = t.quantity >= s.quantity || Math.abs(t.quantity-s.quantity) <= Math.max(1,s.quantity)*Number.EPSILON*16;
        const sold = fullSale ? s.quantity : t.quantity;
        let remaining = sold;
        while ((fullSale || remaining > 0) && s.lots.length) {
          const lot = s.lots[0], quantity = fullSale || remaining >= lot.quantity ? lot.quantity : remaining;
          const fraction = quantity/lot.quantity, cost = lot.cost*fraction, costTwd = lot.costTwd*fraction;
          matchedLots.push({transactionId:lot.transactionId,date:lot.date,time:lot.time,quantity,cost,costTwd});
          costBasis += cost; costBasisTwd += costTwd; remaining -= quantity;
          if (quantity === lot.quantity) s.lots.shift();
          else { lot.quantity -= quantity; lot.cost -= cost; lot.costTwd -= costTwd; }
        }
        cash = (t.quantity*t.price-t.fee-t.tax)*t.fx;
        realized = cash-costBasisTwd;
        s.quantity = s.lots.reduce((n,l)=>n+l.quantity,0);
        s.cost = s.lots.reduce((n,l)=>n+l.cost,0); s.costTwd = s.lots.reduce((n,l)=>n+l.costTwd,0);
      } else if (t.type === 'dividend') {
        dividend = (t.amount-t.fee-t.tax)*t.fx; cash = dividend;
      } else if (t.type === 'split') {
        if (s.quantity <= 0) error(`${s.asset.symbol} 在 ${t.date} 沒有持股，無法登記分割／合併。`);
        s.lots.forEach(l=>{l.quantity *= t.ratio;});
        s.quantity = s.lots.reduce((n,l)=>n+l.quantity,0);
      }
      s.realized += realized; s.dividends += dividend; s.feesTwd += (t.fee+t.tax)*t.fx;
      const inYear = !year || t.date.slice(0,4) === String(year);
      if (inYear) { s.yearRealized += realized; s.yearDividends += dividend; s.yearFeesTwd += (t.fee+t.tax)*t.fx; }
      if (![s.quantity,s.cost,s.costTwd,s.realized,s.dividends,cash].every(Number.isFinite)) error('數值過大，無法安全計算。');
      events.push({...t,asset:s.asset,realized,dividend,cash,balance:s.quantity,inYear,costBasis,costBasisTwd,matchedLots});
    }
    const holdings = [...positions.values()].map(s => {
      const a = s.asset, quoted = a.quotePrice != null && (!asOf || a.quoteDate <= asOf);
      const value = s.quantity === 0 ? 0 : quoted ? s.quantity*a.quotePrice*a.quoteFx : null;
      const unrealized = value == null ? null : value-s.costTwd;
      if (value != null && !Number.isFinite(value)) error('股價或匯率數值過大。');
      return {...s,value,unrealized,average:s.quantity?s.cost/s.quantity:0,returnPct:s.costTwd && unrealized!=null?unrealized/s.costTwd*100:null};
    });
    const missing = holdings.filter(s=>s.quantity>0 && s.value==null).length;
    const sum = key => holdings.reduce((v,s)=>v+(s[key]||0),0);
    return {costMethod:'FIFO',holdings,events,missing,cost:sum('costTwd'),pricedValue:sum('value'),value:missing?null:sum('value'),unrealized:missing?null:sum('unrealized'),realized:sum('realized'),dividends:sum('dividends'),yearRealized:sum('yearRealized'),yearDividends:sum('yearDividends'),yearFees:sum('yearFeesTwd')};
  }
  function dividendForecasts(p,today,includeExcluded=false) {
    const result=[],pending=[],byAsset=new Map();
    for(const t of p.transactions){const rows=byAsset.get(t.assetId)||[];rows.push(t);byAsset.set(t.assetId,rows);}
    for(const a of p.assets){
      if(a.market!=='TW'||a.currency!=='TWD')continue;
      const grouped=new Map(),receivedDates=new Set(),receivedKeys=new Set(),receipts=new Map();let latestOpening='';
      for(const t of byAsset.get(a.id)||[]){
        if(t.type==='opening'&&t.date>latestOpening)latestOpening=t.date;
        if(t.type==='dividend'){
          receivedDates.add(t.exDividendDate);receivedKeys.add(t.dividendPlanKey);
          if(!t.exDividendDate&&!receipts.has(t.date))receipts.set(t.date,t.id);
        }
      }
      for(const row of a.dividendForecast?.announcements||[]){if(row.symbol!==a.symbol||row.market!==a.market||row.currency!==a.currency)continue;const list=grouped.get(row.exDividendDate)||[];list.push(row);grouped.set(row.exDividendDate,list);}
      for(const [exDate,announcements] of grouped){
        const key=a.id+':'+exDate,override=a.dividendPlanOverrides?.[exDate]||{};
        if(override.excluded&&!includeExcluded)continue;
        if(receivedDates.has(exDate)||receivedKeys.has(key))continue;
        const announced=announcements[0],cashValues=[...new Set(announcements.map(r=>r.cashDividend).filter(v=>v!=null))],payValues=[...new Set(announcements.map(r=>r.paymentDate).filter(Boolean))];
        const conflicting=cashValues.length>1||payValues.length>1;
        const prior=new Date(exDate+'T00:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);const cutoff=exDate>today?today:prior.toISOString().slice(0,10);
        const historyUnknown=exDate<=today&&latestOpening>=exDate;
        const cashDividend=override.cashDividend??(cashValues.length===1?cashValues[0]:null),paymentDate=Object.hasOwn(override,'paymentDate')?override.paymentDate:(payValues.length===1?payValues[0]:'');
        pending.push({a,key,exDate,override,announced,conflicting,cutoff,historyUnknown,cashDividend,paymentDate,possibleReceiptId:paymentDate?(receipts.get(paymentDate)||''):''});
      }
    }
    // Replay FIFO once. Each event already records the exact balance after that
    // transaction, including full-sale tolerance and splits; never approximate it.
    const latestCutoff=pending.reduce((day,r)=>!r.historyUnknown&&r.cutoff>day?r.cutoff:day,''),histories=new Map();
    if(latestCutoff)for(const event of calculate(p,undefined,latestCutoff).events){
      const rows=histories.get(event.assetId)||[],last=rows.at(-1);
      if(last?.date===event.date)last.quantity=event.balance;else rows.push({date:event.date,quantity:event.balance});
      histories.set(event.assetId,rows);
    }
    const quantityAt=(id,day)=>{
      const rows=histories.get(id)||[];let lo=0,hi=rows.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].date<=day)lo=mid+1;else hi=mid;}
      return lo?rows[lo-1].quantity:0;
    };
    for(const {a,key,exDate,override,announced,conflicting,cutoff,historyUnknown,cashDividend,paymentDate,possibleReceiptId} of pending){
      const calculated=historyUnknown?null:quantityAt(a.id,cutoff),quantity=override.quantity??calculated;
      if(quantity===0&&override.quantity!==0)continue;
      const gross=quantity!=null&&cashDividend!=null?quantity*cashDividend:null;
      result.push({key,asset:a,exDividendDate:exDate,paymentDate,cashDividend,quantity,amount:Number.isFinite(gross)?gross:null,conflicting,historyUnknown,possibleReceiptId,excluded:!!override.excluded,adjusted:Object.keys(override).some(k=>k!=='excluded'),note:override.note||'',announcement:announced,estimated:exDate>today,canReceive:exDate<=today&&(!paymentDate||paymentDate<=today)});
    }
    return result.sort((a,b)=>(a.paymentDate||a.exDividendDate).localeCompare(b.paymentDate||b.exDividendDate)||a.asset.symbol.localeCompare(b.asset.symbol));
  }
  function prepareBatch(p, rows, today) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 100) error('每批請輸入 1～100 筆交易。');
    if (rows.some(t=>t.date>today)) error('請登記已發生的交易；日期不可晚於今天。');
    const next=clone(p);next.transactions.push(...clone(rows));validate(next);
    const ids=new Set(rows.map(t=>t.id)),before=calculate(p),after=calculate(next);
    const signature=t=>JSON.stringify([t.assetId,t.type,t.date,t.time,t.quantity||0,t.price||0,t.amount||0,t.ratio||1,t.fee,t.tax,t.fx]);
    const seen=new Set(p.transactions.map(signature)),duplicates=[];
    rows.forEach((t,i)=>{const key=signature(t);if(seen.has(key))duplicates.push(i+1);seen.add(key);});
    return {next,events:after.events.filter(t=>ids.has(t.id)),duplicates,realizedChange:after.realized-before.realized,costChange:after.cost-before.cost};
  }
  root.SalaryMateStocks = Object.freeze({empty,normalize,validate,calculate,dateOK,prepareBatch,dividendForecasts,intradaySources,intradayOK,intradayState,marketPreferences,quoteEligible,priceFreshness});
})(globalThis);

// R86: use generic stock/ETF icons until issuer-image permission is recorded.
// User-selected custom images remain in the user's own local data.
globalThis.SalaryMateStockLogos=Object.freeze({});
