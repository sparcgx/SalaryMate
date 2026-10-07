import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const open=b=>b.click('#companyPickerButton');
const action=(name,id)=>`#companyPickerPanel [data-action="${name}"][data-id="${id}"]`;
test('R28 company picker selects a company and persists the selected scope',()=>{
 const b=boot(fixture());open(b);assert.equal(b.q('#companyPickerPanel').hidden,false);
 assert.equal(b.w.document.querySelectorAll('.company-picker-row').length,2);
 b.click(action('pick-company','B'));assert.equal(b.q('#companyFilter').value,'B');assert.equal(b.q('#companyPickerPanel').hidden,true);
 assert.equal(b.state().companies.find(x=>x.id==='B').isCurrent,true);
 const c=boot(b.raw());assert.ok(c.q('#companyPickerLabel').textContent.includes('乙公司'));assert.deepEqual(b.errors,[]);b.close();c.close();
});
test('R28 editing another company does not change current company and updates the list',()=>{
 const b=boot(fixture());open(b);b.click(action('picker-edit-company','B'));
 assert.equal(b.q('#companyPickerPanel').hidden,true);assert.equal(b.q('#companyBasicForm [name="name"]').value,'乙公司');
 b.change('#companyBasicForm [name="name"]','乙公司更新');b.submit('#companyBasicForm');
 assert.equal(b.state().companies.find(x=>x.id==='B').name,'乙公司更新');assert.equal(b.state().companies.find(x=>x.id==='A').isCurrent,true);
 open(b);assert.ok(b.q('#companyPickerList').textContent.includes('乙公司更新'));assert.deepEqual(b.errors,[]);b.close();
});
test('R28 referenced companies remain protected; unreferenced deletion requires confirmation',()=>{
 const f=fixture();f.companies.push({id:'C',name:'空白公司',baseSalary:30000,isCurrent:false});const b=boot(f);
 open(b);b.click(action('picker-delete-company','A'));assert.equal(b.state().companies.length,3);assert.ok(b.q('#toast').textContent.includes('紀錄使用'));
 open(b);b.click(action('picker-delete-company','C'));assert.equal(b.q('#appDialog').open,true);assert.equal(b.state().companies.length,3);
 b.click('[data-action="close-dialog"]');assert.equal(b.state().companies.length,3);
 open(b);b.click(action('picker-delete-company','C'));b.click('[data-action="confirm-action"]');assert.equal(b.state().companies.length,2);assert.equal(b.q(action('pick-company','C')),null);assert.deepEqual(b.errors,[]);b.close();
});
test('R28 picker supports keyboard navigation, Escape, outside click and English',()=>{
 const b=boot(fixture(),{language:'en-US'}),key=(el,k)=>el.dispatchEvent(new b.w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
 const trigger=b.q('#companyPickerButton');trigger.focus();key(trigger,'ArrowDown');assert.equal(b.q('#companyPickerPanel').hidden,false);assert.equal(b.w.document.activeElement.dataset.action,'pick-company');
 key(b.w.document.activeElement,'Escape');assert.equal(b.q('#companyPickerPanel').hidden,true);assert.equal(b.w.document.activeElement,trigger);
 open(b);b.click('#mainContent');assert.equal(b.q('#companyPickerPanel').hidden,true);
 b.w.SalaryMateI18n.apply();assert.equal(b.q('#companyPickerPanel').getAttribute('aria-label'),'Companies');assert.equal(b.q(action('picker-edit-company','A')).textContent,'Edit');assert.equal(b.q(action('picker-delete-company','A')).textContent,'Delete');assert.deepEqual(b.errors,[]);b.close();
});
