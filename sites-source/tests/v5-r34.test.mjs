import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const styles=['doodle','cream','dusk','pencil','studio'];
const open=b=>{b.tab('settings');b.click('[data-action="open-interface-settings"]');};
const choose=(b,key)=>b.change(`input[name="interfaceStyle"][value="${key}"]`,key);
const business=state=>Object.fromEntries(['companies','records','overtimeLogs','leaveRecords','portfolio'].map(key=>[key,state[key]]));
test('R34 five themes persist across reload while preserving existing data and visual preferences',()=>{
 for(const style of styles){
  const f=fixture();f.uiPreferences.surfaceOpacity='translucent';f.uiPreferences.colorTheme='pink';
  const b=boot(f);const before=business(b.state());open(b);
  assert.equal(b.w.document.querySelectorAll('[name="interfaceStyle"]').length,12);
  choose(b,style);
  assert.equal(b.w.document.body.dataset.interfaceStyle,style);
  assert.equal(b.w.document.body.dataset.visualFamily,'reference');
  assert.equal(b.state().uiPreferences.interfaceStyle,style);
  assert.equal(b.state().uiPreferences.surfaceOpacity,'translucent');
  assert.equal(b.state().uiPreferences.colorTheme,'pink');
  assert.deepEqual(business(b.state()),before);
  const c=boot(b.raw());assert.equal(c.w.document.body.dataset.interfaceStyle,style);
  assert.equal(c.w.document.body.dataset.surfaceOpacity,'translucent');
  for(const tab of ['dashboard','records','calendar','investment','tax','settings']){
   c.tab(tab);assert.ok(c.q('#mainContent h2'));assert.ok(c.q('#mainContent .page-head h2 .v5-ui-icon'));
  }
  assert.deepEqual(b.errors,[]);assert.deepEqual(c.errors,[]);b.close();c.close();
 }
});
test('R34 new styles translate and decorative icons preserve labels and action behavior',()=>{
 const f=fixture();f.uiPreferences.interfaceStyle='studio';const b=boot(f,{language:'en-US'});
 assert.equal(b.q('.nav-inner [data-tab="records"]').textContent,'Payroll');
 b.click('.v5-quick-actions [data-action="add-overtime"]');assert.ok(b.q('#appDialog').open);b.click('[data-action="close-dialog"]');
 open(b);b.w.SalaryMateI18n.apply();
 const labels=Array.from(b.w.document.querySelectorAll('.v5-style-choice-title')).map(x=>x.textContent);
 for(const text of ['Colorful Doodles','Cream & Sunshine','Violet Dusk','Pencil Journal','Fresh Studio'])assert.ok(labels.includes(text));
 for(const svg of b.w.document.querySelectorAll('.v5-ui-icon')){assert.equal(svg.getAttribute('aria-hidden'),'true');assert.equal(svg.getAttribute('focusable'),'false');}
 assert.deepEqual(b.errors,[]);b.close();
});
test('R34 existing styles remain selectable and invalid imported style safely falls back',()=>{
 const f=fixture();f.uiPreferences.interfaceStyle='unknown-style';const b=boot(f);
 assert.equal(b.w.document.body.dataset.interfaceStyle,'glass');open(b);
 for(const style of ['pixel','macaron','cards','dark','glass']){
  choose(b,style);assert.equal(b.state().uiPreferences.interfaceStyle,style);assert.equal(b.w.document.body.dataset.visualFamily,'classic');
 }
 assert.deepEqual(b.errors,[]);b.close();
});
