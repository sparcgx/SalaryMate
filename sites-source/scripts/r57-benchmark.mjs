import {performance} from 'node:perf_hooks';
import {runtime,portfolio,backupFixture,plain,stockView,baseline} from '../tests/helpers/r57-core.mjs';
const before=process.argv.includes('--baseline'),c=runtime(before),book=portfolio(1,30),view=stockView(before,book);
const current=backupFixture(600),incoming=plain(current);incoming.overtimeLogs.forEach((r,i)=>r.id='import-'+i);
const records=Array.from({length:7200},(_,i)=>({companyId:'c'+(i%100),year:2023+Math.floor(i/1200),month:1+(i%12),baseSalary:40000+i%1000,mealAllowance:2400,customEarnings:[],customDeductions:[]}));
const measure=fn=>{fn();const times=[];for(let i=0;i<3;i++){const t=performance.now();fn();times.push(performance.now()-t);}return Math.round(times.sort((a,b)=>a-b)[1]*100)/100;};
console.log(JSON.stringify({version:before?baseline:'working tree',unit:'ms',method:'one warmup; median of three; synthetic local fixtures; no browser or network',fixture:{stocks:30,transactions:3000,forecastDates:20,backupRows:600,salaryRows:7200},timings:{portfolio:measure(()=>c.SalaryMateStocks.calculate(book,2026,'2026-10-06')),stockView:measure(()=>view.render()),forecasts:measure(()=>c.SalaryMateStocks.dividendForecasts(book,'2026-10-06')),backupMerge:measure(()=>c.SalaryMateBackup.merge(current,incoming,'overwrite','bench')),annual:measure(()=>c.SalaryMateAnnual.analyze(records,{year:2026,throughMonth:12}))}},null,2));
