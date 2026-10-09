(function(root) {
  'use strict';
  root.SalaryMateStocksUI = {create(api) {
    const core=root.SalaryMateStocks,services=root.SalaryMateStockServices;
    const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const user=x=>root.SalaryMateI18n.user(esc(x));
    const numberFormats=new Map();
    const num=(n,d=2)=>{
      if(!numberFormats.has(d))numberFormats.set(d,new Intl.NumberFormat('zh-TW',{maximumFractionDigits:d}));
      return numberFormats.get(d).format(Number(n));
    };
    const money=n=>n==null?'待更新':`$${num(n)}`;
    const signed=n=>n==null?'—':`${n>0?'+':''}${money(n)}`;
    const tone=n=>n>0?'stock-profit':n<0?'stock-loss':'';
    const types={buy:'買入',sell:'賣出',dividend:'現金股息',split:'分割／合併',opening:'期初持股'};
    const markets={TW:'台股',US:'美股',OTHER:'其他市場'};
    const view={tab:'overview',legacyExpanded:false,search:'',filter:'all',sort:'value',exchange:'',category:'',favorites:false,refreshing:false,quoteResult:null,forecastBusy:false,forecastErrors:[],marketIssue:'',lastMarketAttempt:0,marketExpanded:false};
    const MARKET_INTERVAL=300000;
    let marketTimer,marketController;
    let catalogController,catalogSequence=0,catalogItems=[];
    let lookupTimer,lookupController,lookupSequence=0,importDraft=null,dividendController,dividendSequence=0;
    const p=()=>api.state().stockPortfolio;
    const model=()=>api.model?api.model():core.calculate(p(),api.year(),api.today());
    // DOM replacement must not move the reader back to the first table column.
    function renderKeepingScroll() {
      const before=root.document?.querySelector('.stock-view');
      const tab=before?.dataset?.stockTab;
      const offsets=new Map([...(before?.querySelectorAll?.('.stock-table-wrap')||[])].map(el=>[el.dataset.stockScroll,[el.scrollLeft,el.scrollTop]]));
      api.render();
      const after=root.document?.querySelector('.stock-view');
      if(!tab||after?.dataset?.stockTab!==tab)return;
      for(const el of after.querySelectorAll('.stock-table-wrap')){
        const saved=offsets.get(el.dataset.stockScroll);
        if(saved){el.scrollLeft=saved[0];el.scrollTop=saved[1];}
      }
      root.SalaryMateScrollbars?.refresh();
    }
    const btn=(label,action,id='',primary=false)=>`<button type="button" class="btn ${primary?'btn-primary':''}" data-stock="${action}" data-id="${esc(id)}" ${action==='refresh'&&view.refreshing?'disabled aria-busy="true"':''}>${esc(label)}</button>`;
    const badge=(label,type='')=>`<span class="stock-badge ${type}">${esc(label)}</span>`;
    const classification=a=>({exchange:a.exchangeOverride||a.marketInfo?.exchange||'',industry:a.industryOverride||a.marketInfo?.industry||'',type:a.typeOverride||a.marketInfo?.instrumentType||''});
    const exchangeName=x=>({TWSE:'上市',TPEx:'上櫃'}[x]||x);
    const typeName=x=>({stock:'股票',etf:'ETF',fund:'基金',other:'其他'}[x]||'');
    const icon=a=>{
      const type=classification(a).type, symbol=String(a.symbol||'').trim().toUpperCase();
      const logo=a.iconMode==='symbol'?'':a.iconMode==='custom'?a.iconData:root.SalaryMateStockLogos?.[a.market+':'+symbol];
      const hue=[...String(a.market+':'+symbol)].reduce((n,c)=>(n*31+c.charCodeAt(0))%360,0);
      const glyph=type==='etf'?'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>':type==='fund'?'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>':'<path d="M4 4v16h16M7 14l4-4 4 3 5-7M16 6h4v4"/>';
      const fallback=a.iconMode==='symbol'?`<span>${esc(symbol.slice(0,4))}</span>`:`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
      return `<span class="stock-avatar stock-mini-avatar ${type==='etf'?'is-etf':''}" style="--stock-icon-hue:${hue}" aria-hidden="true">${fallback}${logo?`<img src="${esc(logo)}" alt="" width="32" height="32" data-stock-logo>`:''}</span>`;
    };
    const tags=a=>{const c=classification(a);return `<span class="stock-tags">${c.exchange?badge(exchangeName(c.exchange),'stock-exchange'):badge(markets[a.market])}${c.industry?badge(c.industry):c.type?badge(typeName(c.type)):''}${a.group?`<span class="stock-badge stock-group">${user(a.group)}</span>`:''}</span>`;};
    const favorite=a=>`<button type="button" class="stock-favorite ${a.favorite?'is-favorite':''}" data-stock="favorite" data-id="${esc(a.id)}" aria-pressed="${!!a.favorite}" aria-label="${a.favorite?'取消收藏':'加入收藏'} ${user(a.name)}" title="${a.favorite?'取消收藏':'加入收藏'}"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"/></svg></button>`;
    const assetName=a=>`<button type="button" class="stock-name stock-identity" data-stock="detail" data-id="${esc(a.id)}"><span class="stock-symbol-line">${icon(a)}<strong class="stock-symbol">${user(a.symbol)}</strong></span><span class="stock-name-copy"><span>${user(a.name)}</span></span></button>`;
    const navInfo=(a,withTime=a.quotePrice==null)=>{
      if(a.market!=='TW'||(!a.netAssetValue&&!a.intradayNav&&classification(a).type!=='etf'))return '';
      const n=a.netAssetValue,i=a.intradayNav;
      const estimated=core.intradayOK(i,a.currency)&&(!n||i.at.slice(0,10)>=n.date);
      const value=estimated?i.value:n?.value;
      const currency=estimated?i.currency:n?.currency;
      const at=estimated?i.at.slice(0,19).replace('T',' '):n?.date;
      return `<span class="stock-nav-block" data-stock-nav-id="${esc(a.id)}">${value?`<small class="stock-nav-info"><strong${withTime?'':` title="${estimated?'預估淨值時間':'淨值日期'}：${esc(at)}"`}>${estimated?'最新淨值（預估）':'最新淨值'} ${num(value,4)} ${esc(currency)}</strong>${withTime?`<span>${esc(at)}</span>`:''}</small>`:''}</span>`;
    };
    const quoteMeta=(a,emptyLabel='不會當作 0 元')=>{
      if(a.quotePrice==null)return `<small class="stock-quote-meta">${emptyLabel}</small>`;
      const at=String(a.quoteProviderTime||'').trim()||a.quoteMarketAt||a.quoteDate;
      return `<small class="stock-quote-meta"><span>${esc(a.quoteSource||'手動')}</span><span class="stock-quote-time" aria-label="行情時間">${esc(at)}</span></small>`;
    };
    const dailyChange=a=>`<span class="stock-daily-change ${tone(a.quoteChange)}">${a.quoteChange==null?'漲跌待更新':`${a.quoteChange>0?'+':''}${num(a.quoteChange,4)}${a.quoteChangePercent==null?'':` / ${a.quoteChangePercent>0?'+':''}${num(a.quoteChangePercent,2)}%`}`}</span>`;
    const listPriceFormat=new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:4});
    const listPercentFormat=new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
    function quoteSummary(a,inlineTime=false){
      const quoted=typeof a.quotePrice==='number'&&Number.isFinite(a.quotePrice);
      const source=String(a.quoteSource||'').trim();
      const closed=['TWSE 上市收盤','TPEx 上櫃收盤','TWSE 收盤','TPEx 收盤'].includes(source);
      const label=closed?'收盤':source.includes('最新')||a.quoteMode==='auto'?'最新價':'價格';
      const dated=quoted&&core.dateOK(a.quoteDate);
      const date=dated?`${Number(a.quoteDate.slice(5,7))}/${Number(a.quoteDate.slice(8,10))}`:'—';
      const at=String(a.quoteProviderTime||'').trim()||String(a.quoteMarketAt||a.quoteDate||'');
      const meta=quoted?[a.currency,source||'手動',at].filter(Boolean).join(' · '):'尚無行情';
      // Show the provider's own time beside the holdings price. Do not convert
      // time zones, infer a closing time, or substitute the fetch/check time.
      const readableAt=core.dateOK(at.slice(0,10))?`${Number(at.slice(5,7))}/${Number(at.slice(8,10))}${at.slice(10).replace(/^T/,' ')}`:at;
      const stamp=inlineTime&&quoted
        ? `<span class="stock-quote-date stock-quote-timestamp" title="${esc(at)}">${esc(readableAt||'—')}</span>`
        : dated?`<time class="stock-quote-date" datetime="${esc(a.quoteDate)}" aria-label="${esc(at||a.quoteDate)}">${date}</time>`:'<span class="stock-quote-date">—</span>';
      const percent=quoted&&typeof a.quoteChangePercent==='number'&&Number.isFinite(a.quoteChangePercent)?a.quoteChangePercent:null;
      const change=percent==null?'—':`${percent>0?'+':''}${listPercentFormat.format(Object.is(percent,-0)?0:percent)}%`;
      return `<div class="stock-list-price stock-list-price-summary"><dl class="stock-quote-summary" title="${esc(meta)}"><div><dt>${label}</dt><dd><strong class="stock-quote-value">${quoted?listPriceFormat.format(a.quotePrice):'待更新'}</strong>${stamp}</dd></div><div><dt>漲跌</dt><dd><strong class="stock-quote-value ${tone(percent)}"${percent==null?' aria-label="漲跌待更新"':''}>${change}</strong></dd></div></dl>${navInfo(a)}</div>`;
    }
    const empty=(label,action)=>`<div class="stock-empty"><h3>${label}</h3><p>輸入自己的實際資料，這裡不會預先放入示範持股。</p>${action||btn('新增股票','asset','',true)}</div>`;
    const stat=(label,value,hint='',cls='')=>`<div class="stock-stat"><span>${label}</span><strong class="${cls}">${value}</strong><small>${hint}</small></div>`;
    const table=(heads,rows,variant='')=>`<div class="stock-table-wrap" data-stock-scroll="${esc(variant||heads.join('|'))}" tabindex="0" aria-label="可橫向捲動的股票明細"><table class="stock-table ${variant}"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
    const matches=a=>[a.symbol,a.name,a.account,a.currency,a.group,classification(a).industry].some(x=>String(x||'').toLowerCase().includes(view.search.toLowerCase()));
    const stockMatches=a=>matches(a)&&(!view.exchange||classification(a).exchange===view.exchange)&&(!view.category||[a.group,classification(a).industry,typeName(classification(a).type)].includes(view.category))&&(!view.favorites||a.favorite);
    function classificationFilters(){
      const values=[...new Set(p().assets.flatMap(a=>[a.group,classification(a).industry,typeName(classification(a).type)]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
      const exchanges=[...new Set(p().assets.map(a=>classification(a).exchange).filter(Boolean))].sort();
      return `<label><span class="sr-only">交易所</span><select class="field-select" name="exchange"><option value="">全部市場</option>${exchanges.map(x=>`<option value="${esc(x)}" ${view.exchange===x?'selected':''}>${esc(exchangeName(x))}</option>`).join('')}</select></label><label><span class="sr-only">分類</span><select class="field-select" name="category"><option value="">全部分類</option>${values.map(x=>`<option value="${esc(x)}" ${view.category===x?'selected':''}>${user(x)}</option>`).join('')}</select></label><label class="stock-favorites-filter"><input type="checkbox" name="favorites" ${view.favorites?'checked':''}>只看收藏</label>`;
    }
    function stockList(holdings){
      const rows=holdings.filter(s=>stockMatches(s.asset)).sort((left,right)=>{
        const a=left.asset,b=right.asset;
        return view.sort==='change'?(b.quoteChangePercent??-Infinity)-(a.quoteChangePercent??-Infinity):view.sort==='symbol'?a.symbol.localeCompare(b.symbol):Number(!!b.favorite)-Number(!!a.favorite)||a.symbol.localeCompare(b.symbol);
      });
      return `<section class="stock-panel"><div class="stock-panel-head"><h3>股票清單 <span class="hint">${rows.length} / ${p().assets.length}</span></h3>${btn('找股票','catalog','',true)}</div><form id="stockListForm" class="stock-toolbar stock-list-filters"><label><span class="sr-only">搜尋股票或帳戶</span><input class="field" name="search" type="search" placeholder="代號、名稱或分類" value="${esc(view.search)}"></label>${classificationFilters()}<label><span class="sr-only">排序</span><select class="field-select" name="sort">${[['favorite','收藏優先'],['symbol','股票代號'],['change','漲幅由高到低']].map(([k,v])=>`<option value="${k}" ${view.sort===k?'selected':''}>${v}</option>`).join('')}</select></label><button class="btn" type="submit">篩選</button></form>${rows.length?portfolioTable(rows,{list:true}):''}${!rows.length?`<div class="stock-empty"><p>${p().assets.length?'沒有符合條件的股票':'尚未新增股票'}</p>${btn('新增','asset')}</div>`:''}<p class="stock-footnote">股價依來源日期顯示；紅色上漲、綠色下跌。漲跌為當日行情，不是持股損益。</p></section>`;
    }
    function holdingsTable(holdings,watch=false) {
      let rows=holdings.filter(s=>(watch?s.quantity===0:s.quantity>0)&&stockMatches(s.asset));
      rows.sort((a,b)=>view.sort==='symbol'?a.asset.symbol.localeCompare(b.asset.symbol):view.sort==='profit'?(b.unrealized??-Infinity)-(a.unrealized??-Infinity):(b.value??-1)-(a.value??-1));
      if(!rows.length)return empty(watch?'尚無觀察股票':'沒有符合條件的持股',btn('新增股票','asset')+btn('登記買入','buy','',true));
      return portfolioTable(rows,{watch});
    }
    // Both portfolio views use the same computed rows and column order.
    function portfolioTable(rows,{watch=false,list=false}={}) {
      return table(['股票','分類',watch?'狀態':'股數／剩餘均價','行情','持有成本 TWD','市值 TWD','未實現損益 TWD','帳戶','操作'],rows.map(s=>{
        const a=s.asset;
        return `<tr><td class="stock-asset-cell">${list?`<div class="stock-list-main">${assetName(a)}${favorite(a)}</div>`:assetName(a)}</td><td class="stock-classification-cell">${tags(a)}<small>${markets[a.market]}</small></td><td>${watch?badge('觀察／已出清'):`<strong>${num(s.quantity,6)} 股</strong><small>${num(s.average,4)} ${a.currency}</small>`}</td><td class="stock-quote-cell">${quoteSummary(a,true)}</td><td>${money(s.costTwd)}</td><td>${s.value==null?'待更新股價':money(s.value)}</td><td class="${tone(s.unrealized)}"><strong>${signed(s.unrealized)}</strong><small>${s.returnPct==null?'—':num(s.returnPct)+'%'}</small></td><td class="stock-account-cell">${a.account?user(a.account):'未分帳戶'}</td><td><div class="stock-row-actions">${btn('買入','buy',a.id)}${list?btn('編輯','asset',a.id)+btn('刪除','delete-asset',a.id):s.quantity>0?btn('賣出','sell',a.id):btn('編輯','asset',a.id)}</div></td></tr>`;
      }).join(''),'stock-ledger stock-holdings-table'+(list?' stock-list-table':''));
    }
    function eventTable(events,showActions=true) {
      if(!events.length)return '<div class="stock-empty"><h3>此範圍尚無紀錄</h3><p>可切換年度，或登記一筆交易。</p></div>';
      const hasDividends=events.some(t=>t.type==='dividend'),dividendsOnly=events.every(t=>t.type==='dividend');
      return table([dividendsOnly?'入帳日期／時間':'日期／時間','股票',...(hasDividends?['除息日期','現金股利']:[]),'類型','股數／金額','成交價／匯率','費用＋稅額','現金流 TWD','已實現損益 TWD',...(showActions?['操作']:[])],events.slice().reverse().map(t=>`<tr><td>${esc(t.date)}<small>${esc(t.time)}</small></td><td class="stock-asset-cell">${assetName(t.asset)}<small class="stock-event-note">${(t.asset.account?user(t.asset.account):'未分帳戶')}${t.note?' · '+user(t.note):''}</small></td>${hasDividends?`<td>${t.type==='dividend'&&t.exDividendDate?esc(t.exDividendDate):'—'}</td><td>${t.type==='dividend'&&t.cashDividend!=null?`${num(t.cashDividend,8)} ${t.asset.currency}<small>每股</small>`:'—'}</td>`:''}<td>${badge(types[t.type],`stock-${t.type}`)}</td><td>${t.type==='dividend'?num(t.amount)+' '+t.asset.currency:t.type==='split'?'× '+num(t.ratio,6):num(t.quantity,6)+' 股'}</td><td>${['buy','sell','opening'].includes(t.type)?num(t.price,4)+' '+t.asset.currency:'—'}<small>匯率 ${num(t.fx,6)}</small></td><td>${num(t.fee+t.tax)} ${t.asset.currency}</td><td class="${tone(t.cash)}">${signed(t.cash)}</td><td class="${tone(t.realized)}">${t.type==='sell'?signed(t.realized)+fifoDetail(t):'—'}</td>${showActions?`<td><div class="stock-row-actions">${btn('編輯','transaction',t.id)}${btn('刪除','delete-transaction',t.id)}</div></td>`:''}</tr>`).join(''),'stock-ledger stock-events-table');
    }
    function fifoDetail(t) {
      return `<details class="stock-fifo"><summary>FIFO 成本 ${money(t.costBasisTwd)}</summary><ul>${t.matchedLots.map(l=>`<li>${esc(l.date)} ${esc(l.time)} · ${num(l.quantity,8)} 股 · ${money(l.costTwd)} TWD</li>`).join('')}</ul></details>`;
    }
    function allocation(m) {
      const rows=m.holdings.filter(s=>s.quantity>0&&s.value>0).sort((a,b)=>b.value-a.value);
      return `<aside class="stock-panel stock-allocation"><div class="stock-panel-head"><h3>持股配置</h3><span>TWD 市值</span></div>${rows.length?rows.map(s=>`<div class="stock-allocation-row"><div><span class="stock-allocation-identity">${icon(s.asset)}${user(s.asset.symbol)}</span><strong>${num(s.value/m.pricedValue*100,1)}%</strong></div><div class="stock-bar"><span style="width:${Math.max(0,Math.min(100,s.value/m.pricedValue*100))}%"></span></div><small>${money(s.value)}</small></div>`).join(''):'<p class="hint">登記買入並更新股價後，顯示持股占比。</p>'}${m.missing?'<p class="stock-warning">配置只含已有股價的持股，尚非完整組合。</p>':''}<hr><p class="hint">${api.year()} 年股息</p><strong class="stock-side-number">${money(m.yearDividends)}</strong><p class="hint">費稅後實收 · 不含未實現損益</p>${btn('登記股息','dividend')}${btn('預計配息','forecasts')}</aside>`;
    }
    function analysis(m) {
      const rows=Array.from({length:12},(_,i)=>{
        const es=m.events.filter(t=>t.inYear&&Number(t.date.slice(5,7))===i+1);
        const sum=k=>es.reduce((n,t)=>n+t[k],0),profit=sum('realized'),dividend=sum('dividend');
        return `<tr><th scope="row">${i+1} 月</th><td>${es.filter(t=>t.type==='buy').length}</td><td>${es.filter(t=>t.type==='sell').length}</td><td class="${tone(profit)}">${signed(profit)}</td><td>${money(dividend)}</td><td class="${tone(profit+dividend)}">${signed(profit+dividend)}</td></tr>`;
      }).join('');
      return `<div class="stock-stats">${stat('本年已實現損益',signed(m.yearRealized),'扣除賣出費稅與買入成本',tone(m.yearRealized))}${stat('本年實收股息',money(m.yearDividends),'已扣股息費用與稅額')}${stat('本年投資所得',signed(m.yearRealized+m.yearDividends),'已實現損益＋實收股息',tone(m.yearRealized+m.yearDividends))}${stat('本年記錄費稅',money(m.yearFees),'已計入成本或實收，不再重複扣除')}</div><section class="stock-panel"><div class="stock-panel-head"><h3>${api.year()} 年每月損益</h3><span>單位：TWD</span></div>${table(['月份','買入筆數','賣出筆數','已實現損益','實收股息','合計'],rows)}<p class="stock-footnote">這是記帳損益，不是年化報酬或報稅試算。手動收入未計入此股票交易分析，請見「股息與收入」。</p></section>`;
    }
    let legacySource='';
    const renderLegacy=()=>typeof legacySource==='function'?legacySource():String(legacySource||'');
    function render(legacy) {
      legacySource=legacy;
      if(view.tab!=='income'&&(forecastTimer||forecastController||forecastReady.length))pauseForecasts();
      queueForecasts();
      const m=model(),held=m.holdings.filter(s=>s.quantity>0),legacyTotal=api.legacyTotal(),income=m.yearDividends+legacyTotal;
      const tabs=[['overview','持股總覽'],['stocks','股票清單'],['transactions','交易紀錄'],['income','股息與收入'],['analysis','損益分析'],['watchlist','觀察清單']];
      const top=`<div class="stock-heading page-head"><div><p class="stock-eyebrow">投資工作區 <span>本機記帳 · 跨公司共用</span></p><h2>股票投資</h2><p class="stock-heading-summary"><span>台股・美股・ETF</span><span>${api.year()} 年損益 · 持股累計至今</span></p></div></div><nav class="stock-tabs" aria-label="投資功能">${tabs.map(([id,label])=>`<button type="button" data-stock="tab" data-id="${id}" aria-current="${view.tab===id?'page':'false'}" class="${view.tab===id?'active':''}">${label}</button>`).join('')}</nav>`;
      const help='<details class="stock-method"><summary>資料與計算方式</summary><p>市場資料每 5 分鐘自動查詢，也可立即更新。台股優先採 TWSE 最新成交，未取得成交時使用 TWSE／TPEx 收盤資料；美股採 Nasdaq 最新可用行情，匯率採 Frankfurter 參考值，不保證即時。手動模式與基金保留自行填寫的價格。停用個股連動後僅更新參考匯率；關閉自動更新仍可立即更新。投資頁隱藏、離線或正在編輯時暫停自動查詢。查詢只傳送市場與股票代號，不傳送持股、交易、薪資或帳戶資料。來源失敗、日期較舊或編輯期間收到回應時，保留原資料。</p><p>交易匯率與成本不會被行情更新改寫。新臺幣損益採先進先出（FIFO）；買入費稅加入成本，賣出費稅從收入扣除。資料預設儲存在目前瀏覽器；啟用 Google Drive 備份後，備份會傳至你授權的 Google 帳戶。可於設定匯出一般或加密備份。盤中預估淨值支援群益、富邦投信公布的台幣 ETF，與股價一起查詢，顯示來源時間；預估值獨立保存，不會改寫每日公告或持股市值。</p></details>';
      let body='';
      if(view.tab==='overview'||view.tab==='watchlist') {
        body=`<div class="stock-stats">${stat(m.missing?'已定價持股市值':'持股總市值',money(m.pricedValue),m.missing?`${m.missing} 檔缺少股價；此為部分市值`:`${held.length} 檔持股 · 依各檔價格日期`)}${stat('持有成本',money(m.cost),'含買入費稅 · TWD')}${stat('未實現損益',m.missing?'待補齊股價':signed(m.unrealized),'目前持股估值 − 剩餘成本',tone(m.unrealized))}${stat('本年投資所得',signed(m.yearRealized+m.yearDividends),'已實現損益＋股票實收股息',tone(m.yearRealized+m.yearDividends))}</div><div class="stock-workspace"><section class="stock-panel"><div class="stock-panel-head"><h3>${view.tab==='watchlist'?'觀察／已出清股票':'我的持股'}</h3>${btn('匯出持股','export-holdings')}</div><form id="stockSearchForm" class="stock-toolbar"><label><span class="sr-only">搜尋股票或帳戶</span><input class="field" name="search" type="search" placeholder="代號、名稱或帳戶" value="${esc(view.search)}"></label><label><span class="sr-only">排序</span><select name="sort" class="field-select">${[['value','市值由高到低'],['profit','損益由高到低'],['symbol','股票代號']].map(([v,l])=>`<option value="${v}" ${view.sort===v?'selected':''}>${l}</option>`).join('')}</select></label>${classificationFilters()}<button class="btn" type="submit">篩選</button></form>${holdingsTable(m.holdings,view.tab==='watchlist')}</section>${allocation(m)}</div>`;
      } else if(view.tab==='stocks') {
        body=stockList(m.holdings);
      } else if(view.tab==='transactions') {
        body=`<section class="stock-panel"><div class="stock-panel-head"><h3>${api.year()} 年交易</h3>${btn('匯出交易','export-transactions')}</div><form id="stockSearchForm" class="stock-toolbar"><label><span class="sr-only">搜尋股票或帳戶</span><input name="search" class="field" type="search" placeholder="代號、名稱或帳戶" value="${esc(view.search)}"></label><label><span class="sr-only">交易類型</span><select class="field-select" name="filter">${Object.entries({all:'全部交易',...types}).map(([v,l])=>`<option value="${v}" ${view.filter===v?'selected':''}>${l}</option>`).join('')}</select></label><button class="btn" type="submit">篩選</button>${btn('分割／合併','split')}</form>${eventTable(m.events.filter(t=>t.inYear&&matches(t.asset)&&(view.filter==='all'||view.filter===t.type)))}</section>`;
      } else if(view.tab==='income') {
        body=`<div class="stock-stats">${stat('本年實收股息',money(m.yearDividends),'股票交易簿中的股息')}${stat('本年其他收入',money(legacyTotal),'保留原投資收入紀錄')}${stat('年度收入合計',money(income),'股息＋原投資收入，不含買賣損益')}</div>${forecastSection()}<section class="stock-panel"><div class="stock-panel-head"><h3>${api.year()} 年股票股息</h3>${btn('登記股息','dividend','',true)}</div>${eventTable(m.events.filter(t=>t.inYear&&t.type==='dividend'))}</section><section class="stock-legacy"><p class="stock-footnote">原有收入仍保留在下方，不會自動轉成持股。已在股票交易簿登記的股息／損益，請勿再次手動新增。</p>${renderLegacy()}</section>`;
      } else body=analysis(m);
      // The compact income shortcut preserves the original ledger's one-click entry point.
      const legacyAccess=view.tab==='income'?'':`<details class="stock-legacy-shortcut"${view.legacyExpanded?' open':''}><summary>其他投資收入 · ${api.year()} 年 $${num(legacyTotal)}</summary><div data-stock-legacy data-loaded="${view.legacyExpanded}">${view.legacyExpanded?renderLegacy():''}</div></details>`;
      const imports=p().smartImports?.length?`<div class="stock-import-access">${btn('查看 SmartPortfolio 匯入紀錄','archives')}<span class="hint">${p().smartImports.length} 份備份 · 原始資料保留</span></div>`:'';
      const importedCaveat=p().smartImports?.some(i=>i.mode==='snapshot'||i.conversionEstimated)?`<p class="stock-warning">${p().smartImports.some(i=>i.mode==='snapshot')?'部分舊買賣僅留存，以下損益只含本版已計入的帳務紀錄。':''}${p().smartImports.some(i=>i.conversionEstimated)?'部分新臺幣成本／損益採匯入匯率估計，請核對原交易匯率。':''}</p>`:'';
      queueMarket();
      return `<section class="view stock-view" data-stock-tab="${esc(view.tab)}">${top}${marketCard()}${importedCaveat}${body}${imports}${legacyAccess}${help}</section>`;
    }
    const field=(label,name,value='',attrs='',hint='')=>`<label><span class="field-label">${label}</span><input class="field" name="${esc(name)}" value="${esc(value)}" ${attrs}>${hint?`<span class="hint">${hint}</span>`:''}</label>`;
    const select=(label,name,value,options)=>`<label><span class="field-label">${label}</span><select class="field-select" name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
    const footer=(label='儲存')=>`<div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">${label}</button></div>`;
    function openForm(kind,id,title,html,wide=false) {
      api.begin({entityType:'stock-'+kind,entityId:id,companyId:'',operational:false});
      api.open(title,`<form id="stockForm" data-kind="${kind}" data-id="${esc(id)}">${html}${footer()}</form>`,wide);
    }
    function openAsset(id='',preset=null) {
      catalogController?.abort();catalogSequence++;
      const a=p().assets.find(a=>a.id===id)||{symbol:'',name:'',market:'TW',currency:'TWD',account:'',note:'',...preset};
      const used=p().transactions.some(t=>t.assetId===id);
      openForm('asset',id,id?'編輯股票':'新增股票',`<div class="form-grid">${select('市場','market',a.market,Object.entries(markets))}${select('交易幣別','currency',a.currency,['TWD','USD','HKD','JPY','EUR'].map(x=>[x,x]))}${field('股票代號 *','symbol',a.symbol,'required maxlength="24" placeholder="例如：2330、0050、AAPL"')}${field('股票／ETF 名稱 *','name',a.name,'required maxlength="80"')}<div class="span-2 stock-lookup-row">${btn('查詢名稱','lookup')}<span id="stockLookupStatus" role="status">輸入代號後自動查詢，也可手動填寫名稱。</span></div>${field('券商／帳戶（選填）','account',a.account,'maxlength="60" placeholder="例如：證券帳戶 A"')}${field('備註','note',a.note,'maxlength="200"')}</div><p class="stock-footnote">${used?'已有交易的股票不可更換幣別；不同帳戶可分開建立同一股票。':'建立後可先放入觀察清單，再登記買入；股數以「股」為單位，支援零股與小數股。'}</p>`);
      const form=document.querySelector('#stockForm');form._marketInfo=a.marketInfo||{};form._lookupQuote=preset?.lookupQuote||null;form._iconData=a.iconData||'';
      form.querySelector('.form-grid').insertAdjacentHTML('beforeend',`${select('行情更新模式','priceUpdateMode',core.quoteEligible(a)?'auto':'manual',[['auto','每 5 分鐘自動取得最新行情'],['manual','手動維護價格／淨值']])}${select('類別','typeOverride',a.typeOverride||'',[['','自動'],['stock','股票'],['etf','ETF'],['fund','基金'],['other','其他']])}${select('交易所','exchangeOverride',a.exchangeOverride||'',[['','自動'],...['TWSE','TPEx','NASDAQ','NYSE','AMEX'].map(x=>[x,exchangeName(x)]),...(a.exchangeOverride&&!['TWSE','TPEx','NASDAQ','NYSE','AMEX'].includes(a.exchangeOverride)?[[a.exchangeOverride,a.exchangeOverride]]:[])])}${field('產業分類','industryOverride',a.industryOverride||'','maxlength="60" placeholder="留空使用官方分類"')}${field('自訂分類','group',a.group||'','maxlength="60" list="stockGroupNames" placeholder="例如：長期投資、高股息"')}<datalist id="stockGroupNames">${[...new Set(p().assets.map(x=>x.group).filter(Boolean))].map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist><div class="span-2 stock-classification-info" id="stockClassificationInfo"></div><label class="stock-favorites-filter"><input type="checkbox" name="favorite" ${a.favorite?'checked':''}>加入收藏</label>${select('股票圖示','iconMode',a.iconMode||'auto',[['auto','通用圖示'],['symbol','代號圖示'],['custom','自訂圖片']])}<p class="hint span-2">請使用你有權使用的圖片；自訂圖示隨個人備份保存。</p><div class="span-2 stock-icon-editor"><span id="stockIconPreview">${icon(a)}</span><label class="btn stock-upload-label">上傳圖示<input type="file" id="stockIconFile" accept="image/png,image/jpeg,image/webp"></label>${btn('移除圖片','clear-icon')}<small>PNG、JPG、WebP，最多 2 MB；儲存在個人備份。</small><span id="stockIconStatus" role="status"></span></div>`);
      if(!id)form.insertAdjacentHTML('afterbegin',`<div class="stock-asset-find">${btn('搜尋台股／ETF','catalog')}</div>`);
      showClassification(form);
    }
    function showClassification(form){
      const info=form._marketInfo||{},box=form.querySelector('#stockClassificationInfo');
      if(box)box.textContent=[exchangeName(info.exchange),info.industry||typeName(info.instrumentType),info.classificationSource].filter(Boolean).join(' · ')||'輸入代號查詢官方分類，也可自行設定。';
      root.SalaryMateI18n.apply(form);
    }
    function iconPreview(form){form.querySelector('#stockIconPreview').innerHTML=icon({market:form.elements.market.value,symbol:form.elements.symbol.value.trim().toUpperCase(),iconMode:form.elements.iconMode.value,iconData:form._iconData,typeOverride:form.elements.typeOverride.value,marketInfo:form._marketInfo});}
    async function readIcon(file,form){
      if(!file||!form)return;const status=form.querySelector('#stockIconStatus'),seq=(form._iconSequence||0)+1;form._iconSequence=seq;
      try{
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('請選擇 2 MB 以內的 PNG、JPG 或 WebP 圖片。');
        status.textContent='正在處理圖片…';
        const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('圖片無法讀取。'));r.readAsDataURL(file);});
        const img=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('圖片無法讀取。'));img.src=data;});
        const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d'),scale=Math.min(96/img.width,96/img.height);ctx.drawImage(img,(96-img.width*scale)/2,(96-img.height*scale)/2,img.width*scale,img.height*scale);
        if(!form.isConnected||form._iconSequence!==seq)return;
        form._iconData=canvas.toDataURL('image/png');form.elements.iconMode.value='custom';iconPreview(form);status.textContent='圖示已就緒，儲存股票後生效。';
      }catch(e){if(form.isConnected&&form._iconSequence===seq)status.textContent=e.message;}
    }
    function openCatalog(){
      catalogController?.abort();catalogSequence++;catalogItems=[];
      api.open('找股票',`<form id="stockCatalogForm" class="stock-catalog-search"><label><span class="sr-only">股票代號、名稱或產業</span><input name="query" type="search" class="field" maxlength="80" placeholder="輸入台股代號、名稱或產業"></label><button class="btn btn-primary" type="submit">搜尋</button>${btn('手動新增','asset')}</form><p class="hint">上市、上櫃與 ETF，依最近收盤成交量排序。加入清單後可登記買入。</p><div id="stockCatalogResults" aria-live="polite"></div>`,true);
      void searchCatalog('');
    }
    async function searchCatalog(query){
      catalogController?.abort();catalogController=new AbortController();const seq=++catalogSequence,box=document.querySelector('#stockCatalogResults');if(!box)return;box.innerHTML='<p class="stock-empty">正在取得官方股票清單…</p>';
      try{
        const data=await services.catalog(query,catalogController.signal);if(seq!==catalogSequence||!box.isConnected)return;catalogItems=data.quotes;
        box.innerHTML=`${data.errors?.length?`<p class="stock-warning">${data.errors.map(x=>esc(x.message)).join(' ')}</p>`:''}<p class="hint">${data.total} 筆結果 · 顯示前 ${data.quotes.length} 筆</p><ul class="stock-compact-list stock-catalog-list">${data.quotes.map((q,i)=>{const a={...q,marketInfo:services.marketInfo(q)},exists=p().assets.some(a=>a.market===q.market&&a.symbol===q.symbol);return `<li><div class="stock-catalog-identity">${icon(a)}<div><strong>${user(q.name)}</strong><small>${user(q.symbol)}</small>${tags(a)}</div></div><div class="stock-list-price"><strong class="${tone(q.change)}">${q.price==null?'待更新':num(q.price,4)}</strong>${dailyChange({quoteChange:q.change,quoteChangePercent:q.changePercent})}<small>${esc(q.date)}</small></div>${exists?'<span class="stock-badge">已加入</span>':btn('加入','catalog-add',String(i))}</li>`;}).join('')}</ul>${!data.quotes.length?'<p class="stock-empty">找不到符合條件的股票，請換關鍵字或手動新增。</p>':''}`;root.SalaryMateI18n.apply(box);
      }catch(e){if(seq===catalogSequence&&box.isConnected){box.innerHTML=`<p class="stock-warning">${esc(e.message)}</p>${btn('重試','catalog')}`;root.SalaryMateI18n.apply(box);}}
    }
    function openTransaction(id='',type='buy',assetId='',preset=null) {
      if(!p().assets.length){api.toast('請先新增一檔股票，再登記交易。');openAsset();return;}
      const old=p().transactions.find(t=>t.id===id);
      const a=p().assets.find(a=>a.id===(old?.assetId||assetId))||p().assets[0];
      const t=old||{assetId:a.id,type,date:api.today(),time:'12:00',quantity:1,price:'',amount:'',ratio:1,fee:0,tax:0,fx:a.currency==='TWD'?1:(a.quoteFx||''),note:'',...preset};
      openForm('transaction',id,id?'編輯股票紀錄':`登記${types[type]}`,`<div class="form-grid stock-transaction-grid">${select('交易類型','type',t.type,Object.entries(types))}${select('股票／帳戶','assetId',t.assetId,p().assets.map(a=>[a.id,root.SalaryMateI18n.user(`${a.symbol} ${a.name} · ${a.currency}${a.account?' · '+a.account:''}`)]))}<label><span class="field-label" data-transaction-date-label>${t.type==='dividend'?'入帳日期 *':'日期 *'}</span><input class="field" name="date" value="${esc(t.date)}" type="date" required max="${api.today()}"></label>${field('時間（同日排序）','time',t.time,'type="time" required')}<div class="stock-trade-fields span-2" data-fields="trade">${field('股數 *','quantity',t.quantity??1,'type="number" step="any" min="0.00000001" required')}${field('每股成交價 *','price',t.price??'','type="number" step="any" min="0" required')}</div><div class="stock-trade-fields span-2" data-fields="dividend"><section class="stock-announcement span-2" aria-label="官方配息公告"><div class="stock-announcement-heading"><strong>官方配息公告</strong>${btn('查詢官方公告','lookup-dividends')}</div><label class="stock-auto-dividend"><input type="checkbox" name="autoDividend" checked>自動帶入官方配息</label><p id="stockDividendStatus" class="hint" role="status">依入帳日期自動匹配最近一期公告；可切換期別。</p><div id="stockDividendChoices" hidden><label><span class="field-label">選擇配息期別</span><select class="field-select" id="stockDividendPeriod"></select></label>${btn('帶入公告值','apply-dividend')}</div><p id="stockDividendSource" class="hint"></p></section>${field('除息日期','exDividendDate',t.exDividendDate||'',`type="date" max="${t.date}"`)}${field('現金股利（每股）','cashDividend',t.cashDividend??'','type="number" step="any" min="0"','以股票交易幣別填寫，未提供可留空。')}${field('股息總額（扣費稅前） *','amount',t.amount??'','type="number" step="any" min="0" required','依實際配息明細填寫總額，實收會再扣除費用與稅額。')}</div><div class="span-2" data-fields="split">${field('新股數 ÷ 舊股數 *','ratio',t.ratio??1,'type="number" step="any" min="0.00000001" required','例如：1 股變 2 股填 2；2 股併 1 股填 0.5。')}</div>${field('手續費（交易幣別）','fee',t.fee,'type="number" step="any" min="0" required')}${field('稅額／扣繳（交易幣別）','tax',t.tax,'type="number" step="any" min="0" required')}${field('匯率：1 交易幣別 = 多少 TWD *','fx',t.fx,'type="number" step="any" min="0.00000001" required','請填實際交易匯率；TWD 固定為 1。')}${field('備註','note',t.note,'maxlength="200"')}</div><output class="stock-form-preview" id="stockTradePreview" aria-live="polite"></output><p class="stock-footnote">費率不會自動套用，請依成交或入帳明細填寫。賣出會按先進先出（FIFO）計算損益。</p>`,true);
      const form=document.querySelector('#stockForm');form._dividendAnnouncement=old?.dividendAnnouncement||preset?.dividendAnnouncement||null;form._dividendPlan=preset?.dividendPlanKey?{key:preset.dividendPlanKey,assetId:a.id,exDividendDate:preset.exDividendDate}:null;form.elements.autoDividend.checked=!preset&&(!old||!!old.dividendAnnouncement||(!old.exDividendDate&&old.cashDividend==null));
      updateTradeForm(false);
      if(t.type==='dividend')void loadDividends();
    }
    function updateTradeForm(changedAsset=false) {
      const form=document.querySelector('#stockForm[data-kind="transaction"]');if(!form)return;
      const f=form.elements, type=f.type.value,a=p().assets.find(a=>a.id===f.assetId.value);
      form.querySelector('[data-transaction-date-label]').textContent=type==='dividend'?'入帳日期 *':'日期 *';
      f.exDividendDate.max=f.date.value||api.today();
      if(!form.dataset.id){document.querySelector('#dialogTitle').textContent=`登記${types[type]}`;root.SalaryMateI18n.apply(document.querySelector('#dialogTitle'));}
      for(const box of form.querySelectorAll('[data-fields]')){const visible=box.dataset.fields===(['buy','sell','opening'].includes(type)?'trade':type);box.hidden=!visible;box.querySelectorAll('input').forEach(x=>x.disabled=!visible);}
      for(const k of ['fee','tax']){f[k].disabled=['split','opening'].includes(type);}
      if(a.currency==='TWD')f.fx.value='1';else if(changedAsset)f.fx.value=a.quoteFx||'';
      f.fx.readOnly=a.currency==='TWD';
      const gross=type==='dividend'?Number(f.amount.value):Number(f.quantity.value)*Number(f.price.value);
      const fee=type==='opening'?0:Number(f.fee.value)+Number(f.tax.value),fx=Number(f.fx.value);
      const net=(type==='buy'?gross+fee:gross-fee)*fx;
      const s=model().holdings.find(s=>s.asset.id===a.id);
      const valid=fx>0&&Number.isFinite(net)&&(type==='dividend'?f.amount.value!=='':f.price.value!=='');
      document.querySelector('#stockTradePreview').textContent=type==='split'?`目前持有 ${num(s.quantity,6)} 股；總成本保持不變。`:`${root.SalaryMateI18n.user(a.symbol)} · ${a.currency} · 目前 ${num(s.quantity,6)} 股 ｜ ${type==='opening'?'期初成本（非現金支出）':type==='buy'?'支出':'實收'} ${valid?money(net)+' TWD':'待填金額與匯率'}`;
      root.SalaryMateI18n.apply(form);
    }
    const forecastAssets=()=>{
      const portfolio=p(),purchased=new Set();
      for(const t of portfolio.transactions)if(t.type==='buy'||t.type==='opening')purchased.add(t.assetId);
      return portfolio.assets.filter(a=>a.market==='TW'&&a.currency==='TWD'&&(purchased.has(a.id)||a.dividendForecast?.announcements?.length));
    };
    const forecastRows=(includeExcluded=false)=>core.dividendForecasts(p(),api.today(),includeExcluded);
    const forecastRow=key=>forecastRows(true).find(r=>r.key===key);
    const onInvestment=()=>!!root.document?.querySelector('.stock-view');
    const marketBlocked=()=>!onInvestment()||root.document.hidden||root.document.querySelector('#appDialog')?.open||
      !!(root.document.activeElement?.matches?.('input, select, textarea')&&root.document.activeElement.closest?.('.stock-toolbar, #stockForm, #stockBatchForm'))||root.navigator?.onLine===false;
    function marketCard(){
      const m=p().marketData||{},prefs=core.marketPreferences(p()),fx=m.fx;
      const status=view.refreshing?'syncing':view.marketIssue?'error':m.status||'idle';
      const label={syncing:'正在同步…',success:'資料已同步',partial:'部分資料已更新',error:'更新未完成',idle:'等待首次同步'}[status];
      const fxAge=fx?Date.now()-Date.parse(fx.date):NaN;
      const fxLabel=!fx?'匯率尚未更新':fxAge>3*86400000?'匯率參考日較舊':'匯率參考日近期';
      const fresh={recent:0,older:0,unknown:0,manual:0};
      for(const row of model().holdings.filter(s=>s.quantity>0))fresh[core.priceFreshness(row.asset)]++;
      const last=m.lastSyncAt?new Date(m.lastSyncAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'';
      const sync=view.quoteResult?`<div class="stock-sync-result"><strong>${esc(view.quoteResult.title)}</strong>${view.quoteResult.errors.length?`<details><summary>查看未更新項目（${view.quoteResult.errors.length}）</summary><ul>${view.quoteResult.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}</div>`:'';
      return `<section class="stock-panel stock-market-card" data-market-card aria-label="市場資料連動">
        <div class="stock-market-actions"><button type="button" class="btn btn-small" data-stock="toggle-market-details" aria-expanded="${view.marketExpanded}" aria-controls="stockMarketDetails" aria-label="${view.marketExpanded?'收合市場資訊':'展開市場資訊'}" aria-describedby="stockMarketStatus" title="${label}"><span class="stock-market-dot" data-sync-state="${status}" aria-hidden="true"></span><span data-market-details-label>${view.marketExpanded?'收合':'展開'}</span></button><button type="button" class="btn btn-small" data-stock="toggle-market-quotes" aria-pressed="${prefs.quoteEnabled}" aria-label="個股連動" title="${prefs.quoteEnabled?'停用個股連動':'啟用個股連動'}">${prefs.quoteEnabled?'連動：開':'連動：關'}</button><button type="button" class="btn btn-small stock-market-auto" data-stock="toggle-market-auto" aria-pressed="${prefs.autoRefresh}" aria-label="每 5 分鐘自動更新" title="${prefs.autoRefresh?(prefs.quoteEnabled?'每 5 分鐘自動更新':'匯率每 5 分鐘更新'):'自動更新已暫停'}">${prefs.autoRefresh?'自動：開':'自動：關'}</button>${btn(view.refreshing?'更新中…':'更新','refresh','',true)}<button type="button" class="btn btn-small" data-stock="quotes" aria-label="手動價格／淨值" title="手動價格／淨值">手動</button><div class="stock-action-menu-wrap"><button type="button" class="btn stock-action-toggle" data-stock="toggle-actions" aria-expanded="false" aria-controls="stockHeadActions">選項</button><div id="stockHeadActions" class="stock-head-actions">${btn('新增','asset')}${btn('交易','buy')}${btn('批次','batch')}</div></div></div>
        <span id="stockMarketStatus" class="sr-only" role="status">${label}</span>
        <div id="stockMarketDetails" class="stock-market-copy" ${view.marketExpanded?'':'hidden'}><div class="stock-market-title"><h3>市場資料連動</h3><span class="stock-badge">${label}</span><strong class="stock-market-fx">USD/TWD ${fx?num(fx.rate,3):'—'}</strong><span class="stock-badge">${fxLabel}</span></div>
        <p>台股：TWSE 最新成交／TWSE、TPEx 收盤 · 美股：Nasdaq 最新可用行情 · 基金：手動維護公布淨值</p>
        <p class="stock-market-time">${last?`<span>上次同步</span> ${esc(last)} <span>台北時間</span>`:'尚未完成首次同步'}${fx?` · <span>匯率基準</span> ${esc(fx.date)}`:''}${m.requested?` · ${m.updated||0}/${m.requested} <span>檔已更新</span>`:''}</p>
        ${Object.values(fresh).some(Boolean)?`<p class="stock-market-freshness"><span>持股估值採用已保存價格：</span><span>${fresh.recent} <span>檔近期</span></span> · <span>${fresh.older} <span>檔逾 24 小時</span></span> · <span>${fresh.unknown} <span>檔時間待確認</span></span> · <span>${fresh.manual} <span>檔手動</span></span></p>`:''}
        ${view.marketIssue?`<p class="stock-warning">${esc(view.marketIssue)}</p>`:status==='error'?'<p class="stock-warning">更新失敗，已保留上次匯率與價格。</p>':status==='partial'?'<p class="stock-warning">部分來源未更新，保留各檔上次成功資料。</p>':''}${sync}</div>
      </section>`;
    }
    function toggleMarketDetails(el){
      const card=el.closest('[data-market-card]'),details=card?.querySelector('#stockMarketDetails');
      if(!details)return;
      view.marketExpanded=!view.marketExpanded;
      details.hidden=!view.marketExpanded;
      el.setAttribute('aria-expanded',String(view.marketExpanded));
      el.setAttribute('aria-label',view.marketExpanded?'收合市場資訊':'展開市場資訊');
      el.querySelector('[data-market-details-label]').textContent=view.marketExpanded?'收合':'展開';
      root.SalaryMateI18n.apply(card);
    }
    function marketDisplay(){
      const card=root.document.querySelector('[data-market-card]');if(card){card.outerHTML=marketCard();root.SalaryMateI18n.apply?.(root.document.querySelector('[data-market-card]'));}
    }
    function queueMarket(delay){
      if(marketTimer||view.refreshing||!core.marketPreferences(p()).autoRefresh||typeof root.fetch!=='function'||!root.document||root.document.hidden)return;
      const last=Math.max(view.lastMarketAttempt,Date.parse(p().marketData?.lastAttemptAt)||0);
      marketTimer=setTimeout(()=>{
        marketTimer=null;if(!onInvestment())return;
        if(marketBlocked()||view.forecastBusy){queueMarket(15000);return;}
        void refreshQuotes(false);
      },delay??Math.max(1500,MARKET_INTERVAL-(Date.now()-Math.min(last,Date.now()))));
    }
    function toggleMarket(key){
      const enabled=!core.marketPreferences(p())[key];
      if(api.commit(()=>{p().marketData={...p().marketData,[key]:enabled};},'市場連動設定未儲存，請再試一次。',api.id('market-preference'),false)){
        marketController?.abort();clearTimeout(marketTimer);marketTimer=null;view.marketIssue='';view.quoteResult=null;
        if(enabled)view.lastMarketAttempt=0;
        renderKeepingScroll();
      }
    }
    let forecastTimer,forecastController,forecastSequence=0,forecastReady=[];
    const forecastInactive=()=>view.tab!=='income'||!onInvestment()||root.document.hidden||root.navigator?.onLine===false;
    function pauseForecasts() {
      if(view.forecastBusy||forecastReady.length||forecastTimer){view.forecastAttempt=0;view.forecastAttemptKey='';}
      clearTimeout(forecastTimer);forecastTimer=null;
      forecastSequence++;forecastController?.abort();forecastController=null;
      view.forecastBusy=false;forecastReady=[];
    }
    function forecastSection() {
      const rows=forecastRows(),known=rows.filter(r=>r.amount!=null),unknown=rows.length-known.length,total=known.reduce((sum,r)=>sum+r.amount,0);
      const removed=p().assets.some(a=>Object.values(a.dividendPlanOverrides||{}).some(r=>r.excluded));
      return `<section class="stock-panel stock-forecast-panel"><div class="stock-panel-head"><h3>台股／ETF 預計配息</h3><div class="stock-row-actions"><button type="button" class="btn" data-stock="refresh-forecasts" ${view.forecastBusy?'disabled aria-busy="true"':''}>${view.forecastBusy?'配息更新中…':'更新預計配息'}</button>${removed?btn('恢復已刪除項目','restore-forecasts'):''}</div></div><div class="stock-forecast-summary"><span>依官方公告自動加入 · 尚未計入收入</span><strong>${unknown?'已知預計金額':'預計配息合計'} ${money(total)} TWD${unknown?' · '+unknown+' 筆待確認':''}</strong></div>${rows.length?table(['股票／帳戶','除息日期','預計發放日','現金股利／股','計息股數','預計金額（費稅前）','公告／狀態','操作'],rows.map(r=>`<tr><td class="stock-asset-cell">${assetName(r.asset)}<small>${user(r.asset.account||'')}</small></td><td>${esc(r.exDividendDate)}</td><td>${r.paymentDate?esc(r.paymentDate):'待公告'}</td><td>${r.cashDividend==null?'待公告':num(r.cashDividend,8)+' TWD'}</td><td>${r.quantity==null?'待補持股資料':num(r.quantity,8)}<small>${r.estimated?'依目前持股暫估':'依除息前持股'}</small></td><td><strong>${r.amount==null?'待確認':money(r.amount)}</strong></td><td>${sourceLink(r.announcement)}<small>${r.possibleReceiptId?'可能已有入帳紀錄':r.adjusted?'已手動調整':r.conflicting?'公告有差異，請核對':r.canReceive?'待確認入帳':'預計配息'} · ${esc(String(r.announcement.checkedAt||'').slice(0,10))}</small>${r.note?`<small>${user(r.note)}</small>`:''}</td><td><div class="stock-row-actions">${btn('編輯','edit-forecast',r.key)}${btn('刪除','delete-forecast',r.key)}${r.possibleReceiptId?btn('核對原紀錄','transaction',r.possibleReceiptId):''}<button type="button" class="btn" data-stock="receive-forecast" data-id="${esc(r.key)}" ${r.canReceive&&!r.possibleReceiptId?'':'disabled'}>登記入帳</button></div></td></tr>`).join('')):'<p class="stock-forecast-note hint">目前沒有待領配息；有持股與官方公告時會自動加入。</p>'}${view.forecastErrors.length?`<details class="stock-forecast-errors"><summary>部分公告尚未更新</summary><ul>${view.forecastErrors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></details>`:''}<p class="stock-forecast-note hint">未除息以目前股數暫估，已除息依除息前持股估算；實際金額仍以入帳明細為準。未公布的日期或金額不會推估。刪除後不會被自動加回。</p></section>`;
    }
    function queueForecasts() {
      if(view.tab!=='income'||typeof root.fetch!=='function'||view.forecastBusy||root.document?.hidden||root.navigator?.onLine===false||root.document?.querySelector('#appDialog')?.open)return;
      clearTimeout(forecastTimer);forecastTimer=setTimeout(()=>{
        forecastTimer=null;
        if(forecastInactive()||marketBlocked())return;
        if(forecastReady.length){flushForecasts();return;}
        const key=forecastAssets().map(a=>a.id+':'+a.symbol).join('|');
        if(key!==view.forecastAttemptKey||Date.now()-(view.forecastAttempt||0)>300000)void refreshForecasts(false);
      },150);
    }
    function flushForecasts() {
      if(!forecastReady.length||forecastInactive()||root.document.querySelector('#appDialog')?.open)return;
      const ready=forecastReady;forecastReady=[];
      const updates=ready.filter(r=>p().assets.some(a=>a.id===r.id&&a.market===r.market&&a.symbol===r.symbol&&a.currency===r.currency));
      if(updates.length){
        const next=JSON.parse(JSON.stringify(p()));
        for(const r of updates){const a=next.assets.find(a=>a.id===r.id);a.dividendForecast=services.forecastCache(a.dividendForecast,r.data,api.today());}
        try{core.validate(next);if(!api.commit(()=>{api.state().stockPortfolio=next;},'預計配息未儲存，原資料保持不變。',api.id('forecast-sync'),false))view.forecastErrors.push('預計配息未儲存，請重新更新。');}catch(e){view.forecastErrors.push(e.message);}
      }
      if(onInvestment())renderKeepingScroll();
    }
    async function refreshForecasts(force=true) {
      if(force&&root.navigator?.onLine===false){api.toast('目前離線，保留上次配息公告。');return;}
      if(view.forecastBusy||forecastInactive()||marketBlocked())return;
      const eligible=forecastAssets(),assets=eligible.filter(a=>force||!a.dividendForecast||Date.now()-Date.parse(a.dividendForecast.checkedAt)>21600000||!Number.isFinite(Date.parse(a.dividendForecast.checkedAt)));
      if(!assets.length){if(force)api.toast('目前沒有需要查詢的台股／ETF 持股。');return;}
      const bySymbol=new Map();
      for(const a of assets){if(!bySymbol.has(a.symbol))bySymbol.set(a.symbol,{symbol:a.symbol,assets:[]});bySymbol.get(a.symbol).assets.push(a);}
      const grouped=[...bySymbol.values()];
      const controller=new AbortController(),sequence=++forecastSequence;
      forecastController=controller;
      const current=()=>sequence===forecastSequence&&!controller.signal.aborted&&!forecastInactive();
      view.forecastBusy=true;view.forecastAttempt=Date.now();view.forecastAttemptKey=eligible.map(a=>a.id+':'+a.symbol).join('|');view.forecastErrors=[];renderKeepingScroll();
      const year=Number(api.today().slice(0,4)),ready=[];
      try{
        for(let i=0;i<grouped.length&&current();i+=2){
          await Promise.all(grouped.slice(i,i+2).map(async item=>{
            try{
              const data=await services.forecasts('TW',item.symbol,year,controller.signal);
              if(!current())return;
              const clean={...data,announcements:data.announcements.filter(r=>r.market==='TW'&&r.symbol===item.symbol&&r.currency==='TWD')};
              for(const a of item.assets)ready.push({id:a.id,symbol:a.symbol,market:a.market,currency:a.currency,data:clean});
              for(const e of data.errors)view.forecastErrors.push(item.symbol+' · '+e);
            }catch(e){if(current())view.forecastErrors.push(item.symbol+' · '+e.message);}
          }));
        }
      }finally{
        // An older request may settle after a newer one starts, even after abort.
        if(sequence!==forecastSequence)return;
        if(!current()){pauseForecasts();return;}
        forecastController=null;view.forecastBusy=false;forecastReady.push(...ready);
        if(!root.document.querySelector('#appDialog')?.open){flushForecasts();if(!ready.length)renderKeepingScroll();}
      }
    }
    document.querySelector('#appDialog')?.addEventListener('close',()=>{setTimeout(()=>{if(root.document&&forecastReady.length)flushForecasts();else if(root.document)queueForecasts();},0);});
    function editForecast(key) {
      const r=forecastRow(key);if(!r)return;
      openForm('forecast',key,'編輯預計配息',`<p>${user(r.asset.symbol+' '+r.asset.name)} · 除息 ${esc(r.exDividendDate)}</p><div class="form-grid">${field('計息股數','quantity',r.quantity??'','type="number" min="0" step="any"')}${field('現金股利（每股）','cashDividend',r.cashDividend??'','type="number" min="0" step="any"')}${field('預計發放日','paymentDate',r.paymentDate,`type="date" min="${r.exDividendDate}"`)}${field('備註','note',r.note,'maxlength="200"')}</div><p class="hint">修改後保留你的調整；恢復官方值可重新依公告與持股自動更新。</p>${btn('恢復官方值','reset-forecast',key)}`,true);
    }
    function deleteForecast(key) {
      const r=forecastRow(key);if(!r)return;
      api.confirm('刪除預計配息','此期預計配息將從清單移除，之後更新不會自動加回。',()=>{
        if(api.commit(()=>{const a=p().assets.find(a=>a.id===r.asset.id);if(!a)throw Error('股票不存在。');a.dividendPlanOverrides||={};a.dividendPlanOverrides[r.exDividendDate]={...a.dividendPlanOverrides[r.exDividendDate],excluded:true};core.validate(p());})){api.close();renderKeepingScroll();api.toast('已刪除');}
      },'刪除');
    }
    function resetForecast(key) {
      const r=forecastRow(key);if(!r)return;
      if(api.commit(()=>{const a=p().assets.find(a=>a.id===r.asset.id);if(a?.dividendPlanOverrides)delete a.dividendPlanOverrides[r.exDividendDate];})){api.close();renderKeepingScroll();api.toast('已恢復官方值');}
    }
    function restoreForecasts() {
      api.confirm('恢復已刪除項目','將重新顯示已刪除且尚未入帳的預計配息。',()=>{if(api.commit(()=>{for(const a of p().assets)for(const o of Object.values(a.dividendPlanOverrides||{}))delete o.excluded;})){api.close();renderKeepingScroll();}},'恢復');
    }
    function receiveForecast(key) {
      const r=forecastRow(key);if(!r||!r.canReceive||r.excluded||r.possibleReceiptId)return;
      openTransaction('','dividend',r.asset.id,{date:r.paymentDate||api.today(),exDividendDate:r.exDividendDate,cashDividend:r.cashDividend,amount:r.amount??'',note:r.note,dividendAnnouncement:r.adjusted||r.conflicting?null:r.announcement,dividendPlanKey:r.key});
    }
    const sourceLink=row=>{try{const u=new URL(row.sourceUrl);return u.protocol==='https:'&&['www.twse.com.tw','openapi.twse.com.tw','www.tpex.org.tw','info.tpex.org.tw'].includes(u.hostname)?`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(row.source)}</a>`:esc(row.source);}catch{return esc(row.source||'');}};
    function showDividendSource(form){
      const row=form._dividendAnnouncement,box=form.querySelector('#stockDividendSource');if(!box)return;
      box.innerHTML=row?`已帶入 ${sourceLink(row)} · ${esc(String(row.checkedAt||'').slice(0,10))}<br>股息總額仍依實際入帳明細填寫。`:'';
    }
    function showDividendChoice(form){
      if(!form)return;const row=form._dividendRows?.[Number(form.querySelector('#stockDividendPeriod').value)];
      const button=form.querySelector('[data-stock="apply-dividend"]');if(button)button.disabled=!row||row.cashDividend===null||row.exDividendDate>form.elements.date.value;
      if(row)form.querySelector('#stockDividendStatus').innerHTML=`${sourceLink(row)}${row.paymentDate?' · 公告發放日 '+esc(row.paymentDate):' · 官方未提供發放日，請核對期別。'}${row.cashDividend===null?' · 金額待公告':row.exDividendDate>form.elements.date.value?' · 除息日尚未到，請於實際入帳後登記':''}`;
      root.SalaryMateI18n.apply(form);
    }
    function applyDividend(index){
      const form=document.querySelector('#stockForm[data-kind="transaction"]');if(!form||form.elements.type.value!=='dividend')return;
      const row=form._dividendRows?.[index??Number(form.querySelector('#stockDividendPeriod').value)],a=p().assets.find(a=>a.id===form.elements.assetId.value);
      if(!row||row.cashDividend===null||row.symbol!==a.symbol||row.market!==a.market||row.currency!==a.currency||row.exDividendDate>form.elements.date.value)return;
      form.elements.exDividendDate.value=row.exDividendDate;form.elements.cashDividend.value=String(row.cashDividend);form._dividendAnnouncement={...row};showDividendSource(form);updateTradeForm();
    }
    function autoDividend(form) {
      if(!form.elements.autoDividend.checked)return;
      const index=services.dividendPeriod(form._dividendRows||[],form.elements.date.value);
      if(index<0){
        if(form._dividendAnnouncement){form.elements.exDividendDate.value='';form.elements.cashDividend.value='';form._dividendAnnouncement=null;showDividendSource(form);}
        form.querySelector('#stockDividendStatus').textContent='尚無可匹配的公告，或公告有多個金額，請選擇期別或手動填寫。';
        root.SalaryMateI18n.apply(form);return;
      }
      form.querySelector('#stockDividendPeriod').value=String(index);showDividendChoice(form);applyDividend(index);
    }
    async function loadDividends(force=false){
      const form=document.querySelector('#stockForm[data-kind="transaction"]');if(!form||form.elements.type.value!=='dividend')return;
      const a=p().assets.find(a=>a.id===form.elements.assetId.value),year=Number(form.elements.date.value.slice(0,4)),key=a.id+':'+year;
      if(!force&&form._dividendKey===key){showDividendChoice(form);autoDividend(form);return;}
      dividendController?.abort();const sequence=++dividendSequence;dividendController=new AbortController();form._dividendKey=key;form._dividendRows=[];
      const status=form.querySelector('#stockDividendStatus'),choices=form.querySelector('#stockDividendChoices'),button=form.querySelector('[data-stock="lookup-dividends"]');choices.hidden=true;button.disabled=false;button.removeAttribute('aria-busy');showDividendSource(form);
      if(a.market!=='TW'||a.currency!=='TWD'){status.textContent='官方公告查詢目前支援台股股票與 ETF；其他市場請依發行人公告填寫。';root.SalaryMateI18n.apply(form);return;}
      button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='正在查詢官方配息公告…';root.SalaryMateI18n.apply(form);
      try{
        const data=await services.dividends(a.market,a.symbol,year,dividendController.signal);
        if(sequence!==dividendSequence||root.document?.querySelector('#stockForm')!==form||form.elements.type.value!=='dividend'||form.elements.assetId.value!==a.id)return;
        const rows=data.announcements.filter(r=>r.symbol===a.symbol&&r.market===a.market&&r.currency===a.currency&&core.dateOK(r.exDividendDate)&&(r.cashDividend===null||typeof r.cashDividend==='number'&&Number.isFinite(r.cashDividend)&&r.cashDividend>=0));
        form._dividendRows=rows;
        if(!rows.length){autoDividend(form);status.textContent='此期間查無官方配息公告，原欄位保留。'+(data.errors.length?' '+data.errors.join(' '):'');return;}
        const select=form.querySelector('#stockDividendPeriod');select.innerHTML=rows.map((r,i)=>`<option value="${i}">${esc(r.exDividendDate)} · ${r.cashDividend===null?'金額待公告':num(r.cashDividend,8)+' TWD／每股'}${r.paymentDate?' · 發放 '+esc(r.paymentDate):''}</option>`).join('');
        const matches=rows.map((r,i)=>({r,i})).filter(({r})=>r.paymentDate===form.elements.date.value&&r.cashDividend!==null);
        const exMatch=rows.findIndex(r=>r.exDividendDate===form.elements.exDividendDate.value),recent=rows.findIndex(r=>r.cashDividend!==null&&r.exDividendDate<=form.elements.date.value);
        select.value=String(exMatch>=0?exMatch:matches.length===1?matches[0].i:Math.max(0,recent));choices.hidden=false;showDividendChoice(form);
        autoDividend(form);
        if(data.errors.length)status.append(document.createTextNode(' · '+data.errors.join(' ')));
      }catch(e){if(sequence===dividendSequence&&root.document?.querySelector('#stockForm')===form){status.textContent='官方公告查詢失敗，原欄位保留。';form._dividendKey='';}}
      finally{if(sequence===dividendSequence&&root.document?.querySelector('#stockForm')===form){button.disabled=false;button.removeAttribute('aria-busy');root.SalaryMateI18n.apply(form);}}
    }
    let batchDraft=null;
    const batchValue=(row,name)=>row.querySelector(`[name="${name}"]`);
    const batchRows=()=>[...document.querySelectorAll('#stockBatchRows [data-batch-row]')];
    const batchData=row=>Object.fromEntries([...row.querySelectorAll('input,select')].filter(x=>x.name&&!x.disabled).map(x=>[x.name,x.type==='checkbox'?x.checked:x.value]));
    function openBatch() {
      if(!p().assets.length){api.toast('請先新增一檔股票，再登記交易。');openAsset();return;}
      batchDraft={baseline:JSON.stringify(p()),id:api.id('batch'),review:null,dividendCache:new Map()};
      api.begin({entityType:'stock-batch',entityId:batchDraft.id,companyId:'',operational:false});
      api.open('批次交易',`<form id="stockBatchForm"><p class="hint">每批最多 100 筆。先輸入並核對，全部通過後一次儲存；股數以「股」為單位。</p><details class="stock-batch-paste"><summary>從 Excel 貼上買賣</summary><p class="hint">欄位順序：類型、日期、時間、股票代號、股數、成交價、手續費、稅額、匯率、帳戶。用 Tab 分隔；類型填買入／賣出或 buy／sell。日期填 YYYY-MM-DD，時間可留空。同代號有多個帳戶時須填帳戶。</p><label><span class="field-label">貼上交易資料</span><textarea class="field" id="stockBatchPaste" rows="4" maxlength="100000" placeholder="買入&#9;2026-10-01&#9;09:00&#9;0050&#9;1000&#9;60&#9;20&#9;0&#9;1"></textarea></label>${btn('加入草稿','batch-paste')}</details><div id="stockBatchRows"></div><div class="stock-batch-toolbar">${btn('新增一筆','batch-add')}<span id="stockBatchCount" class="hint"></span></div><div id="stockBatchPreview" aria-live="polite"></div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button>${btn('預覽核對','batch-preview')}<button class="btn btn-primary" type="submit" disabled>確認整批儲存</button></div></form>`,true);
      appendBatchRow();
    }
    function appendBatchRow(data) {
      if(batchRows().length>=100){api.toast('每批請輸入 1～100 筆交易。','error');return;}
      const a=p().assets.find(x=>x.id===data?.assetId)||p().assets[0];
      const d={assetId:a.id,type:'buy',date:api.today(),time:'12:00',quantity:1,price:'',amount:'',exDividendDate:'',cashDividend:'',ratio:1,fee:0,tax:0,fx:a.currency==='TWD'?1:(a.quoteFx||''),note:'',autoDividend:true,...data};
      const id=api.id('drafttx'),row=document.createElement('fieldset');row.className='stock-batch-row';row.dataset.batchRow=id;
      row.innerHTML=`<legend>交易 <span data-row-number></span></legend><div class="stock-row-actions">${btn('複製','batch-copy',id)}${btn('刪除','batch-remove',id)}</div><div class="form-grid stock-batch-grid">${select('交易類型','type',d.type,Object.entries(types))}${select('股票／帳戶','assetId',d.assetId,p().assets.map(x=>[x.id,root.SalaryMateI18n.user(`${x.symbol} ${x.name} · ${x.currency}${x.account?' · '+x.account:''}`)]))}${field('日期／入帳日期 *','date',d.date,`type="date" required max="${api.today()}"`)}${field('時間（同日排序）','time',d.time,'type="time" required')}<div class="stock-trade-fields span-2" data-batch-fields="trade">${field('股數 *','quantity',d.quantity,'type="number" min="0.00000001" step="any" required')}${field('每股成交價 *','price',d.price,'type="number" min="0" step="any" required')}</div><div class="stock-trade-fields span-2" data-batch-fields="dividend"><div class="span-2 stock-batch-announcement"><label class="stock-auto-dividend"><input type="checkbox" name="autoDividend" ${d.autoDividend?'checked':''}>自動帶入官方配息</label><p class="hint" data-batch-dividend-status role="status"></p>${select('選擇配息期別','dividendPeriod','',[])}${btn('查詢官方公告','batch-dividend',id)}</div>${field('除息日期','exDividendDate',d.exDividendDate,`type="date" max="${d.date}"`)}${field('現金股利（每股）','cashDividend',d.cashDividend,'type="number" min="0" step="any"')}${field('股息總額（扣費稅前） *','amount',d.amount,'type="number" min="0" step="any" required')}</div><div class="span-2" data-batch-fields="split">${field('新股數 ÷ 舊股數 *','ratio',d.ratio,'type="number" min="0.00000001" step="any" required')}</div>${field('手續費','fee',d.fee,'type="number" min="0" step="any" required')}${field('稅額／扣繳','tax',d.tax,'type="number" min="0" step="any" required')}${field('1 交易幣別 = TWD *','fx',d.fx,'type="number" min="0.00000001" step="any" required')}${field('備註','note',d.note,'maxlength="200"')}</div>`;
      document.querySelector('#stockBatchRows').append(row);updateBatchRow(row);renumberBatch();invalidateBatch();
      if(d.type==='dividend')void loadBatchDividend(row);
      root.SalaryMateI18n.apply(row);return row;
    }
    function renumberBatch(){batchRows().forEach((row,i)=>row.querySelector('[data-row-number]').textContent=String(i+1));const count=document.querySelector('#stockBatchCount');if(count){count.textContent=`${batchRows().length} / 100`;}}
    function updateBatchRow(row,changedAsset=false) {
      const type=batchValue(row,'type').value,a=p().assets.find(x=>x.id===batchValue(row,'assetId').value);
      for(const box of row.querySelectorAll('[data-batch-fields]')){box.hidden=box.dataset.batchFields!==(['buy','sell','opening'].includes(type)?'trade':type);box.querySelectorAll('input,select,button').forEach(x=>x.disabled=box.hidden);}
      for(const name of ['fee','tax'])batchValue(row,name).disabled=['split','opening'].includes(type);
      const fx=batchValue(row,'fx');if(a.currency==='TWD')fx.value='1';else if(changedAsset)fx.value=a.quoteFx||'';fx.readOnly=a.currency==='TWD';
      batchValue(row,'exDividendDate').max=batchValue(row,'date').value;
    }
    function invalidateBatch() {
      const form=document.querySelector('#stockBatchForm');if(!form||!batchDraft)return;
      batchDraft.review=null;form.querySelector('[type="submit"]').disabled=true;
      form.querySelector('#stockBatchPreview').innerHTML='';
    }
    function readBatchTransactions() {
      return batchRows().map(row=>{
        const d=batchData(row),t={id:row.dataset.batchRow,batchId:batchDraft.id,assetId:d.assetId,type:d.type,date:d.date,time:d.time,quantity:Number(d.quantity||0),price:Number(d.price||0),amount:Number(d.amount||0),ratio:Number(d.ratio||1),fee:Number(d.fee||0),tax:Number(d.tax||0),fx:Number(d.fx),note:String(d.note||'').trim(),exDividendDate:d.type==='dividend'?(d.exDividendDate||''):'',cashDividend:d.type==='dividend'&&d.cashDividend!==''?Number(d.cashDividend):null};
        const a=row._dividendAnnouncement;t.dividendAnnouncement=t.type==='dividend'&&a&&a.exDividendDate===t.exDividendDate&&a.cashDividend===t.cashDividend?a:null;return t;
      });
    }
    function previewBatch() {
      const form=document.querySelector('#stockBatchForm');if(!form||!batchDraft)return;
      invalidateBatch();if(!api.validate(form))return;
      try {
        if(batchRows().some(r=>r._dividendPending&&batchValue(r,'autoDividend').checked))throw Error('配息公告查詢中，請稍候再核對。');
        if(JSON.stringify(p())!==batchDraft.baseline)throw Error('投資資料已變更，請重新開啟批次交易。');
        const rows=readBatchTransactions(),result=core.prepareBatch(p(),rows,api.today());batchDraft.review={rows:JSON.stringify(rows),result};
        form.querySelector('#stockBatchPreview').innerHTML=`<div class="stock-sync-result"><strong>核對 ${rows.length} 筆交易</strong><p>整本帳簿的持有成本變動：${signed(result.costChange)} TWD<br>整本帳簿的已實現損益變動：${signed(result.realizedChange)} TWD</p><p class="hint">補登舊交易也會重算後續賣出的 FIFO 成本。儲存後可在交易紀錄逐筆編輯或刪除。</p></div>${result.duplicates.length?`<label class="stock-import-ack"><input type="checkbox" id="stockBatchDuplicates">相同交易列：${result.duplicates.join('、')} · 確認仍要新增</label>`:''}${eventTable(result.events,false)}`;
        form.querySelector('[type="submit"]').disabled=!!result.duplicates.length;root.SalaryMateI18n.apply(form);
      }catch(e){api.error(form,e.message);}
    }
    function saveBatch(form) {
      if(!batchDraft||!api.validate(form))return;
      if(!api.assert({entityType:'stock-batch',entityId:batchDraft.id,companyId:'',operational:false}))return;
      try {
        const review=batchDraft.review;
        if(!review||review.rows!==JSON.stringify(readBatchTransactions()))throw Error('交易內容已變更，請重新預覽核對。');
        if(JSON.stringify(p())!==batchDraft.baseline)throw Error('投資資料已變更，請重新開啟批次交易。');
        if(review.result.duplicates.length&&!form.querySelector('#stockBatchDuplicates')?.checked)throw Error('請先確認重複交易。');
        const result=core.prepareBatch(p(),JSON.parse(review.rows),api.today()),count=result.events.length;
        if(api.commit(()=>{api.state().stockPortfolio=result.next;},'批次交易未儲存，原資料保持不變。')){batchDraft=null;view.tab='transactions';view.search='';view.filter='all';api.close();renderKeepingScroll();api.toast(`已儲存 ${count} 筆交易`);}
      }catch(e){api.error(form,e.message);}
    }
    function pasteBatch() {
      const form=document.querySelector('#stockBatchForm');if(!form)return;
      try {
        const text=form.querySelector('#stockBatchPaste').value.trim();if(!text)throw Error('請先貼上交易資料。');
        const lines=text.split(/\r?\n/).filter(s=>s.trim());if(/^(類型|type)\t/i.test(lines[0]))lines.shift();
        const numbers=(value,fallback)=>{if(value==='')return fallback;if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value))throw Error('金額與股數請填數字。');return value.replaceAll(',','');};
        const entries=lines.map((line,i)=>{
          try {
            const cells=line.split('\t').map(s=>s.trim());if(cells.length<6||cells.length>10)throw Error('請使用指定的欄位順序。');
            const [kind,date,time,symbol,quantity,price,fee='',tax='',fx='',account='']=cells,type={買入:'buy',賣出:'sell',buy:'buy',sell:'sell'}[kind.toLowerCase()];if(!type)throw Error('類型請填買入或賣出。');
            const assets=p().assets.filter(a=>a.symbol.toUpperCase()===symbol.toUpperCase()&&(!account||String(a.account||'')===account));if(assets.length!==1)throw Error('找不到唯一的股票／帳戶，請先新增股票或填寫帳戶。');
            const a=assets[0],day=date.replaceAll('/','-');if(!core.dateOK(day)||day>api.today())throw Error('日期不正確或晚於今天。');
            if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('時間請填 HH:mm。');
            if(!quantity||!price)throw Error('股數與成交價不可留空。');
            return {assetId:a.id,type,date:day,time:time||'12:00',quantity:numbers(quantity,''),price:numbers(price,''),fee:numbers(fee,0),tax:numbers(tax,0),fx:numbers(fx,a.currency==='TWD'?1:'')};
          }catch(e){throw Error(`交易 ${i+1}：${e.message}`);}
        });
        const existing=batchRows(),blank=existing.length===1&&batchValue(existing[0],'type').value==='buy'&&batchValue(existing[0],'price').value===''&&batchValue(existing[0],'note').value==='';
        if(!entries.length||entries.length+existing.length-(blank?1:0)>100)throw Error('每批請輸入 1～100 筆交易。');
        if(blank)existing[0].remove();entries.forEach(appendBatchRow);form.querySelector('#stockBatchPaste').value='';invalidateBatch();
      }catch(e){api.error(form,e.message);}
    }
    async function loadBatchDividend(row,force=false) {
      const draft=batchDraft;if(!draft||batchValue(row,'type').value!=='dividend')return;
      const active=()=>!!root.document?.querySelector('#stockBatchForm')&&row.isConnected&&batchDraft===draft;
      const a=p().assets.find(a=>a.id===batchValue(row,'assetId').value),date=batchValue(row,'date').value,year=Number(date.slice(0,4));
      const status=row.querySelector('[data-batch-dividend-status]'),period=batchValue(row,'dividendPeriod'),key=a.id+':'+year,seq=(row._dividendSequence||0)+1;row._dividendSequence=seq;
      const show=()=>{period.innerHTML='<option value="">選擇配息期別</option>'+row._dividendRows.map((r,i)=>`<option value="${i}" ${r.cashDividend==null||r.exDividendDate>batchValue(row,'date').value?'disabled':''}>${esc(r.exDividendDate)} · ${r.cashDividend==null?'金額待公告':num(r.cashDividend,8)+' TWD／每股'}${r.paymentDate?' · '+esc(r.paymentDate):''}</option>`).join('');if(batchValue(row,'autoDividend').checked){const selected=services.dividendPeriod(row._dividendRows,batchValue(row,'date').value);period.value=selected<0?'':String(selected);if(selected>=0)applyBatchDividend(row);else{if(row._dividendAnnouncement){batchValue(row,'exDividendDate').value='';batchValue(row,'cashDividend').value='';row._dividendAnnouncement=null;invalidateBatch();}status.textContent='尚無可匹配的公告，或公告有多個金額，請選擇期別或手動填寫。';}}root.SalaryMateI18n.apply(row);};
      if(!force&&row._dividendKey===key&&row._dividendRows){row._dividendPending=false;show();return;}
      row._dividendKey=key;row._dividendRows=null;row._dividendPending=false;period.innerHTML='';
      if(a.market!=='TW'||a.currency!=='TWD'){status.textContent='官方公告查詢目前支援台股股票與 ETF；其他市場請依發行人公告填寫。';root.SalaryMateI18n.apply(row);return;}
      const cacheKey=a.symbol+':'+year;status.textContent='正在查詢官方配息公告…';row._dividendPending=true;invalidateBatch();root.SalaryMateI18n.apply(row);
      try {
        if(force)draft.dividendCache.delete(cacheKey);
        if(!draft.dividendCache.has(cacheKey))draft.dividendCache.set(cacheKey,services.dividends(a.market,a.symbol,year));
        const data=await draft.dividendCache.get(cacheKey);
        if(!active()||seq!==row._dividendSequence||batchValue(row,'type').value!=='dividend')return;
        row._dividendRows=data.announcements.filter(r=>r.symbol===a.symbol&&r.market===a.market&&r.currency===a.currency&&core.dateOK(r.exDividendDate)&&(r.cashDividend===null||typeof r.cashDividend==='number'&&Number.isFinite(r.cashDividend)&&r.cashDividend>=0));row._dividendPending=false;status.textContent='請核對配息期別，股息總額依實際入帳明細填寫。';show();
      }catch(e){draft.dividendCache.delete(cacheKey);if(active()&&seq===row._dividendSequence){status.textContent='官方公告查詢失敗，原欄位保留。';row._dividendKey='';}}
      finally{if(active()&&seq===row._dividendSequence){row._dividendPending=false;root.SalaryMateI18n.apply(row);}}
    }
    function applyBatchDividend(row) {
      const value=batchValue(row,'dividendPeriod').value,r=value===''?null:row._dividendRows?.[Number(value)];if(!r||r.cashDividend==null||r.exDividendDate>batchValue(row,'date').value)return;
      batchValue(row,'exDividendDate').value=r.exDividendDate;batchValue(row,'cashDividend').value=String(r.cashDividend);row._dividendAnnouncement={...r};row.querySelector('[data-batch-dividend-status]').innerHTML=`已帶入 ${sourceLink(r)} · ${esc(r.exDividendDate)}${r.paymentDate?' · 公告發放日 '+esc(r.paymentDate):' · 官方未提供發放日，請核對期別。'}`;invalidateBatch();root.SalaryMateI18n.apply(row);
    }
    function openQuotes() {
      if(!p().assets.length){openAsset();return;}
      openForm('quotes','','手動價格／淨值',`<p class="hint">選擇手動維護後可編輯價格、日期與匯率，自動更新會保留這些值。基金採手動公布淨值；留空價格代表尚未定價。</p><div class="stock-quote-list">${p().assets.map(a=>`<fieldset data-quote-id="${esc(a.id)}"><legend>${user(a.symbol)} · ${user(a.name)} <small>${user(a.account||'')} / ${a.currency}</small></legend>${select('行情更新模式',`mode-${a.id}`,core.quoteEligible(a)?'auto':'manual',[...(['TW','US'].includes(a.market)&&(classification(a).type!=='fund')?[['auto','每 5 分鐘自動取得最新行情']]:[]),['manual','手動維護價格／淨值']])}<div class="form-grid cols-3">${field('每股價格',`price-${a.id}`,a.quotePrice??'','type="number" step="any" min="0"')}${field('價格日期',`date-${a.id}`,a.quoteDate||api.today(),`type="date" max="${api.today()}"`)}${field('1 '+a.currency+' = TWD',`fx-${a.id}`,a.currency==='TWD'?1:(a.quoteFx||''),`type="number" step="any" min="0.00000001" ${a.currency==='TWD'?'readonly':''}`)}</div></fieldset>`).join('')}</div>`,true);
      syncManualPriceFields();
    }
    function syncManualPriceFields(){
      for(const fieldset of root.document.querySelectorAll('#stockForm [data-quote-id]')){
        const manual=fieldset.querySelector('select').value==='manual';
        for(const input of fieldset.querySelectorAll('input'))input.disabled=!manual;
      }
    }
    function detail(id) {
      const m=model(),s=m.holdings.find(s=>s.asset.id===id);if(!s)return;
      const a=s.asset;
      api.open(root.SalaryMateI18n.user(`${a.symbol} · ${a.name}`),`<div class="stock-detail-heading"><div class="stock-detail-identity">${icon(a)}${tags(a)}${favorite(a)}</div><p>${markets[a.market]} · ${a.currency} · ${(a.account?user(a.account):'未分帳戶')}</p><div class="page-actions">${btn('買入','buy',id,true)}${btn('賣出','sell',id)}${btn('股息','dividend',id)}${btn('編輯股票','asset',id)}${btn('刪除股票','delete-asset',id)}</div></div><div class="stock-stats">${stat('持有股數',num(s.quantity,6),'股')}${stat('剩餘持股均價',num(s.average,4),a.currency+'／股 · FIFO 剩餘成本')}${stat('未實現損益',signed(s.unrealized),'TWD',tone(s.unrealized))}${stat('累計已實現＋股息',signed(s.realized+s.dividends),'全部年度 · TWD',tone(s.realized+s.dividends))}</div>${navInfo(a)}<p class="hint">參考股價：${a.quotePrice==null?'尚未設定':num(a.quotePrice,4)+' '+a.currency+' · 匯率 '+num(a.quoteFx,6)}</p>${quoteMeta(a,'尚無行情')}${a.note?`<p>${user(a.note)}</p>`:''}<h3>全部年度紀錄</h3>${eventTable(m.events.filter(t=>t.assetId===id))}`,true);
    }
    function save(form) {
      if(!api.validate(form))return;
      const kind=form.dataset.kind,id=form.dataset.id;
      if(!api.assert({entityType:'stock-'+kind,entityId:id,companyId:'',operational:false}))return;
      const data=new FormData(form),d=Object.fromEntries(data),next=JSON.parse(JSON.stringify(p()));
      try {
        if(kind==='asset') {
          const old=next.assets.find(a=>a.id===id);
          if(old&&old.currency!==d.currency&&next.transactions.some(t=>t.assetId===id))throw new Error('已有交易紀錄，無法更換幣別；請另建股票。');
          const row={...old,id:id||api.id('stock'),symbol:d.symbol.trim().toUpperCase(),name:d.name.trim(),market:d.market,currency:d.currency,account:d.account.trim(),note:d.note.trim(),favorite:d.favorite==='on',group:d.group.trim(),typeOverride:d.typeOverride,exchangeOverride:d.exchangeOverride,industryOverride:d.industryOverride.trim(),iconMode:d.iconMode,iconData:form._iconData||'',marketInfo:form._marketInfo||{},priceUpdateMode:d.priceUpdateMode};
          if(old&&(old.symbol!==row.symbol||old.market!==row.market||old.currency!==row.currency)){delete row.dividendForecast;delete row.dividendPlanOverrides;delete row.netAssetValue;delete row.navStatus;delete row.navCheckedAt;delete row.intradayNav;delete row.intradayNavStatus;delete row.intradayCheckedAt;}
          if(!old||old.symbol!==row.symbol||old.market!==row.market||old.currency!==row.currency){row.quotePrice=null;row.quoteDate='';row.quoteFx=null;row.quoteChange=null;row.quoteChangePercent=null;row.quoteSource='';row.quoteProviderTime='';row.quoteMarketAt='';row.quoteCheckedAt='';row.quoteFxDate='';row.quoteMode='manual';}
          const q=form._lookupQuote;
          if(core.quoteEligible(row)&&q&&q.symbol===row.symbol&&q.market===row.market&&q.currency===row.currency&&row.currency==='TWD'&&q.price>0&&core.dateOK(q.date)&&q.date<=api.today()&&(!row.quoteDate||q.date>=row.quoteDate))Object.assign(row,{quotePrice:q.price,quoteDate:q.date,quoteFx:1,quoteChange:q.change??null,quoteChangePercent:q.changePercent??null,quoteSource:q.source,quoteMode:'auto',quoteProviderTime:q.providerTime,quoteMarketAt:q.quoteAt||'',quoteCheckedAt:new Date().toISOString()});
          const i=next.assets.findIndex(a=>a.id===id);if(i<0)next.assets.push(row);else next.assets[i]=row;
        } else if(kind==='forecast') {
          const forecast=core.dividendForecasts(next,api.today(),true).find(r=>r.key===id);if(!forecast)throw Error('預計配息內容已變更，請重新開啟。');
          const a=next.assets.find(a=>a.id===forecast.asset.id);a.dividendPlanOverrides||={};a.dividendPlanOverrides[forecast.exDividendDate]={quantity:d.quantity===''?null:Number(d.quantity),cashDividend:d.cashDividend===''?null:Number(d.cashDividend),paymentDate:d.paymentDate||'',note:d.note.trim()};
        } else if(kind==='transaction') {
          if(d.date>api.today())throw new Error('請登記已發生的交易；日期不可晚於今天。');
          const row={...next.transactions.find(t=>t.id===id),id:id||api.id('stocktx'),assetId:d.assetId,type:d.type,date:d.date,time:d.time,quantity:Number(d.quantity||0),price:Number(d.price||0),amount:Number(d.amount||0),exDividendDate:d.type==='dividend'?(d.exDividendDate||''):'',cashDividend:d.type==='dividend'&&d.cashDividend!==''?Number(d.cashDividend):null,ratio:Number(d.ratio||1),fee:Number(d.fee||0),tax:Number(d.tax||0),fx:Number(d.fx),note:d.note.trim()};
          const plan=form._dividendPlan;
          if(plan&&row.type==='dividend'&&row.assetId===plan.assetId&&row.exDividendDate===plan.exDividendDate){
            if(next.transactions.some(t=>t.id!==id&&t.type==='dividend'&&t.assetId===row.assetId&&(t.dividendPlanKey===plan.key||t.exDividendDate===row.exDividendDate)))throw Error('此期配息已有入帳紀錄，請編輯原紀錄。');
            row.dividendPlanKey=plan.key;
          }
          const announcement=form._dividendAnnouncement,asset=next.assets.find(a=>a.id===row.assetId);
          row.dividendAnnouncement=row.type==='dividend'&&announcement&&announcement.symbol===asset.symbol&&announcement.market===asset.market&&announcement.exDividendDate===row.exDividendDate&&announcement.cashDividend===row.cashDividend?announcement:null;
          const i=next.transactions.findIndex(t=>t.id===id);if(i<0)next.transactions.push(row);else next.transactions[i]=row;
        } else if(kind==='quotes') {
          for(const a of next.assets){a.priceUpdateMode=d['mode-'+a.id];if(a.priceUpdateMode==='auto')continue;const price=d['price-'+a.id];a.quotePrice=price===''?null:Number(price);a.quoteDate=price===''?'':d['date-'+a.id];a.quoteFx=price===''?null:Number(d['fx-'+a.id]);a.quoteSource='手動';a.quoteMode='manual';a.quoteMarketAt='';a.quoteChange=null;a.quoteChangePercent=null;a.quoteProviderTime='';a.quoteCheckedAt='';if(a.quoteDate>api.today())throw new Error('股價日期不可晚於今天。');}
        }
        core.validate(next);
        if(api.commit(()=>{api.state().stockPortfolio=next;},'股票資料未儲存，原資料保持不變。')){
          if(kind==='asset'&&!id){view.tab='stocks';view.search='';view.exchange='';view.category='';view.favorites=false;}
          if(kind==='transaction'&&d.type==='buy'&&['watchlist','stocks'].includes(view.tab)){view.tab='overview';view.search='';view.exchange='';view.category='';view.favorites=false;}
          api.close();renderKeepingScroll();api.toast('股票資料已儲存');
        }
      } catch(e) {api.error(form,e.message);}
    }
    function remove(kind,id) {
      const next=JSON.parse(JSON.stringify(p()));
      if(kind==='asset'&&next.transactions.some(t=>t.assetId===id)){api.toast('這檔股票已有交易。請保留歷史，或先處理相關交易再刪除。','error');return;}
      if(kind==='asset')next.assets=next.assets.filter(a=>a.id!==id);else next.transactions=next.transactions.filter(t=>t.id!==id);
      try{core.validate(next);}catch(e){api.toast('無法刪除：'+e.message,'error');return;}
      api.confirm('刪除股票'+(kind==='asset'?'':'紀錄'),'此動作會移除這筆資料並重新計算持股與損益。確定刪除？',()=>{
        if(api.commit(()=>{api.state().stockPortfolio=next;})){api.close();renderKeepingScroll();api.toast('已刪除');}
      },'刪除');
    }
    function exportCSV(type) {
      const m=model();
      const rows=type==='holdings'?[['代號','名稱','市場','幣別','帳戶','股數','平均成本原幣','持有成本TWD','手動價格','價格日期','估值匯率','市值TWD','未實現損益TWD'],...m.holdings.map(s=>[s.asset.symbol,s.asset.name,s.asset.market,s.asset.currency,s.asset.account,s.quantity,s.average,s.costTwd,s.asset.quotePrice??'',s.asset.quoteDate,s.asset.quoteFx??'',s.value??'',s.unrealized??''])]:[['日期','時間','代號','名稱','帳戶','幣別','類型','股數','成交價','除息日期','現金股利（每股）','股息總額','分割比例','手續費','稅額','交易匯率','現金流TWD','已實現損益TWD','備註'],...m.events.filter(t=>t.inYear).map(t=>[t.date,t.time,t.asset.symbol,t.asset.name,t.asset.account,t.asset.currency,types[t.type],t.quantity,t.price,t.exDividendDate||'',t.cashDividend??'',t.amount,t.ratio,t.fee,t.tax,t.fx,t.cash,t.realized,t.note])];
      api.csv(rows,`股票_${type==='holdings'?'持股':api.year()+'_交易'}.csv`);
    }
    async function refreshQuotes(manual=true) {
      if(view.refreshing)return;
      if(manual&&root.navigator?.onLine===false){view.marketIssue='目前離線，保留上次匯率與價格。';marketDisplay();return;}
      if(marketBlocked())return;
      clearTimeout(marketTimer);marketTimer=null;
      const baseline=JSON.stringify(p()),assets=core.marketPreferences(p()).quoteEnabled?p().assets.filter(core.quoteEligible):[];
      view.refreshing=true;view.lastMarketAttempt=Date.now();view.quoteResult=null;view.marketIssue='';
      const controller=new AbortController();marketController=controller;marketDisplay();
      try {
        const snapshot=await services.fetchQuotes(assets,'/api/stocks/quotes',controller.signal);
        if(controller.signal.aborted)return;
        if(JSON.stringify(p())!==baseline||marketBlocked()){
          if(manual)view.marketIssue='查詢期間資料或編輯狀態已變更，請重新更新。';
          return;
        }
        const result=services.applyQuotes(p(),snapshot,api.today());
        const saved=api.commit(()=>{api.state().stockPortfolio=result.next;},'更新價格未儲存，原資料保持不變。',api.id('market-sync'),false);
        if(!saved)throw Error('儲存失敗，請重新整理後再試。');
        if(manual&&result.errors.length)view.quoteResult={title:result.useful?'部分資料已更新':'更新未完成，原價格保留',errors:result.errors};
        renderKeepingScroll();
      }catch(e){if(!controller.signal.aborted)view.marketIssue='更新失敗，已保留上次匯率與價格。';}
      finally{view.refreshing=false;marketController=null;marketDisplay();queueMarket();}
    }
    async function lookupName() {
      clearTimeout(lookupTimer);lookupController?.abort();
      const form=document.querySelector('#stockForm[data-kind="asset"]');if(!form)return;
      const f=form.elements,symbol=f.symbol.value.trim().toUpperCase(),market=f.market.value,nameBefore=f.name.value,status=form.querySelector('#stockLookupStatus');
      if(!symbol)return;
      if(!['TW','US'].includes(market)){status.textContent='其他市場請手動輸入名稱。';return;}
      const seq=++lookupSequence;lookupController=new AbortController();status.textContent='正在查詢股票名稱…';
      try {
        const data=await services.lookup(market,symbol,lookupController.signal);
        if(seq!==lookupSequence||document.querySelector('#stockForm')!==form||f.symbol.value.trim().toUpperCase()!==symbol||f.market.value!==market)return;
        const item=data.quotes.find(q=>q.market===market&&q.symbol===symbol&&typeof q.name==='string'&&q.name.trim());
        if(!item)throw new Error('找不到這個代號，請確認市場與代號，或手動輸入名稱。');
        form._marketInfo=services.marketInfo(item);form._lookupQuote=item;showClassification(form);iconPreview(form);
        if(f.name.value!==nameBefore){status.textContent='查詢完成；保留你剛輸入的名稱。';return;}
        f.name.value=item.name;f.name.dispatchEvent(new Event('input',{bubbles:true}));
        if(!p().transactions.some(t=>t.assetId===form.dataset.id))f.currency.value=item.currency;
        status.textContent='已帶入名稱 · '+item.source;
      }catch(e){if(seq===lookupSequence&&document.querySelector('#stockForm')===form)status.textContent=e.message;}
    }
    function openImport() {
      importDraft=null;
      api.open('匯入 SmartPortfolio 備份',`<p>選擇智投資 SmartPortfolio 匯出的完整 JSON 備份。會先預覽，確認後才加入投資資料。</p><label class="stock-import-file"><span class="field-label">備份檔（最多 10 MB）</span><input id="smartPortfolioFile" type="file" accept="application/json,.json"></label><p class="hint">新增到 SmartPortfolio 帳戶；薪資、公司與既有投資紀錄會保留。匯入持股、交易及現金股息；收益目標、提醒與介面設定保留於原檔。檔案不會上傳到行情服務。</p><p id="stockImportReadStatus" role="status"></p>`);
    }
    async function readImport(file) {
      const status=document.querySelector('#stockImportReadStatus');if(!file||!status)return;
      try {
        if(file.size>10*1024*1024)throw new Error('備份超過 10 MB，請先確認檔案。');
        status.textContent='正在讀取與核對…';
        const raw=await file.text(),value=JSON.parse(raw),parsed=services.parseSmart(value);
        const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(parsed.data)));
        if(document.querySelector('#stockImportReadStatus')!==status)return;
        const token=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
        importDraft={value,token,copyToken:api.id('copy'),baseline:JSON.stringify(p())};
        let mode='history';try{services.prepareSmart(value,p(),{mode,snapshotDate:api.today(),token,conflict:'overwrite'});}catch{mode='snapshot';}
        api.begin({entityType:'stock-import',entityId:token,companyId:'',operational:false});
        api.open('預覽 SmartPortfolio 匯入',`<form id="stockImportForm"><p>${user(file.name)} · SmartPortfolio ${esc(parsed.appVersion)}</p><div class="form-grid">${select('相同資料如何處理？','conflict','overwrite',[['overwrite','覆蓋相同標的與交易'],['copy','新增為獨立帳戶副本']])}${select('匯入方式','mode',mode,[['history','完整交易履歷重算'],['snapshot','持股快照＋歷史留存']])}${field('期初持股日期','snapshotDate',api.today(),`type="date" required max="${api.today()}"`)}${field('備用 USD/TWD 匯率','fallbackFx',parsed.data.marketData?.usdTwdRate||'','type="number" step="any" min="0.00000001"','只在缺少原交易匯率／匯入持股快照時使用。')}</div><div id="stockImportPreview" aria-live="polite"></div><label class="stock-import-ack"><input type="checkbox" name="ack" required>我已核對匯入方式、持股與匯率說明</label>${footer('確認加入投資資料')}</form>`,true);
        previewImport();
      }catch(e){if(document.querySelector('#stockImportReadStatus')===status)status.textContent='無法讀取：'+e.message;}
    }
    function previewImport() {
      const form=document.querySelector('#stockImportForm');if(!form||!importDraft)return null;
      const box=form.querySelector('#stockImportPreview');form.elements.ack.checked=false;
      try {
        const d=Object.fromEntries(new FormData(form));
        if(d.snapshotDate>api.today())throw new Error('期初日期不可晚於今天。');
        const result=services.prepareSmart(importDraft.value,p(),{mode:d.mode,snapshotDate:d.snapshotDate,fallbackFx:d.fallbackFx===''?undefined:Number(d.fallbackFx),token:importDraft.token,conflict:d.conflict,copyToken:importDraft.copyToken});
        const m=core.calculate(result.next,api.year(),api.today()),ids=new Set(result.next.smartImports.at(-1).assets);
        box.innerHTML=`<div class="stock-sync-result"><strong>匯入 ${result.assets} 檔標的、${result.transactions} 筆帳務紀錄；覆蓋 ${result.replaced} 檔相同標的</strong><p>另留存 ${result.archived} 筆舊買賣履歷，不會重複增加持股。</p></div>${result.warnings.length?`<ul class="stock-import-warnings">${result.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}${table(['標的','匯入後持有股數','原幣平均成本','TWD 持有成本'],m.holdings.filter(s=>ids.has(s.asset.id)).map(s=>`<tr><td>${user(s.asset.symbol)} ${user(s.asset.name)}</td><td>${num(s.quantity,6)}</td><td>${num(s.average,4)} ${s.asset.currency}</td><td>${money(s.costTwd)}</td></tr>`).join(''))}`;
        form.querySelector('[type="submit"]').disabled=false;return result;
      }catch(e){box.innerHTML=`<p class="stock-warning">${esc(e.message)}</p>`;form.querySelector('[type="submit"]').disabled=true;return null;}
    }
    function saveImport(form) {
      if(!api.validate(form)||!importDraft)return;
      if(!api.assert({entityType:'stock-import',entityId:importDraft.token,companyId:'',operational:false}))return;
      if(JSON.stringify(p())!==importDraft.baseline){api.error(form,'投資資料已變更，請重新選擇備份檔核對。');return;}
      const result=previewImport();if(!result)return;
      if(api.commit(()=>{api.state().stockPortfolio=result.next;},'匯入未儲存，原資料保持不變。')){importDraft=null;view.tab='overview';view.search='';api.close();renderKeepingScroll();api.toast('SmartPortfolio 備份已匯入');}
    }
    function archives() {
      api.open('SmartPortfolio 匯入紀錄',(p().smartImports||[]).map(i=>`<section class="stock-import-archive"><div class="stock-panel-head"><div><h3>SmartPortfolio ${esc(i.appVersion)}</h3><p class="hint">${esc(i.importedAt)} · ${i.mode==='snapshot'?'持股快照＋歷史留存':'完整履歷重算'}</p></div><div class="page-actions">${btn('編輯資料','edit-import',i.token)}${btn('刪除','delete-import',i.token)}${btn('下載原始備份','export-smart',i.token)}</div></div>${i.archivedTransactions.length?`<p class="hint">以下舊買賣僅留存，不計入本版持股或損益。</p>${table(['日期','標的','類型','股數','成交價','費用／稅額'],i.archivedTransactions.map(t=>`<tr><td>${esc(t.date)}</td><td>${user(t.symbol)} ${user(t.name)}</td><td>${t.type==='BUY'?'買入':'賣出'}</td><td>${num(t.shares,6)}</td><td>${num(t.price,4)}</td><td>${num(t.fee||0)} / ${num(t.tax||0)}</td></tr>`).join(''))}`:'<p class="hint">交易已加入交易紀錄，可按年度查看。</p>'}</section>`).join('')||'<p>尚未匯入備份。</p>',true);
    }
    function editImport(token) {
      const entry=p().smartImports?.find(i=>i.token===token);if(!entry)return;
      const ids=new Set(entry.assets),assets=p().assets.filter(a=>ids.has(a.id)),transactions=p().transactions.filter(t=>ids.has(t.assetId));
      api.open('編輯匯入資料',`<p class="hint">可編輯目前持股與帳務紀錄。原始備份保留當時內容。</p>${table(['股票','操作'],assets.map(a=>`<tr><td class="stock-asset-cell">${assetName(a)}</td><td>${btn('編輯股票','asset',a.id)}${btn('查看交易','detail',a.id)}</td></tr>`).join(''))}${table(['日期','類型','操作'],transactions.map(t=>`<tr><td>${esc(t.date)}</td><td>${esc(types[t.type])}</td><td>${btn('編輯','transaction',t.id)}${btn('刪除','delete-transaction',t.id)}</td></tr>`).join(''))}`,true);
    }
    function deleteImport(token) {
      const entry=p().smartImports?.find(i=>i.token===token);if(!entry)return;
      const ids=new Set(entry.assets),count=p().transactions.filter(t=>ids.has(t.assetId)).length;
      api.confirm('刪除匯入資料',`將刪除此份匯入紀錄、${ids.size} 檔相關股票及 ${count} 筆交易，包含匯入後新增的交易。原始備份留存也會移除。`,()=>{
        if(!api.commit(()=>{const next=p();next.assets=next.assets.filter(a=>!ids.has(a.id));next.transactions=next.transactions.filter(t=>!ids.has(t.assetId));next.smartImports=next.smartImports.filter(i=>i.token!==token).map(i=>({...i,assets:i.assets.filter(id=>!ids.has(id))}));core.validate(next);},'刪除失敗，原資料保持不變。'))return;
        api.close();renderKeepingScroll();api.toast('匯入資料已刪除。');
      },'刪除');
    }
    function onInput(event) {
      const trade=event.target.closest('#stockForm[data-kind="transaction"]');
      if(trade&&['exDividendDate','cashDividend'].includes(event.target.name)){trade.elements.autoDividend.checked=false;trade._dividendAnnouncement=null;showDividendSource(trade);}
      if(event.target.closest('#stockBatchForm')&&event.target.id!=='stockBatchDuplicates')invalidateBatch();
      const row=event.target.closest('[data-batch-row]');if(row&&['exDividendDate','cashDividend'].includes(event.target.name)){batchValue(row,'autoDividend').checked=false;row._dividendAnnouncement=null;row.querySelector('[data-batch-dividend-status]').textContent='手動填寫';}
      if(event.target.closest('#stockForm[data-kind="asset"]')&&event.target.name==='symbol'){
        clearTimeout(lookupTimer);lookupController?.abort();lookupSequence++;
        const form=event.target.form;form._marketInfo={};form._lookupQuote=null;showClassification(form);iconPreview(form);
        lookupTimer=setTimeout(lookupName,650);
      }
    }
    function onChange(event) {
      if(event.target.closest?.('#stockForm[data-kind="quotes"]')&&event.target.name.startsWith('mode-')){syncManualPriceFields();return;}

      const assetForm=event.target.closest('#stockForm[data-kind="asset"]');
      if(assetForm&&event.target.id==='stockIconFile')void readIcon(event.target.files?.[0],assetForm);
      if(assetForm&&['iconMode','typeOverride'].includes(event.target.name))iconPreview(assetForm);
      const row=event.target.closest('[data-batch-row]');
      if(row){
        if(event.target.name==='assetId'){batchValue(row,'exDividendDate').value='';batchValue(row,'cashDividend').value='';row._dividendAnnouncement=null;row._dividendRows=null;}
        updateBatchRow(row,event.target.name==='assetId');
        if(['type','assetId','date','autoDividend'].includes(event.target.name)){
          if(batchValue(row,'type').value==='dividend')void loadBatchDividend(row);
          else {row._dividendSequence=(row._dividendSequence||0)+1;row._dividendPending=false;}
        }
        if(event.target.name==='dividendPeriod')applyBatchDividend(row);
      }
      if(event.target.id==='stockBatchDuplicates')event.target.form.querySelector('[type="submit"]').disabled=!event.target.checked||!batchDraft?.review;
      const tradeForm=event.target.closest('#stockForm[data-kind="transaction"]');
      if(tradeForm&&['type','assetId','date'].includes(event.target.name)){
        if(event.target.name==='assetId'&&tradeForm._dividendAnnouncement){tradeForm.elements.exDividendDate.value='';tradeForm.elements.cashDividend.value='';tradeForm._dividendAnnouncement=null;}
        if(tradeForm.elements.type.value==='dividend')void loadDividends();else{dividendController?.abort();dividendSequence++;tradeForm._dividendKey='';const button=tradeForm.querySelector('[data-stock="lookup-dividends"]');button.disabled=false;button.removeAttribute('aria-busy');}
      }
      if(tradeForm&&['exDividendDate','cashDividend'].includes(event.target.name)){const a=tradeForm._dividendAnnouncement;if(a&&(a.exDividendDate!==tradeForm.elements.exDividendDate.value||a.cashDividend!==Number(tradeForm.elements.cashDividend.value))){tradeForm._dividendAnnouncement=null;showDividendSource(tradeForm);}}
      if(event.target.id==='stockDividendPeriod'){showDividendChoice(tradeForm);applyDividend();}
      if(tradeForm&&event.target.name==='autoDividend'&&event.target.checked){autoDividend(tradeForm);void loadDividends();}
      if(event.target.id==='smartPortfolioFile')void readImport(event.target.files?.[0]);
      if(event.target.closest('#stockImportForm')&&event.target.name!=='ack')previewImport();
      if(event.target.closest('#stockForm[data-kind="asset"]')&&event.target.name==='market'){
        clearTimeout(lookupTimer);lookupController?.abort();lookupSequence++;
        const f=event.target.form.elements;if(!p().transactions.some(t=>t.assetId===event.target.form.dataset.id))f.currency.value=f.market.value==='US'?'USD':'TWD';
        event.target.form._marketInfo={};event.target.form._lookupQuote=null;showClassification(event.target.form);iconPreview(event.target.form);
        lookupTimer=setTimeout(lookupName,50);
      }
    }
    const closeStockActions=(focus=false)=>{
      const wrap=root.document.querySelector('.stock-action-menu-wrap');
      wrap?.classList.remove('is-open');
      const toggle=wrap?.querySelector('.stock-action-toggle');
      toggle?.setAttribute('aria-expanded','false');
      if(focus)toggle?.focus({preventScroll:true});
    };
    root.document.addEventListener('click',event=>{if(!event.target.closest('.stock-action-menu-wrap'))closeStockActions();});
    root.document.addEventListener('focusin',event=>{if(!event.target.closest('.stock-action-menu-wrap'))closeStockActions();});
    root.document.addEventListener('error',event=>{if(event.target.matches?.('.stock-avatar img[data-stock-logo]'))event.target.remove();},true);
    root.document.addEventListener('toggle',event=>{
      const details=event.target;
      if(!details.matches?.('.stock-legacy-shortcut')||details.isConnected===false)return;
      view.legacyExpanded=details.open;
      const content=details.querySelector('[data-stock-legacy]');
      if(!details.open||!content||content.dataset.loaded==='true')return;
      content.innerHTML=renderLegacy();content.dataset.loaded='true';
      if(api.enhance)api.enhance(content);else root.SalaryMateI18n?.apply(content);
      root.SalaryMateScrollbars?.refresh();
    },true);
    root.document.addEventListener('visibilitychange',()=>{
      if(root.document.hidden){clearTimeout(marketTimer);marketTimer=null;marketController?.abort();pauseForecasts();return;}
      if(!onInvestment()||root.document.querySelector('#appDialog')?.open)return;
      queueMarket();resumeForecasts();
    });
    function resumeForecasts(){if(!forecastInactive()){renderKeepingScroll();queueForecasts();}}
    root.addEventListener?.('offline',()=>{pauseForecasts();if(onInvestment()&&view.tab==='income')renderKeepingScroll();});
    root.addEventListener?.('online',resumeForecasts);
    root.addEventListener?.('pagehide',pauseForecasts);
    root.addEventListener?.('pageshow',resumeForecasts);
    root.document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.document.querySelector('.stock-action-menu-wrap.is-open')){event.preventDefault();closeStockActions(true);}});
    function click(el) {
      const action=el.dataset.stock,id=el.dataset.id||'';
      if(action==='toggle-market-details'){toggleMarketDetails(el);return true;}
      if(action==='toggle-market-auto'){toggleMarket('autoRefresh');return true;}
      if(action==='toggle-market-quotes'){toggleMarket('quoteEnabled');return true;}
      if(action==='toggle-actions'){const wrap=el.closest('.stock-action-menu-wrap');const open=wrap.classList.toggle('is-open');el.setAttribute('aria-expanded',String(open));return;}
      if(el.closest('.stock-head-actions')&&root.document.querySelector('.stock-action-menu-wrap.is-open'))closeStockActions(true);
      if(action==='tab'){if(id!==view.tab)pauseForecasts();view.tab=id;view.search='';view.filter='all';view.exchange='';view.category='';view.favorites=false;renderKeepingScroll();}
      else if(action==='forecasts'){view.tab='income';renderKeepingScroll();}
      else if(action==='refresh-forecasts')void refreshForecasts(true);
      else if(action==='edit-forecast')editForecast(id);
      else if(action==='delete-forecast')deleteForecast(id);
      else if(action==='reset-forecast')resetForecast(id);
      else if(action==='restore-forecasts')restoreForecasts();
      else if(action==='receive-forecast')receiveForecast(id);
      else if(action==='favorite'){if(api.commit(()=>{const a=p().assets.find(a=>a.id===id);if(a)a.favorite=!a.favorite;},'收藏未儲存，請再試一次。','stock-favorite:'+id,false)){renderKeepingScroll();const a=p().assets.find(a=>a.id===id);if(el.isConnected&&a)el.outerHTML=favorite(a);}}
      else if(action==='catalog')openCatalog();
      else if(action==='catalog-add'){const q=catalogItems[Number(id)];if(q)openAsset('',{symbol:q.symbol,name:q.name,market:q.market,currency:q.currency,marketInfo:services.marketInfo(q),lookupQuote:q,favorite:true});}
      else if(action==='clear-icon'){const f=document.querySelector('#stockForm');if(f){f._iconSequence=(f._iconSequence||0)+1;f._iconData='';f.elements.iconMode.value='auto';f.querySelector('#stockIconFile').value='';f.querySelector('#stockIconStatus').textContent='';iconPreview(f);}}
      else if(action==='asset')openAsset(id);
      else if(action==='transaction')openTransaction(id);
      else if(['buy','sell','dividend','split'].includes(action))openTransaction('',action,id);
      else if(action==='batch')openBatch();
      else if(action==='batch-add')appendBatchRow();
      else if(action==='batch-preview')previewBatch();
      else if(action==='batch-paste')pasteBatch();
      else if(['batch-copy','batch-remove','batch-dividend'].includes(action)){
        const row=batchRows().find(r=>r.dataset.batchRow===id);if(!row)return;
        if(action==='batch-copy')appendBatchRow(batchData(row));
        else if(action==='batch-dividend')void loadBatchDividend(row,true);
        else {row.remove();renumberBatch();invalidateBatch();}
      }
      else if(action==='quotes')openQuotes();
      else if(action==='refresh')void refreshQuotes();
      else if(action==='lookup')void lookupName();
      else if(action==='lookup-dividends')void loadDividends(true);
      else if(action==='apply-dividend')applyDividend();
      else if(action==='import')openImport();
      else if(action==='archives')archives();
      else if(action==='edit-import')editImport(id);
      else if(action==='delete-import')deleteImport(id);
      else if(action==='export-smart'){const value=p().smartImports?.find(i=>i.token===id);if(value)api.downloadJSON(value.original,'SmartPortfolio_原始備份.json');}
      else if(action==='detail')detail(id);
      else if(action==='delete-asset')remove('asset',id);
      else if(action==='delete-transaction')remove('transaction',id);
      else if(action==='export-holdings')exportCSV('holdings');
      else if(action==='export-transactions')exportCSV('transactions');
    }
    function submit(form) {
      if(form.id==='stockBatchForm'){saveBatch(form);return true;}
      if(form.id==='stockImportForm'){saveImport(form);return true;}
      if(form.id==='stockForm'){save(form);return true;}
      if(form.id==='stockCatalogForm'){void searchCatalog(String(new FormData(form).get('query')||''));return true;}
      if(['stockSearchForm','stockListForm'].includes(form.id)){const d=new FormData(form);view.search=String(d.get('search')||'').trim();view.filter=String(d.get('filter')||'all');view.sort=String(d.get('sort')||view.sort);view.exchange=String(d.get('exchange')||'');view.category=String(d.get('category')||'');view.favorites=d.has('favorites');renderKeepingScroll();return true;}
      return false;
    }
    return {render,click,submit,updateTradeForm,onInput,onChange,suspend:pauseForecasts,importFile:file=>{openImport();return readImport(file);}};
  }};
})(globalThis);
