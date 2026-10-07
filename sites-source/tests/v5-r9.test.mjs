import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const seed=()=>{
 const f=fixture();f.stockPortfolio={assets:[{id:'a',symbol:'2330',name:'台積電',market:'TW',currency:'TWD',account:'證券'}],transactions:[{id:'d',assetId:'a',type:'dividend',date:'2026-09-16',time:'12:00',amount:90,fee:2,tax:3,fx:1,smartSourceId:'original'}]};return f;
};
const income=b=>{b.tab('investment');b.click('[data-stock="tab"][data-id="income"]');};
const work=(b,tab)=>{b.tab('calendar');b.click(`[data-v5="work-tab"][data-value="${tab}"]`);};

test('R9: legacy dividends display blank metadata; edit, reload, language and CSV retain new fields without changing income',()=>{
 const b=boot(seed());income(b);
 const heads=()=>[...b.q('.stock-panel:not(.stock-forecast-panel)').querySelectorAll('th')].map(n=>n.textContent);
 assert.ok(heads().includes('除息日期'));assert.ok(heads().includes('現金股利'));
 const cells=b.q('.stock-panel:not(.stock-forecast-panel) tbody tr').cells;assert.equal(cells[2].textContent,'—');assert.equal(cells[3].textContent,'—');
 b.click('[data-stock="transaction"][data-id="d"]');assert.equal(b.q('[name="cashDividend"]').value,'');assert.equal(b.q('[name="exDividendDate"]').value,'');
 b.change('[name="exDividendDate"]','2025-12-31');b.change('[name="cashDividend"]','4.12345678');b.submit('#stockForm');
 let t=b.state().stockPortfolio.transactions[0];assert.equal(t.exDividendDate,'2025-12-31');assert.equal(t.cashDividend,4.12345678);assert.equal(t.smartSourceId,'original');assert.equal(t.amount,90);
 assert.equal(b.w.SalaryMateStocks.calculate(b.state().stockPortfolio,2026).yearDividends,85);
 assert.match(b.q('.stock-panel:not(.stock-forecast-panel) tbody').textContent,/4\.12345678 TWD/);
 b.w.SalaryMateI18n.set('en');assert.ok(heads().includes('Ex-dividend date'));assert.ok(heads().includes('Cash dividend'));
 b.click('[data-stock="transaction"][data-id="d"]');assert.equal(b.q('[name="cashDividend"]').value,'4.12345678');assert.equal(b.q('[data-transaction-date-label]').textContent,'Payment date *');
 b.click('[data-action="close-dialog"]');b.click('[data-stock="tab"][data-id="transactions"]');let csv='';b.w.Blob=class {constructor(parts){csv=parts.join('');}};b.click('[data-stock="export-transactions"]');assert.match(csv,/2025-12-31/);assert.match(csv,/4\.12345678/);
 const reloaded=boot(b.raw());income(reloaded);assert.match(reloaded.q('.stock-panel:not(.stock-forecast-panel) tbody').textContent,/2025-12-31/);assert.equal(reloaded.state().stockPortfolio.transactions[0].cashDividend,4.12345678);
 assert.deepEqual(b.errors,[]);assert.deepEqual(reloaded.errors,[]);b.close();reloaded.close();
});

test('R9: new dividend fields are optional, accept zero, and invalid metadata is rejected',()=>{
 const b=boot(seed());income(b);b.click('[data-stock="dividend"]');
 b.change('[name="date"]','2026-09-16');b.change('[name="amount"]','100');b.change('[name="cashDividend"]','0');b.submit('#stockForm');
 let p=b.state().stockPortfolio;assert.equal(p.transactions.at(-1).cashDividend,0);assert.equal(p.transactions.at(-1).exDividendDate,'');assert.equal(b.w.SalaryMateStocks.calculate(p,2026).yearDividends,185);
 for(const changes of [{exDividendDate:0},{exDividendDate:'2026-02-30'},{exDividendDate:'2026-09-17'},{cashDividend:-1},{cashDividend:'5'},{cashDividend:Infinity}]){const n=structuredClone(p);Object.assign(n.transactions[0],changes);assert.throws(()=>b.w.SalaryMateStocks.validate(n));}
 b.click('[data-stock="transaction"][data-id="d"]');b.change('[name="type"]','buy');assert.equal(b.q('[name="cashDividend"]').disabled,true);assert.equal(b.q('[name="exDividendDate"]').disabled,true);assert.equal(b.q('[data-transaction-date-label]').textContent,'日期 *');
 b.change('[name="type"]','dividend');assert.equal(b.q('[name="cashDividend"]').disabled,false);assert.deepEqual(b.errors,[]);b.close();
});

