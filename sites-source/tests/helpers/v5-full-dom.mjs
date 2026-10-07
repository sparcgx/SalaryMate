import fs from 'node:fs';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const {JSDOM,VirtualConsole}=await import(process.env.SALARYMATE_DOM_MODULE||'/tmp/salarymate-v5-qa/node_modules/jsdom/lib/api.js');
const base=new URL('../../dist/dev/v5.0.0-dev.2/',import.meta.url);
export const KEY='salarymate_v5_full_state';
export const fixture=()=>({schemaVersion:13,appVersion:'5.0.0-dev.2',companies:[{id:'A',name:'甲公司',isCurrent:true,baseSalary:48000,mealAllowance:3000,employmentStartDate:'2024-01-01',workHoursPerDay:8,leaveQuotaCycle:'calendar',leavePolicies:{annual:{mode:'custom',quotaDays:10}}},{id:'B',name:'乙公司',isCurrent:false,baseSalary:35000,employmentStartDate:'2025-01-01',workHoursPerDay:8,leavePolicies:{annual:{mode:'custom',quotaDays:5}}}],records:[{id:'r1',companyId:'A',year:2026,month:9,baseSalary:48000,mealAllowance:3000,laborIns:1000,healthIns:500,sideIncome:1000,payDate:'2026-10-05'},{id:'r2',companyId:'B',year:2026,month:9,baseSalary:35000},{id:'r3',companyId:'A',year:2025,month:9,baseSalary:40000}],overtimeLogs:[{id:'ot1',companyId:'A',date:'2026-10-01',hours:2,hourlyRate:200,type:'weekday',note:'支援'},{id:'otB',companyId:'B',date:'2026-10-01',hours:3,hourlyRate:333,type:'weekday'}],leaveRecords:[{id:'l1',companyId:'A',startDate:'2026-10-06',endDate:'2026-10-06',type:'annual',durationMode:'full_day',status:'planned',quantity:1,paidRatio:100}],uiPreferences:{selectedYear:2026,interfaceMode:'minimal',colorTheme:'slate',companyFilter:'A'}});
export function boot(seed,options={}) {
  const errors=[],downloads=[];
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const singleFile=options.singleFile||process.env.SALARYMATE_SINGLE_HTML;
  const dom=new JSDOM(fs.readFileSync(singleFile||new URL('index.html',base),'utf8'),{url:options.url||'https://example.test/dev/v5.0.0-dev.2/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window;
  if(options.url?.startsWith('file:')){
    // jsdom does not implement file-origin storage; model a browser's local file store.
    const values=new Map();Object.defineProperty(w,'localStorage',{value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size;}}});
  }
  Object.defineProperty(w.navigator,'language',{value:options.language||'zh-TW',configurable:true});Object.defineProperty(w.navigator,'languages',{value:[options.language||'zh-TW'],configurable:true});
  if(options.preference)w.localStorage.setItem('salarymate_v5_language',options.preference);
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.confirm=()=>true;w.print=()=>{};
  w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
  w.localStorage.setItem('salarymate_v310_state','v4-original');w.localStorage.setItem('salarymate_v5_worklog','v5-dev1-original');
  if(seed!==undefined)w.localStorage.setItem(KEY,typeof seed==='string'?seed:JSON.stringify(seed));
  if(singleFile){for(const script of w.document.querySelectorAll('script:not([src])'))w.eval(script.textContent);}
  else for(const name of ['i18n-en.js','i18n.js','reconcile.js','copy-month.js','comp-time.js','annual-analysis.js','legal-data.js','bootstrap.js','stocks.js','stocks-integrations.js','backup.js','google-drive.js','google-drive-ui.js','stocks-ui.js','app.js'])w.eval(fs.readFileSync(new URL(name,base),'utf8'));
  const q=(s)=>w.document.querySelector(s);
  const click=s=>{assert.ok(q(s),`Missing control: ${s}`);q(s).click();};
  const change=(s,value)=>{assert.ok(q(s),`Missing field: ${s}`);q(s).value=value;q(s).dispatchEvent(new w.Event('input',{bubbles:true}));q(s).dispatchEvent(new w.Event('change',{bubbles:true}));};
  const submit=s=>{assert.ok(q(s),`Missing form: ${s}`);q(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
  return {w,q,click,change,submit,downloads,errors,tab:tab=>click(`.nav-inner [data-tab="${tab}"]`),state:()=>JSON.parse(w.SalaryMateData.exportPayload()),raw:()=>w.localStorage.getItem(KEY),close:()=>w.close()};
}
