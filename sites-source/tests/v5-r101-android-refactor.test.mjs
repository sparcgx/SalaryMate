import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const previous=fs.readFileSync(new URL('./fixtures/android-runtime-r101.js',import.meta.url),'utf8');
const current=fs.readFileSync(new URL('../scripts/lib/android-runtime.js',import.meta.url),'utf8');
const pause=()=>new Promise(resolve=>setImmediate(resolve));
const gate=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const plain=value=>JSON.parse(JSON.stringify(value));
const error=code=>Object.assign(new Error('Fictional provider failure'),{code});
// Native callbacks only: no browser, DOM emulator, device, account or network.
function harness(source,{language='zh',plugin={},bridge=true,native=true,platform='android'}={}){
 const listeners=new Map(),observers=[],calls=[],trace=[],dialog={open:true};
 const toast={textContent:'',className:'',setAttribute:(name,value)=>trace.push(['toast-role',name,value])};
 let url=0;
 class LocalURL extends URL {static createObjectURL(){return 'blob:https://salarymate.sparcgx2420.chatgpt.site/'+(++url);}static revokeObjectURL(value){trace.push(['revoke',value]);}}
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-10-12T13:20:00Z']));}static now(){return Date.parse('2026-10-12T13:20:00Z');}}
 const files={
  saveDocument:async options=>({verified:true,fileName:options.fileName,size:Buffer.from(options.data,options.encoding==='base64'?'base64':'utf8').length}),
  openDocument:async()=>({data:'{"companies":[],"records":[]}',size:29,fileName:'fixture.json'}),...plugin
 };
 const proxies=Object.fromEntries(Object.entries(files).map(([name,callback])=>[name,options=>{calls.push([name,plain(options??null)]);return callback(options);}])) ;
 const on=(type,callback)=>{const rows=listeners.get(type)||[];rows.push(callback);listeners.set(type,rows);};
 const context={URL:LocalURL,Blob,TextEncoder,Uint8Array,Promise,Date:Clock,JSON,Map,Object,Number,String,Error,
  btoa:value=>Buffer.from(value,'binary').toString('base64'),addEventListener:on,
  Capacitor:{isNativePlatform:()=>native,getPlatform:()=>platform,Plugins:bridge?{BackupFile:proxies}:{},registerPlugin(){throw Error('R99 registration must not be restored');}},
  SalaryMateI18n:{language:()=>language},
  MutationObserver:class{constructor(callback){observers.push(callback);}observe(){}},
  document:{getElementById:id=>id==='toast'?toast:id==='appDialog'?dialog:null,addEventListener:on},
  SalaryMateData:{exportPayload:()=>JSON.stringify({companies:[],records:[],exportInfo:{appVersion:'5.0.0-dev.2-R101'}}),importPayload:async value=>trace.push(['import',value])}
 };
 context.window=context;vm.runInNewContext(source,context);
 const fire=(type,event={})=>(listeners.get(type)||[]).forEach(fn=>fn(event));
 const event=target=>({target,preventDefault:()=>trace.push(['prevent']),stopImmediatePropagation:()=>trace.push(['stop'])});
 const blobClick=(bytes=new Blob(['{}'],{type:'application/json'}),name='fixture.json')=>{
  const anchor={href:context.URL.createObjectURL(bytes),download:name};
  fire('click',event({closest:selector=>selector==='a[download]'?anchor:null}));return anchor;
 };
 const form=(encrypted=true)=>{
  const status={textContent:''},button={disabled:false};
  const node={id:'backupExportForm',dataset:{},isConnected:true,reportValidity:()=>true,
   elements:{encrypted:{checked:encrypted},password:{value:'Fictional password'},confirmation:{value:'Fictional password'}},
   querySelector:selector=>selector==='.backup-status'?status:button};
  return {node,status,button,submit:()=>fire('submit',event(node)),snapshot:()=>plain({status:status.textContent,disabled:button.disabled,dataset:node.dataset,password:node.elements.password.value,confirmation:node.elements.confirmation.value})};
 };
 const drive=()=>{
  const api={openDialog:(title,html)=>trace.push(['dialog',title,html]),closeDialog:()=>{trace.push(['close']);dialog.open=false;}};
  const ui=context.SalaryMateGoogleDriveUI.create(api);ui.open();
  const status={textContent:''},nodes=[{disabled:false},{disabled:false}];
  const panel={isConnected:true,querySelector:()=>status,querySelectorAll:()=>nodes};
  const click=(action='open',disabled=false)=>{const button={dataset:{androidDrive:action},disabled,closest:selector=>selector==='#androidDrivePanel'?panel:null};fire('click',event({closest:selector=>selector==='[data-android-drive]'?button:null}));};
  return {ui,panel,status,nodes,click,snapshot:()=>plain({status:status.textContent,disabled:nodes.map(n=>n.disabled)})};
 };
 fire('DOMContentLoaded');
 return {context,dialog,calls,trace,toast,observers,proxies,fire,form,drive,blobClick,snapshot:()=>plain({calls,trace,toast})};
}
async function compare(options,scenario){
 const left=await scenario(harness(previous,options)),right=await scenario(harness(current,options));
 assert.deepEqual(right,left);
}