test('R9: backup overwrite/copy and encrypted round-trip preserve dividend metadata',async()=>{
 const f=seed();Object.assign(f.stockPortfolio.transactions[0],{exDividendDate:'2026-09-01',cashDividend:3.5});const b=boot(f),s=b.state(),svc=b.w.SalaryMateBackup;
 for(const mode of ['overwrite','copy']){const r=svc.merge(s,s,mode,'r9');for(const t of r.next.stockPortfolio.transactions){assert.equal(t.exDividendDate,'2026-09-01');assert.equal(t.cashDividend,3.5);}}
 const encrypted=await svc.encrypt(s,'r9-backup-password');const recovered=await svc.decrypt(encrypted,'r9-backup-password');assert.equal(recovered.stockPortfolio.transactions[0].cashDividend,3.5);assert.equal(recovered.stockPortfolio.transactions[0].exDividendDate,'2026-09-01');assert.deepEqual(b.errors,[]);b.close();
});

test('R9: overtime editor delete confirms, cancels safely and removes only the selected record',()=>{
 const b=boot(fixture());work(b,'overtime');const pay=JSON.stringify(b.state().records);
 b.click('[data-action="edit-overtime"][data-id="ot1"]');let button=b.q('#overtimeForm [data-action="delete-overtime"]');assert.ok(button);assert.equal(button.type,'button');assert.equal(button.dataset.id,'ot1');
 b.change('#overtimeForm [name="hours"]','8');const before=b.raw();button.click();assert.ok(b.q('[data-action="confirm-action"]'));b.click('[data-action="close-dialog"]');assert.equal(b.raw(),before);
 b.click('[data-action="edit-overtime"][data-id="ot1"]');b.click('#overtimeForm [data-action="delete-overtime"]');b.click('[data-action="confirm-action"]');
 assert.deepEqual(b.state().overtimeLogs.map(t=>t.id),['otB']);assert.equal(JSON.stringify(b.state().records),pay);assert.equal(b.q('#appDialog').open,false);
 b.click('[data-action="add-overtime"]');assert.equal(b.q('#overtimeForm [data-action="delete-overtime"]'),null);assert.deepEqual(b.errors,[]);b.close();
});

test('R9: leave editor has translated delete; cancellation preserves record and confirmation updates usage',()=>{
 const f=fixture();f.leaveRecords[0].status='confirmed';f.leaveRecords.push({...f.leaveRecords[0],id:'lB',companyId:'B'});
 const b=boot(f,{language:'en-US'});work(b,'leave');const pay=JSON.stringify(b.state().records);
 b.click('[data-action="edit-leave"][data-id="l1"]');const button=b.q('#leaveForm [data-action="delete-leave"]');assert.ok(button);assert.equal(button.textContent,'Delete record');assert.equal(button.type,'button');
 const before=b.raw();button.click();b.click('[data-action="close-dialog"]');assert.equal(b.raw(),before);
 b.click('[data-action="edit-leave"][data-id="l1"]');b.click('#leaveForm [data-action="delete-leave"]');b.click('[data-action="confirm-action"]');assert.deepEqual(b.state().leaveRecords.map(t=>t.id),['lB']);assert.equal(JSON.stringify(b.state().records),pay);
 b.click('[data-action="add-leave"]');assert.equal(b.q('#leaveForm [data-action="delete-leave"]'),null);assert.deepEqual(b.errors,[]);b.close();
});
