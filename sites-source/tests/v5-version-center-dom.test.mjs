import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
test('settings and sidebar open version center with a working history icon and preserve records',()=>{
 const h=boot(fixture());try{const before=h.raw();h.tab('settings');h.click('.version-center-entry [data-action="open-version-center"]');
 assert.ok(h.q('#versionCenterPanel'));assert.ok(h.q('#versionCenterPanel').textContent.includes('v5.3.2'));assert.equal(h.q('.version-center-entry [data-ui-icon]').dataset.uiIcon,'history');
 h.click('#versionCenterPanel [data-action="close-dialog"]');h.click('.version-center-link');assert.ok(h.q('#versionCenterPanel'));assert.equal(h.raw(),before);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('desktop version is displayed asynchronously and update center opens after closing history',async()=>{
 const h=boot(fixture());try{let opened=false,resolve;h.w.SalaryMateDesktop={platform:'win32',updateState:()=>new Promise(r=>resolve=r)};h.w.SalaryMateDesktopUpdates={open(){assert.equal(h.q('#appDialog').open,false);opened=true;}};
 h.click('.version-center-link');resolve({current:{sequence:1}});await new Promise(setImmediate);assert.ok(h.q('[data-version-desktop]').textContent.includes('桌面封裝 1'));
 h.click('[data-action="open-desktop-updates"]');assert.ok(opened);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('late desktop response cannot change a closed/replaced dialog; English notes are available',async()=>{
 const h=boot(fixture(),{language:'en',preference:'en'});try{let resolve;h.w.SalaryMateDesktop={platform:'win32',updateState:()=>new Promise(r=>resolve=r)};
 h.click('.version-center-link');assert.ok(h.q('#versionCenterPanel').textContent.includes('Currently using'));h.click('#versionCenterPanel [data-action="close-dialog"]');
 resolve({current:{sequence:3}});await new Promise(setImmediate);assert.equal(h.q('#appDialog').open,false);assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
