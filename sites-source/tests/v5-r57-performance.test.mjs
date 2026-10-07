import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {runtime,portfolio,backupFixture,plain,definition,stockView} from './helpers/r57-core.mjs';
const old=runtime(true),now=runtime();
const compare=(fn,...args)=>assert.deepEqual(plain(fn(now,...args)),plain(fn(old,...args)));

test('forecast histories match R56 exactly across dates, fractional shares and overrides',()=>{
 for(let seed=0;seed<12;seed++){
  const p=portfolio(seed),before=JSON.stringify(p);
  for(const day of ['2024-01-01','2025-02-15','2025-04-14','2026-10-06'])for(const excluded of [false,true]){
   compare((c,p,d,e)=>c.SalaryMateStocks.dividendForecasts(p,d,e),p,day,excluded);
  }
  assert.equal(JSON.stringify(p),before);
 }
});
test('forecast receipt matching, duplicate announcements, split and opening boundaries match R56',()=>{
 const p=portfolio(1,2),a=p.assets[0],b=p.assets[1];
 a.dividendForecast.announcements.push({...a.dividendForecast.announcements[0],cashDividend:2,paymentDate:'2025-02-01'});
 a.dividendForecast.announcements[3].paymentDate='2025-05-01';
 p.transactions.push({id:'split',assetId:a.id,type:'split',date:'2025-01-14',time:'15:00',ratio:2,fee:0,tax:0,fx:1});
 for(const [i,extra] of [{exDividendDate:'2025-02-15'},{dividendPlanKey:a.id+':2025-03-15'},{}].entries())p.transactions.push({id:'div'+i,assetId:a.id,type:'dividend',date:'2025-05-01',time:'12:00',amount:100,fee:0,tax:0,fx:1,...extra});
 p.transactions.push({id:'opening',assetId:b.id,type:'opening',date:'2025-06-15',time:'12:00',quantity:20,price:100,fee:0,tax:0,fx:1});
 now.SalaryMateStocks.validate(p);
 for(const day of ['2025-01-15','2025-06-15','2026-10-06'])compare((c,p,d)=>c.SalaryMateStocks.dividendForecasts(p,d,true),p,day);
 const result=now.SalaryMateStocks.dividendForecasts(p,'2026-10-06');
 assert.ok(result.some(r=>r.historyUnknown));assert.ok(result.some(r=>r.possibleReceiptId==='div1'));
});
test('FIFO outputs and rejection of invalid transactions stay identical',()=>{
 for(let seed=0;seed<12;seed++)compare((c,p)=>c.SalaryMateStocks.calculate(c.SalaryMateStocks.validate(p),2026,'2026-10-06'),portfolio(seed));
 const p=portfolio();p.transactions.push({id:'bad',assetId:'a0',date:'2023-01-01',time:'12:00',type:'sell',quantity:5,price:100,fee:0,tax:0,fx:1});
 for(const c of [old,now])assert.throws(()=>c.SalaryMateStocks.validate(p),/超過/);
});
test('indexed backup merging preserves overwrite, copy, restore and linked IDs',()=>{
 const current=backupFixture(),incoming=plain(current);
 current.compTimeCredits=[{id:'credit',sourceId:'ot0',companyId:'c',earnedAt:'2024-01-01',expiresAt:'2026-12-31',hours:2}];
 current.compTimeSettlements=[{id:'settle',creditId:'credit',companyId:'c',date:'2024-03-01',hours:1,amount:200}];
 incoming.compTimeCredits=plain(current.compTimeCredits);incoming.compTimeSettlements=plain(current.compTimeSettlements);
 incoming.overtimeLogs.forEach((r,i)=>r.id='import-'+i);incoming.compTimeCredits[0].sourceId='import-0';
 const before=JSON.stringify([current,incoming]);
 for(const mode of ['overwrite','copy','restore'])compare((c)=>c.SalaryMateBackup.merge(current,incoming,mode,'fixed-token'));
 assert.equal(JSON.stringify([current,incoming]),before);
});
test('ambiguous and duplicate import targets still fail without mutating either input',()=>{
 for(const variant of ['ambiguous','duplicate']){
  const current=backupFixture(2),incoming=plain(current);
  if(variant==='ambiguous'){
   current.overtimeLogs[1]={...current.overtimeLogs[0],id:'ot1'};
   incoming.overtimeLogs=[{...current.overtimeLogs[0],id:'unknown'}];
  }else incoming.overtimeLogs=[incoming.overtimeLogs[0],{...incoming.overtimeLogs[0]}];
  const before=JSON.stringify([current,incoming]);
  const message=c=>{try{c.SalaryMateBackup.merge(current,incoming,'overwrite','fixed');return '';}catch(e){return e.message;}};
  assert.ok(message(now));assert.equal(message(now),message(old));assert.equal(JSON.stringify([current,incoming]),before);
 }
});
test('annual group indexing preserves rounding, input order and company/year scope',()=>{
 const records=Array.from({length:900},(_,i)=>({companyId:'c'+i%3,year:String(2023+i%4),month:i%16,baseSalary:i%4?12345.67:-78.93,mealAllowance:.12,positionAllowance:.07,overtime:1.15,sideIncome:i%2?-.13:1.25,customEarnings:[{sourceType:'company-fixed',amount:.02},{amount:.03}],customDeductions:[{amount:.14}]}));
 for(const year of [2023,2026,2029])for(const companyId of ['ALL','c1','missing'])for(const throughMonth of [1,7,12])compare(c=>c.SalaryMateAnnual.analyze(records,{year,companyId,throughMonth}));
});
function appFixture(){
 let computations=0,day='2026-10-06',reads=0;
 const c=vm.createContext({Map,Set,Date,console,state:{stockPortfolio:portfolio(),leaveRecords:[]},ui:{selectedYear:2026},calculationCache:{stockModels:new Map(),leaveMembership:new Map(),leaveEntries:new Map()},todayIso:()=>day,getCompany:()=>{reads++;return {workHoursPerDay:c.hours};},hours:8,window:{SalaryMateStocks:{calculate:(...args)=>{computations++;return now.SalaryMateStocks.calculate(...args);}}}});
 const names=['numberValue','clamp','pad2','isoDate','parseDateParts','validIsoDate','addIsoDays','isWeekend','enumerateIsoDates','computeLeaveDateEntries','isStoredLeave','leaveDateEntries','invalidateCalculationCache','stockPortfolioModel'];
 vm.runInContext(names.map(n=>definition(n)).join('\n')+'\nglobalThis.api={leaveDateEntries,invalidateCalculationCache,stockPortfolioModel};',c);
 return {c,api:c.api,count:()=>computations,reads:()=>reads,setDay:v=>day=v};
}
test('shared portfolio cache refreshes for save, year, day and replaced portfolio',()=>{
 const h=appFixture(),m=h.api.stockPortfolioModel();assert.equal(h.api.stockPortfolioModel(),m);assert.equal(h.count(),1);
 h.c.ui.selectedYear=2025;h.api.stockPortfolioModel();h.setDay('2026-10-07');h.api.stockPortfolioModel();
 h.c.state.stockPortfolio=plain(h.c.state.stockPortfolio);h.api.stockPortfolioModel();assert.equal(h.count(),4);
 h.c.state.stockPortfolio.assets[0].quotePrice=200;h.api.invalidateCalculationCache();assert.notEqual(h.api.stockPortfolioModel().value,m.value);assert.equal(h.count(),5);
 assert.equal(h.c.calculationCache.stockModels.size,1);
});
test('leave entries cache only stored records; drafts and invalidation remain current',()=>{
 const h=appFixture(),record={id:'l',companyId:'c',durationMode:'range',startDate:'2026-10-01',endDate:'2026-10-07',startPortion:'pm',endPortion:'am',includeWeekends:false};
 h.c.state.leaveRecords=[record];const a=h.api.leaveDateEntries(record);assert.equal(h.api.leaveDateEntries(record),a);assert.equal(h.reads(),1);
 const draft={...record};h.api.leaveDateEntries(draft);draft.endDate='2026-10-09';assert.ok(h.api.leaveDateEntries(draft).length>a.length);
 h.c.hours=10;h.api.invalidateCalculationCache();assert.equal(h.api.leaveDateEntries(record)[0].hours,5);
 const reference=vm.createContext({getCompany:()=>({workHoursPerDay:10})});
 vm.runInContext(['numberValue','clamp','pad2','isoDate','parseDateParts','validIsoDate','addIsoDays','isWeekend','enumerateIsoDates'].map(n=>definition(n)).join('\n')+'\n'+definition('leaveDateEntries',true)+'\nglobalThis.read=leaveDateEntries;',reference);
 for(const durationMode of ['range','hours','half_am','half_pm','days'])for(const includeWeekends of [false,true]){
  const r={...record,durationMode,includeWeekends,quantity:2,customHours:3.5};assert.deepEqual(plain(h.api.leaveDateEntries(r)),plain(reference.read(r)));
 }
});
test('all six investment views retain exact output while sharing the FIFO result',()=>{
 const book=portfolio(2,3),prior=stockView(true,book),current=stockView(false,book);
 for(const tab of ['overview','stocks','transactions','income','analysis','watchlist']){
  prior.tab(tab);current.tab(tab);assert.equal(current.render(),prior.render(),tab);
  assert.equal(current.calls(),1);assert.equal(prior.calls(),2);
 }
});
