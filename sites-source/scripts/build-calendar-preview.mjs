import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {salaryMateCsp} from '../server/security-policy.mjs';
const output=process.argv[2];if(!output?.startsWith('/'))throw Error('Absolute output required');
const origin='https://salarymate.sparcgx2420.chatgpt.site';
execFileSync(process.execPath,['scripts/build-single-html.mjs',output,origin],{stdio:'inherit'});
const key='salarymate_v5_calendar_preview_state';
const seed={schemaVersion:15,appVersion:'5.0.0',updatedAt:'2026-10-18T04:00:00Z',companies:[{id:'preview-company',name:'示範公司（虛構）',isCurrent:true,baseSalary:36000,workHoursPerDay:8,employmentStartDate:'2026-01-01'}],records:[],investmentRecords:[],overtimeLogs:[{id:'preview-ot-1',companyId:'preview-company',date:'2026-10-09',type:'holiday',hours:3,hourlyRate:150,note:'示範：政府放假日仍有出勤，日別由公司核對。'},{id:'preview-ot-2',companyId:'preview-company',date:'2026-10-14',type:'weekday',hours:2,hourlyRate:150,note:'示範加班'}],leaveRecords:[{id:'preview-leave-1',companyId:'preview-company',date:'2026-10-08',type:'annual',durationMode:'half_am',quantity:1,status:'confirmed'},{id:'preview-leave-2',companyId:'preview-company',date:'2026-10-26',type:'annual',durationMode:'full_day',quantity:1,status:'planned'}],uiPreferences:{selectedYear:2026,companyFilter:'preview-company',interfaceStyle:'cards',motionEffect:'off',showOnboarding:false}};
const storage=`window.SalaryMatePreviewStorage=(()=>{const map=new Map([[${JSON.stringify(key)},${JSON.stringify(JSON.stringify(seed))}]]);return Object.freeze({getItem:key=>map.get(String(key))??null,setItem:(key,value)=>map.set(String(key),String(value)),removeItem:key=>map.delete(String(key)),clear:()=>map.clear(),key:i=>[...map.keys()][i]??null,get length(){return map.size;}});})();\n`;
let html=fs.readFileSync(output,'utf8'),first=true;
html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(_,attrs,source)=>{
 source=source.replace(/\blocalStorage\b/g,'SalaryMatePreviewStorage').replaceAll('salarymate_v5_full_state',key);
 if(attrs.includes('data-module="app.js"'))source=source.replace("if (runtimeState.dataStatus !== 'failure') restoreUiPreferences();","if (runtimeState.dataStatus !== 'failure') restoreUiPreferences();\n    ui.tab='calendar';ui.selectedYear=2026;v5.month=10;v5.date='2026-10-09';");
 if(first){source=storage+source;first=false;}
 return `<script${attrs}>${source}</script>`;
});
html=html.replace(/<title>[^<]*<\/title>/,'<title>SalaryMate · 辦公日曆整合預覽</title>');
html=html.replace(/(<body\b[^>]*>)/,'$1<div class="v5-preview-banner" role="note" style="padding:12px 18px;background:#eaf2fb;color:#1f3d61;border-bottom:1px solid #a4bed9;font:14px/1.7 system-ui">辦公日曆整合預覽 · 出勤紀錄為虛構示範 · 操作僅保留於這次開啟，重新開啟即重設</div>');
const hashes=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>"'sha256-"+createHash('sha256').update(m[1].replace(/\r\n?/g,'\n')).digest('base64')+"'");
html=html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/,`<meta http-equiv="Content-Security-Policy" content="${salaryMateCsp({scriptHashes:hashes,marketOrigin:origin,portable:true})}">`);
fs.writeFileSync(output,html);console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),scripts:hashes.length,memoryOnly:true}));
