(function(root){
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('zh-TW',{maximumFractionDigits:d}).format(n):'—';
  const mean=values=>values.reduce((s,x)=>s+x,0)/values.length;
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  const supported=a=>['TW','US'].includes(a.market)&&!['fund','other'].includes(a.typeOverride||a.marketInfo?.instrumentType)&&a.currency===(a.market==='TW'?'TWD':'USD');
  function rsi(closes,period=14){
    if(closes.length<period+1)return null;
    let gain=0,loss=0;
    for(let i=1;i<=period;i++){const d=closes[i]-closes[i-1];gain+=Math.max(0,d)/period;loss+=Math.max(0,-d)/period;}
    for(let i=period+1;i<closes.length;i++){const d=closes[i]-closes[i-1];gain=(gain*(period-1)+Math.max(0,d))/period;loss=(loss*(period-1)+Math.max(0,-d))/period;}
    return gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
  }
  function expectedClose(market,now,calendars){
    for(let i=0;i<22;i++){const s=root.SalaryMateMarketHours.marketSession(market,now-i*86400000,calendars);if(!s.calendarKnown)return '';if(s.phase!=='holiday'&&now>=s.closesAt)return s.date;}
    return '';
  }
  function analyze(history,{now=Date.now(),calendars=root.SalaryMateMarketHours.MARKET_CALENDARS}={}){
    const issues=[],bars=[],seen=new Set();
    if(!history||!['TW','US'].includes(history.market)||!Array.isArray(history.bars))return {status:'unavailable',title:'資料格式不完整',issues:['未取得有效歷史行情'],bars:[]};
    for(const b of history.bars){
      if(!validDate(b.date)||typeof b.close!=='number'||!Number.isFinite(b.close)||b.close<=0||seen.has(b.date)){issues.push('歷史價格或日期不完整');continue;}
      seen.add(b.date);bars.push(b);
    }
    bars.sort((a,b)=>a.date.localeCompare(b.date));
    const expected=expectedClose(history.market,now,calendars),last=bars.at(-1);
    if(!expected)issues.push('交易日曆尚未確認');
    else if(last?.date!==expected)issues.push(last?.date>expected?'尚未收盤的價格不納入分析':'等待最新收盤資料');
    if(history.partial)issues.push('來源有缺漏，請重試');
    if(history.adjustment!=='unadjusted')issues.push('價格計算基準未確認');
    if(bars.length<60)issues.push(`需至少 60 筆收盤資料，目前 ${bars.length} 筆`);
    const recent=bars.slice(-60);
    if(expected&&recent.length>1){
      const first=Date.parse(recent[0].date+'T12:00:00Z'),end=Date.parse(last.date+'T12:00:00Z');
      for(let t=first;t<=end;t+=86400000){const s=root.SalaryMateMarketHours.marketSession(history.market,t,calendars);if(s.calendarKnown&&s.phase!=='holiday'&&!seen.has(s.date)){issues.push('近期交易日有缺價，暫停建議');break;}}
    }
    if(recent.some((b,i)=>b.corporateAction||i>0&&Math.abs(b.close/recent[i-1].close-1)>=.2))issues.push('價格跳動或分割／除權事件待核對');
    const result={bars,expectedDate:expected,asOf:last?.date||'',issues:[...new Set(issues)],status:'unavailable',title:issues[0]||'等待資料',metrics:null};
    if(issues.length)return result;
    const closes=bars.map(b=>b.close),price=last.close,sma20=mean(closes.slice(-20)),sma60=mean(closes.slice(-60)),prior20=mean(closes.slice(-25,-5)),strength=rsi(closes);
    const returns=closes.slice(-21).slice(1).map((v,i)=>Math.log(v/closes.slice(-21)[i])),avg=mean(returns),volatility=Math.sqrt(returns.reduce((s,v)=>s+(v-avg)**2,0)/(returns.length-1))*Math.sqrt(252)*100;
    let peak=recent[0].close,maxDrawdown=0;for(const b of recent){peak=Math.max(peak,b.close);maxDrawdown=Math.min(maxDrawdown,(b.close/peak-1)*100);}
    const change20=(price/closes.at(-21)-1)*100,distance20=(price/sma20-1)*100,up=price>sma20&&sma20>sma60&&sma20>prior20,down=price<sma20&&sma20<sma60;
    let signal='neutral',title='中性觀望',summary='均線與動能方向尚未一致，先觀察價格是否站穩 20 日均線，再考慮新部位。';
    if(down&&strength<45){signal='reduce';title='減碼風險評估';summary='價格低於 20／60 日均線，短期動能偏弱。已有部位可檢視是否分批減碼；尚未持有可等待趨勢回穩。';}
    else if(strength>=70){signal='wait';title='偏熱，留意追價';summary='RSI 已進入偏熱區，強勢可能延續，但追高風險上升。新增部位可等待回檔；已有部位檢視集中度與獲利保護。';}
    else if(strength<=30){signal='wait';title='偏弱，等待止穩';summary='RSI 偏低不代表即將反彈。先等價格與均線回穩，避免只因跌深就加碼。';}
    else if(up&&strength>=45&&strength<=65&&distance20<5&&volatility<60){signal='buy';title='分批買入觀察';summary='價格與均線方向一致向上，動能尚未過熱。可列入分批買入觀察名單，先核對基本面、近期公告與可承受損失。';}
    else if(up){signal='hold';title='續抱觀察';summary='趨勢仍偏上行。已有部位可持續觀察；新部位等待更合適的回檔與風險條件，避免一次投入。';}
    return {...result,status:'ready',signal,title,summary,metrics:{price,sma20,sma60,rsi:strength,volatility,maxDrawdown,change20,distance20},reasons:[`收盤 ${fmt(price)}，${price>=sma20?'高於':'低於'} 20 日均線 ${fmt(sma20)}。`,`20 日均線${sma20>=sma60?'高於':'低於'} 60 日均線 ${fmt(sma60)}。`,`RSI(14) ${fmt(strength,1)}，${strength>=70?'偏熱':strength<=30?'偏弱':'介於 30–70 區間'}。`],risks:[...(recent.some(b=>b.nonComparable)?['近期含不比價註記，可能涉及除權息；請先核對公告，均線可能受到影響。']:[]),...(volatility>=40?['近期價格波動較大，宜降低單筆投入並預留緩衝。']:[]),'使用未還原每日收盤價；除息、分割與公司事件可能影響指標。','只分析價格趨勢，未納入即時新聞、財報、估值、費稅與個人風險承受度。']};
  }
  function chart(bars,range){
    const rows=bars.slice(-range);if(rows.length<2)return '';
    const values=rows.map(b=>b.close),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||lo*.02||1;
    const x=i=>24+i/(rows.length-1)*712,y=p=>150-(p-lo)/span*120;
    const points=rows.map((b,i)=>`${fmt(x(i),2).replaceAll(',','')},${fmt(y(b.close),2).replaceAll(',','')}`).join(' ');
    return `<div class="insight-chart"><svg viewBox="0 0 760 185" role="img" aria-label="${rows.length} 筆收盤價走勢，${esc(rows[0].date)} 至 ${esc(rows.at(-1).date)}，最低 ${fmt(lo)}，最高 ${fmt(hi)}"><path d="M24 30H736M24 90H736M24 150H736" class="insight-gridline"/><polygon points="24,150 ${points} 736,150" class="insight-chart-area"/><polyline points="${points}" class="insight-chart-line"/><circle cx="736" cy="${y(values.at(-1))}" r="4.5" class="insight-chart-end"/><text x="24" y="177">${esc(rows[0].date)}</text><text x="736" y="177" text-anchor="end">${esc(rows.at(-1).date)}</text></svg><div class="insight-chart-bounds"><span>區間最低 ${fmt(lo)}</span><span>區間最高 ${fmt(hi)}</span></div></div>`;
  }
  function create({portfolio,model,render,active,detail,renderIcon}){
    let selected='',range=60,busy=false,controller,timer,sequence=0,error='',pendingKey='';const cache=new Map();
    const key=a=>a.market+':'+a.symbol.toUpperCase();
    const candidates=()=>portfolio().assets.filter(supported);
    const asset=()=>candidates().find(a=>a.id===selected)||candidates()[0];
    function pause(){clearTimeout(timer);timer=null;sequence++;controller?.abort();controller=null;busy=false;pendingKey='';}
    function schedule(){
      const a=asset();if(!a||busy||timer||error||!active()||root.document.hidden)return;
      const entry=cache.get(key(a)),wait=entry?Math.max(100,600000-(Date.now()-entry.loaded)):100;
      timer=setTimeout(()=>{timer=null;void refresh();},wait);
    }
    async function refresh(){
      const a=asset();if(!a||!active()||root.document.hidden)return;
      pause();const own=++sequence,k=key(a);controller=new AbortController();busy=true;pendingKey=k;error='';render();
      try{
        const h=await root.SalaryMateStockServices.history(a,controller.signal);
        if(sequence!==own||!active()||asset()?.id!==a.id)return;
        if(h.market!==a.market||h.symbol!==a.symbol.toUpperCase()||h.currency!==a.currency)throw Error('歷史行情與目前標的不符');
        analyze(h); // Validate shape before retaining a response.
        if(cache.size>=24)cache.delete(cache.keys().next().value);
        cache.set(k,{data:h,loaded:Date.now()});
      }catch(e){if(sequence===own&&e.name!=='AbortError')error=e.message||'歷史行情暫時無法取得';}
      finally{if(sequence===own){busy=false;pendingKey='';controller=null;if(active())render();}}
    }
    const action=(label,name,attrs='')=>`<button type="button" class="btn" data-stock="insight-${name}" ${attrs}>${label}</button>`;
    function view(){
      const assets=candidates(),a=asset();if(a)selected=a.id;
      const icons=root.SalaryMateStockIcons;
      const hero=`<header class="insight-hero"><span class="insight-hero-icon">${icons.svg('insight')}</span><div><p class="stock-eyebrow">INVESTMENT INSIGHTS <span>近期 1–4 週觀察</span></p><h3>智慧分析</h3><p>把近期價格，轉成看得懂的買賣觀察。</p></div><span class="insight-method-pill">規則型技術分析</span></header>`;
      if(!a)return `<section class="stock-insights">${hero}<div class="stock-panel stock-empty"><h3>從一檔股票或 ETF 開始</h3><p>先加入台股或美股股票／ETF，就能查看近期趨勢、買賣觀察與風險提醒。基金與其他市場尚不支援。</p><button class="btn btn-primary" type="button" data-stock="asset">新增股票／ETF</button></div></section>`;
      const entry=cache.get(key(a)),h=entry?.data,r=h?analyze(h,{calendars:root.SalaryMateStockServices.calendars()}):null;
      const fresh=entry&&Date.now()-entry.loaded<600000,ready=r?.status==='ready'&&fresh&&!error&&!busy;
      const controls=`<div class="insight-controls"><label><span class="field-label">分析標的</span><select class="field-select" name="insightAsset">${assets.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.symbol)} · ${esc(x.name)}${x.account?' · '+esc(x.account):''}</option>`).join('')}</select></label><div>${action(busy?'正在更新…':'更新分析','refresh',busy?'disabled aria-busy="true"':'')}${action('檢視股票','detail')}</div></div>`;
      const head=`<div class="insight-instrument"><span class="insight-asset-icon">${renderIcon?renderIcon(a):icons.svg(icons.infer(a))}</span><div><h3>${esc(a.symbol)} <span>${esc(a.name)}</span></h3><p>${a.market==='TW'?'台股':'美股'} · ${esc(a.currency)} · ${h?`已收盤資料至 ${esc(r.asOf)}`:'等待歷史行情'}</p></div></div>`;
      let body='';
      if(!ready){
        const title=busy?'正在讀取近期行情':error?'暫時無法更新':!fresh&&h?'正在確認資料時效':r?.title||'準備分析';
        const notes=error?[error]:r?.issues?.length?r.issues:['讀取官方歷史收盤價，完成後會顯示分析。'];
        body=`<div class="insight-notice" role="status"><strong>${esc(title)}</strong><p>${notes.map(esc).join('；')}</p>${error?'<p>本次暫停買賣建議，可按「更新分析」重試。</p>':''}</div>${h&&r.bars.length?chart(r.bars,range):''}`;
      }else{
        const t=r.metrics,m=model(),same=m.holdings.filter(s=>key(s.asset)===key(a)),holding={quantity:same.reduce((n,s)=>n+s.quantity,0),value:same.reduce((n,s)=>n+(s.value||0),0)},weight=!m.missing&&m.pricedValue>0&&holding.value>0?holding.value/m.pricedValue*100:null;
        body=`<div class="insight-result-grid"><section class="insight-decision" data-signal="${r.signal}"><span class="insight-section-label">近期買賣參考</span><h4>${esc(r.title)}</h4><p>${esc(r.summary)}</p><ul>${r.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="insight-next"><strong>下一個觀察點</strong><p>觀察後續收盤是否站穩 20 日均線 ${fmt(t.sma20)} ${esc(a.currency)}；跌破或重新站回時，再重新評估。此為觀察線，並非保證有效的買賣價。</p></div></section><section class="insight-evidence"><div class="insight-chart-head"><h4>收盤價走勢</h4><div role="group" aria-label="走勢期間">${[20,60,120].map(n=>action(n===120?'全部':n+' 日','range',`data-id="${n}" aria-pressed="${range===n}"`)).join('')}</div></div>${chart(r.bars,range)}<dl class="insight-metrics"><div><dt>20 日漲跌</dt><dd>${t.change20>0?'+':''}${fmt(t.change20)}%</dd></div><div><dt>RSI · 14 日</dt><dd>${fmt(t.rsi,1)}</dd></div><div><dt>20 日均線</dt><dd>${fmt(t.sma20)}</dd></div><div><dt>60 日均線</dt><dd>${fmt(t.sma60)}</dd></div><div><dt>60 日最大回落</dt><dd>${fmt(t.maxDrawdown)}%</dd></div><div><dt>20 日波動 · 年化估算</dt><dd>${fmt(t.volatility,1)}%</dd></div></dl></section></div><aside class="insight-risk"><strong>風險與部位提醒</strong><p>${holding?.quantity>0?'你已持有此標的，建議先檢視現有部位，再決定是否調整。':'目前為觀察標的；買入前請先設定可承受的損失與投入上限。'}${weight!=null?` 此標的占已記錄持股市值 ${fmt(weight,1)}%。${weight>=30?'占比較高，需留意單一標的集中風險。':''}`:''}</p><ul>${r.risks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></aside>`;
      }
      const sourceUrl=h&&/^https:\/\/(?:www\.twse\.com\.tw|www\.tpex\.org\.tw|www\.nasdaq\.com)\//.test(h.sourceUrl)?h.sourceUrl:'';
      const source=h?`<p class="insight-source">資料來源：${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(h.source)}</a>`:esc(h.source)} · ${r.bars.length} 筆日資料 · 取得時間 ${esc(h.fetchedAt.replace('T',' ').replace('Z',' UTC'))}。盤中報價與此收盤分析分開更新。</p>`:'';
      schedule();
      return `<section class="stock-insights">${hero}${controls}<section class="stock-panel insight-main" aria-busy="${busy}">${head}${body}${source}</section><details class="stock-method insight-method"><summary>建議怎麼產生？</summary><p>本功能在本機依固定規則計算，不是生成式 AI，也不預測勝率。至少使用 60 個交易日：20／60 日簡單移動平均、Wilder RSI(14)、20 日對數報酬波動（乘以 √252 年化）與 60 日最大回落。</p><p>分批買入觀察：收盤高於 20 日均線、20 日均線高於 60 日且比 5 日前上升；RSI 45–65、距 20 日線小於 5%、年化波動小於 60%。減碼評估：收盤低於 20 日線、20 日線低於 60 日且 RSI 小於 45。其他情況依過熱、偏弱或中性顯示觀察。這些是本版觀察規則，未經獲利回測驗證。</p><p>過期、缺價、少於 60 筆或近期單日跳動達 20% 等情況暫停建議。未還原價格可能受除權息、分割影響；尚未涵蓋所有公司事件。分析不會替你下單或更動記帳資料。查詢只送出市場與代號，部位占比留在本機計算。</p><p>指標說明：<a href="https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI" target="_blank" rel="noopener noreferrer">Fidelity RSI 指南</a>。以上為研究參考，不是依個人財務狀況制定的投資建議。</p></details></section>`;
    }
    return {view,pause,refresh,resume(){if(active())render();},change(event){if(event.target.name!=='insightAsset')return false;pause();selected=event.target.value;error='';render();return true;},click(el){const action=el.dataset.stock;if(!action?.startsWith('insight-'))return false;if(action==='insight-refresh')void refresh();else if(action==='insight-range'){range=[20,60,120].includes(+el.dataset.id)?+el.dataset.id:60;render();}else if(action==='insight-detail')detail(selected);return true;}};
  }
  root.SalaryMateInvestmentInsights=Object.freeze({analyze,rsi,expectedClose,supported,create});
})(globalThis);
