import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

// Production functions and plain callback spies only. This does not boot the
// application, interpret HTML, emulate a DOM, access storage, or send requests.
const project=fileURLToPath(new URL('../',import.meta.url));
const currentDirectory=path.join(project,'dist/dev/v5.0.0-dev.2');
const baselineCommit='6a5b2592643ea8ede4138236f7bd67b092169c82';
const baselineDirectory='/workspace/scratch/2abc8ba223a0/r92-baseline';
const sourceNames=['app.js','stocks-ui.js'];
export const readSources=directory=>Object.fromEntries(sourceNames.map(name=>[name,fs.readFileSync(path.join(directory,name),'utf8')]));
export const currentSources=()=>readSources(currentDirectory);
export function beforeSources(directory=baselineDirectory){
  if(fs.existsSync(path.join(directory,'app.js')))return readSources(directory);
  return Object.fromEntries(sourceNames.map(name=>[name,execFileSync('git',['show',`${baselineCommit}:dist/dev/v5.0.0-dev.2/${name}`],{cwd:project,encoding:'utf8'})]));
}
function between(source,startMarker,endMarker){
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start+startMarker.length);
  if(start<0||end<0)throw Error(`Production definition not found: ${startMarker}`);
  return source.slice(start,end);
}
const line=(source,name)=>{
  const start=source.indexOf(`    const ${name}=`),spaced=source.indexOf(`    const ${name} =`),index=start>=0?start:spaced;
  if(index<0)throw Error(`Production constant not found: ${name}`);
  return source.slice(index,source.indexOf('\n',index));
};

export function monthlyHarness(sources){
  const source=sources['stocks-ui.js'];
  const code=[line(source,'esc'),between(source,'    const numberFormats=','    const types='),line(source,'stat'),line(source,'table'),between(source,'    function analysis(m) {','    let legacySource=')].join('\n');
  const context={Intl,api:{year:()=>2026}};vm.createContext(context);
  vm.runInContext(code+'\nglobalThis.run=analysis;',context);
  return {run:model=>context.run(model)};
}
export function monthlyFixture(count=10000){
  let visits=0;
  const types=['buy','sell','dividend','split','opening'];
  const rows=Array.from({length:count},(_,i)=>({
    inYear:i%7!==0,date:`${i%7===0?'2025':'2026'}-${String(i%12+1).padStart(2,'0')}-01`,type:types[i%types.length],
    realized:i%5===1?(i%3?1:-1)*(i+.125)/7:0,dividend:i%5===2?(i+.375)/11:0
  }));
  const events=rows.map(row=>({...row,get inYear(){visits++;return row.inYear;}}));
  const model={events,yearRealized:rows.filter(r=>r.inYear).reduce((n,r)=>n+r.realized,0),yearDividends:rows.filter(r=>r.inYear).reduce((n,r)=>n+r.dividend,0),yearFees:12.34};
  return {model,rows,get visits(){return visits;},reset(){visits=0;}};
}

