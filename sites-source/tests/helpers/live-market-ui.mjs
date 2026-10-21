import fs from "node:fs";import vm from "node:vm";
const NOW=Date.parse('2026-10-05T02:00:00Z'),today='2026-10-05';
const source=name=>fs.readFileSync(new URL('../../dist/dev/v5.0.0-dev.2/'+name,import.meta.url),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
const asset=(extra={})=>({id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'private account',quotePrice:100,quoteDate:'2026-10-02',quoteFx:1,quoteMode:'auto',...extra});
const portfolio=(extra={})=>({assets:[asset()],transactions:[{id:'buy',assetId:'a',type:'buy',date:'2026-10-01',time:'12:00',quantity:10,price:80,fx:1,fee:2,tax:0}],...extra});
const quote=(extra={})=>({market:'TW',symbol:'2330',currency:'TWD',price:120,date:today,quoteAt:'2026-10-05T09:59:58+08:00',providerTime:'2026-10-05 09:59:58',source:'TWSE 最新成交',...extra});
const snapshot=(extra={})=>({quotes:[quote()],fx:{rate:31.839,date:today},fetchedAt:new Date(NOW).toISOString(),errors:[],...extra});
const settle=()=>new Promise(r=>setImmediate(r));
function harness(initial=portfolio(),fetcher,start=NOW){
  let now=start,current={stockPortfolio:clone(initial)},hidden=false,editing=false,onPage=true,online=true,save=true,commits=0;
  let lastHTML='',opened='';const timers=new Map(),listeners=new Map(),events=new Map(),pending=[];let timerId=0;
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const document={activeElement:null,documentElement:{},get hidden(){return hidden;},addEventListener:(type,fn)=>listeners.set(type,fn),querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>null}),querySelector:s=>s==='.stock-view'?onPage?{}:null:s==='#appDialog'?{open:editing,addEventListener(){}}:null};
  const c=vm.createContext({Date:FixedDate,Intl,console,AbortController,navigator:{get onLine(){return online;},language:'en',languages:['en']},fetch:fetcher||(()=>{}),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),document,FormData:class{constructor(form){this.values=form.values;}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}},SalaryMateI18n:{user:s=>s,text:s=>s,apply(){}},addEventListener:(type,fn)=>events.set(type,fn)});
  for(const file of ['stocks.js','market-hours.js','stocks-integrations.js','stocks-ui.js'])vm.runInContext(source(file),c);
  c.SalaryMateStockServices.refreshSessions=async()=>{};
  if(!fetcher)c.SalaryMateStockServices.fetchQuotes=(assets,path,signal,options)=>new Promise((resolve,reject)=>pending.push({assets:clone(assets),path,signal,options,resolve,reject}));
  const api={state:()=>current,year:()=>2026,today:()=>new Date(now+8*3600000).toISOString().slice(0,10),legacyTotal:()=>0,id:()=>String(++timerId),begin(){},assert:()=>true,validate:()=>true,close(){},error:(form,message)=>{throw Error(message);},open:(title,html)=>{opened=html;},toast(){},commit:fn=>{if(!save)return false;fn();commits++;return true;},render:()=>{lastHTML=ui.render('');}};
  const ui=c.SalaryMateStocksUI.create(api);
  const click=stock=>ui.click({dataset:{stock},closest:()=>null});
  return {c,ui,click,timers,pending,document,core:c.SalaryMateStocks,services:c.SalaryMateStockServices,
    state:()=>current.stockPortfolio,render:()=>lastHTML=ui.render(''),html:()=>lastHTML,opened:()=>opened,commits:()=>commits,
    setHidden:v=>hidden=v,setEditing:v=>editing=v,setPage:v=>onPage=v,setOnline:v=>online=v,setSave:v=>save=v,
    advance:ms=>now+=ms,visibility:()=>listeners.get('visibilitychange')?.(),event:type=>events.get(type)?.(),
    fire:()=>{const [id,t]=timers.entries().next().value||[];if(t){timers.delete(id);t.fn();}return t;}};
}


export {harness,asset,portfolio,quote,snapshot,settle,NOW};
