import assert from 'node:assert/strict';
import test from 'node:test';
import {boot,element,PAYROLL_KEY} from './helpers/app-runtime.mjs';
const fixture=()=>({schemaVersion:13,companies:[{id:'A',name:'甲',isCurrent:true},{id:'B',name:'乙'}],records:[{id:'r',companyId:'A',year:2026,month:9,baseSalary:47000,note:'薪資甲'}],overtimeLogs:[{id:'ot',companyId:'A',date:'2026-09-01',hours:8,hourlyRate:200,type:'weekday'}],compTimeCredits:[{id:'c',companyId:'A',sourceId:'ot',earnedAt:'2026-09-01',expiresAt:'2027-09-01',hours:4}],leaveRecords:[]});
const csv=async runtime=>{runtime.action('export-annual-report');return runtime.downloads.at(-1).blob.text();};

test('RC2：較新 Schema 備份拒絕還原，未知資料與現有資料不被覆寫',async()=>{
  for(const version of [{schemaVersion:999},{exportInfo:{schemaVersion:999}}]){
    const runtime=boot(fixture()),before=runtime.storage.get(PAYROLL_KEY);
    await runtime.window.SalaryMateData.importPayload(JSON.stringify({...fixture(),...version,futureCriticalField:{balance:123}}));
    assert.equal(runtime.storage.get(PAYROLL_KEY),before);
    assert(!runtime.elements.get('dialogContent').innerHTML.includes('確認還原'));
    assert(runtime.elements.get('toast').textContent.includes('較新'));
  }
});
test('RC2：本機較新 Schema 啟動失敗時保留原始位元組',()=>{
  const seed=JSON.stringify({...fixture(),schemaVersion:999,futureCriticalField:{balance:123}}),runtime=boot(seed);
  assert.equal(runtime.storage.get(PAYROLL_KEY),seed);
  assert(runtime.elements.get('mainContent').innerHTML.includes('較新版本'));
});
test('RC2：重複識別碼、非陣列與空白資料列備份拒絕且不改寫',async()=>{
  const seed=fixture();
  for(const change of [{records:[seed.records[0],seed.records[0]]},{leaveRecords:{}},{overtimeLogs:[null]},{schemaVersion:'invalid'}]){
    const runtime=boot(seed),before=runtime.storage.get(PAYROLL_KEY);
    await runtime.window.SalaryMateData.importPayload(JSON.stringify({...seed,...change}));
    assert.equal(runtime.storage.get(PAYROLL_KEY),before);assert(!runtime.elements.get('dialogContent').innerHTML.includes('確認還原'));
  }
});
test('RC2：薪資、請假、出勤 CSV 皆防止前置空白與 BOM 公式文字',async()=>{
  const seed=fixture();seed.companies[0].name=' \t=1+1';seed.records[0].note='\ufeff+SUM(1,2)';seed.leaveRecords=[{id:'l',companyId:'A',type:'personal',status:'confirmed',startDate:'2026-09-01',endDate:'2026-09-01',quantityMode:'hours',hours:2,note:' @test'}];
  const runtime=boot(seed);runtime.change('yearFilter','2026');
  for(const action of ['export-csv','export-leave-csv','export-attendance-csv']){
    runtime.action(action);const text=await runtime.downloads.at(-1).blob.text();assert(text.includes('"\' \t=1+1"'),action);
    if(action==='export-csv')assert(text.includes('"\'\ufeff+SUM(1,2)"'));
  }
});
test('RC2：無來源、重複來源與未發生補休不列入目前可用時數',()=>{
  const runtime=boot(fixture()),api=runtime.window.SalaryMateCompTime,seed=fixture();
  const leaves=[{id:'use',companyId:'A',type:'compensatory',status:'confirmed',compTimeLinked:true,compTimeEntries:[{date:'2026-09-02',hours:2}]}];
  for(const credits of [[{...seed.compTimeCredits[0],sourceId:'missing'}],[seed.compTimeCredits[0],{...seed.compTimeCredits[0],id:'duplicate'}]]){
    const x=api.ledger({credits,logs:seed.overtimeLogs,leaves,today:'2026-09-30'});assert.equal(x.totals.available,0);assert.equal(x.totals.used,0);assert(x.violations.length);
  }
  const future=api.ledger({credits:seed.compTimeCredits,logs:seed.overtimeLogs,today:'2026-08-31'});assert.equal(future.totals.available,0);assert.equal(future.totals.upcoming,4);
});
test('RC2：異常補休不扣加班費，年度轉補休時數與工時估算一致',async()=>{
  const seed=fixture();seed.compTimeCredits[0].earnedAt='invalid';const runtime=boot(seed);runtime.change('yearFilter','2026');runtime.change('annualThroughMonth','9');
  const bad=await csv(runtime);const without=fixture();without.compTimeCredits=[];const clean=boot(without);clean.change('yearFilter','2026');clean.change('annualThroughMonth','9');assert.equal(bad,await csv(clean));
  runtime.action('data-health');assert(runtime.elements.get('dialogContent').innerHTML.includes('補休'));
});
test('RC2：他公司異常補休不阻擋正常公司的結算',()=>{
  const seed=fixture();seed.compTimeCredits.push({id:'bad',companyId:'B',sourceId:'missing',hours:5,earnedAt:'2026-09-01',expiresAt:'2027-01-01'});
  const runtime=boot(seed);runtime.action('settle-comp-time','c');
  runtime.elements.set('compSettlementForm',Object.assign(element('compSettlementForm'),{_data:{date:'2026-09-20',hours:'1',amount:'200',note:'測試'}}));
  runtime.submit('compSettlementForm');assert.equal(runtime.state().compTimeSettlements.length,1);assert.equal(runtime.state().compTimeSettlements[0].creditId,'c');
  assert.equal(runtime.state().compTimeCredits.length,2);
});
test('RC2：年度重複讀取一致，還原更新後重新計算，不沿用舊快取',async()=>{
  const runtime=boot(fixture());runtime.change('yearFilter','2026');runtime.change('annualThroughMonth','9');const first=await csv(runtime);assert.equal(await csv(runtime),first);
  const changed=fixture();changed.records[0].baseSalary=51000;changed.overtimeLogs[0].hours=10;
  await runtime.window.SalaryMateData.importPayload(JSON.stringify(changed));runtime.action('confirm-action');
  const updated=await csv(runtime);assert.notEqual(updated,first);assert(updated.includes('"51000"'));
  const fresh=boot(changed);fresh.change('yearFilter','2026');fresh.change('annualThroughMonth','9');assert.equal(updated,await csv(fresh));
});
test('RC2：中文組字期間不重繪搜尋欄，確認後篩選並保留游標',()=>{
  const runtime=boot(fixture());runtime.tab('records');let cursor=-1;
  const search=Object.assign(element('recordSearch'),{value:'薪資甲',setSelectionRange(start){cursor=start;}});runtime.elements.set('recordSearch',search);
  const before=runtime.elements.get('mainContent').innerHTML;
  runtime.document.dispatch('compositionstart',{target:search});runtime.document.dispatch('input',{target:search,isComposing:true});assert.equal(runtime.elements.get('mainContent').innerHTML,before);
  runtime.document.dispatch('compositionend',{target:search});assert.equal(cursor,3);assert(runtime.elements.get('mainContent').innerHTML.includes('value="薪資甲"'));
});
