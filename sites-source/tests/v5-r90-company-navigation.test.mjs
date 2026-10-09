import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Production routing functions with plain callback spies only; no browser,
// document, DOM emulator, application boot, storage, or network.
const source=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js',import.meta.url),'utf8');
const routing=source.slice(source.indexOf('    const selectPrimaryTab ='),source.indexOf("    document.addEventListener('click'",source.indexOf('    const selectPrimaryTab =')));
const popstate=source.slice(source.indexOf("    window.addEventListener('popstate'"),source.indexOf("    window.addEventListener('beforeunload'"));
const back=source.match(/'company-back': (\(\) => \{[\s\S]*?\n        \}),/)[1];
const manage=source.match(/'manage-companies': (\(\) => [^\n]+),/)[1];
const copy=value=>JSON.parse(JSON.stringify(value));

function fixture(overrides={}){
  const ui={tab:'settings',companyDetailId:'a',companyDetailSection:'salary-rules',companyFilter:'b',draftScope:null,...overrides};
  const state={companies:[{id:'a',isCurrent:true,baseSalary:1000},{id:'b',isCurrent:false,baseSalary:2000}],records:[{companyId:'a',netPay:900}],leaveRecords:[]};
  const calls={renders:[],history:[],focus:0,scroll:0,toasts:[],backs:0};
  let onPopState,modalOpen=false,dirtyOverride=false;
  const history={state:null,pushState(value,title,url){this.state=copy(value);calls.history.push({state:copy(value),url});},back(){calls.backs++;}};
  const context={ui,state,history,ROUTE_TABS:['dashboard','settings','companies','records','investment','calendar','tax','hourly','overtime'],
    $:()=>({open:modalOpen}),getCompany:id=>state.companies.find(company=>company.id===id),
    selectedEntityIsInCurrentScope:()=>true,clearOperationalSelection(){throw Error('Unexpected selection reset');},
    renderView:()=>calls.renders.push(copy({tab:ui.tab,id:ui.companyDetailId,section:ui.companyDetailSection})),
    focusPageHeading:()=>calls.focus++,toast:(message,tone)=>calls.toasts.push({message,tone}),
    hasDirtyDraft:()=>dirtyOverride||Boolean(ui.draftScope?.dirty),location:{hash:'#companies'},
    window:{scrollTo:()=>calls.scroll++,addEventListener:(name,callback)=>{assert.equal(name,'popstate');onPopState=callback;}}};
  vm.createContext(context);vm.runInContext(routing+popstate+`\nglobalThis.api={selectPrimaryTab,openCompanyDetailRoute,currentHistoryState,companyBack:${back},manageCompanies:${manage}};`,context);
  const before=copy(state);
  return {ui,state,calls,history,api:context.api,pop:value=>onPopState({state:value}),unchanged:()=>assert.deepEqual(state,before),
    modal:value=>{modalOpen=value;},dirty:value=>{dirtyOverride=value;}};
}

test('every ordinary company-management entry resets stale company subpages, including the same tab',()=>{
  for(const tab of ['settings','dashboard','companies'])for(const section of ['overview','salary-rules','advanced-rules']){
    const f=fixture({tab,companyDetailSection:section});f.api.manageCompanies();
    assert.equal(f.ui.tab,'companies');assert.equal(f.ui.companyDetailId,'');assert.equal(f.ui.companyDetailSection,'overview');
    assert.deepEqual(f.calls.renders,[{tab:'companies',id:'',section:'overview'}]);assert.equal(f.ui.companyFilter,'b');f.unchanged();
  }
});

test('explicit company viewing and rules still work, then reopening company management returns to the overview',()=>{
  const f=fixture();f.api.openCompanyDetailRoute('b','advanced-rules');
  assert.equal(f.ui.companyDetailId,'b');assert.equal(f.ui.companyDetailSection,'advanced-rules');
  assert.deepEqual(f.history.state,{salaryMateTab:'companies',companyDetailId:'b',companyDetailSection:'advanced-rules'});
  f.api.selectPrimaryTab('settings');f.api.manageCompanies();
  assert.equal(f.ui.companyDetailId,'');assert.equal(f.ui.companyDetailSection,'overview');
  assert.deepEqual(f.history.state,{salaryMateTab:'companies',companyDetailId:'',companyDetailSection:'overview'});f.unchanged();
});

test('same-tab detail-to-overview navigation rejects a dirty draft before changing any route or history',()=>{
  const f=fixture({tab:'companies',draftScope:{dirty:true}}),before=copy(f.ui);
  assert.equal(f.api.selectPrimaryTab('companies'),false);assert.deepEqual(f.ui,before);
  assert.equal(f.calls.renders.length,0);assert.equal(f.calls.history.length,0);assert.equal(f.calls.scroll,0);f.unchanged();
});

test('explicit detail navigation also rejects a dirty draft atomically, across tabs and company subpages',()=>{
  for(const tab of ['settings','companies']){
    const f=fixture({tab,draftScope:{dirty:true}}),before=copy(f.ui);
    f.api.openCompanyDetailRoute('b','advanced-rules');assert.deepEqual(f.ui,before);
    assert.equal(f.calls.renders.length,0);assert.equal(f.calls.history.length,0);f.unchanged();
  }
});

test('the company-management back action opens the overview rather than walking backward to another subpage',()=>{
  const f=fixture({tab:'companies'});f.history.state={salaryMateTab:'companies',companyDetailId:'a',companyDetailSection:'salary-rules'};
  f.api.companyBack();assert.equal(f.ui.companyDetailId,'');assert.equal(f.ui.companyDetailSection,'overview');assert.equal(f.calls.backs,0);
  const dirty=fixture({tab:'companies'}),before=copy(dirty.ui);dirty.dirty(true);dirty.modal(true);dirty.api.companyBack();
  assert.deepEqual(dirty.ui,before);assert.equal(dirty.calls.renders.length,0);f.unchanged();dirty.unchanged();
});

test('real history restoration retains a specified company subpage without adding another history entry',()=>{
  const f=fixture();f.pop({salaryMateTab:'companies',companyDetailId:'b',companyDetailSection:'salary-rules'});
  assert.equal(f.ui.tab,'companies');assert.equal(f.ui.companyDetailId,'b');assert.equal(f.ui.companyDetailSection,'salary-rules');
  assert.equal(f.calls.history.length,0);f.pop({salaryMateTab:'companies'});
  assert.equal(f.ui.companyDetailId,'');assert.equal(f.ui.companyDetailSection,'overview');f.unchanged();
});

test('dirty history restoration preserves the current route and invalid explicit companies do not navigate',()=>{
  const f=fixture({tab:'companies',draftScope:{dirty:true}}),before=copy(f.ui);
  f.pop({salaryMateTab:'companies',companyDetailId:'b',companyDetailSection:'advanced-rules'});assert.deepEqual(f.ui,before);
  assert.deepEqual(f.history.state,{salaryMateTab:'companies',companyDetailId:'a',companyDetailSection:'salary-rules'});
  const missing=fixture(),initial=copy(missing.ui);missing.api.openCompanyDetailRoute('missing','salary-rules');
  assert.deepEqual(missing.ui,initial);assert.equal(missing.calls.renders.length,0);f.unchanged();missing.unchanged();
});
