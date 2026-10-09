import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Native production-function tests; no browser, DOM emulator or private data.
const source=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js',import.meta.url),'utf8');
const declarations=[...source.matchAll(/^    (?:const|let) ([A-Za-z_$][\w$]*)\s*=/gm)];
const definitions=new Map(declarations.map((m,i)=>[m[1],source.slice(m.index,declarations[i+1]?.index??source.length)]));
const plain=value=>JSON.parse(JSON.stringify(value));
const dateNames=['numberValue','clamp','pad2','isoDate','parseDateParts','validIsoDate','addIsoDays','isWeekend','enumerateIsoDates','computeLeaveDateEntries'];
function leaveHarness(){
  const company={id:'fictional',workHoursPerDay:8};
  const context=vm.createContext({getCompany:()=>company});
  vm.runInContext(dateNames.map(n=>definitions.get(n)).join('\n')+'\nglobalThis.entries=computeLeaveDateEntries;',context);
  return {company,context,entries:record=>plain(context.entries(record))};
}
const range=(startDate,endDate,startPortion='full',endPortion='full',includeWeekends=false)=>({companyId:'fictional',durationMode:'range',startDate,endDate,startPortion,endPortion,includeWeekends});

test('R95 excluded Saturday half-day cannot halve the following Monday',()=>{
  const h=leaveHarness();
  assert.deepEqual(h.entries(range('2026-10-10','2026-10-12','pm')),[{date:'2026-10-12',hours:8,days:1}]);
});
test('R95 excluded Sunday half-day cannot halve the preceding Friday',()=>{
  const h=leaveHarness();
  assert.deepEqual(h.entries(range('2026-10-09','2026-10-11','full','am')),[{date:'2026-10-09',hours:8,days:1}]);
});
test('R95 actual workday endpoints, included weekends and company daily hours retain their meaning',()=>{
  const h=leaveHarness();
  assert.deepEqual(h.entries(range('2026-10-09','2026-10-12','pm','am')),[{date:'2026-10-09',hours:4,days:.5},{date:'2026-10-12',hours:4,days:.5}]);
  assert.deepEqual(h.entries(range('2026-10-10','2026-10-12','pm','full',true)),[{date:'2026-10-10',hours:4,days:.5},{date:'2026-10-11',hours:8,days:1},{date:'2026-10-12',hours:8,days:1}]);
  h.company.workHoursPerDay=6;
  assert.deepEqual(h.entries(range('2026-10-10','2026-10-12','pm')),[{date:'2026-10-12',hours:6,days:1}]);
  for(const [start,end] of [['full','am'],['pm','full']])assert.deepEqual(h.entries(range('2026-10-12','2026-10-12',start,end)),[{date:'2026-10-12',hours:3,days:.5}]);
});
test('R95 corrected working hours feed the existing full-pay/half-pay deduction formula',()=>{
  const h=leaveHarness(),draft=range('2026-10-10','2026-10-12','pm');
  Object.assign(h.context,{salaryProfileAt:()=>({employmentMode:'monthly'}),salaryProfileTotal:()=>36000,leaveHours:r=>h.entries(r).reduce((s,e)=>s+e.hours,0)});
  vm.runInContext(definitions.get('leaveWageDeduction')+'\nglobalThis.deduct=leaveWageDeduction;',h.context);
  // Fixture monthly pay / 30 days / 8 hours, using the existing configured ratios.
  for(const [paidRatio,want] of [[0,1200],[50,600],[100,0]])assert.equal(h.context.deduct({...draft,paidRatio}),want);
});
test('R95 same-day afternoon-to-morning range is rejected before persistence',()=>{
  const h=leaveHarness(),errors=[],draft={...range('2026-10-12','2026-10-12','pm','am'),id:'draft',status:'confirmed'};
  Object.assign(h.context,{collectLeaveDraft:()=>draft,$:()=>({}),validateNativeForm:()=>true,assertDraftScope:()=>true,state:{leaveRecords:[]},validateField:(_form,key,message)=>errors.push({key,message}),leaveDateEntries:()=>{throw Error('Invalid range passed validation');}});
  vm.runInContext(definitions.get('saveLeaveForm')+'\nglobalThis.save=saveLeaveForm;',h.context);
  assert.doesNotThrow(()=>h.context.save());assert.equal(errors.length,1);assert.equal(errors[0].key,'endPortion');
});

