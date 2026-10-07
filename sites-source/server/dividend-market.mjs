// Announcement values only: never estimate dividends from yield or current holdings.
export function createDividendLookup(read, clock=()=>Date.now()) {
  const date=value=>{
    const s=String(value??'').trim();let m=s.match(/^(\d{3,4})(?:年|\/|-)(\d{1,2})(?:月|\/|-)(\d{1,2})日?$/);
    if(!m&&/^\d{7,8}$/.test(s))m=[s,s.slice(0,-4),s.slice(-4,-2),s.slice(-2)];
    if(!m)return '';const y=Number(m[1])+(m[1].length===3?1911:0),out=`${y}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return Number.isFinite(Date.parse(out))&&new Date(out).toISOString().slice(0,10)===out?out:'';
  };
  const amount=value=>{if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;const s=String(value??'').trim().replaceAll(',','');return /^\d+(?:\.\d+)?$/.test(s)&&Number.isFinite(Number(s))?Number(s):null;};
  const twEtf='https://www.twse.com.tw/zh/products/securities/etf/products/div.html';
  const twForecast='https://www.twse.com.tw/zh/announcement/ex-right/twt48u.html';
  const tpEtf='https://info.tpex.org.tw/ETF/zh/dividend-list.html';
  const tpForecast='https://www.tpex.org.tw/openapi/v1/tpex_exright_prepost';
  return async ({market,symbol},year,{forecast=false}={})=>{
    const checkedAt=new Date(clock()).toISOString(),announcements=[],errors=[];
    if(market!=='TW')return {market,symbol,announcements,errors:['官方公告查詢目前支援台股股票與 ETF；其他市場請依發行人公告填寫。'],checkedAt};
    const startDate=`${year-1}0101`,endYear=year+(forecast?1:0),endDate=`${endYear}1231`,fund=/^00/.test(symbol);
    const add=(code,name,ex,pay,cash,source,sourceUrl)=>{
      if(String(code).trim().toUpperCase()!==symbol)return;
      const exDividendDate=date(ex),paymentDate=date(pay),cashDividend=amount(cash);
      if(!exDividendDate||Number(exDividendDate.slice(0,4))<year-1||Number(exDividendDate.slice(0,4))>endYear)return;
      announcements.push({market,symbol,name:String(name||symbol),exDividendDate,paymentDate,cashDividend,currency:'TWD',source,sourceUrl,checkedAt,status:cashDividend===null?'pending':'announced'});
    };
    const sources=[
      ['TWSE 除權息預告',async()=>{const rows=await read('https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL',300000);if(!Array.isArray(rows))throw Error();for(const r of rows)if(String(r.Exdividend).includes('息'))add(r.Code,r.Name,r.Date,'',r.CashDividend,'TWSE 除權息預告',twForecast);}],
      ['TPEx 除權息預告',async()=>{const rows=await read(tpForecast,300000);if(!Array.isArray(rows))throw Error();for(const r of rows)if(String(r.ExRrightsExDividend).includes('息'))add(r.SecuritiesCompanyCode,r.CompanyName,r.ExRrightsExDividendDate,'',r.CashDividend,'TPEx 除權息預告',tpForecast);}]
    ];
    if(fund){
      sources.push(['TWSE ETF 收益分配',async()=>{const d=await read(`https://www.twse.com.tw/rwd/zh/ETF/etfDiv?stkNo=${encodeURIComponent(symbol)}&startDate=${startDate}&endDate=${endDate}&response=json`,300000);if(!Array.isArray(d.data))throw Error();for(const r of d.data)add(r[0],r[1],r[2],r[4],r[5],'TWSE ETF 收益分配',twEtf);}]);
      sources.push(['TPEx ETF 收益分配',async()=>{const d=await read('https://info.tpex.org.tw/api/etfExDiv',300000,{method:'POST',body:new URLSearchParams({stkNo:symbol,startDate,endDate,lang:'zh-tw'}).toString(),headers:{'content-type':'application/x-www-form-urlencoded'}});if(!Array.isArray(d))throw Error();for(const r of d)add(r.stockNo,r.stockName,r.divDate,r.inDate,r.amount,'TPEx ETF 收益分配',tpEtf);}]);
    }else{
      sources.push(['TWSE 除息歷史',async()=>{
        const d=await read(`https://www.twse.com.tw/rwd/zh/exRight/TWT49U?startDate=${startDate}&endDate=${endDate}&response=json`,300000);if(!Array.isArray(d.data))throw Error();
        // Read the explicit cash-dividend field in each official detail. The summary's
        // combined rights + dividend value must never be treated as a cash dividend.
        const events=d.data.filter(r=>String(r[1]).trim()===symbol&&String(r[6]).includes('息')&&date(r[0])).sort((a,b)=>date(b[0]).localeCompare(date(a[0]))).slice(0,24);
        for(let i=0;i<events.length;i+=8){
          const results=await Promise.allSettled(events.slice(i,i+8).map(async r=>{
            const day=date(r[0]).replaceAll('-',''),detail=await read(`https://www.twse.com.tw/rwd/zh/exRight/TWT49UDetail?STK_NO=${encodeURIComponent(symbol)}&T1=${day}&response=json`,300000),row=detail.data?.[0];
            if(!row||String(row[0]).trim()!==symbol||!String(detail.fields?.[2]).includes('現金股利'))throw Error();
            const cash=String(row[2]).replace(/\s*元[／/]股\s*$/,'').trim();if(amount(cash)===null)throw Error();
            add(symbol,String(row[1]).trim(),r[0],'',cash,'TWSE 除息歷史',`https://www.twse.com.tw/zh/announcement/ex-right/twt49u-detail.html?${encodeURIComponent(symbol)},${day}`);
          }));
          if(results.some(r=>r.status==='rejected')&&!errors.includes('部分個股除息明細暫時無法取得。'))errors.push('部分個股除息明細暫時無法取得。');
        }
      }]);
    }
    const results=await Promise.allSettled(sources.map(([,run])=>run()));
    results.forEach((r,i)=>{if(r.status==='rejected')errors.push(sources[i][0]+' 暫時無法取得，已保留其他可用公告。');});
    // Prefer a complete distribution record; pending and confirmed amounts must never become zero.
    announcements.sort((a,b)=>Number(Boolean(b.paymentDate))-Number(Boolean(a.paymentDate)));
    const merged=[];
    for(const row of announcements){const previous=merged.find(p=>p.exDividendDate===row.exDividendDate&&(p.cashDividend===row.cashDividend||p.cashDividend===null||row.cashDividend===null));if(!previous)merged.push(row);else if(previous.cashDividend===null&&row.cashDividend!==null){Object.assign(previous,{cashDividend:row.cashDividend,status:row.status,source:row.source,sourceUrl:row.sourceUrl});}}
    merged.sort((a,b)=>b.exDividendDate.localeCompare(a.exDividendDate));
    if(merged.length===0&&results.every(r=>r.status==='rejected'))throw new Error('官方公告服務暫時無法使用，原資料保留。');
    return {market,symbol,announcements:merged.slice(0,100),errors,checkedAt};
  };
}
