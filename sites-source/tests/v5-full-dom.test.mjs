import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture,KEY} from './helpers/v5-full-dom.mjs';

test('V5 full: all primary pages, company rules, calculators and legal render without modifying domain records',()=>{
  const b=boot(fixture()),before=b.raw();
  for(const tab of ['dashboard','records','calendar','tax','settings']){b.tab(tab);assert.ok(b.q('main h2'));assert.ok(b.q('main').textContent.length>50);}
  b.click('[data-action="manage-companies"]');b.click('[data-action="company-salary-rules"]');assert.ok(b.q('main').textContent.includes('薪資規則'));
  b.tab('tax');b.click('[data-value="tools"]');
  for(const tab of ['overtime','yearend','raises']){b.click(`[data-salary-tab="${tab}"]`);assert.ok(b.q('main').textContent.length>100);}
  b.tab('settings');b.click('[data-action="open-legal"]');assert.ok(b.q('#appDialog').open);assert.ok(b.q('#dialogContent').textContent.includes('MIT'));
  assert.equal(b.state().records.length,3);assert.equal(b.w.localStorage.getItem('salarymate_v310_state'),'v4-original');assert.equal(b.w.localStorage.getItem('salarymate_v5_worklog'),'v5-dev1-original');
  assert.equal(JSON.parse(before).records[0].baseSalary,b.state().records[0].baseSalary);assert.deepEqual(b.errors,[]);b.close();
});
test('V5 full: first company and three-step monthly payroll save and reload',()=>{
  const b=boot();b.click('[data-action="add-company-basic"]');
  b.change('#companyBasicForm [name="name"]','新公司');b.change('#companyBasicForm [name="baseSalary"]','48000');b.change('#companyBasicForm [name="employmentStartDate"]','2024-01-01');b.submit('#companyBasicForm');
  assert.equal(b.state().companies.length,1);assert.equal(b.q('#appDialog').open,false);
  b.tab('records');b.click('main [data-action="add-record"]');assert.equal(b.q('#recordForm').dataset.payrollStep,'1');
  b.change('#recordForm [name="year"]','2026');b.change('#recordForm [name="month"]','10');b.click('[data-action="payroll-next"]');
  assert.equal(b.q('#recordForm').dataset.payrollStep,'2');b.change('#recordForm [name="bonus"]','2000');b.change('#recordForm [name="laborIns"]','1000');
  b.click('[data-action="payroll-next"]');assert.equal(b.q('#recordForm').dataset.payrollStep,'3');b.submit('#recordForm');
  assert.equal(b.state().records.length,1);assert.equal(b.state().records[0].bonus,2000);assert.equal(b.q('#appDialog').open,false);
  assert.ok(b.q('.v5-salary-list').textContent.includes('52,000'));
  const raw=b.raw();b.close();const next=boot(raw);assert.equal(next.state().records[0].laborIns,1000);assert.deepEqual(next.errors,[]);next.close();
});
test('V5 full: selected calendar date creates overtime, quick-hours and historical rate isolation',()=>{
  const b=boot(fixture());b.tab('calendar');b.click('[data-v5="day"][data-date="2026-10-09"]');b.click('main [data-action="add-overtime"]');
  assert.equal(b.q('#overtimeForm [name="date"]').value,'2026-10-09');assert.equal(b.q('#overtimeForm [name="hourlyRate"]').value,'200.000');
  b.click('[data-v5="quick-hours"][data-value="8"]');b.change('#overtimeForm [name="hourlyRate"]','210');b.submit('#overtimeForm');
  assert.equal(b.state().overtimeLogs.length,3);assert.ok(b.q('[data-date="2026-10-09"]').textContent.includes('8h'));
  b.change('#companyFilter','B');b.click('main [data-action="add-overtime"]');assert.equal(b.q('#overtimeForm [name="hourlyRate"]').value,'333.000');
  assert.equal(b.state().overtimeLogs.find(x=>x.id==='ot1').hourlyRate,200);assert.deepEqual(b.errors,[]);b.close();
});
test('V5 full: planned leave, calendar range and cancellation return annual allowance',()=>{
  const b=boot(fixture());b.tab('calendar');b.click('[data-v5="day"][data-date="2026-10-12"]');b.click('main [data-action="add-leave"]');
  assert.equal(b.q('#leaveForm [name="startDate"]').value,'2026-10-12');b.change('#leaveForm [name="durationMode"]','range');b.change('#leaveForm [name="endDate"]','2026-10-14');b.submit('#leaveForm');
  assert.equal(b.state().leaveRecords.length,2);assert.ok(b.q('[data-date="2026-10-13"]').textContent.includes('特休 8h'));
  const id=b.state().leaveRecords.find(x=>x.id!=='l1').id;
  assert.ok(b.q('.v5-leave-balance').textContent.includes('48 小時'));
  b.click(`[data-action="edit-leave"][data-id="${id}"]`);b.change('#leaveForm [name="status"]','cancelled');b.submit('#leaveForm');
  assert.equal(b.state().leaveRecords.find(x=>x.id===id).status,'cancelled');assert.ok(b.q('.v5-leave-balance').textContent.includes('72 小時'));
  assert.ok(!b.q('[data-date="2026-10-13"]').textContent.includes('特休'));assert.deepEqual(b.errors,[]);b.close();
});
test('V5 full: leave settings persist, validate anniversary requirements and apply company-specific quota',()=>{
  const b=boot(fixture());b.tab('settings');b.click('[data-action="v5-leave-settings"]');
  b.change('#v5LeaveSettingsForm [name="quotaMode"]','custom');b.change('#v5LeaveSettingsForm [name="quotaHours"]','96');b.submit('#v5LeaveSettingsForm');
  assert.equal(b.state().companies.find(c=>c.id==='A').leavePolicies.annual.quotaDays,12);
  assert.equal(b.state().companies.find(c=>c.id==='B').leavePolicies.annual.quotaDays,5);
  b.tab('calendar');assert.ok(b.q('.v5-leave-balance').textContent.includes('88 小時'));b.close();
  const c=boot(fixture());c.tab('settings');c.click('[data-action="v5-leave-settings"]');c.change('#v5LeaveSettingsForm [name="employmentStartDate"]','');c.change('#v5LeaveSettingsForm [name="quotaMode"]','auto');c.submit('#v5LeaveSettingsForm');assert.match(c.q('#v5LeaveSettingsForm .validation-summary').textContent,/請先填寫到職日/);assert.equal(c.state().companies[0].employmentStartDate,'2024-01-01');assert.deepEqual(c.errors,[]);c.close();
});
test('V5 full: exact monthly navigation and salary expansion expose full amounts',()=>{
  const f=fixture();f.records.push({id:'january',companyId:'A',year:2026,month:1,baseSalary:30000},{id:'october',companyId:'A',year:2026,month:10,baseSalary:50000});
  const b=boot(f);b.tab('tax');b.click('[data-v5="salary-month"][data-month="1"]');assert.equal(b.q('#v5SalaryMonth').value,'1');assert.equal(b.w.document.querySelectorAll('.v5-salary-record').length,1);assert.ok(b.q('.v5-salary-row').textContent.includes('1 月薪資'));
  b.change('#v5SalaryMonth','0');assert.equal(b.w.document.querySelectorAll('.v5-salary-record').length,3);b.click('[data-action="toggle-record"][data-id="r1"]');b.tab('investment');assert.ok(b.q('main').textContent.includes('1,000'));assert.equal(b.state().records.find(r=>r.id==='r1').sideIncome,0);assert.deepEqual(b.errors,[]);b.close();
});
test('V5 full: reconciliation saves exact matching salary lines without altering payroll',()=>{
  const f=fixture();f.overtimeLogs=[];f.leaveRecords=[];const b=boot(f);b.tab('records');b.click('[data-action="reconcile-record"][data-id="r1"]');
  const rows=b.w.SalaryMateReconcile.rows(b.state().records.find(r=>r.id==='r1'));
  for(const row of rows)b.change(`[data-reconcile-key="${row.key}"]`,String(row.expected));
  b.click('#reconciliationForm button[value="confirm"]');
  assert.equal(b.state().records.find(r=>r.id==='r1').reconciliation.reviewed,true);assert.equal(b.state().records[0].baseSalary,48000);assert.deepEqual(b.errors,[]);b.close();
});
test('V5 full: backup preview then restore preserves all modules; invalid import remains read-only',async()=>{
  const b=boot(fixture());const payload=b.w.SalaryMateData.exportPayload();b.tab('settings');b.click('[data-action="export-json"]');b.submit('#backupExportForm');assert.equal(b.downloads.length,1);
  const target=boot();const before=target.raw();await target.w.SalaryMateData.importPayload(payload);assert.equal(target.raw(),before);assert.ok(target.q('#dialogContent').textContent.includes('確認匯入'));target.click('[data-action="confirm-action"]');assert.equal(target.state().records.length,3);assert.equal(target.state().leaveRecords.length,1);
  const after=target.raw();await target.w.SalaryMateData.importPayload('{bad');assert.equal(target.raw(),after);assert.equal(target.w.localStorage.getItem('salarymate_v310_state'),'v4-original');assert.deepEqual(target.errors,[]);b.close();target.close();
});
test('V5 full: concurrent tab write conflict preserves current form and external state',()=>{
  const b=boot(fixture());b.tab('calendar');b.click('[data-v5="day"][data-date="2026-10-09"]');b.click('main [data-action="add-overtime"]');b.change('#overtimeForm [name="note"]','尚未儲存內容');
  const updated={...fixture(),updatedAt:'newer-tab'};b.w.localStorage.setItem(KEY,JSON.stringify(updated));b.submit('#overtimeForm');
  assert.equal(b.q('#appDialog').open,true);assert.equal(b.q('#overtimeForm [name="note"]').value,'尚未儲存內容');assert.equal(JSON.parse(b.raw()).updatedAt,'newer-tab');assert.equal(b.state().overtimeLogs.length,2);b.close();
});
test('V5 full: malformed local data fail closed; settings and responsive stylesheet contain no glass assets',()=>{
  const b=boot('{corrupt');assert.equal(b.raw(),'{corrupt');assert.ok(b.q('main').textContent.includes('資料讀取失敗'));assert.equal(b.w.document.querySelectorAll('script[src*="glass"],link[href*="glass"]').length,0);b.close();
  const c=boot(fixture());c.tab('settings');c.click('[data-action="open-interface-settings"]');c.click('[data-mode="large"]');assert.equal(c.w.document.body.dataset.uiMode,'large');assert.equal(c.state().uiPreferences.interfaceMode,'large');assert.deepEqual(c.errors,[]);c.close();
});
