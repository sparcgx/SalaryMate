import fs from 'node:fs/promises';
const targets={
  twCalendar:'https://www.twse.com.tw/rwd/zh/holidaySchedule/holidaySchedule?response=json&queryYear=2026',
  twTrade:'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw%7Ctse_0050.tw%7Cotc_00679B.tw&json=1&delay=0',
  usStock:'https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks',
  usEtf:'https://api.nasdaq.com/api/quote/VOO/info?assetclass=etf'
};
const results=await Promise.all(Object.entries(targets).map(async([name,url])=>{
  try{const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{accept:'application/json','user-agent':'SalaryMate/5.1 market updates',referer:url.includes('nasdaq')?'https://www.nasdaq.com/':'https://www.twse.com.tw/'}});const text=await r.text();let data;try{data=JSON.parse(text);}catch{};return {name,url,status:r.status,data:data??text.slice(0,200)};}catch(e){return {name,url,error:e.message};}
}));
await fs.mkdir(new URL('../release-evidence/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../release-evidence/market-source-probe.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
for(const r of results)console.log(JSON.stringify({name:r.name,status:r.status,error:r.error,data:r.data}));
