import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createReferenceApi} from '../server/reference-api.mjs';
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url),context={};vm.createContext(context);
for(const file of ['reference-data.js','reference-tools.js'])vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),context);
const D=context.SalaryMateReferenceData,R=context.SalaryMateReference;
const now=()=>Date.parse('2026-10-16T04:00:00Z');
const request=(date='2026-10-10',extra={})=>new Request('https://salarymate.test/api/reference/fx?'+new URLSearchParams({date,base:'USD',quote:'TWD',...extra}));
test('calendar snapshots are complete contiguous years with official New Year holiday',()=>{
 for(const year of [2026,2027]){const rows=D.calendar[year];assert.equal(rows.length,365);for(let i=0;i<365;i++)assert.equal(rows[i][0],new Date(Date.UTC(year,0,1+i)).toISOString().slice(0,10));assert.equal(rows[0][1],true);assert.equal(rows[0][2],'開國紀念日');}
});
test('insurance boundaries use official ranges, categories, caps and no invented premium',()=>{
 for(const group of new Set(D.labor.map(r=>r.group))){const rows=D.labor.filter(r=>r.group===group);for(const row of rows){if(row.min>0)assert.equal(R.findBracket(rows,row.min)?.amount,row.amount);if(row.max)assert.equal(R.findBracket(rows,row.max)?.amount,row.amount);}}
 const general=D.labor.filter(r=>r.group==='一般勞工');assert.equal(R.findBracket(general,29500).amount,29500);assert.equal(R.findBracket(general,29500.01).amount,30300);assert.equal(R.findBracket(general,90000).amount,45800);assert.equal(R.findBracket(D.health,400000).amount,313000);assert.equal(R.findBracket(general,0),null);assert.equal(R.findBracket(general,NaN),null);
});
test('FX rejects invalid or future dates, arbitrary keys, currencies and methods before fetching',async()=>{
 let calls=0;const api=createReferenceApi({now,fetcher:()=>{calls++;throw Error();}});
 for(const req of [request('2026-02-30'),request('2026-10-17'),request('1998-01-01'),request('2026-10-10',{base:'XXX'}),request('2026-10-10',{amount:'99'})])assert.equal((await api(req)).status,400);
 assert.equal((await api(new Request(request(),{method:'POST'}))).status,405);assert.equal(calls,0);
});
test('FX retains actual earlier reference date, caches and deduplicates',async()=>{
 let calls=0;const api=createReferenceApi({now,fetcher:async()=>{calls++;return Response.json({date:'2026-10-09',base:'USD',quote:'TWD',rate:31.5});}});
 const [a,b]=await Promise.all([api(request()),api(request())]);const value=await a.json();assert.equal(value.date,'2026-10-09');assert.equal(value.requestedDate,'2026-10-10');assert.equal((await b.json()).rate,31.5);await api(request());assert.equal(calls,1);assert.ok(R.validRate(value,'2026-10-10','USD','TWD'));
});
test('FX rejects malformed, mismatched, stale and future upstream rows; failures can retry',async()=>{
 for(const row of [{date:'2026-10-11',rate:31},{date:'2026-09-01',rate:31},{date:'2026-10-09',rate:-1},{date:'2026-10-09',rate:'31'},{date:'2026-10-09',rate:31,base:'EUR'}]){
  const api=createReferenceApi({now,fetcher:async()=>Response.json({base:'USD',quote:'TWD',...row})});assert.equal((await api(request())).status,502);
 }
 let calls=0;const api=createReferenceApi({now,fetcher:async()=>{if(++calls===1)throw Error();return Response.json({date:'2026-10-09',base:'USD',quote:'TWD',rate:31});}});assert.equal((await api(request())).status,502);assert.equal((await api(request())).status,200);
});
test('public CORS accepts known portable origins and rejects unknown origins',async()=>{
 const api=createReferenceApi({now});for(const origin of ['null','https://sparcgx.github.io','https://salarymate.test']){const res=await api(new Request(request('2026-10-10',{base:'TWD'}),{headers:{origin}}));assert.equal(res.status,200);assert.equal(res.headers.get('access-control-allow-origin'),origin);}
 assert.equal((await api(new Request(request(),{headers:{origin:'https://unknown.test'}}))).status,403);
});
test('queries have bounded per-client rate limit',async()=>{const api=createReferenceApi({now});for(let i=0;i<30;i++)assert.equal((await api(request('2026-10-10',{base:'TWD'}))).status,200);assert.equal((await api(request('2026-10-10',{base:'TWD'}))).status,429);});
test('reference modules stay outside startup and do not save private state',()=>{
 const startup=fs.readFileSync(new URL('../scripts/lib/startup-bundle.mjs',import.meta.url),'utf8');assert.ok(!startup.includes("'reference-tools.js'"));
 const ui=fs.readFileSync(new URL('reference-tools.js',base),'utf8');assert.ok(!ui.includes('salarymate_v5_full_state'));assert.ok(!ui.includes('saveState('));
});
