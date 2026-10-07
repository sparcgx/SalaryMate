import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
export const baseline='20c25f66c1c01a4d2199b217ed22c312a4423dd7';
const root=new URL('../../',import.meta.url),base='dist/dev/v5.0.0-dev.2/';
export const source=(name,before=false)=>before?execFileSync('git',['show',baseline+':'+base+name],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}):fs.readFileSync(new URL(base+name,root),'utf8');
export const plain=value=>JSON.parse(JSON.stringify(value));
export function runtime(before=false){
 const context=vm.createContext({console});context.window=context;
 for(const name of ['stocks.js','comp-time.js','backup.js','annual-analysis.js'])vm.runInContext(source(name,before),context);
 return context;
}
export function portfolio(seed=0,count=4){
 const date=i=>new Date(Date.UTC(2024,0,1+i*9)).toISOString().slice(0,10);
 const assets=Array.from({length:count},(_,a)=>({id:'a'+a,symbol:String(9000+a),name:'Synthetic '+a,market:'TW',currency:'TWD',quotePrice:120,quoteDate:'2026-10-06',quoteFx:1,
  dividendForecast:{checkedAt:'2026-10-06',announcements:Array.from({length:20},(_,m)=>({market:'TW',currency:'TWD',symbol:String(9000+a),exDividendDate:new Date(Date.UTC(2025,m,15)).toISOString().slice(0,10),paymentDate:'',cashDividend:(seed+m)%4?1.37:0}))},
  dividendPlanOverrides:seed%3?{}:{'2025-02-15':{quantity:0},'2025-03-15':{excluded:true},'2025-04-15':{quantity:25.5,cashDividend:1.13,paymentDate:'2025-05-01',note:'<private>'}}}));
 const transactions=assets.flatMap((a,ai)=>Array.from({length:100},(_,i)=>({id:ai+'-'+i,assetId:a.id,date:date(i),time:'12:00',type:i%4===3?'sell':'buy',quantity:10+(seed%7)/10,price:100+i%13,fee:2,tax:0,fx:1})));
 return {assets,transactions:transactions.reverse()};
}
export function backupFixture(rows=20){
 const state=Object.fromEntries(['companies','records','overtimeLogs','leaveRecords','compTimeCredits','compTimeSettlements','salaryAdjustments','yearEndEstimates','investmentRecords'].map(k=>[k,[]]));
 state.companies=[{id:'c',name:'Synthetic',isCurrent:true}];state.stockPortfolio={assets:[],transactions:[]};
 state.overtimeLogs=Array.from({length:rows},(_,i)=>({id:'ot'+i,companyId:'c',date:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10),hours:2,type:'weekday',hourlyRate:200,note:'row '+i}));
 return state;
}
export function definition(name,before=false){
 const content=source('app.js',before),start=content.indexOf(`    const ${name} =`);
 if(start<0)throw Error('Missing '+name);
 const tail=content.slice(start),end=tail.slice(1).search(/\n    const /);
 return end<0?tail:tail.slice(0,end+1);
}
export function stockView(before=false,book=portfolio()){
 const c=runtime(before);let calls=0,snapshot,html='';
 const core=c.SalaryMateStocks;c.SalaryMateStocks={...core,calculate:(...args)=>{calls++;return core.calculate(...args);}};
 c.document={hidden:false,activeElement:null,addEventListener(){},querySelector:selector=>selector==='.stock-view'?{}:null};
 c.navigator={onLine:true};c.setTimeout=()=>1;c.clearTimeout=()=>{};c.addEventListener=()=>{};
 c.SalaryMateI18n={user:s=>s,text:s=>s,apply(){}};
 vm.runInContext(source('stocks-integrations.js',before),c);vm.runInContext(source('stocks-ui.js',before),c);
 const state={stockPortfolio:book},api={state:()=>state,year:()=>2026,today:()=> '2026-10-06',legacyTotal:()=>0,model:()=>snapshot??=c.SalaryMateStocks.calculate(book,2026,'2026-10-06'),render:()=>{html=ui.render('');}};
 const ui=c.SalaryMateStocksUI.create(api);
 return {render:()=>{snapshot=null;calls=0;html=ui.render('');return html;},calls:()=>calls,tab:id=>ui.click({dataset:{stock:'tab',id},closest:()=>null}),html:()=>html};
}
