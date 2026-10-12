import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';

const dataKeys=['companies','records','overtimeLogs','leaveRecords','investmentRecords','stockPortfolio','compTimeCredits','compTimeSettlements'];
const data=state=>Object.fromEntries(dataKeys.map(key=>[key,state[key]]));
function seed(mode='minimal'){
  const value=fixture();
  value.companies[0].name='QA 超長公司名稱 Long Company Name 0123456789 — 僅供版面回歸';
  Object.assign(value.uiPreferences,{interfaceStyle:'pixel-luxe',interfaceMode:mode,hd2dBackground:'harbor',surfaceOpacity:'frosted'});
  return value;
}
function workTab(b,tab){b.tab('calendar');b.click(`[data-v5="work-tab"][data-value="${tab}"]`);}
function toolbar(b,ids){
  const head=b.q('.v5-worklog-view>.page-head');assert.ok(head);
  const actions=head.querySelector(':scope>.page-actions');assert.ok(actions);
  assert.equal(actions.querySelector('.page-actions'),null,'a nested toolbar can escape its constrained parent');
  assert.deepEqual([...actions.querySelectorAll('select')].map(el=>el.id),ids);
  for(const id of ids){
    const select=b.q('#'+id);
    assert.equal(select.parentElement,actions,'responsive rules must reach the actual controls');
    assert.equal(select.style.width,'','inline fixed widths must not override the mobile layout');
    assert.ok(actions.querySelector(`label[for="${id}"]`),'each filter retains its accessible label');
  }
  return actions;
}

test('work-log filters keep a single toolbar and working actions across ornate, large-text and English modes',()=>{
  for(const [mode,language] of [['minimal','zh-TW'],['large','zh-TW'],['large','en-US']]){
    const b=boot(seed(mode),{language});
    try{
      const before=data(b.state());
      workTab(b,'overtime');
      const overtime=toolbar(b,['overtimeMonth']);
      assert.equal(b.q('#overtimeMonth').options.length,13);
      assert.ok(overtime.querySelector(':scope>button[data-action="add-overtime"]'));
      b.change('#overtimeMonth','10');assert.equal(b.q('#overtimeMonth').value,'10');
      assert.match(b.q('.v5-work-list').textContent,/2026-10-01/);
      b.click('.v5-worklog-view>.page-head [data-action="add-overtime"]');assert.equal(b.q('#appDialog').open,true);assert.ok(b.q('#overtimeForm'));
      b.click('[data-action="close-dialog"]');
      workTab(b,'leave');
      const leave=toolbar(b,['leaveMonth','leaveStatus']);
      assert.equal(b.q('#leaveStatus').options.length,5);
      assert.ok(leave.querySelector(':scope>button[data-action="add-leave"]'));
      b.change('#leaveMonth','10');b.change('#leaveStatus','planned');
      assert.equal(b.q('#leaveMonth').value,'10');assert.equal(b.q('#leaveStatus').value,'planned');
      assert.match(b.q('.v5-work-list').textContent,/2026-10-06/);
      b.change('#leaveStatus','cancelled');
      assert.equal(b.q('.v5-work-list .table-shell:not(.quota-table) .data-row'),null);
      b.click('.v5-worklog-view>.page-head [data-action="add-leave"]');assert.equal(b.q('#appDialog').open,true);assert.ok(b.q('#leaveForm'));
      b.click('[data-action="close-dialog"]');
      assert.deepEqual(data(b.state()),before,'view/filter/dialog operations must not alter business data');
      assert.equal(b.w.document.body.dataset.interfaceStyle,'pixel');assert.equal(b.w.document.body.dataset.styleVariant,'ornate');
      assert.equal(b.q('meta[name="theme-color"]').content,'#102635');
      assert.equal(b.state().uiPreferences.interfaceStyle,'pixel-luxe');assert.equal(b.state().uiPreferences.hd2dBackground,'harbor');
      assert.deepEqual(b.errors,[]);
    }finally{b.close();}
  }
});

test('long company labels and year changes keep the company picker functional without altering records',()=>{
  const b=boot(seed('large'));
  try{
    const before=data(b.state());
    assert.match(b.q('#companyPickerLabel').textContent,/Long Company Name/);
    b.click('#companyPickerButton');assert.equal(b.q('#companyPickerPanel').hidden,false);
    assert.ok(b.q('#companyPickerList').textContent.includes(before.companies[0].name));
    b.click('#companyPickerButton');assert.equal(b.q('#companyPickerPanel').hidden,true);
    b.change('#yearFilter','2025');assert.equal(b.q('#yearFilter').value,'2025');
    b.change('#yearFilter','2026');assert.equal(b.q('#yearFilter').value,'2026');
    workTab(b,'leave');
    assert.ok(b.q('.v5-worklog-view .leave-kpi-stat'));
    assert.ok(b.q('.v5-worklog-view .sync-panel .status'),'long sync status stays available for responsive rendering');
    assert.deepEqual(data(b.state()),before);
    assert.deepEqual(b.errors,[]);
  }finally{b.close();}
});

test('the leave trend exposes all twelve months in a labelled keyboard-focusable scroll region',()=>{
  const b=boot(seed('large'),{language:'en-US'});
  try{
    const before=data(b.state());workTab(b,'leave');
    const region=b.q('.v5-worklog-view .attendance-trend-scroll');assert.ok(region);
    assert.equal(region.getAttribute('role'),'region');assert.equal(region.tabIndex,0);
    assert.ok(region.getAttribute('aria-label'));assert.equal(region.hidden,false);
    const months=[...region.querySelectorAll('.attendance-month')];
    assert.equal(months.length,12);assert.equal(months.filter(el=>el.hidden).length,0);
    for(const month of months){assert.ok(month.querySelector('b').textContent);assert.ok(month.querySelector('span').textContent);}
    region.focus();assert.equal(b.w.document.activeElement,region);
    assert.deepEqual(data(b.state()),before);assert.deepEqual(b.errors,[]);
  }finally{b.close();}
});
