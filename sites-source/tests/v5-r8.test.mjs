import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const work=(b,tab)=>{b.tab('calendar');b.click(`[data-v5="work-tab"][data-value="${tab}"]`);};
const tools=b=>{b.tab('tax');b.click('[data-value="tools"]');};
const creditFixture=()=>{
  const f=fixture();f.overtimeLogs[0].hours=8;
  f.compTimeCredits=[{id:'c1',sourceId:'ot1',companyId:'A',earnedAt:'2026-10-01',expiresAt:'2027-03-31',hours:6,note:'Credit'}];
  f.compTimeSettlements=[{id:'s1',creditId:'c1',companyId:'A',date:'2026-10-02',hours:1,amount:300,note:'Settlement'}];
  return f;
};

test('R8: system language defaults and explicit preference survive page changes and reload',()=>{
  for(const [system,expected] of [['zh-TW','zh'],['zh-HK','zh'],['en-US','en'],['ja-JP','en']]){
    const b=boot(fixture(),{language:system});assert.equal(b.w.SalaryMateI18n.language(),expected);
    assert.equal(b.w.SalaryMateI18n.preference(),'auto');assert.equal(b.w.document.documentElement.lang,expected==='zh'?'zh-Hant':'en');
    b.click('[data-language="en"]');b.tab('settings');assert.equal(b.q('[data-language-preference]').value,'en');
    assert.equal(b.w.localStorage.getItem('salarymate_v5_language'),'en');assert.equal(b.q('main h2').textContent,'Settings');
    const c=boot(b.raw(),{language:system,preference:b.w.localStorage.getItem('salarymate_v5_language')});assert.equal(c.w.SalaryMateI18n.language(),'en');
    assert.deepEqual(b.errors,[]);b.close();c.close();
  }
});

test('R8: system-language changes and preference storage events update the interface',()=>{
  const b=boot(fixture(),{language:'en-US'});
  Object.defineProperty(b.w.navigator,'languages',{value:['zh-TW'],configurable:true});b.w.dispatchEvent(new b.w.Event('languagechange'));
  assert.equal(b.q('.nav-inner [data-tab="dashboard"]').textContent,'首頁');
  b.click('[data-language="en"]');b.w.dispatchEvent(new b.w.Event('languagechange'));assert.equal(b.w.SalaryMateI18n.language(),'en');
  b.w.dispatchEvent(new b.w.StorageEvent('storage',{key:'salarymate_v5_language',newValue:'zh'}));assert.equal(b.w.SalaryMateI18n.language(),'zh');
  b.tab('settings');b.change('[data-language-preference]','auto');assert.equal(b.w.SalaryMateI18n.preference(),'auto');assert.equal(b.w.SalaryMateI18n.language(),'zh');b.close();
});

test('R8: toggling language preserves unsaved form nodes, values, selection and business storage',()=>{
  const b=boot(fixture());b.tab('investment');b.click('[data-action="add-investment"]');
  b.change('#investmentForm [name="name"]','薪資');b.change('#investmentForm [name="note"]','新增');b.change('#investmentForm [name="amount"]','1250');
  const form=b.q('#investmentForm'),input=form.elements.name;input.focus();input.setSelectionRange(1,2);
  const before=b.raw();b.w.SalaryMateI18n.set('en');
  assert.equal(b.q('#investmentForm'),form);assert.equal(b.w.document.activeElement,input);assert.equal(input.selectionStart,1);assert.equal(input.value,'薪資');
  assert.equal(form.elements.kind.value,'股息／配息');assert.equal(form.elements.kind.selectedOptions[0].textContent,'Dividends / distributions');
  assert.equal(b.raw(),before);
  b.submit('#investmentForm');const saved=b.state().investmentRecords.find(r=>r.name==='薪資');assert.ok(saved);assert.equal(saved.note,'新增');assert.equal(saved.kind,'股息／配息');assert.equal(saved.amount,1250);
  b.w.SalaryMateI18n.set('zh');assert.equal(b.q('main h2').textContent,'股票投資');assert.ok(!b.w.document.body.textContent.includes('\uE100'));
  assert.deepEqual(b.errors,[]);b.close();
});

test('R8: user company names, notes and stock names remain verbatim in English',()=>{
  const f=fixture();f.companies[0].name='薪資';f.overtimeLogs[0].note='新增';
  f.stockPortfolio={assets:[{id:'a',symbol:'2330',name:'設定',market:'TW',currency:'TWD',account:'薪資',note:'刪除'}],transactions:[]};
  const b=boot(f,{language:'en-US'});assert.equal(b.q('#companyFilter option[value="A"]').textContent.includes('薪資'),true);
  work(b,'overtime');assert.ok(b.q('main').textContent.includes('新增'));
  b.tab('investment');b.click('[data-stock="tab"][data-id="watchlist"]');assert.ok(b.q('.stock-name').textContent.includes('設定'));
  b.click('[data-stock="detail"][data-id="a"]');assert.ok(b.q('#dialogTitle').textContent.includes('設定'));assert.ok(b.q('#dialogContent').textContent.includes('刪除'));
  b.click('[data-stock="asset"][data-id="a"]');assert.equal(b.q('#stockForm [name="name"]').value,'設定');assert.equal(b.q('#stockForm [name="account"]').value,'薪資');
  b.submit('#stockForm');assert.equal(b.state().stockPortfolio.assets[0].name,'設定');assert.equal(b.state().companies[0].name,'薪資');assert.deepEqual(b.errors,[]);b.close();
});

