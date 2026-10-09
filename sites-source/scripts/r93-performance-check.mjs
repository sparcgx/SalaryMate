import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),base=root+'dist/dev/v5.0.0-dev.2/';
const before=name=>{
 for(const revision of ['99efd2999c60f89aa39d9f412d57111c8472256a:dist/dev/v5.0.0-dev.2/','3d1ce045b179f50ef14fa0de12ef0095816e11d8:sites-source/dist/dev/v5.0.0-dev.2/']){
  try{return execFileSync('git',['show',revision+name],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{}
 }
 throw Error('R92 baseline source is required for comparison');
};
const core=fs.readFileSync(base+'stocks.js','utf8');assert.equal(core,before('stocks.js'),'Financial calculation source must remain unchanged');
const assets=Array.from({length:100},(_,i)=>({id:'a'+i,symbol:'F'+String(i).padStart(3,'0'),name:'Fictional asset '+i,market:'TW',currency:'TWD',account:'Fictional account',quotePrice:30,quoteDate:'2026-10-09',quoteFx:1}));
const transactions=Array.from({length:10000},(_,i)=>({id:'t'+i,assetId:'a'+(Math.floor(i/2)%100),type:i%2?'sell':'buy',date:'2026-01-'+String(1+Math.floor(i/1440)).padStart(2,'0'),time:String(Math.floor((i%1440)/60)).padStart(2,'0')+':'+String(i%60).padStart(2,'0'),quantity:1,price:i%2?30:20,fee:.25,tax:i%2?.03:0,fx:1,note:''}));
function measure(source){
 const context={Intl,Date,document:{hidden:true,querySelector:()=>null,addEventListener(){}},SalaryMateI18n:{user:x=>x,apply(){}},clearTimeout(){},setTimeout(){throw Error('Unexpected timer');}};
 vm.createContext(context);vm.runInContext(core,context);
 const marker='return {render,click,submit,updateTradeForm,onInput,onChange,cancelDialogRequests,';assert.ok(source.includes(marker));
 vm.runInContext(source.replace(marker,'return {eventTable,render,click,submit,updateTradeForm,onInput,onChange,cancelDialogRequests,'),context);
 const portfolio=structuredClone({assets,transactions}),unchanged=JSON.stringify(portfolio),model=context.SalaryMateStocks.calculate(portfolio,2026,'2026-10-09');let lotReads=0,lotRows=0;
 for(const event of model.events){const lots=event.matchedLots;Object.defineProperty(event,'matchedLots',{get(){lotReads++;return new Proxy(lots,{get(target,key){if(key==='map')return fn=>target.map((lot,index)=>{lotRows++;return fn(lot,index);});return target[key];}});}});}
 const ui=context.SalaryMateStocksUI.create({state:()=>({stockPortfolio:portfolio}),year:()=>2026,today:()=>'2026-10-09',model:()=>model});
 const html=ui.eventTable(model.events,true,{scope:'transactions'});assert.equal(JSON.stringify(portfolio),unchanged);
 return {events:model.events.length,visibleRows:(html.match(/<tr>/g)||[]).length-1,generatedHtmlBytes:Buffer.byteLength(html),closedFifoLotReads:lotReads,closedFifoLotRows:lotRows};
}
const previous=measure(before('stocks-ui.js')),current=measure(fs.readFileSync(base+'stocks-ui.js','utf8'));
assert.equal(previous.visibleRows,10000);assert.equal(current.visibleRows,50);assert.equal(current.closedFifoLotReads,0);
const report={environment:'Native Node VM production functions, fictional 100 assets / 10,000 alternating buy-sell events; no browser, DOM emulator, private data or HTTP',scope:'Generated HTML bytes and operation counts, not network download size, device startup time, measured memory or FPS',R92:previous,R93:current,unchangedFinancialCalculationSha256:createHash('sha256').update(core).digest('hex'),hosted:{eagerModulesBefore:15,eagerModulesAfter:14,deferredLegalDataBytes:fs.statSync(base+'legal-data.js').size,removedInstallPrefetchBytes:fs.statSync(base+'legal-data.js').size+fs.statSync(base+'legal.html').size},storageProof:'See tests/v5-r93-storage.test.mjs: UI clone 0, financial clone 1; identical UI patch serialization/write 0; rollback and durable notification cases checked'};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
