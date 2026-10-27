import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const icon=node=>node?.querySelector('.v5-ui-icon');

test('navigation, investment tabs and settings have decorative icons without altering saved records',t=>{
 const b=boot(fixture());t.after(()=>b.close());const before=b.state();
 for(const button of b.w.document.querySelectorAll('.nav-inner button')){assert.ok(icon(button));assert.equal(icon(button).getAttribute('aria-hidden'),'true');assert.equal(icon(button).getAttribute('focusable'),'false');}
 for(const tab of ['records','calendar','tax','settings','investment']){
  b.tab(tab);
  for(const button of b.w.document.querySelectorAll('main button:not([data-v5="day"]):not(.stock-favorite)'))assert.ok(button.querySelector('svg,img,.v5-style-preview,.theme-dot,.color-dot'),button.textContent);
 }
 assert.equal(b.w.document.querySelectorAll('.stock-tabs button>.v5-ui-icon').length,7);
 assert.equal(b.q('main [data-stock="buy"] svg').dataset.uiIcon,'exchange');
 assert.equal(b.q('main [data-stock="quotes"] svg').dataset.uiIcon,'edit');
 b.tab('settings');for(const summary of b.w.document.querySelectorAll('.v5-settings-summary'))assert.ok(icon(summary));
 const after=b.state();for(const key of ['companies','records','overtimeLogs','leaveRecords','stockPortfolio'])assert.deepEqual(after[key],before[key],key);
 assert.deepEqual(b.errors,[]);
});

test('decorated native selects retain labels, native selection and submitted overtime values',async t=>{
 const b=boot(fixture());t.after(()=>b.close());b.click('main [data-action="add-overtime"]');
 b.change('#overtimeForm [name="date"]','2026-10-31');await tick();
 const select=b.q('#overtimeForm [name="type"]'),form=b.q('#overtimeForm');
 assert.equal(select.tagName,'SELECT');assert.equal(select.value,'restday');assert.ok(select.labels.length);
 assert.equal(select.parentElement.querySelector('svg').dataset.uiIcon,'coffee');
 assert.equal(new b.w.FormData(form).get('hours'),'8');assert.equal(new b.w.FormData(form).get('type'),'restday');
 b.change('#overtimeForm [name="type"]','custom');b.change('#overtimeForm [name="hours"]','3.5');b.change('#overtimeForm [name="customRate"]','2.25');await tick();
 assert.equal(select.parentElement.querySelector('svg').dataset.uiIcon,'settings');
 b.submit('#overtimeForm');const saved=b.state().overtimeLogs.find(row=>row.date==='2026-10-31');
 assert.equal(saved.hours,3.5);assert.equal(saved.type,'custom');assert.equal(saved.customRate,2.25);assert.deepEqual(b.errors,[]);
});

test('Chinese and English retain canonical option values and button names',t=>{
 const b=boot(fixture());t.after(()=>b.close());b.click('main [data-action="add-overtime"]');
 const form=b.q('#overtimeForm'),values=()=>Array.from(form.querySelector('[name="type"]').options,option=>option.value),before=values();
 b.w.SalaryMateI18n.set('en');assert.deepEqual(values(),before);assert.match(form.querySelector('button[type="submit"]').textContent,/Save/i);
 assert.equal(icon(form.querySelector('button[type="submit"]')).getAttribute('aria-hidden'),'true');
 b.w.SalaryMateI18n.set('zh');assert.deepEqual(values(),before);assert.equal(form.querySelector('button[type="submit"]').textContent,'儲存加班');
 assert.deepEqual(b.errors,[]);
});

test('asynchronously inserted options receive icons once and preserve selection and click handlers',async t=>{
 const b=boot(fixture());t.after(()=>b.close());const panel=b.w.document.createElement('section');
 panel.innerHTML='<label>市場<select name="market"><option value="TW">台股</option><option value="US" selected>美股</option></select></label><button type="button" data-stock="catalog-add">加入</button>';
 b.q('main').append(panel);await tick();
 const select=panel.querySelector('select'),button=panel.querySelector('button');let clicks=0;button.addEventListener('click',()=>clicks++);
 for(let i=0;i<3;i++)b.w.SalaryMateOptionIcons.enhance(panel);
 assert.equal(panel.querySelectorAll('.v5-select-shell').length,1);assert.equal(button.querySelectorAll('svg').length,1);assert.equal(select.value,'US');
 button.click();assert.equal(clicks,1);assert.equal(button.textContent,'加入');assert.deepEqual(b.errors,[]);
});

test('checkboxes remain focusable inputs with unchanged labels and existing artwork is preserved',async t=>{
 const b=boot(fixture());t.after(()=>b.close());const panel=b.w.document.createElement('section');
 panel.innerHTML='<label><input type="checkbox" name="encrypted">密碼加密</label><button type="button"><svg class="stock-designed-svg" aria-hidden="true"><path d="M0 0h1"/></svg><span>ETF 組合</span></button>';
 b.q('main').append(panel);const artwork=panel.querySelector('button').innerHTML;await tick();
 const input=panel.querySelector('input');assert.equal(input.labels[0].textContent,'密碼加密');input.click();assert.equal(input.checked,true);
 assert.equal(input.labels[0].querySelectorAll('.v5-choice-icon').length,1);assert.equal(panel.querySelector('button').innerHTML,artwork);assert.deepEqual(b.errors,[]);
});

test('every available theme keeps the option icons and stored business records intact',t=>{
 const b=boot(fixture());t.after(()=>b.close());const before=b.state().records;
 b.tab('settings');b.click('[data-action="open-interface-settings"]');
 const styles=Array.from(b.w.document.querySelectorAll('[name="interfaceStyle"]'),input=>input.value);
 for(const expected of ['dark','dusk','pixel-luxe'])assert.ok(styles.includes(expected));
 for(const style of styles){
  b.click(`[name="interfaceStyle"][value="${style}"]`);
  assert.equal(b.w.document.body.dataset.interfaceStyle,style.replace('-luxe',''));assert.equal(b.state().uiPreferences.interfaceStyle,style);assert.deepEqual(b.state().records,before);
  assert.equal(b.w.document.querySelectorAll('.nav-inner button>.v5-ui-icon').length,6);
  assert.equal(b.w.document.querySelectorAll('.v5-select-shell .v5-select-shell').length,0);
 }
 assert.deepEqual(b.errors,[]);
});