test('R95 corrected leave totals mark an old payroll link stale without rewriting saved payroll',()=>{
  const h=leaveHarness(),leave={...range('2026-10-10','2026-10-12','pm'),id:'leave',status:'confirmed',paidRatio:0,attendanceDeduction:0};
  const payroll={companyId:'fictional',year:2026,month:10,customDeductions:[{sourceType:'leave-payroll',sourceKey:'leave:fictional:2026-10',amount:600}]};
  const state={leaveRecords:[leave],records:[payroll]},original=JSON.stringify(state);
  Object.assign(h.context,{state,calculationCache:{leaveMembership:new Map(),leaveEntries:new Map(),leaveAllocations:new Map()},salaryProfileAt:()=>({employmentMode:'monthly'}),salaryProfileTotal:()=>36000,salaryMonthForDate:date=>({year:Number(date.slice(0,4)),month:Number(date.slice(5,7))})});
  const names=['isStoredLeave','leaveDateEntries','leaveHours','leaveWageDeduction','leaveAllocations','leaveAllocationForMonth','leaveDeductionSummary','leaveSyncKey','leaveSyncInfo'];
  vm.runInContext(names.map(n=>definitions.get(n)).join('\n')+'\nglobalThis.sync=leaveSyncInfo;',h.context);
  const result=h.context.sync(2026,10,'fictional');
  assert.equal(result.hours,8);assert.equal(result.total,1200);assert.equal(result.status,'stale');assert.equal(payroll.customDeductions[0].amount,600);assert.equal(JSON.stringify(state),original);
});

test('R95 FIFO, fees, partial sales and separate historical/current FX retain established results',()=>{
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/stocks.js',import.meta.url),'utf8'),context);
  const core=context.SalaryMateStocks;
  const asset=extra=>({id:'a',symbol:'FIX',name:'Fictional asset',market:'TW',currency:'TWD',quotePrice:120,quoteDate:'2026-09-30',quoteFx:1,...extra});
  const tx=(id,type,extra={})=>({id,assetId:'a',type,date:'2026-09-01',time:'12:00',quantity:100,price:100,amount:0,ratio:1,fee:10,tax:0,fx:1,...extra});
  const tw={assets:[asset()],transactions:[tx('b1','buy'),tx('b2','buy',{date:'2026-09-02',price:200,fee:20,tax:10}),tx('s','sell',{date:'2026-09-03',quantity:50,price:180,fee:5,tax:27})]};
  const us={assets:[asset({market:'US',currency:'USD',quotePrice:130,quoteFx:33})],transactions:[tx('b','buy',{quantity:10,price:100,fee:2,fx:30}),tx('s','sell',{date:'2026-09-02',quantity:4,price:120,fee:1,tax:1,fx:32}),tx('d','dividend',{date:'2026-09-03',amount:30,fee:1,tax:9,fx:31})]};
  const a=core.calculate(core.validate(tw),2026),b=core.calculate(core.validate(us),2026);
  assert.equal(a.holdings[0].quantity,150);assert.equal(a.cost,25035);assert.equal(a.yearRealized,3963);assert.equal(a.unrealized,-7035);
  assert.equal(b.cost,18036);assert.equal(b.yearRealized,3272);assert.equal(b.yearDividends,620);assert.equal(b.value,25740);assert.equal(b.unrealized,7704);
  assert.throws(()=>core.validate({...tw,transactions:[...tw.transactions,tx('bad','sell',{date:'2026-09-04',quantity:151})]}),/賣出股數超過/);
});

