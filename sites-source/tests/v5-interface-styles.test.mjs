import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const records = s => JSON.parse(JSON.stringify(Object.fromEntries(['companies','records','overtimeLogs','leaveRecords','compTimeCredits','compTimeSettlements','investmentRecords','stockPortfolio'].map(k=>[k,s[k]]))));
const open = b => {b.tab('settings');b.click('[data-action="open-interface-settings"]');};
test('Interface styles: five styles apply immediately, persist across reload and preserve all business data',()=>{
 const b=boot(fixture());const before=records(b.state());open(b);
 assert.equal(b.q('#dialogTitle').textContent,'版面設定');assert.equal(b.w.document.querySelectorAll('[name="interfaceStyle"]').length,5);
 for(const style of ['cards','dark','glass','macaron','pixel']){
  b.click(`[name="interfaceStyle"][value="${style}"]`);assert.equal(b.w.document.body.dataset.interfaceStyle,style);assert.equal(b.w.document.documentElement.dataset.interfaceStyle,style);assert.equal(b.state().uiPreferences.interfaceStyle,style);assert.equal(b.q(`[name="interfaceStyle"][value="${style}"]`).checked,true);assert.deepEqual(records(b.state()),before);
  const reopened=boot(b.raw());assert.equal(reopened.w.document.body.dataset.interfaceStyle,style);assert.deepEqual(records(reopened.state()),before);reopened.close();
 }
 assert.deepEqual(b.errors,[]);b.close();
});
test('Interface styles: style, density and accent remain independent; dark toolbar color stays dark',()=>{
 const b=boot(fixture());open(b);b.click('[name="interfaceStyle"][value="dark"]');b.click('[data-action="set-interface-mode"][data-mode="large"]');b.click('[data-action="set-color-theme"][data-theme="teal"]');
 assert.equal(b.w.document.body.dataset.interfaceStyle,'dark');assert.equal(b.w.document.body.dataset.uiMode,'large');assert.equal(b.w.document.body.dataset.colorTheme,'teal');assert.equal(b.q('meta[name="theme-color"]').content,'#151a21');assert.equal(b.state().uiPreferences.interfaceStyle,'dark');assert.deepEqual(b.errors,[]);b.close();
});
test('Interface styles: old or invalid preference falls back to glass without changing records',()=>{
 for(const style of [undefined,'unknown']){const seed=fixture();seed.uiPreferences.interfaceStyle=style;const b=boot(seed);assert.equal(b.w.document.body.dataset.interfaceStyle,'glass');assert.equal(b.state().records.length,3);b.close();}
});
test('Interface styles: failed persistence restores prior style and stored data',()=>{
 const b=boot(fixture());open(b);const before=b.raw();b.w.Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};b.click('[name="interfaceStyle"][value="dark"]');assert.equal(b.raw(),before);assert.equal(b.w.document.body.dataset.interfaceStyle,'glass');assert.equal(b.q('[name="interfaceStyle"][value="glass"]').checked,true);assert.notEqual(b.q('#toast').textContent,'介面風格已儲存');b.close();
});
test('Interface styles: English settings and style labels translate without changing stored keys',()=>{
 const b=boot(fixture(),{language:'en-US'});open(b);assert.equal(b.q('#dialogTitle').textContent,'Layout settings');assert.match(b.q('.v5-style-fieldset').textContent,/Animated frosted glass/);assert.match(b.q('.v5-style-fieldset').textContent,/Classic cards/);assert.ok(!/[\u4e00-\u9fff]/.test(b.q('.v5-style-fieldset').textContent));b.click('[name="interfaceStyle"][value="dark"]');assert.equal(b.state().uiPreferences.interfaceStyle,'dark');b.close();
});
test('R16: removed white choice migrates to cards while preserving density, accent and records',()=>{
 const seed=fixture();seed.uiPreferences.interfaceStyle='white';seed.uiPreferences.interfaceMode='large';seed.uiPreferences.colorTheme='violet';const b=boot(seed);assert.equal(b.w.document.body.dataset.interfaceStyle,'cards');assert.equal(b.state().uiPreferences.interfaceMode,'large');assert.equal(b.state().uiPreferences.colorTheme,'violet');open(b);assert.equal(b.q('[name="interfaceStyle"][value="white"]'),null);assert.ok(!b.q('#dialogContent').textContent.includes('白色極簡'));assert.equal(b.state().records.length,3);b.close();
});
test('R16: all seven accents are selectable, persist and remain independent from new styles',()=>{
 const b=boot(fixture());const before=records(b.state());open(b);assert.equal(b.w.document.querySelectorAll('[data-action="set-color-theme"]').length,7);
 for(const style of ['macaron','pixel','dark']){b.click(`[name="interfaceStyle"][value="${style}"]`);for(const theme of ['slate','blue','teal','pink','violet','amber','rose']){b.click(`[data-action="set-color-theme"][data-theme="${theme}"]`);assert.equal(b.w.document.body.dataset.colorTheme,theme);assert.equal(b.w.document.body.dataset.interfaceStyle,style);assert.equal(b.state().uiPreferences.colorTheme,theme);assert.deepEqual(records(b.state()),before);}}
 const reopened=boot(b.raw());assert.equal(reopened.w.document.body.dataset.colorTheme,'rose');assert.equal(reopened.w.document.body.dataset.interfaceStyle,'dark');assert.deepEqual(b.errors,[]);reopened.close();b.close();
});
test('R16: failed accent storage preserves previous appearance and stored data',()=>{
 const b=boot(fixture());open(b);const before=b.raw();b.w.Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};b.click('[data-action="set-color-theme"][data-theme="pink"]');assert.equal(b.raw(),before);assert.equal(b.w.document.body.dataset.colorTheme,'slate');assert.equal(b.q('[data-theme="slate"]').getAttribute('aria-checked'),'true');b.close();
});
test('R19: all five backgrounds persist, remain independent from style and leave business records intact',()=>{
 const b=boot(fixture());const before=records(b.state());open(b);
 assert.equal(b.q('.v5-background-fieldset'),null);b.click('[name="interfaceStyle"][value="pixel"]');
 assert.equal(b.w.document.querySelectorAll('[name="hd2dBackground"]').length,5);
 for(const scene of ['forest','harbor','aurora','sky','canyon']){
  b.click(`[name="hd2dBackground"][value="${scene}"]`);
  assert.equal(b.w.document.documentElement.dataset.hd2dBackground,scene);assert.equal(b.state().uiPreferences.hd2dBackground,scene);
  const reopened=boot(b.raw());assert.equal(reopened.w.document.documentElement.dataset.hd2dBackground,scene);assert.deepEqual(records(reopened.state()),before);reopened.close();
 }
 b.click('[name="hd2dBackground"][value="aurora"]');b.click('[name="interfaceStyle"][value="macaron"]');assert.equal(b.q('.v5-background-fieldset'),null);
 b.click('[name="interfaceStyle"][value="pixel"]');assert.equal(b.q('[name="hd2dBackground"][value="aurora"]').checked,true);
 const english=boot(b.raw(),{language:'en-US'});open(english);assert.match(english.q('.v5-background-fieldset').textContent,/Aurora Castle/);assert.ok(!/[\u4e00-\u9fff]/.test(english.q('.v5-background-fieldset').textContent));
 assert.deepEqual(records(b.state()),before);assert.deepEqual(b.errors,[]);english.close();b.close();
});
test('R19: existing and unknown background preferences retain the original canyon',()=>{
 for(const value of [undefined,'invalid-scene']){const seed=fixture();seed.uiPreferences.interfaceStyle='pixel';seed.uiPreferences.hd2dBackground=value;const b=boot(seed);open(b);assert.equal(b.q('[name="hd2dBackground"][value="canyon"]').checked,true);assert.equal(b.w.document.documentElement.dataset.hd2dBackground,'canyon');b.close();}
});
test('R19: failed background persistence restores the selected scene and leaves saved records unchanged',()=>{
 const seed=fixture();seed.uiPreferences.interfaceStyle='pixel';seed.uiPreferences.hd2dBackground='forest';const b=boot(seed);open(b);const before=b.raw();
 b.w.Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};b.click('[name="hd2dBackground"][value="sky"]');
 assert.equal(b.raw(),before);assert.equal(b.w.document.documentElement.dataset.hd2dBackground,'forest');assert.equal(b.q('[name="hd2dBackground"][value="forest"]').checked,true);assert.notEqual(b.q('#toast').textContent,'背景已儲存');b.close();
});
