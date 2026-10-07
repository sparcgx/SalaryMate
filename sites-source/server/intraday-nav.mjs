// Issuer-published estimates only. Do not combine NAV with an unrelated closing quote.
export function createIntradayNavLookup(read, clock=()=>Date.now()) {
  const decimal=v=>{
    if(typeof v==='number')return Number.isFinite(v)?v:null;
    if(typeof v!=='string'||!/^\s*[+-]?[\d,]+(?:\.\d+)?%?\s*$/.test(v))return null;
    const n=Number(v.trim().replaceAll(',','').replace(/%$/,''));return Number.isFinite(n)?n:null;
  };
  const timestamp=(date,time)=>{
    const d=String(date||'').replaceAll('/','-'),t=String(time||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(t))return null;
    const at=d+'T'+t+'+08:00',ms=Date.parse(at);
    if(!Number.isFinite(ms)||new Date(ms+28800000).toISOString().slice(0,19)!==d+'T'+t||ms>clock()+120000)return null;
    return at;
  };
  const record=(provider,symbol,value,at,price,premium,day)=>{
    const n=decimal(value),p=decimal(price);
    if(!/^[0-9A-Z]{2,12}$/.test(symbol))return null;
    if(!(n>0)||!at)return {symbol,nav:null};
    return {symbol,nav:{provider,value:n,at,currency:'TWD',marketPrice:p>0?p:null,premiumPercent:p>0?decimal(premium):null,businessDay:day==='Y'?true:day==='N'?false:null}};
  };
  const text=html=>html.replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').trim();
  const providers=[{
    id:'capital',matches:name=>name.includes('群益'),
    async load(){
      const d=await read('https://www.capitalfund.com.tw/CFWeb/api/etf/nav',30000,{method:'POST',headers:{'content-type':'application/json',referer:'https://www.capitalfund.com.tw/etf/transaction/networth'},body:'null'});
      if(d?.code!==200||!Array.isArray(d.data))throw new Error('Invalid issuer response');
      return d.data.map(r=>record('capital',String(r.stocNo||'').trim().toUpperCase(),r.stockDollarname==='台幣'?r.nav:null,timestamp(r.date1,r.time1),r.price,r.diffRatio,r.workDay)).filter(Boolean);
    }
  },{
    id:'fubon',matches:name=>name.includes('富邦'),
    async load(){
      const html=await read('https://websys.fsit.com.tw/FubonETF/Trade/Estimate.aspx?area=TA',30000,{headers:{referer:'https://websys.fsit.com.tw/FubonETF/'}},'text');
      if(typeof html!=='string'||html.length>2000000)throw new Error('Invalid issuer page');
      const rows=[];
      for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
        const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>text(m[1]));
        if(cells.length!==11)continue;
        const symbol=cells[0].split(/\s+/)[0];
        // The K/C share classes trade in RMB/USD; the ledger request here is TWD.
        if(/[KC]$/.test(symbol))continue;
        const [date,time]=cells[9].split(/\s+/),r=record('fubon',symbol,cells[2],timestamp(date,time),cells[5],cells[7],cells[10]);
        if(r)rows.push(r);
      }
      if(!rows.length)throw new Error('Issuer page has no valid estimates');
      return rows;
    }
  }];
  return async (rows,{discover=false}={})=>{
    const targets=rows.filter(r=>r.market==='TW'&&r.instrumentType==='etf');
    for(const row of targets)row.intradayNavStatus='unsupported';
    const results=await Promise.all(providers.map(async provider=>{
      const selected=targets.filter(r=>r.currency==='TWD'&&!/[KC]$/.test(r.symbol)&&(discover||provider.matches(r.name||'')));if(!selected.length)return {selected,data:[]};
      try{
        const data=await provider.load();
        return {selected,data};
      }catch{return {selected,data:[],failed:true};}
    }));
    for(const row of targets){
      const selected=results.filter(r=>r.selected.includes(row)),found=selected.flatMap(r=>r.data).find(r=>r.symbol===row.symbol&&r.nav);
      if(found){row.intradayNav=found.nav;row.intradayNavStatus='available';}
      else if(selected.some(r=>r.failed||r.data.some(x=>x.symbol===row.symbol))||!discover&&selected.length)row.intradayNavStatus='unavailable';
    }
  };
}