test('R8: primary pages, work ledgers, settings, calculators and forms have English UI',()=>{
  const f=fixture();f.companies.forEach((c,i)=>c.name='Company '+i);f.overtimeLogs.forEach(c=>c.note='Test');f.records.forEach(r=>r.sideIncome=0);
  const b=boot(f,{language:'en-US'});
  const check=()=>{b.w.SalaryMateI18n.apply();const walker=b.w.document.createTreeWalker(b.w.document.body,b.w.NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(n.parentElement?.closest('script,style,[data-language],textarea'))continue;assert.doesNotMatch(n.nodeValue,/\p{Script=Han}/u,n.nodeValue);}};
  for(const tab of ['dashboard','records','calendar','investment','tax','settings']){b.tab(tab);check();}
  for(const t of ['overtime','leave','comp']){work(b,t);check();}
  for(const [tab,selector] of [['settings','[data-action="add-company-basic"]'],['settings','[data-action="open-interface-settings"]'],['settings','[data-action="v5-leave-settings"]'],['settings','[data-action="open-legal"]'],['settings','[data-action="export-json"]'],['calendar','[data-action="add-overtime"]'],['calendar','[data-action="add-leave"]'],['records','[data-action="add-record"]'],['investment','[data-stock="asset"]'],['investment','[data-stock="import"]'],['investment','[data-action="add-investment"]']]){
    b.tab(tab);b.click(selector);check();if(b.q('#appDialog').open)b.click('[data-action="close-dialog"]');
  }
  b.tab('settings');b.click('[data-action="manage-companies"]');check();b.click('[data-action="company-salary-rules"]');check();
  tools(b);for(const t of ['overtime','yearend','raises']){b.click(`[data-salary-tab="${t}"]`);check();}
  assert.deepEqual(b.errors,[]);b.close();
});

test('R8: time-off credit edits retain identity, update estimates and reject insufficient balances',()=>{
  const b=boot(creditFixture());work(b,'comp');const pay=JSON.stringify(b.state().records);
  b.click('[data-action="edit-comp-credit"][data-id="c1"]');b.change('#compCreditForm [name="hours"]','4');b.change('#compCreditForm [name="note"]','Updated');b.change('#compCreditForm [name="expiresAt"]','2027-05-01');b.submit('#compCreditForm');
  let c=b.state().compTimeCredits[0];assert.equal(c.id,'c1');assert.equal(c.hours,4);assert.equal(c.note,'Updated');assert.equal(c.expiresAt,'2027-05-01');assert.equal(JSON.stringify(b.state().records),pay);
  b.click('[data-action="edit-comp-credit"][data-id="c1"]');b.change('#compCreditForm [name="hours"]','0.5');const raw=b.raw();b.submit('#compCreditForm');assert.equal(b.raw(),raw);assert.match(b.q('.validation-summary').textContent,/不足/);
  assert.deepEqual(b.errors,[]);b.close();
});

test('R8: settlement can be edited and deleted before the source credit is deleted',()=>{
  const b=boot(creditFixture(),{language:'en-US'});work(b,'comp');
  assert.equal(b.q('[data-action="delete-comp-credit"]').disabled,true);
  b.click('[data-action="edit-comp-settlement"][data-id="s1"]');assert.equal(b.q('#compSettlementForm [name="hours"]').max,'6');
  b.change('#compSettlementForm [name="hours"]','2');b.change('#compSettlementForm [name="amount"]','650');b.change('#compSettlementForm [name="note"]','Reviewed');b.submit('#compSettlementForm');
  const s=b.state().compTimeSettlements[0];assert.equal(s.id,'s1');assert.equal(s.hours,2);assert.equal(s.amount,650);assert.equal(s.note,'Reviewed');
  b.click('[data-action="delete-comp-settlement"][data-id="s1"]');b.click('[data-action="confirm-action"]');assert.equal(b.state().compTimeSettlements.length,0);
  b.click('[data-action="delete-comp-credit"][data-id="c1"]');b.click('[data-action="confirm-action"]');assert.equal(b.state().compTimeCredits.length,0);assert.ok(b.state().overtimeLogs.find(r=>r.id==='ot1'));assert.deepEqual(b.errors,[]);b.close();
});