test('R101 equivalence fixture is the actual published adapter, not the stale source mirror',()=>{
 assert.equal(createHash('sha256').update(previous).digest('hex'),'31305b1ef45dbe06500c34d0f6bf2847dbdf4c05a96cfb1c5e1260fe9fe4e20b');
 for(const source of [previous,current])assert.doesNotMatch(source,/localStorage\.(?:setItem|removeItem|clear)|accounts\.google\.com|addJavascriptInterface/);
 for(const options of [{native:false},{platform:'ios'}]){
  assert.equal(harness(previous,options).context.SalaryMateAndroid,undefined);
  assert.equal(harness(current,options).context.SalaryMateAndroid,undefined);
 }
});

for(const language of ['zh','en']){
 test(`R101 ${language}: public factory, summary and Drive markup remain exact`,async()=>{
  await compare({language},async h=>{
   const d=h.drive();assert.ok(Object.isFrozen(d.ui));assert.ok(Object.isFrozen(h.context.SalaryMateAndroid));
   return {summary:d.ui.summary(),trace:h.trace,api:Object.keys(h.context.SalaryMateAndroid)};
  });
 });
 test(`R101 ${language}: binary/BOM exports preserve bytes at every base64 chunk boundary`,async()=>{
  for(const size of [1,2,3,24575,24576,24577,49152,49153])await compare({language},async h=>{
   const bytes=Uint8Array.from({length:size},(_,i)=>i%256);
   await h.context.SalaryMateAndroid.saveBlob(new Blob([bytes],{type:'text/csv;charset=utf-8'}),'虛構報表.csv');
   assert.deepEqual(Buffer.from(h.calls[0][1].data,'base64'),Buffer.from(bytes));return h.calls;
  });
  await compare({language},async h=>{
   await h.context.SalaryMateAndroid.saveBlob(new Blob(['\uFEFF股票,股數\r\n測試,3\r\n'],{type:'text/csv;charset=utf-8'}),'fixture.csv');return h.calls;
  });
 });
 test(`R101 ${language}: all provider error/cancellation messages remain exact`,async()=>{
  for(const code of ['SAVE_CANCELLED','OPEN_CANCELLED','DOCUMENT_BUSY','BRIDGE_UNAVAILABLE','PICKER_UNAVAILABLE','SAVE_INVALID_DOCUMENT','SAVE_EXTENSION_CHANGED','SAVE_FAILED','OPEN_FAILED','OPEN_INVALID_DOCUMENT','CUSTOM',undefined]){
   await compare({language,plugin:{saveDocument:async()=>{throw error(code);}}},async h=>{h.blobClick();await pause();return h.snapshot();});
  }
 });
 test(`R101 ${language}: unavailable bridge can retry and does not block startup`,async()=>{
  await compare({language,bridge:false},async h=>{
   assert.ok(h.context.SalaryMateAndroid);h.blobClick();await pause();const before=h.snapshot();
   h.context.Capacitor.Plugins.BackupFile=h.proxies;h.blobClick();await pause();return {before,after:h.snapshot()};
  });
 });
 test(`R101 ${language}: malformed verification responses never report success and release the lock`,async()=>{
  for(const bad of [{verified:false,size:2,fileName:'x.json'},{verified:true,size:1,fileName:'x.json'},{verified:true,size:2,fileName:''},{verified:true,size:2},null]){
   await compare({language,plugin:{saveDocument:async()=>bad}},async h=>{
    h.blobClick();await pause();const first=h.snapshot();h.blobClick();await pause();return {first,after:h.snapshot()};
   });
  }
 });
 test(`R101 ${language}: normal/encrypted backup bytes, filenames, passwords and completion remain exact`,async()=>{
  for(const encrypted of [false,true])for(const version of ['5.0.0-dev.2-R101','a/b <version>',0,null]){
   await compare({language},async h=>{
    h.context.SalaryMateData.exportPayload=()=>JSON.stringify({companies:[],records:[],label:'虛構😀',exportInfo:{appVersion:version}});
    h.context.SalaryMateBackup={encrypt:async(payload,password)=>{h.trace.push(['encrypt',payload,password]);return {format:'salarymate-encrypted-backup',ciphertext:'fictional ciphertext'};}};
    const f=h.form(encrypted);f.submit();await pause();return {form:f.snapshot(),...h.snapshot()};
   });
  }
 });
 test(`R101 ${language}: encryption is serialized and closing/leaving the page cancels stale saves`,async()=>{
  for(const end of ['dialog','disconnect','pagehide']){
   async function scenario(source){
    const wait=gate(),h=harness(source,{language});h.context.SalaryMateBackup={encrypt:()=>wait.promise};
    const f=h.form();f.submit();await pause();let blocked;
    try{await h.context.SalaryMateAndroid.saveBlob(new Blob(['{}']),'another.json');}catch(e){blocked={code:e.code,message:e.message};}
    if(end==='dialog')h.dialog.open=false;else if(end==='disconnect')f.node.isConnected=false;else h.fire('pagehide');
    wait.resolve({format:'salarymate-encrypted-backup',ciphertext:'fictional'});await pause();
    assert.equal(h.calls.length,0);return {blocked,form:f.snapshot(),...h.snapshot()};
   }
   assert.deepEqual(await scenario(current),await scenario(previous));
  }
 });
 test(`R101 ${language}: native pending saves suppress early success and retain revoked Blobs`,async()=>{
  async function scenario(source){
   const wait=gate(),h=harness(source,{language,plugin:{saveDocument:()=>wait.promise}});
   const a=h.blobClick();h.context.URL.revokeObjectURL(a.href);await pause();
   h.toast.textContent=language==='en'?'Exported fixture':'已匯出虛構報表';h.observers.forEach(fn=>fn());const pending=h.snapshot();
   wait.resolve({verified:true,size:2,fileName:'fixture.json'});await pause();return {pending,done:h.snapshot()};
  }
  assert.deepEqual(await scenario(current),await scenario(previous));
 });
 test(`R101 ${language}: Drive saves preserve JSON text and strict UTF-8 input validation`,async()=>{
  for(const data of ['{"fixture":"中文😀"}','{"fixture":"\ud800"}', '{}'])await compare({language},async h=>{
   h.context.SalaryMateData.exportPayload=()=>data;const d=h.drive();d.click('save');await pause();
   assert.equal(h.calls[0][1].data,data);return {drive:d.snapshot(),...h.snapshot()};
  });
  for(const result of [{data:'中',size:3},{data:'中',size:2},{data:123,size:3},{data:'',size:1},{data:'{}',size:0},{data:'{}',size:NaN}]){
   await compare({language,plugin:{openDocument:async()=>result}},async h=>{const d=h.drive();d.click();await pause();return {drive:d.snapshot(),...h.snapshot()};});
  }
 });
 test(`R101 ${language}: old Drive responses cannot import after panel replacement or page departure`,async()=>{
  for(const end of ['reopen','pagehide','disconnect','dialog']){
   async function scenario(source){
    const wait=gate(),h=harness(source,{language,plugin:{openDocument:()=>wait.promise}}),d=h.drive();d.click();await pause();
    d.click('save',true);
    if(end==='reopen')d.ui.open();else if(end==='pagehide')h.fire('pagehide');else if(end==='disconnect')d.panel.isConnected=false;else h.dialog.open=false;
    wait.resolve({data:'{"companies":[],"records":[]}',size:29,fileName:'fixture.json'});await pause();
    assert.equal(h.trace.some(row=>row[0]==='import'),false);return {drive:d.snapshot(),...h.snapshot()};
   }
   assert.deepEqual(await scenario(current),await scenario(previous));
  }
 });
 test(`R101 ${language}: backup preparation errors, invalid forms and mismatch retain input`,async()=>{
  for(const failure of ['snapshot','invalid-json','encrypt','mismatch','invalid-form'])await compare({language},async h=>{
   h.context.SalaryMateBackup={encrypt:async()=>{throw new Error('Fictional crypto failure');}};
   const f=h.form();
   if(failure==='snapshot')h.context.SalaryMateData.exportPayload=()=>{throw new Error('Fictional snapshot failure');};
   if(failure==='invalid-json')h.context.SalaryMateData.exportPayload=()=>'{';
   if(failure==='mismatch')f.node.elements.confirmation.value='another';
   if(failure==='invalid-form')f.node.reportValidity=()=>false;
   f.submit();await pause();return {form:f.snapshot(),...h.snapshot()};
  });
 });
}
