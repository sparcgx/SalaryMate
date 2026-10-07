import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const open=b=>{b.tab('settings');b.click('[data-action="open-interface-settings"]');};
const choose=(b,key)=>b.change(`input[name="interfaceStyle"][value="${key}"]`,key);
test('R36 ornate presets persist their identity and map to original scene themes',()=>{
 for(const [preset,base,color] of [['macaron-luxe','macaron','#fffefa'],['pixel-luxe','pixel','#102635']]){
  const f=fixture();f.uiPreferences.hd2dBackground='harbor';f.uiPreferences.colorTheme='pink';
  const b=boot(f),before=b.state();open(b);choose(b,preset);
  assert.equal(b.state().uiPreferences.interfaceStyle,preset);
  for(const el of [b.w.document.body,b.w.document.documentElement]){assert.equal(el.dataset.interfaceStyle,base);assert.equal(el.dataset.styleVariant,'ornate');}
  assert.equal(b.q('meta[name="theme-color"]').content,color);
  assert.equal(b.w.document.body.dataset.visualFamily,'classic');
  assert.deepEqual(b.state().records,before.records);assert.deepEqual(b.state().companies,before.companies);
  const c=boot(b.raw());assert.equal(c.w.document.body.dataset.styleVariant,'ornate');assert.equal(c.state().uiPreferences.interfaceStyle,preset);assert.equal(c.state().uiPreferences.hd2dBackground,'harbor');assert.equal(c.state().uiPreferences.colorTheme,'pink');
  open(c);assert.equal(c.q(`input[name="interfaceStyle"][value="${preset}"]`).checked,true);
  choose(c,'glass');assert.equal(c.w.document.body.dataset.styleVariant,undefined);assert.equal(c.w.document.documentElement.dataset.styleVariant,undefined);assert.equal(c.w.document.body.dataset.interfaceStyle,'glass');
  assert.deepEqual(b.errors,[]);assert.deepEqual(c.errors,[]);b.close();c.close();
 }
});
test('R36 ornate HD-2D retains all five background choices and four background effect modes',()=>{
 const f=fixture();f.uiPreferences.interfaceStyle='pixel-luxe';const b=boot(f);open(b);
 assert.equal(b.w.document.querySelectorAll('[name="hd2dBackground"]').length,5);
 for(const scene of ['forest','harbor','aurora','sky','canyon']){
  b.change(`[name="hd2dBackground"][value="${scene}"]`,scene);
  assert.equal(b.state().uiPreferences.hd2dBackground,scene);assert.equal(b.w.document.documentElement.dataset.hd2dBackground,scene);
  assert.equal(b.state().uiPreferences.interfaceStyle,'pixel-luxe');
 }
 for(const opacity of ['translucent','frosted','dynamic','multi-dynamic']){
  b.change(`[name="surfaceOpacity"][value="${opacity}"]`,opacity);
  assert.equal(b.w.document.body.dataset.surfaceOpacity,opacity);assert.equal(b.w.document.body.dataset.styleVariant,'ornate');
 }
 choose(b,'macaron-luxe');assert.equal(b.q('[name="hd2dBackground"]'),null);
 choose(b,'pixel-luxe');assert.equal(b.w.document.querySelectorAll('[name="hd2dBackground"]').length,5);
 assert.deepEqual(b.errors,[]);b.close();
});
test('R36 both ornate options are translated and switching to other themes clears ornament state',()=>{
 const f=fixture();f.uiPreferences.interfaceStyle='pixel-luxe';const b=boot(f,{language:'en-US'});open(b);b.w.SalaryMateI18n.apply();
 const labels=Array.from(b.w.document.querySelectorAll('.v5-style-choice-title')).map(x=>x.textContent);
 assert.ok(labels.includes('Macaron Candy · Ornate'));assert.ok(labels.includes('Fantasy HD-2D · Ornate'));
 assert.equal(b.w.document.querySelectorAll('[name="interfaceStyle"]').length,10);
 choose(b,'dusk');assert.equal(b.w.document.body.dataset.styleVariant,undefined);assert.equal(b.w.document.body.dataset.visualFamily,'reference');
 choose(b,'glass');assert.equal(b.w.document.body.dataset.styleVariant,undefined);assert.equal(b.w.document.body.dataset.interfaceStyle,'glass');
 assert.deepEqual(b.errors,[]);b.close();
});
