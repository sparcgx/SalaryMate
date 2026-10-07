import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
test('Fixed income add/remove keeps unfinished rows and saves to selected company only',()=>{
 const b=boot(fixture());b.tab('settings');b.click('[data-action="company-salary-rules"]');b.click('[data-action="edit-fixed-income-rule"]');
 b.click('[data-action="add-fixed-income-rule"]');b.change('[data-fixed-income-name]','輪班津貼');b.change('[data-fixed-income-amount]','1200');
 b.click('[data-action="add-fixed-income-rule"]');assert.equal(b.w.document.querySelectorAll('[data-fixed-income-row]').length,2);
 b.click('[data-action="remove-fixed-income-rule"][data-index="1"]');assert.equal(b.q('[data-fixed-income-name]').value,'輪班津貼');
 b.submit('#fixedIncomeRuleForm');assert.equal(b.q('#appDialog').open,false);assert.ok(JSON.stringify(b.state().salaryAdjustments.filter(c=>c.companyId==='A')).includes('輪班津貼'));assert.ok(!JSON.stringify(b.state().salaryAdjustments.filter(c=>c.companyId==='B')).includes('輪班津貼'));assert.deepEqual(b.errors,[]);b.close();
});
test('Overtime shortcuts 1/2/8/10 and day-type defaults persist without altering edits on open',()=>{
 const b=boot(fixture());b.tab('calendar');b.click('main [data-action="add-overtime"]');
 assert.deepEqual([...b.w.document.querySelectorAll('[data-v5="quick-hours"]')].map(x=>x.dataset.value),['1','2','8','10']);
 for(const type of ['restday','holiday']){b.change('#overtimeForm [name="type"]',type);assert.equal(b.q('#overtimeForm [name="hours"]').value,'8');}
 b.click('[data-v5="quick-hours"][data-value="10"]');b.submit('#overtimeForm');const id=b.state().overtimeLogs.find(x=>!['ot1','otB'].includes(x.id)).id;
 b.click(`[data-action="edit-overtime"][data-id="${id}"]`);assert.equal(b.q('#overtimeForm [name="hours"]').value,'10');assert.deepEqual(b.errors,[]);b.close();
});
test('Investment ledger migrates old amounts once, works without a company, reloads and roundtrips',async()=>{
 const b=boot(fixture());assert.equal(b.state().investmentRecords.length,1);assert.equal(b.state().investmentRecords[0].amount,1000);assert.equal(b.state().records[0].sideIncome,0);
 b.tab('investment');b.click('main [data-action="add-investment"]');b.change('#investmentForm [name="name"]','00878');b.change('#investmentForm [name="date"]','2026-10-02');b.change('#investmentForm [name="amount"]','1234.56');b.submit('#investmentForm');
 assert.equal(b.state().investmentRecords.length,2);assert.match(b.q('main').textContent,/2,234/);b.click('[data-action="export-investment"]');assert.equal(b.downloads.length,1);const payload=b.w.SalaryMateData.exportPayload();const c=boot(payload);assert.equal(c.state().investmentRecords.length,2);
 const d=boot();await d.w.SalaryMateData.importPayload(payload);d.click('[data-action="confirm-action"]');assert.equal(d.state().investmentRecords.length,2);assert.equal(d.state().investmentRecords.find(r=>r.name==='00878').amount,1234.56);
 const e=boot();e.tab('investment');e.click('main [data-action="add-investment"]');e.change('#investmentForm [name="name"]','利息');e.change('#investmentForm [name="amount"]','50');e.submit('#investmentForm');assert.equal(e.state().investmentRecords.length,1);
 const eid=e.state().investmentRecords[0].id;e.click(`[data-action="edit-investment"][data-id="${eid}"]`);e.change('#investmentForm [name="amount"]','-20');e.submit('#investmentForm');assert.equal(e.state().investmentRecords[0].amount,-20);e.click(`[data-action="delete-investment"][data-id="${eid}"]`);e.click('[data-action="confirm-action"]');assert.equal(e.state().investmentRecords.length,0);
 for(const app of [b,c,d,e]){assert.deepEqual(app.errors,[]);app.close();}
});
test('New company requires pay type and creates an hourly company with the correct payroll defaults',()=>{
 const b=boot();b.click('[data-action="add-company-basic"]');
 assert.equal(b.w.document.querySelectorAll('#companyBasicForm [name="employmentMode"]').length,2);
 b.click('#companyBasicForm [name="employmentMode"][value="dispatch_hourly"]');
 assert.ok(b.q('#companyBasicForm [name="baseHourlyRate"]'));assert.ok(b.q('#companyBasicForm [name="defaultRegularHours"]'));
 b.change('#companyBasicForm [name="name"]','時薪公司');b.change('#companyBasicForm [name="baseHourlyRate"]','205.5');b.change('#companyBasicForm [name="defaultRegularHours"]','160');b.change('#companyBasicForm [name="employmentStartDate"]','2026-10-01');
 assert.ok(b.q('#companyHourlyPreview').textContent.includes('32,880'));b.submit('#companyBasicForm');
 const c=b.state().companies[0];assert.equal(c.employmentMode,'dispatch_hourly');assert.equal(c.baseHourlyRate,205.5);assert.equal(c.defaultRegularHours,160);assert.equal(c.baseSalary,32880);
 b.tab('records');b.click('main [data-action="add-record"]');b.click('[data-action="payroll-next"]');assert.ok(b.q('#recordForm [name="baseHourlyRate"]'));assert.equal(b.q('#recordForm [name="baseHourlyRate"]').value,'205.500');assert.equal(b.q('#recordForm [name="regularHours"]').value,'160');assert.deepEqual(b.errors,[]);b.close();
});
test('Hourly company creation rejects missing hourly rate without changing data',()=>{
 const b=boot();b.click('[data-action="add-company-basic"]');b.click('#companyBasicForm [name="employmentMode"][value="dispatch_hourly"]');b.change('#companyBasicForm [name="name"]','缺少時薪');b.change('#companyBasicForm [name="employmentStartDate"]','2026-10-01');
 b.submit('#companyBasicForm');assert.equal(b.state().companies.length,0);assert.equal(b.q('#appDialog').open,true);assert.deepEqual(b.errors,[]);b.close();
});
