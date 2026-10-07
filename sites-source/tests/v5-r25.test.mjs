import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const failWrites=b=>{b.w.Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};};
test('R25: failed density save restores appearance and never claims success',()=>{
 const b=boot(fixture());b.tab('settings');b.click('[data-action="open-interface-settings"]');const before=b.raw();failWrites(b);b.click('[data-action="set-interface-mode"][data-mode="large"]');assert.equal(b.raw(),before);assert.equal(b.w.document.body.dataset.uiMode,'minimal');assert.ok(!b.q('#toast').textContent.includes('已切換'));b.close();
});
test('R25: clearing data persists default preferences and empty records across reload',()=>{
 const f=fixture();f.uiPreferences.interfaceStyle='pixel';f.uiPreferences.surfaceOpacity='transparent';f.uiPreferences.hd2dBackground='sky';const b=boot(f);b.tab('settings');b.click('[data-action="clear-data"]');b.click('[data-action="confirm-action"]');const c=boot(b.raw());for(const app of [b,c]){assert.equal(app.state().records.length,0);assert.equal(app.w.document.body.dataset.interfaceStyle,'glass');assert.equal(app.w.document.body.dataset.surfaceOpacity,'frosted');assert.equal(app.w.document.body.dataset.hd2dBackground,'canyon');}assert.deepEqual(b.state().uiPreferences,c.state().uiPreferences);b.close();c.close();
});
test('R25: failed clear restores records and every visual preference',()=>{
 const f=fixture();f.uiPreferences.interfaceStyle='pixel';f.uiPreferences.surfaceOpacity='transparent';const b=boot(f);b.tab('settings');const before=b.raw();b.click('[data-action="clear-data"]');failWrites(b);b.click('[data-action="confirm-action"]');assert.equal(b.raw(),before);assert.equal(b.state().records.length,3);assert.equal(b.w.document.body.dataset.interfaceStyle,'pixel');assert.equal(b.w.document.body.dataset.surfaceOpacity,'transparent');b.close();
});
test('R25: calculator edits, import and reset roll back on failed storage',()=>{
 const b=boot(fixture());b.tab('tax');b.click('[data-value="tools"]');b.change('#hourlyMonth','9');const before=b.raw(),calc=JSON.stringify(b.state().overtimeCalculator);failWrites(b);
 for(const selector of ['[data-calc-setting="baseSalary"]','[data-calc-multiplier="first"]','[data-calc-hours="first"]']){b.change(selector,'7');assert.equal(b.raw(),before);assert.equal(JSON.stringify(b.state().overtimeCalculator),calc);}
 b.click('[data-action="load-calculator-record"]');assert.equal(JSON.stringify(b.state().overtimeCalculator),calc);assert.ok(!b.q('#toast').textContent.startsWith('已帶入'));
 b.click('[data-action="reset-calculator"]');b.click('[data-action="confirm-action"]');assert.equal(b.raw(),before);assert.equal(JSON.stringify(b.state().overtimeCalculator),calc);assert.notEqual(b.q('#toast').textContent,'加班費試算已重設');b.close();
});
