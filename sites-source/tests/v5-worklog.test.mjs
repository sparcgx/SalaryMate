import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, putCompany, putEntry, calendarDates, validDate, leaveBalance, monthSummary, parseBackup, backup, LocalStore, KEY } from '../dist/dev/v5.0.0-dev.1/core.js';
function seed() {
  const s = initialState(); s.companies[0].id = 'a';
  s.companies[0].hourlyRate = 200; s.companies[0].quotas = {2026:80,2027:40};
  return putCompany(s, {id:'b',name:'第二份工作',hourlyRate:300,multiplier:1.5,quotas:{2026:16}});
}
const leave = (id,date,hours = 8,status = 'confirmed',companyId = 'a') => ({id,date,hours,status,companyId,kind:'leave',leaveType:'特休',note:''});
const ot = (id,date,hours = 2,status = 'confirmed',rate = 200) => ({id,date,hours,status,companyId:'a',kind:'overtime',hourlyRate:rate,multiplier:1.34,note:''});
test('Calendar: Monday start, leap years and full weeks', () => {
  assert.equal(calendarDates('2026-10')[0], '2026-09-28');
  assert.equal(calendarDates('2026-10').at(-1), '2026-11-01');
  assert.equal(calendarDates('2026-08').length, 42);
  assert.ok(calendarDates('2024-02').includes('2024-02-29'));
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2026-13-01'), false);
});
test('Annual leave: used, planned, future confirmed and cancelled are distinguished', () => {
  let s = seed();
  for (const e of [leave('used','2026-09-01',8),leave('future','2026-11-01',4),leave('plan','2026-08-01',2,'planned'),leave('cancel','2026-09-02',8,'cancelled')]) s = putEntry(s,e);
  assert.deepEqual(leaveBalance(s,'a','2026','2026-10-02'),{quota:80,used:8,booked:6,available:66});
  assert.deepEqual(leaveBalance(s,'a','2026','2026-11-01'),{quota:80,used:12,booked:2,available:66});
});
test('Company and year isolation', () => {
  let s = putEntry(seed(),leave('a1','2026-09-01'));
  s = putEntry(s,leave('b1','2026-09-01',4,'confirmed','b'));
  s = putEntry(s,leave('next','2027-01-01',10));
  assert.equal(leaveBalance(s,'a','2026').available,72);
  assert.equal(leaveBalance(s,'b','2026').available,12);
  assert.equal(leaveBalance(s,'a','2027').available,30);
  assert.throws(() => putEntry(s,leave('a1','2026-09-01',8,'confirmed','b')),/其他公司/);
});
test('Editing, cancelling and reactivating recompute balance without double counting', () => {
  let s = putEntry(seed(),leave('x','2026-10-01',8));
  s = putEntry(s,leave('x','2026-10-01',4));
  assert.equal(s.entries.length,1); assert.equal(leaveBalance(s,'a','2026').available,76);
  s = putEntry(s,leave('x','2026-10-01',4,'cancelled'));
  assert.equal(leaveBalance(s,'a','2026').available,80);
  s = putEntry(s,leave('x','2026-10-01',4,'planned'));
  assert.equal(leaveBalance(s,'a','2026').available,76);
});
test('Quota guard includes booked leave and preserves prior state on failure', () => {
  let s = seed(); s.companies[0].quotas[2026] = 8;
  s = putEntry(s,leave('x','2026-11-01',8,'planned'));
  assert.throws(() => putEntry(s,leave('y','2026-11-02',1)),/超過設定額度/);
  assert.equal(s.entries.length,1);
  assert.throws(() => putCompany(s,{...s.companies[0],quotas:{2026:4}}),/超過設定額度/);
});
test('Unknown quota is distinct from zero, other leave does not consume annual leave', () => {
  let s = seed(); s.companies[0].quotas = {};
  s = putEntry(s,leave('x','2026-10-02',8));
  assert.equal(leaveBalance(s,'a','2026').available,null);
  assert.throws(() => putCompany(s,{...s.companies[0],quotas:{2026:0}}));
  s = putEntry(s,{...leave('x','2026-10-02',8),leaveType:'病假'});
  s = putCompany(s,{...s.companies[0],quotas:{2026:0}});
  assert.equal(leaveBalance(s,'a','2026').available,0);
});
test('Confirmed monthly overtime excludes cancelled/planned; unknown rates stay unknown', () => {
  let s = seed();
  for (const e of [ot('1','2026-10-01'),ot('2','2026-10-02',1.5,'confirmed',null),ot('3','2026-10-03',3,'planned'),ot('4','2026-10-04',4,'cancelled'),ot('5','2026-09-30',8)]) s=putEntry(s,e);
  assert.deepEqual(monthSummary(s,'a','2026-10'),{hours:3.5,amount:536,unpriced:1,leaveHours:0,plannedHours:3});
  assert.equal(monthSummary(s,'b','2026-10').hours,0);
});
test('Changing current rate never rewrites historical amounts', () => {
  let s = putEntry(seed(),ot('x','2026-10-01'));
  s = putCompany(s,{...s.companies[0],hourlyRate:999,multiplier:2});
  assert.equal(monthSummary(s,'a','2026-10').amount,536);
});
test('Reject invalid hours, dates, statuses and more than 24 hours daily', () => {
  const s=seed();
  for (const hours of [NaN,Infinity,0,-1,24.01,1.001,'',null,true]) assert.throws(() => putEntry(s,ot('x','2026-10-01',hours)));
  assert.throws(() => putEntry(s,ot('x','2026-02-30')));
  assert.throws(() => putEntry(s,ot('x','2026-10-01',2,'bogus')));
  const next=putEntry(s,ot('x','2026-10-01',20));
  assert.throws(() => putEntry(next,leave('y','2026-10-01',8)),/24 小時/);
  assert.equal(putEntry(next,leave('y','2026-10-01',8,'cancelled')).entries.length,2);
});
test('Backup round trip, invalid backup and structural rejection', () => {
  const s=putEntry(seed(),{...leave('a1','2026-10-01'),note:'<script>不可執行</script>'});
  assert.deepEqual(parseBackup(backup(s)),s);
  assert.throws(() => parseBackup('{broken'));
  assert.throws(() => parseBackup(JSON.stringify({format:'salarymate-v4',data:s})));
  const body=JSON.parse(backup(s)); body.data.entries[0].companyId='missing';
  assert.throws(() => parseBackup(JSON.stringify(body)),/失去公司關聯/);
  body.data.entries[0].companyId='a';body.data.entries.push(body.data.entries[0]);
  assert.throws(() => parseBackup(JSON.stringify(body)),/重複/);
});
test('Local storage failures do not advance state; unrelated keys untouched', () => {
  const data=new Map([['salarymate_v310_state','original-v4']]); let fail=false;
  const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(fail)throw Error('quota');data.set(k,v)}};
  const store=new LocalStore(storage), first=store.load(); const saved=store.save(first);
  const raw=store.raw; fail=true;
  assert.throws(() => store.save(putEntry(saved,{...ot('x','2026-10-01'),companyId:saved.companies[0].id})),/儲存失敗/);
  assert.equal(store.raw,raw);assert.equal(data.get(KEY),raw);assert.equal(data.get('salarymate_v310_state'),'original-v4');
});
test('Concurrent tab writes are rejected and corrupt data is not overwritten', () => {
  const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const a=new LocalStore(storage), b=new LocalStore(storage);const s=a.load(); b.load();a.save(s);
  assert.throws(()=>b.save(seed()),/另一分頁/);
  data.set(KEY,'{corrupt'); const bad=new LocalStore(storage);
  assert.throws(()=>bad.load(),/停止寫入/);assert.throws(()=>bad.save(seed()),/尚未恢復/);assert.equal(data.get(KEY),'{corrupt');
});