test('R8: reducing a used credit expiry is blocked without changing leave or payroll',()=>{
  const f=creditFixture();f.leaveRecords=[{id:'used',companyId:'A',type:'compensatory',startDate:'2026-10-02',endDate:'2026-10-02',durationMode:'hours',customHours:2,quantity:2,status:'confirmed',compTimeLinked:true,paidRatio:100}];
  const b=boot(f);work(b,'comp');b.click('[data-action="edit-comp-credit"][data-id="c1"]');b.change('#compCreditForm [name="expiresAt"]','2026-10-01');const raw=b.raw();b.submit('#compCreditForm');assert.equal(b.raw(),raw);assert.ok(b.q('.validation-summary'));assert.deepEqual(b.errors,[]);b.close();
});

test('R8: year-end estimate saves, edits and deletes independently of payroll',()=>{
  const b=boot(fixture());const pay=JSON.stringify(b.state().records);tools(b);b.click('[data-salary-tab="yearend"]');
  b.change('#yearEndForm [name="extraAdjustment"]','1000');b.submit('#yearEndForm');assert.equal(b.state().yearEndEstimates.length,1);const id=b.state().yearEndEstimates[0].id;
  b.change('#yearEndForm [name="extraAdjustment"]','2000');b.submit('#yearEndForm');assert.equal(b.state().yearEndEstimates[0].id,id);assert.equal(b.state().yearEndEstimates[0].extraAdjustment,2000);
  b.click('[data-action="delete-year-end"]');b.click('[data-action="confirm-action"]');assert.equal(b.state().yearEndEstimates.length,0);assert.equal(JSON.stringify(b.state().records),pay);assert.deepEqual(b.errors,[]);b.close();
});

test('R8: SmartPortfolio archive edit/delete keeps unrelated assets and payroll',()=>{
  const f=fixture(),asset=(id,symbol)=>({id,symbol,name:'Stock '+id,market:'TW',currency:'TWD',account:'Account '+id});
  f.stockPortfolio={assets:[asset('imported','2330'),asset('other','0050')],transactions:[{id:'tx',assetId:'imported',type:'buy',date:'2026-09-01',time:'12:00',quantity:10,price:100,fx:1,fee:0,tax:0}],smartImports:[{token:'archive',assets:['imported'],mode:'replay',importedAt:'2026-10-02',snapshotDate:'2026-10-02',archivedTransactions:[],original:{data:{holdings:[],transactions:[]}}}]};
  const b=boot(f);const pay=JSON.stringify(b.state().records);b.tab('investment');b.click('[data-stock="archives"]');b.click('[data-stock="edit-import"]');b.click('[data-stock="asset"][data-id="imported"]');b.change('#stockForm [name="name"]','Edited');b.submit('#stockForm');assert.equal(b.state().stockPortfolio.assets.find(a=>a.id==='imported').name,'Edited');
  b.click('[data-stock="archives"]');b.click('[data-stock="delete-import"]');b.click('[data-action="confirm-action"]');
  assert.deepEqual(b.state().stockPortfolio.assets.map(a=>a.id),['other']);assert.equal(b.state().stockPortfolio.transactions.length,0);assert.equal(b.state().stockPortfolio.smartImports.length,0);assert.equal(JSON.stringify(b.state().records),pay);assert.deepEqual(b.errors,[]);b.close();
});

test('R8: asynchronous messages are translated and safely restored',async()=>{
  const b=boot(fixture(),{language:'en-US'});b.tab('investment');b.click('[data-stock="asset"]');b.w.fetch=async()=>{throw new Error('行情查詢逾時或已取消，原價格保持不變。');};
  b.change('#stockForm [name="symbol"]','2330');b.click('[data-stock="lookup"]');await tick();await tick();assert.doesNotMatch(b.q('#stockLookupStatus').textContent,/\p{Script=Han}/u);
  b.w.SalaryMateI18n.set('zh');assert.match(b.q('#stockLookupStatus').textContent,/原價格/);assert.deepEqual(b.errors,[]);b.close();
});

test('R8: custom payroll labels and printable reports preserve user text',()=>{
  const f=fixture();f.companies[0].name='薪資';f.records[0].customEarnings=[{id:'extra',name:'設定',amount:100,affectsHourly:false}];
  const b=boot(f,{language:'en-US'});b.tab('records');b.click('[data-action="toggle-record"][data-id="r1"]');assert.ok(b.q('.v5-salary-detail').textContent.includes('設定'));
  b.tab('tax');assert.ok(b.q('.annual-scope').textContent.includes('薪資'));
  const rendered=b.w.SalaryMateI18n.html('<!doctype html><html lang="zh"><title>年度整合報表</title><body><h1>年度整合報表</h1><p>'+b.w.SalaryMateI18n.user('設定')+'</p></body></html>');
  assert.match(rendered,/<html lang="en">/);assert.match(rendered,/<p>設定<\/p>/);assert.doesNotMatch(rendered,/年度|\uE100/);assert.deepEqual(b.errors,[]);b.close();
});
