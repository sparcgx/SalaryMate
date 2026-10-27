import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';

function selectDay(b,date) {
 b.tab('calendar');
 const [year,month]=b.q('.v5-calendar-top h3').textContent.match(/\d+/g).map(Number);
 const [targetYear,targetMonth]=date.split('-').map(Number),months=(targetYear-year)*12+targetMonth-month;
 for(let i=0;i<Math.abs(months);i++)b.click(`[data-v5="month"][data-step="${Math.sign(months)}"]`);
 b.click(`[data-v5="day"][data-date="${date}"]`);
}
function open(t,date='2026-10-17',seed=fixture()) {
 const b=boot(seed);t.after(()=>b.close());selectDay(b,date);b.click('main [data-action="add-overtime"]');return b;
}
const value=(b,name)=>b.q(`#overtimeForm [name="${name}"]`).value;
const change=(b,name,value)=>b.change(`#overtimeForm [name="${name}"]`,value);

test('Saturday calendar entry starts at 8 rest-day hours and saves without changing older records',t=>{
 const b=open(t),older=b.state().overtimeLogs;
 assert.equal(value(b,'date'),'2026-10-17');assert.equal(value(b,'type'),'restday');assert.equal(value(b,'hours'),'8');assert.equal(b.q('#overtimeForm [name="hours"]').max,'12');
 b.submit('#overtimeForm');const rows=b.state().overtimeLogs,created=rows.find(r=>!older.some(o=>o.id===r.id));
 assert.equal(created.hours,8);assert.equal(created.type,'restday');assert.equal(created.date,'2026-10-17');assert.deepEqual(rows.filter(r=>r.id!==created.id),older);
 assert.match(b.q('[data-date="2026-10-17"]').textContent,/8h/);assert.deepEqual(b.errors,[]);
 const restored=boot(b.raw());t.after(()=>restored.close());assert.equal(restored.state().overtimeLogs.find(r=>r.id===created.id).hours,8);
});

test('new overtime follows date changes between Friday, Saturday, and Monday',t=>{
 const b=open(t,'2026-10-16');assert.equal(value(b,'hours'),'2');assert.equal(value(b,'type'),'weekday');
 for(const [date,type,hours] of [['2026-10-17','restday','8'],['2026-10-19','weekday','2'],['2026-10-24','restday','8'],['2027-01-02','restday','8']]){
  change(b,'date',date);assert.equal(value(b,'type'),type,date);assert.equal(value(b,'hours'),hours,date);
 }
 assert.deepEqual(b.errors,[]);
});

test('clearing a date does not overwrite the current Saturday defaults',t=>{
 const b=open(t);change(b,'date','');assert.equal(value(b,'hours'),'8');assert.equal(value(b,'type'),'restday');
 change(b,'date','2026-10-19');assert.equal(value(b,'hours'),'2');assert.equal(value(b,'type'),'weekday');
});

test('manual hours survive a date change while the automatic day type follows Saturday',t=>{
 const b=open(t,'2026-10-16');change(b,'hours','3.5');change(b,'date','2026-10-17');
 assert.equal(value(b,'hours'),'3.5');assert.equal(value(b,'type'),'restday');
 change(b,'hourlyRate','210.125');change(b,'date','2026-10-19');assert.equal(value(b,'hourlyRate'),'210.125');assert.equal(value(b,'hours'),'3.5');
});

test('quick-hour choices survive later date changes',t=>{
 const b=open(t);b.click('[data-v5="quick-hours"][data-value="10"]');change(b,'date','2026-10-19');
 assert.equal(value(b,'hours'),'10');assert.equal(value(b,'type'),'weekday');change(b,'date','2026-10-24');assert.equal(value(b,'hours'),'10');assert.equal(value(b,'type'),'restday');
});

test('an explicitly selected day type is retained when the date changes',t=>{
 const b=open(t,'2026-10-16');change(b,'type','custom');change(b,'customRate','2.25');change(b,'hours','4');change(b,'date','2026-10-17');
 assert.equal(value(b,'type'),'custom');assert.equal(value(b,'hours'),'4');assert.equal(value(b,'customRate'),'2.25');
 change(b,'type','holiday');assert.equal(value(b,'hours'),'8');change(b,'date','2026-10-19');assert.equal(value(b,'type'),'holiday');assert.equal(value(b,'hours'),'8');
});

test('editing an existing Saturday entry retains its recorded hours and type',t=>{
 const seed=fixture();seed.overtimeLogs.push({id:'saved-saturday',companyId:'A',date:'2026-10-17',hours:5.5,hourlyRate:230,type:'weekday',note:'既有核定紀錄'});
 const b=boot(seed);t.after(()=>b.close());const original=b.state().overtimeLogs;
 selectDay(b,'2026-10-17');b.click('[data-action="edit-overtime"][data-id="saved-saturday"]');
 assert.equal(value(b,'hours'),'5.5');assert.equal(value(b,'type'),'weekday');assert.deepEqual(b.state().overtimeLogs,original);
 change(b,'date','2026-10-24');assert.equal(value(b,'hours'),'5.5');assert.equal(value(b,'type'),'weekday');assert.equal(value(b,'hourlyRate'),'230.000');
 b.submit('#overtimeForm');const saved=b.state().overtimeLogs.find(r=>r.id==='saved-saturday');assert.equal(saved.hours,5.5);assert.equal(saved.type,'weekday');assert.equal(saved.date,'2026-10-24');
});

test('Sunday retains the existing default until a day type is explicitly chosen',t=>{
 const b=open(t,'2026-10-18');assert.equal(value(b,'type'),'weekday');assert.equal(value(b,'hours'),'2');change(b,'type','holiday');assert.equal(value(b,'hours'),'8');
});
