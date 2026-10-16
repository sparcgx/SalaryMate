(function(root){
 'use strict';
 const D=root.SalaryMateReferenceData,CURRENCIES=['TWD','USD','EUR','JPY','GBP','CNY','HKD','AUD','CAD','CHF','SGD','KRW'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const en=()=>document.documentElement.lang?.startsWith('en'),t=(zh,english)=>en()?english:zh;
 const fmt=n=>Number(n).toLocaleString(en()?'en-US':'zh-TW',{maximumFractionDigits:8});
 const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
 const cacheKey='salarymate_public_fx_v1';let activeController=null;
 function findBracket(rows,amount){if(!Number.isFinite(amount)||amount<=0)return null;const wage=Math.ceil(amount);return rows.find(r=>wage>=r.min&&(r.max===null||wage<=r.max))||null;}
 function validRate(r,date,base,quote){return r&&r.requestedDate===date&&r.base===base&&r.quote===quote&&dateValid(r.date)&&r.date<=date&&Date.parse(date)-Date.parse(r.date)<=7*86400000&&typeof r.rate==='number'&&Number.isFinite(r.rate)&&r.rate>0;}
 function readCache(){try{const x=JSON.parse(localStorage.getItem(cacheKey)||'[]');return Array.isArray(x)?x.slice(-60):[];}catch{return [];}}
 function stop(){activeController?.abort();activeController=null;}
 function mount(kind,api){
  stop();if(!['calendar','insurance','fx'].includes(kind))kind='calendar';
  const title=t('公開資料工具','Public reference tools');
  api.openDialog(title,`<section id="publicReferenceTools"><div class="form-actions">${[['calendar',t('辦公日曆','Office calendar')],['insurance',t('級距核對','Insurance brackets')],['fx',t('歷史匯率','Historical FX')]].map(([key,label])=>`<button type="button" class="btn ${key===kind?'btn-primary':''}" data-reference-tab="${key}" aria-pressed="${key===kind}">${label}</button>`).join('')}</div><div data-reference-body></div><p class="hint">${t('公開資料僅供查閱與核對，不會自動變更公司排班、薪資或投資紀錄。','Reference only. Company schedules, payroll and investments are not changed.')}</p><div class="form-actions"><button type="button" class="btn" data-action="close-dialog">${t('返回','Back')}</button></div></section>`,true);
  const host=document.getElementById('publicReferenceTools'),body=host.querySelector('[data-reference-body]');
  host.querySelectorAll('[data-reference-tab]').forEach(b=>b.onclick=()=>mount(b.dataset.referenceTab,api));
  const live=()=>host.isConnected&&document.getElementById('appDialog')?.open;
  if(kind==='calendar')calendar(body,api);
  else if(kind==='insurance')insurance(body);
  else fx(body,live);
 }
 const link=(url,label)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
 const source=(kind,name)=>`<p class="hint">${link(D.sources[kind],name)} · ${link(D.license,t('政府資料開放授權條款第 1 版','Open Government Data License v1'))}<br>${t('資料核對日期','Snapshot checked')}: ${D.checkedAt}</p>`;
 function calendar(body,api){
  let year=D.calendar[api.year]?Number(api.year):2026,month=Math.min(12,Math.max(1,Number(api.month)||1));
  body.innerHTML=`${!D.calendar[api.year]?'<p class="hint">'+t('所選年份未收錄，請從已收錄年份中選擇。','The selected year is unavailable. Choose a listed year.')+'</p>':''}<h4>${t('政府行政機關辦公日曆','Government office calendar')}</h4><p class="hint">${t('僅供參考；休息日、例假、國定假日及輪班安排依公司與適用規則確認。此表不會套用加班倍率。','Reference only. Confirm rest days, holidays and shifts with your employer. This table does not set overtime rates.')}</p><div class="form-grid"><label>${t('年份','Year')}<select class="field-select" data-year>${Object.keys(D.calendar).map(y=>`<option ${Number(y)===year?'selected':''}>${y}</option>`).join('')}</select></label><label>${t('月份','Month')}<select class="field-select" data-month>${Array.from({length:12},(_,i)=>`<option ${i+1===month?'selected':''}>${i+1}</option>`).join('')}</select></label></div><div data-calendar-month></div>${source('calendar',t('行政院人事行政總處','DGPA'))}`;
  const paint=()=>{const prefix=`${year}-${String(month).padStart(2,'0')}`,rows=D.calendar[year].filter(r=>r[0].startsWith(prefix)),offset=(new Date(prefix+'-01T12:00:00').getDay()+6)%7;
   body.querySelector('[data-calendar-month]').innerHTML=`<p>${t('放假','Days off')}: ${rows.filter(r=>r[1]).length} · ${t('上班','Work days')}: ${rows.filter(r=>!r[1]).length}</p><div class="v5-weekdays">${(en()?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['一','二','三','四','五','六','日']).map(s=>`<span>${s}</span>`).join('')}</div><div class="v5-calendar-grid">${'<div aria-hidden="true"></div>'.repeat(offset)}${rows.map(([date,off,note])=>`<div class="v5-day"><span class="v5-date-number">${Number(date.slice(8))}</span><span class="v5-calendar-tag ${off?'leave':'overtime'}">${off?t('放假','Off'):t('上班','Work')}</span>${note?`<small>${esc(note)}</small>`:''}</div>`).join('')}</div>`;
  };body.querySelector('[data-year]').onchange=e=>{year=Number(e.target.value);paint();};body.querySelector('[data-month]').onchange=e=>{month=Number(e.target.value);paint();};paint();
 }
 function insurance(body){
  const groups=[...new Set(D.labor.map(r=>r.group))];
  body.innerHTML=`<h4>${t('勞保／健保投保級距核對','Labor / health insurance bracket check')}</h4><p class="hint">${t('目前收錄 2026 年表。投保薪資／金額不是每月保費；不計算眷屬、補助或自負額。依申報口徑輸入完整月薪資總額，不只本薪。','2026 tables only. Insured salary is not the monthly premium; dependants, subsidies and employee premiums are excluded. Enter the complete reportable monthly wage, not base salary alone.')}</p><div class="form-grid"><label>${t('核對日期','Date')}<input class="field" type="date" data-date value="${today()}"></label><label>${t('勞保身分別','Labor insurance category')}<select class="field-select" data-group>${groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label><label>${t('月薪資總額 TWD','Reportable monthly wage TWD')}<input class="field" type="number" min="0.01" step="0.01" inputmode="decimal" data-wage></label><label>${t('目前申報勞保投保薪資（選填）','Current labor insured salary (optional)')}<input class="field" type="number" min="1" step="1" data-labor></label><label>${t('目前申報健保投保金額（選填）','Current health insured amount (optional)')}<input class="field" type="number" min="1" step="1" data-health></label></div><button type="button" class="btn btn-primary" data-check>${t('核對','Check')}</button><div data-result role="status"></div><p class="hint">${t('健保結果僅按一般受僱者薪資區間查表；雇主、自營、特殊最低投保金額與其他身分請另依官方規定核對。小數薪資先向上取整數元再查表。','Health results use the standard employee wage table. Employer, self-employed and other special minimums require separate verification. Fractional wages are rounded up to whole TWD for lookup.')}</p>${source('labor',t('勞動部','Ministry of Labor'))}${source('health',t('衛生福利部中央健康保險署','National Health Insurance Administration'))}`;
  body.querySelector('[data-check]').onclick=()=>{
   const date=body.querySelector('[data-date]').value,wage=Number(body.querySelector('[data-wage]').value),out=body.querySelector('[data-result]');
   if(!dateValid(date)||date<D.effectiveFrom||date>D.effectiveThrough){out.textContent=t('此日期尚無已核對的適用表，請查閱官方資料；不沿用其他年度級距。','No verified table for this date. Check the official source; other years are not substituted.');return;}
   const labor=findBracket(D.labor.filter(r=>r.group===body.querySelector('[data-group]').value),wage),health=findBracket(D.health,wage);
   if(!labor||!health){out.textContent=t('請輸入有效月薪資總額；查無符合區間時請核對身分。','Enter a valid monthly wage and verify the insurance category.');return;}
   const result=(key,r,label)=>{const input=body.querySelector('[data-'+key+']').value,current=Number(input);return `<article class="card card-pad"><h4>${label}</h4><strong>${fmt(r.amount)} TWD</strong><p>${t('級別','Grade')} ${esc(r.grade)} · ${esc(r.label)}</p><p>${input?(current===r.amount?t('與輸入申報額一致','Matches entered amount'):t('與輸入申報額不同，請核對','Differs from entered amount; please verify')):t('未輸入目前申報額','No current amount entered')}</p></article>`;};
   out.innerHTML=`<p>${t('適用表','Table')}: ${D.effectiveFrom} · ${t('核對日期','Date')}: ${date}</p><div class="form-grid">${result('labor',labor,t('勞保投保薪資','Labor insured salary'))}${result('health',health,t('健保投保金額','Health insured amount'))}</div>`;
  };
 }
 function fx(body,live){
  body.innerHTML=`<h4>${t('歷史參考匯率','Historical reference exchange rate')}</h4><p class="hint">${t('Frankfurter 每日參考中間價，非銀行成交價。週末／假日可能回傳較早參考日；不會改寫交易成本。查詢只傳日期與幣別，不傳薪資、持股或金額。','Frankfurter daily reference mid-rates, not bank execution rates. Weekends / holidays may return an earlier reference date. Transaction costs remain unchanged. Only dates and currencies are sent.')}</p><div class="form-grid"><label>${t('查詢日期','Requested date')}<input class="field" type="date" min="1999-01-01" max="${today()}" value="${today()}" data-date></label>${['base','quote'].map((key,i)=>`<label>${i?t('目標幣別','Quote currency'):t('來源幣別','Base currency')}<select class="field-select" data-${key}>${CURRENCIES.map(c=>`<option ${c===(i?'TWD':'USD')?'selected':''}>${c}</option>`).join('')}</select></label>`).join('')}</div><div class="form-actions"><button type="button" class="btn btn-primary" data-query>${t('查詢','Look up')}</button><button type="button" class="btn" data-refresh>${t('重新取得','Refresh')}</button></div><div data-result role="status"></div><p class="hint">${link('https://frankfurter.dev/',t('Frankfurter 資料與授權','Frankfurter data and terms'))} · ${t('已查詢結果最多暫存 60 筆供離線查閱；首次查詢需連線。','Up to 60 results are cached for offline use. New lookups need a connection.')}</p>`;
  const out=body.querySelector('[data-result]');let requestId=0;
  const query=async(force=false)=>{
   stop();const id=++requestId,date=body.querySelector('[data-date]').value,base=body.querySelector('[data-base]').value,quote=body.querySelector('[data-quote]').value;
   if(!dateValid(date)||date<'1999-01-01'||date>today()){out.textContent=t('請選擇有效歷史日期。','Choose a valid historical date.');return;}
   const key=[date,base,quote].join(':'),cached=readCache().find(x=>x.key===key&&validRate(x.value,date,base,quote));
   const show=(r,note)=>{out.innerHTML=`<article class="card card-pad"><strong>1 ${base} = ${fmt(r.rate)} ${quote}</strong><p>${t('查詢日期','Requested')}: ${date}<br>${t('實際參考日','Actual reference date')}: ${esc(r.date)}</p><p>${esc(note)}</p>${r.date!==date?`<p class="hint">${t('來源提供較早參考日，並非查詢當日成交匯率。','An earlier reference date was returned; this is not an execution rate for the requested date.')}</p>`:''}</article>`;};
   if(cached&&!force){show(cached.value,t('本機快取；可按重新取得核對來源修訂。','Local cache; refresh to check source revisions.'));return;}
   out.textContent=t('正在取得參考匯率…','Loading reference rate…');
   const controller=new AbortController();activeController=controller;const timer=setTimeout(()=>controller.abort(),16000);
   try{
    const origin=root.SalaryMatePortable?.marketOrigin||location.origin;
    const response=await fetch(origin+'/api/reference/fx?'+new URLSearchParams({date,base,quote}),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw Error('Unavailable');const value=await response.json();if(!validRate(value,date,base,quote))throw Error('Invalid result');
    if(!live()||id!==requestId||controller.signal.aborted)return;
    const entries=readCache().filter(x=>x.key!==key);entries.push({key,value});try{localStorage.setItem(cacheKey,JSON.stringify(entries.slice(-60)));}catch{}
    show(value,t('已取得來源參考值；非成交匯率。','Reference rate retrieved; not an execution rate.'));
   }catch{if(live()&&id===requestId){if(cached)show(cached.value,t('連線失敗，顯示原快取；尚未重新核對。','Connection failed. Showing the previous unrefreshed cache.'));else out.textContent=t('未取得有效匯率，請稍後重試；既有紀錄未變更。','No valid rate available. Retry later; existing records are unchanged.');}}
   finally{clearTimeout(timer);if(activeController===controller)activeController=null;}
  };
  body.querySelector('[data-query]').onclick=()=>query();body.querySelector('[data-refresh]').onclick=()=>query(true);
  body.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{requestId++;stop();out.textContent='';}));
 }
 root.SalaryMateReference=Object.freeze({mount,stop,findBracket,validRate});
})(globalThis);
