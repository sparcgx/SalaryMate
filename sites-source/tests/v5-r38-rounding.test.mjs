import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js',import.meta.url),'utf8');
function setup(){
 const credits=new Map();
 const context={numberValue:x=>Number(x)||0,overtimeHourlyRate:l=>Math.round(Number(l.hourlyRate)*1000)/1000,calculationCache:{creditHours:new Map([['index',credits]])},salaryMonthForLog:l=>({year:2026,month:l.month||9})};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('    const overtimeAmount ='),source.indexOf('    const overtimeTypeName ='))+'globalThis.api={overtimeAmount,overtimeTotal,roundOvertimeTotal};',context);
 return {...context.api,credits};
}
const row=(type,hours,extra={})=>({id:'x',companyId:'A',type,hours,hourlyRate:179.167,...extra});
test('confirmed September 76-hour case is 19665 without changing records',()=>{
 const a=setup(),logs=[...Array.from({length:22},(_,i)=>row('weekday',2,{id:'w'+i})),...Array.from({length:4},(_,i)=>row('restday',8,{id:'r'+i}))];
 const before=JSON.stringify(logs);
 assert.equal(logs.reduce((n,l)=>n+l.hours,0),76);
 assert.equal(a.overtimeTotal(logs),19665);
 assert.equal(a.overtimeTotal([...logs].reverse()),19665);
 assert.equal(logs.reduce((n,l)=>n+Math.round(a.overtimeAmount(l)),0),19660);
 assert.equal(JSON.stringify(logs),before);
});
test('company and payroll months settle independently in combined views',()=>{
 const a=setup(),logs=[row('custom',1,{hourlyRate:100.4,customRate:1}),row('custom',1,{hourlyRate:100.4,customRate:1,companyId:'B'}),row('custom',1,{hourlyRate:100.4,customRate:1,month:10})];
 assert.equal(a.overtimeTotal(logs),300);
 assert.equal(a.overtimeTotal([logs[0],{...logs[0],id:'y'}]),201);
});
test('fractional rates, extended restday, holiday, spring and custom retain precision',()=>{
 const a=setup();
 for(const [type,hours,mult] of [['weekday',3,4.35],['restday',10,18.04],['holiday',8,16],['spring',8,20],['custom',3,3.75]])assert.ok(Math.abs(a.overtimeAmount(row(type,hours,{customRate:1.25}))-179.167*mult)<1e-7);
 assert.equal(a.overtimeTotal([]),0);
 assert.equal(a.overtimeTotal([row('weekday',0)]),0);
 assert.equal(a.roundOvertimeTotal(100.49999999999999),101);
});
test('comp-time deduction continues to exclude fully credited entries',()=>{
 const a=setup(),log=row('weekday',2);a.credits.set(JSON.stringify(['A','x']),2);
 assert.equal(a.overtimeTotal([log]),0);
});
test('salary import and reconciliation share final integer total',()=>{
 assert.ok(source.includes('const overtime = overtimeTotal(logs);'));
 assert.ok(source.includes('const amount = overtimeTotal(logs);'));
 assert.equal((source.match(/draft.overtime = overtimeTotal\(overtimeForSalaryMonth/g)||[]).length,2);
 assert.ok(source.includes('const overtimePay = roundOvertimeTotal(Object.values(amounts).reduce'));
});
