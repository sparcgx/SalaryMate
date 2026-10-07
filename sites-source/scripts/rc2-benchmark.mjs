import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline='b887d8bb62f71731e40adeec33f5163b867cf6b9';
const fixture={schemaVersion:13,companies:[{id:'A',name:'效能測試公司',isCurrent:true,startDate:'2021-01-01',baseSalary:47000}],records:[],overtimeLogs:[],leaveRecords:[]};
for(let year=2021;year<=2026;year++)for(let month=1;month<=12;month++)fixture.records.push({id:`r-${year}-${month}`,companyId:'A',year,month,baseSalary:47000});
for(let i=0;i<1373;i++){const date=new Date(Date.UTC(2022,0,i+1)).toISOString().slice(0,10);fixture.overtimeLogs.push({id:`ot-${i}`,companyId:'A',date,hours:2,hourlyRate:200,type:'weekday'});}
for(let i=0;i<120;i++){const date=new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);fixture.leaveRecords.push({id:`l-${i}`,companyId:'A',type:'personal',status:'confirmed',startDate:date,endDate:date,quantityMode:'hours',hours:2});}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'salarymate-rc2-benchmark-'));
const assets=['glass.js','reconcile.js','copy-month.js','comp-time.js','annual-analysis.js','app.js'];
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
try{
  const results={};const exports={};
  for(const revision of ['baseline','candidate']){
    const dir=path.join(temp,revision);fs.mkdirSync(path.join(dir,'tests/helpers'),{recursive:true});fs.mkdirSync(path.join(dir,'dist'));
    fs.copyFileSync(path.join(root,'tests/helpers/app-runtime.mjs'),path.join(dir,'tests/helpers/app-runtime.mjs'));
    for(const asset of assets){const file='dist/'+asset;fs.writeFileSync(path.join(dir,file),revision==='baseline'?execFileSync('git',['show',baseline+':'+file],{cwd:root}):fs.readFileSync(path.join(root,file)));}
    const {boot}=await import(pathToFileURL(path.join(dir,'tests/helpers/app-runtime.mjs')));
    const cold=[],warm=[];
    for(let sample=0;sample<5;sample++){
      const runtime=boot(fixture);runtime.change('yearFilter','2026');runtime.change('annualThroughMonth','12');
      let start=performance.now();runtime.tab('tax');cold.push(performance.now()-start);
      start=performance.now();runtime.tab('tax');warm.push(performance.now()-start);
      runtime.action('export-annual-report');exports[revision]=(await runtime.downloads.at(-1).blob.text()).replaceAll('4.3.2-RC.1','VERSION').replaceAll('4.3.2-RC.2','VERSION');
    }
    results[revision]={coldMs:cold,warmMs:warm,medianColdMs:median(cold),medianWarmMs:median(warm)};
  }
  assert.equal(exports.candidate,exports.baseline,'Optimized annual financial output must remain identical for valid input');
  const report={version:'4.3.2-RC.2',checkedAt:new Date().toISOString(),baselineCommit:baseline,environment:process.version,scope:'Node VM with simulated DOM; not real phone, browser frame-rate or native timing',fixture:{companies:1,salaryRecords:72,overtimeLogs:1373,leaveRecords:120,year:2026,throughMonth:12},method:'Five fresh app boots per revision; first annual render followed by one repeat; excludes boot timing. CSV contents compared after version normalization.',financialOutput:'IDENTICAL',results};
  fs.writeFileSync(path.join(root,'release-evidence/v4.3.2-RC.2_performance.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