function commitHarness(options={}){
  const state={schemaVersion:15,appVersion:'fixture',updatedAt:'before',records:[{id:'fictional',amount:10}],uiPreferences:{selectedYear:2026}};
  const ui={selectedYear:2026,draftScope:null},locks=new Set(),writes=[],released=[];
  const context=vm.createContext({state,ui,SCHEMA_VERSION:15,APP_VERSION:'fixture',STORAGE_KEY:'salarymate_v5_full_state',console:{error(){},warn(){}},
    clone(value){if(options.failClone)throw Error('Snapshot failed');return plain(value);},
    acquireOperationLock:key=>{if(locks.has(key))return false;locks.add(key);return true;},
    releaseOperationLock:(key,remember)=>{released.push({key,remember});locks.delete(key);},
    invalidateCalculationCache(){},syncDataStatusFromState(){if(options.failSync)throw Error('Status failed');},
    setOperationStatus:status=>{if(options.failStatus===status)throw Error('Notification failed');},
    toast(){if(options.failToast)throw Error('Toast failed');},
    window:{SalaryMateStorage:{assertCurrent(){},setItem(_key,value){if(options.failWrite)throw Error('QuotaExceededError');writes.push(value);}}}
  });
  for(const name of ['InterfaceStyle','Hd2dBackground','AutumnBackground','SurfaceOpacity','MotionEffect','InterfaceMode','ColorTheme'])context['normalize'+name]=value=>value;
  const blocks=['saveState','commitStateMutation','commitVisualPreference','UI_PREFERENCE_KEYS','commitUiPreferencePatch'];
  vm.runInContext(blocks.map(n=>definitions.get(n)).join('\n')+'\nglobalThis.api={commitStateMutation,commitUiPreferencePatch,getState:()=>state};',context);
  return {api:context.api,options,locks,writes,released,ui,mutate:()=>{context.state.records[0].amount=20;}};
}
for(const kind of ['financial','preference'])test(`R95 ${kind} submitting exception releases its lock, leaves data intact and permits retry`,()=>{
  const h=commitHarness({failStatus:'submitting'}),before=plain(h.api.getState());
  const submit=()=>kind==='financial'?h.api.commitStateMutation(h.mutate):h.api.commitUiPreferencePatch({selectedYear:2025});
  assert.doesNotThrow(()=>assert.equal(submit(),false));assert.deepEqual(plain(h.api.getState()),before);assert.equal(h.locks.size,0);assert.equal(h.writes.length,0);assert.equal(h.ui.selectedYear,2026);
  h.options.failStatus=null;assert.equal(submit(),true);assert.equal(h.writes.length,1);assert.equal(h.locks.size,0);
});
test('R95 failed financial snapshot cannot leave a locked operation or run its mutation',()=>{
  const h=commitHarness({failClone:true}),before=plain(h.api.getState());
  assert.doesNotThrow(()=>assert.equal(h.api.commitStateMutation(h.mutate),false));assert.deepEqual(plain(h.api.getState()),before);assert.equal(h.locks.size,0);assert.equal(h.writes.length,0);
  h.options.failClone=false;assert.equal(h.api.commitStateMutation(h.mutate),true);assert.equal(h.writes.length,1);
});
test('R95 financial rollback returns failure even when its failure notification throws',()=>{
  for(const options of [{failWrite:true,failSync:true},{failWrite:true,failStatus:'failure'},{failWrite:true,failToast:true}]){
    const h=commitHarness(options),before=plain(h.api.getState());
    assert.doesNotThrow(()=>assert.equal(h.api.commitStateMutation(h.mutate),false));assert.deepEqual(plain(h.api.getState()),before);assert.equal(h.writes.length,0);assert.equal(h.locks.size,0);
    Object.assign(h.options,{failWrite:false,failSync:false,failStatus:null,failToast:false});assert.equal(h.api.commitStateMutation(h.mutate),true);
  }
});