export function visualCommitHarness(sources,{failWrite=false,denyLock=false}={}){
  const source=sources['app.js'];
  const counts={writes:[],cloudChanges:0,renders:0,applies:0,removedNotices:0,attributes:[],focuses:0,opened:0,translations:0,statuses:[],released:[],toasts:[],cacheClears:0};
  const cacheResult={fixture:'retained calculation'};
  class CountedMap extends Map{clear(){counts.cacheClears++;super.clear();}}
  const calculationCache=Object.fromEntries(['filteredRecords','hourlyMetrics','attendanceAnalysis','annualAnalysis','overtimePeriods','leaveAllocations','leaveEntries','leaveMembership','stockModels','creditHours'].map(name=>[name,new CountedMap([['fixture',cacheResult]])]));
  const ui={companyFilter:'fixture-company',selectedYear:2026,attendanceTab:'leave',overtimeMonth:10,leaveMonth:10,leaveStatus:'active',hourlyMonth:10,salaryCalcTab:'overtime',hourlyAdvancedOpen:false,yearEndCompanyId:'fixture-company',raiseCompanyId:'fixture-company',interfaceStyle:'autumn',hd2dBackground:'forest',autumnBackground:'cafe',surfaceOpacity:'balanced',motionEffect:'gentle',interfaceMode:'standard',colorTheme:'teal',draftScope:null};
  const state={schemaVersion:15,appVersion:'5.0.0-dev.2-R91',updatedAt:'2026-10-09T00:00:00.000Z',uiPreferences:{...ui},companies:[{id:'fixture-company',baseSalary:30000}],records:[{id:'fixture-record',baseSalary:30000}],leaveRecords:[],stockPortfolio:{assets:[],transactions:[]}};
  delete state.uiPreferences.draftScope;
  const dialog={scrollTop:37,querySelector:()=>null,querySelectorAll:()=>[]};
  const main={setAttribute:(name,value)=>counts.attributes.push([name,value])};
  const focus={focus:()=>counts.focuses++};
  const context={ui,state,calculationCache,clone:structuredClone,SCHEMA_VERSION:15,APP_VERSION:'5.0.0-dev.2-R92',STORAGE_KEY:'salarymate_v5_full_state',
    acquireOperationLock:()=>!denyLock,releaseOperationLock:(...args)=>counts.released.push(args),
    syncDataStatusFromState(){},setOperationStatus:(...args)=>counts.statuses.push(args),toast:(...args)=>counts.toasts.push(args),console:{error(){},warn(){}},
    renderAll:()=>counts.renders++,applyVisualPreferences:()=>counts.applies++,openInterfaceSettings:()=>counts.opened++,
    $:selector=>selector==='#appDialog'?dialog:selector==='#mainContent'?main:focus,
    $$:selector=>selector==='#mainContent > .operation-state'?[{remove:()=>counts.removedNotices++},{remove:()=>counts.removedNotices++}]:[],
    interfaceBaseStyle:value=>value==='pixel-luxe'?'pixel':value==='macaron-luxe'?'macaron':value,
    INTERFACE_MODES:{large:{name:'大字'},standard:{name:'標準'},compact:{name:'緊湊'}},COLOR_THEMES:{rose:{name:'玫瑰'},teal:{name:'青綠'}}};
  for(const name of ['InterfaceStyle','Hd2dBackground','AutumnBackground','SurfaceOpacity','MotionEffect','InterfaceMode','ColorTheme'])context['normalize'+name]=value=>value;
  context.window={SalaryMateStorage:{setItem(key,value,reset){counts.writes.push({key,value,reset});if(failWrite)throw Error('Fixture failed write');}},SalaryMateCloud:{changed:()=>counts.cloudChanges++},SalaryMateI18n:{apply:()=>counts.translations++}};
  const save=between(source,'    const saveState =','    const restoreUiPreferences =');
  const visualStart=source.indexOf('    const commitVisualPreference =');
  const visualHelpers=visualStart>=0?between(source,'    const commitVisualPreference =','    const setInterfaceStyle ='):'';
  const setters=between(source,'    const setInterfaceStyle =','    const recordEditorFormHtml =');
  vm.createContext(context);
  vm.runInContext(line(source,'invalidateCalculationCache')+'\n'+save+visualHelpers+setters+'\nglobalThis.api={saveState,commitStateMutation,'+(visualStart>=0?'commitVisualPreference,refreshVisualPreferences,':'')+'setInterfaceStyle,setSurfaceOpacity,setHd2dBackground,setAutumnBackground,setInterfaceMode,setColorTheme};',context);
  return {api:context.api,ui,counts,calculationCache,cacheResult,dialog,get state(){return context.state;}};
}

const median=fn=>{
  for(let i=0;i<2;i++)fn();
  const samples=Array.from({length:9},()=>{const start=performance.now();fn();return performance.now()-start;}).sort((a,b)=>a-b);
  return +samples[4].toFixed(3);
};
export function report(before,after){
  const old=monthlyHarness(before),next=monthlyHarness(after),a=monthlyFixture(),b=monthlyFixture();
  const oldHtml=old.run(a.model),newHtml=next.run(b.model);
  assert.equal(newHtml,oldHtml);assert.equal(a.visits,120000);assert.equal(b.visits,10000);
  const oldVisual=visualCommitHarness(before),newVisual=visualCommitHarness(after);
  oldVisual.api.setAutumnBackground('fuji');newVisual.api.setAutumnBackground('fuji');
  assert.equal(oldVisual.state.uiPreferences.autumnBackground,newVisual.state.uiPreferences.autumnBackground);
  assert.deepEqual(oldVisual.state.records,newVisual.state.records);
  return {environment:'Node production functions and plain callback spies; no browser, DOM emulator, private data, storage writes or HTTP',method:'Fictional 10,000 events; 2 warm-ups and median of 9 timing samples. Counts and timings are not download size, device opening time or FPS.',equivalence:{monthlyHtmlByteExact:true,fictionalBusinessDataUnchanged:true},R91:{monthly:{events:a.model.events.length,eventVisits:a.visits,nodeMedianMs:median(()=>old.run(a.model))},appearance:{mainViewRenders:oldVisual.counts.renders,calculationCachesCleared:oldVisual.counts.cacheClears,fullStateWrites:oldVisual.counts.writes.length}},R92:{monthly:{events:b.model.events.length,eventVisits:b.visits,nodeMedianMs:median(()=>next.run(b.model))},appearance:{mainViewRenders:newVisual.counts.renders,calculationCachesCleared:newVisual.counts.cacheClears,fullStateWrites:newVisual.counts.writes.length}}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const directory=process.argv[2];
  if(directory&&!path.isAbsolute(directory))throw Error('Supply an absolute directory containing the R91 production sources.');
  console.log(JSON.stringify(report(beforeSources(directory),currentSources()),null,2));
}
