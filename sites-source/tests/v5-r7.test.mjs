import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {boot,fixture,KEY} from './helpers/v5-full-dom.mjs';
const tick=()=>new Promise(r=>setTimeout(r,10));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await tick();}assert.ok(fn(),'Async UI did not settle');}
const asset=()=>({id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'證券',quotePrice:120,quoteDate:'2026-09-01',quoteFx:1});
const trade=()=>({id:'buy',assetId:'a',type:'buy',date:'2026-09-01',time:'12:00',quantity:10,price:100,fee:0,tax:0,fx:1});
function seed(){const x=fixture();x.stockPortfolio={assets:[asset()],transactions:[trade()]};x.compTimeCredits=[{id:'c',sourceId:'ot1',companyId:'A',hours:2,earnedAt:'2026-10-01',expiresAt:'2027-10-01'}];x.compTimeSettlements=[{id:'s',creditId:'c',companyId:'A',date:'2026-10-02',hours:1,amount:200}];return x;}
const choose=(b,mode)=>b.click(`#backupImportForm [name="mode"][value="${mode}"]`);
const smart=()=>({format:'smartportfolio-backup',backupVersion:1,appVersion:'1.12.0',data:{schemaVersion:3,holdings:[{id:'h',symbol:'2330',name:'台積電',category:'台股',shares:10,avgPrice:100,currentPrice:120,priceUpdatedAt:'2026-09-01'}],transactions:[{id:'b',symbol:'2330',name:'台積電',category:'台股',type:'BUY',date:'2026-09-01',shares:10,price:100,fee:0,tax:0}],marketData:{usdTwdRate:32}}});
test('Encrypted backups: UTF-8 round-trip, unique salt/IV, no plaintext, wrong password and tampering rejected',async()=>{
 const b=boot(seed()),service=b.w.SalaryMateBackup,payload=b.state(),password='密碼🔐 with spaces ';
 const x=await service.encrypt(payload,password),y=await service.encrypt(payload,password);
 assert.notEqual(x.salt,y.salt);assert.notEqual(x.iv,y.iv);assert.notEqual(x.ciphertext,y.ciphertext);assert.ok(!JSON.stringify(x).includes('甲公司'));
 assert.deepEqual(JSON.parse(JSON.stringify(await service.decrypt(x,password))),payload);
 await assert.rejects(service.decrypt(x,'wrong-password'),/密碼不正確/);
 const tampered={...x,ciphertext:(x.ciphertext[0]==='A'?'B':'A')+x.ciphertext.slice(1)};await assert.rejects(service.decrypt(tampered,password),/損毀/);
 await assert.rejects(service.decrypt({...x,iterations:1},password),/不支援/);await assert.rejects(service.encrypt(payload,'short'),/至少/);b.close();
});
test('Full backup overwrite is idempotent, updates duplicates and preserves unrelated local data',()=>{
 const b=boot(seed()),current=b.state(),incoming=structuredClone(current);current.records.push({...current.records[0],id:'extra',year:2024});incoming.records[0].baseSalary=52000;incoming.stockPortfolio.assets[0].quotePrice=140;
 const r=b.w.SalaryMateBackup.merge(current,incoming,'overwrite','one');assert.equal(r.next.records.length,4);assert.equal(r.next.records[0].baseSalary,52000);assert.equal(r.next.stockPortfolio.transactions.length,1);assert.equal(r.next.stockPortfolio.assets[0].quotePrice,140);assert.equal(current.records[0].baseSalary,48000);
 assert.deepEqual(JSON.parse(JSON.stringify(b.w.SalaryMateBackup.merge(r.next,incoming,'overwrite','two').next)),JSON.parse(JSON.stringify(r.next)));b.close();
});
test('Independent copy remaps company, payroll, overtime, comp-time, stock and migrated income references',()=>{
 const b=boot(seed()),state=b.state();state.stockPortfolio.smartImports=[{token:'archived',assets:['a','deleted-watchlist'],archivedTransactions:[],original:{source:'kept'}}];const r=b.w.SalaryMateBackup.merge(state,state,'copy','separate'),n=r.next;
 assert.equal(n.stockPortfolio.smartImports[1].assets.length,1);assert.equal(n.stockPortfolio.smartImports[1].original.source,'kept');
 assert.equal(n.companies.length,4);assert.equal(n.records.length,6);assert.equal(n.stockPortfolio.assets.length,2);assert.equal(n.stockPortfolio.transactions.length,2);
 const company=n.companies.find(c=>c.name==='甲公司（匯入副本 1）'),record=n.records.find(r=>r.companyId===company.id&&r.year===2026),credit=n.compTimeCredits[1],settlement=n.compTimeSettlements[1];
 assert.notEqual(record.id,'r1');assert.equal(n.overtimeLogs.find(o=>o.id===credit.sourceId).companyId,company.id);assert.equal(settlement.creditId,credit.id);assert.equal(settlement.companyId,company.id);assert.equal(n.investmentRecords[1].sourceRecordId,record.id);
 assert.equal(n.stockPortfolio.transactions[1].assetId,n.stockPortfolio.assets[1].id);assert.notEqual(n.stockPortfolio.assets[0].account,n.stockPortfolio.assets[1].account);assert.equal(b.w.SalaryMateStocks.calculate(n.stockPortfolio).cost,2000);assert.deepEqual(b.errors,[]);b.close();
});
test('Natural identity matches companies/months/assets with different IDs, preserving destination references',()=>{
 const b=boot(seed()),s=b.state(),incoming=structuredClone(s);incoming.companies[0].id='newA';
 for(const k of ['records','overtimeLogs','leaveRecords','compTimeCredits','compTimeSettlements'])for(const r of incoming[k])if(r.companyId==='A')r.companyId='newA';
 incoming.records[0].id='newR';incoming.investmentRecords[0].sourceRecordId='newR';incoming.stockPortfolio.assets[0].id='newAsset';incoming.stockPortfolio.transactions[0].assetId='newAsset';incoming.stockPortfolio.transactions[0].id='newTrade';
 const n=b.w.SalaryMateBackup.merge(s,incoming).next;assert.equal(n.companies.length,2);assert.equal(n.records.length,3);assert.equal(n.stockPortfolio.assets.length,1);assert.equal(n.stockPortfolio.transactions.length,1);assert.equal(n.stockPortfolio.transactions[0].assetId,'a');assert.equal(n.investmentRecords[0].sourceRecordId,'r1');b.close();
});
test('Legitimate identical stock fills retain distinct IDs; invalid combined stock or comp-time ledger is blocked',()=>{
 const b=boot(seed()),s=b.state();s.stockPortfolio.transactions.push({...trade(),id:'buy2'});
 const empty=boot().state();let n=b.w.SalaryMateBackup.merge(empty,s).next;assert.equal(n.stockPortfolio.transactions.length,2);n=b.w.SalaryMateBackup.merge(n,s).next;assert.equal(n.stockPortfolio.transactions.length,2);
 const incoming=structuredClone(s);incoming.compTimeCredits[0].hours=0.5;assert.throws(()=>b.w.SalaryMateBackup.merge(s,incoming),/補休/);
 const local=structuredClone(s);local.stockPortfolio.transactions.push({...trade(),id:'sell',type:'sell',date:'2026-09-02',quantity:20});incoming.compTimeCredits[0].hours=2;incoming.stockPortfolio.transactions[0].quantity=1;assert.throws(()=>b.w.SalaryMateBackup.merge(local,incoming),/股/);b.close();
});
test('UI export: plain default, optional password confirmation and encrypted download do not store passwords',async()=>{
 const b=boot(seed());b.tab('settings');b.click('[data-action="export-json"]');assert.equal(b.q('#backupPasswords').hidden,true);b.submit('#backupExportForm');assert.equal(b.downloads.length,1);assert.match(b.downloads[0],/_backup_/);
 b.click('[data-action="export-json"]');b.click('#backupExportForm [name="encrypted"]');assert.equal(b.q('#backupPasswords').disabled,false);
 b.change('#backupExportForm [name="password"]','my-password-777');b.change('#backupExportForm [name="confirmation"]','different');b.submit('#backupExportForm');assert.equal(b.downloads.length,1);assert.match(b.q('#backupExportForm').textContent,/兩次密碼/);
 b.change('#backupExportForm [name="confirmation"]','my-password-777');b.submit('#backupExportForm');await until(()=>b.downloads.length===2);assert.match(b.downloads[1],/_encrypted_/);assert.ok(!b.raw().includes('my-password-777'));assert.deepEqual(b.errors,[]);b.close();
});
test('UI encrypted import: wrong password is read-only; correct password previews before overwrite/copy',async()=>{
 const b=boot(seed()),payload=b.state(),cipher=await b.w.SalaryMateBackup.encrypt(payload,'test-password'),before=b.raw();await b.w.SalaryMateData.importPayload(JSON.stringify(cipher));assert.ok(b.q('#backupDecryptForm'));b.change('#backupDecryptForm [name="password"]','bad-password');b.submit('#backupDecryptForm');await until(()=>b.q('.backup-status').textContent.includes('密碼不正確'));assert.equal(b.raw(),before);
 b.change('#backupDecryptForm [name="password"]','test-password');b.submit('#backupDecryptForm');await until(()=>b.q('#backupImportForm'));assert.equal(b.raw(),before);choose(b,'copy');assert.match(b.q('#backupImportPreview').textContent,/新增 2/);b.click('[data-action="confirm-action"]');assert.equal(b.state().companies.length,4);assert.equal(b.state().records.length,6);assert.ok(!b.raw().includes('test-password'));assert.deepEqual(b.errors,[]);b.close();
});
test('UI complete restore requires acknowledgement; copy keeps device preferences, restore restores backup preferences',async()=>{
 const b=boot(seed()),incoming=b.state();incoming.uiPreferences.colorTheme='blue';incoming.records=[];incoming.investmentRecords=[];
 await b.w.SalaryMateData.importPayload(JSON.stringify(incoming));choose(b,'restore');assert.equal(b.q('[data-action="confirm-action"]').disabled,true);b.click('#backupImportForm [name="restoreAck"]');b.click('[data-action="confirm-action"]');assert.equal(b.state().records.length,0);assert.equal(b.state().uiPreferences.colorTheme,'blue');assert.deepEqual(b.errors,[]);b.close();
});
test('UI cancelled, concurrent and failed-storage imports leave original data intact',async()=>{
 const b=boot(seed()),payload=b.w.SalaryMateData.exportPayload(),before=b.raw();await b.w.SalaryMateData.importPayload(payload);choose(b,'copy');b.click('[data-action="close-dialog"]');assert.equal(b.raw(),before);
 await b.w.SalaryMateData.importPayload(payload);choose(b,'copy');const external={...JSON.parse(before),updatedAt:'other-tab'};b.w.localStorage.setItem(KEY,JSON.stringify(external));b.click('[data-action="confirm-action"]');assert.deepEqual(JSON.parse(b.raw()),external);assert.equal(b.state().companies.length,2);assert.ok(b.q('#backupImportForm'));b.close();
 const c=boot(seed()),old=c.raw();await c.w.SalaryMateData.importPayload(payload);choose(c,'copy');c.w.Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};c.click('[data-action="confirm-action"]');assert.equal(c.raw(),old);assert.equal(c.state().companies.length,2);assert.ok(c.q('#backupImportForm'));c.close();
});
test('SmartPortfolio overwrite replaces matching ledger once; independent copies coexist and preserve unrelated accounts',()=>{
 const b=boot(),svc=b.w.SalaryMateStockServices,opts={mode:'history',snapshotDate:'2026-10-02',token:'source'},first=svc.prepareSmart(smart(),b.w.SalaryMateStocks.empty(),opts).next;
 first.assets.push(asset());first.transactions.push(trade());const overwritten=svc.prepareSmart(smart(),first,{...opts,conflict:'overwrite'});assert.equal(overwritten.replaced,1);assert.equal(overwritten.next.assets.length,2);assert.equal(overwritten.next.transactions.length,2);assert.equal(overwritten.next.smartImports.length,1);
 const duplicated=svc.prepareSmart(smart(),overwritten.next,{...opts,conflict:'copy',copyToken:'unique'});assert.equal(duplicated.next.assets.length,3);assert.equal(duplicated.next.transactions.length,3);assert.equal(new Set(duplicated.next.assets.map(a=>a.id)).size,3);assert.match(duplicated.next.assets.at(-1).account,/副本/);assert.equal(b.w.SalaryMateStocks.calculate(duplicated.next).cost,3000);b.close();
});
test('UI SmartPortfolio duplicate import exposes overwrite/copy choice with actual preview and acknowledgement',async()=>{
 const b=boot(seed());const load=async()=>{await b.w.SalaryMateData.importPayload(JSON.stringify(smart()));assert.ok(b.q('#stockImportForm'));};await load();b.click('#stockImportForm [name="ack"]');b.submit('#stockImportForm');assert.equal(b.state().stockPortfolio.assets.length,2);
 await load();assert.equal(b.q('#stockImportForm [name="conflict"]').value,'overwrite');assert.match(b.q('#stockImportPreview').textContent,/覆蓋 1/);b.change('#stockImportForm [name="conflict"]','copy');assert.match(b.q('#stockImportPreview').textContent,/獨立帳戶副本/);b.click('#stockImportForm [name="ack"]');b.submit('#stockImportForm');assert.equal(b.state().stockPortfolio.assets.length,3);assert.deepEqual(b.errors,[]);b.close();
});
test('Framed annual cards and inner income panels have positive padding after the complete stylesheet cascade',()=>{
 const b=boot(seed()),style=b.w.document.createElement('style');style.textContent=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/styles.css',import.meta.url),'utf8');b.w.document.head.append(style);
 const host=b.w.document.createElement('div');host.innerHTML='<article class="card card-pad annual-analysis"><h3>年度同期比較</h3><div class="annual-structure"><article class="card"><h4>薪資實領</h4></article></div></article>';b.w.document.body.append(host);
 for(const el of host.querySelectorAll('.card')){const css=b.w.getComputedStyle(el);assert.ok(parseFloat(css.paddingLeft)>=18);assert.ok(parseFloat(css.paddingRight)>=18);}b.close();
});
