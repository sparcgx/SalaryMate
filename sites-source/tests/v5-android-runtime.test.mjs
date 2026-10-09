import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../scripts/lib/android-runtime.js',import.meta.url),'utf8');
const pause=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
// Callback spies for adapter contracts; no browser, DOM emulator or device.
function harness({native=true,platform='android',language='zh',plugin={}}={}){
 const listeners=new Map(),observers=[],calls=[],revoked=[];
 const toast={textContent:'',className:'',setAttribute(){}};
 let urlIndex=0;
 class LocalURL extends URL {static createObjectURL(){return 'blob:https://salarymate.sparcgx2420.chatgpt.site/'+(++urlIndex);}static revokeObjectURL(url){revoked.push(url);}}
 const files={saveDocument:async options=>{calls.push(options);return {verified:true,size:Buffer.from(options.data,options.encoding==='base64'?'base64':'utf8').length,fileName:options.fileName};},...plugin};
 const context={URL:LocalURL,Blob,TextEncoder,Uint8Array,Promise,Date,JSON,Map,Object,Number,String,Error,
  btoa:value=>Buffer.from(value,'binary').toString('base64'),
  Capacitor:{isNativePlatform:()=>native,getPlatform:()=>platform,registerPlugin:name=>{assert.equal(name,'BackupFile');return files;}},
  SalaryMateI18n:{language:()=>language},
  MutationObserver:class{constructor(callback){observers.push(callback);}observe(){}},
  document:{getElementById:id=>id==='toast'?toast:id==='appDialog'?{open:true}:null,addEventListener:(type,fn)=>{const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows);}}
 };
 context.window=context;vm.runInNewContext(source,context);
 const fire=(type,event={})=>(listeners.get(type)||[]).forEach(fn=>fn(event));
 fire('DOMContentLoaded');return {context,listeners,observers,calls,revoked,toast,fire,files};
}
test('Android adapters are inert on website/iOS and preserve the state key and backup adapter',()=>{
 for(const options of [{native:false},{platform:'ios'}]){const h=harness(options);assert.equal(h.context.SalaryMateAndroid,undefined);assert.equal(h.listeners.size,0);}
 const h=harness();assert.equal(h.context.SalaryMatePortable.marketOrigin,'https://salarymate.sparcgx2420.chatgpt.site');
 assert.equal(h.context.SalaryMateNative,undefined);assert.equal(h.context.SalaryMateBackup,undefined);
 assert.doesNotMatch(source,/localStorage\.(?:setItem|removeItem|clear)|accounts\.google\.com|addJavascriptInterface/);
});
test('Blob exports preserve exact binary and UTF-8 BOM bytes; success requires verified native response',async()=>{
 const h=harness(),bytes=Buffer.from('\uFEFF股票,股數\r\n測試,3\r\n','utf8');
 const result=await h.context.SalaryMateAndroid.saveBlob(new Blob([bytes],{type:'text/csv;charset=utf-8'}),'持股.csv');
 assert.equal(result.verified,true);assert.equal(h.calls[0].mimeType,'text/csv');assert.equal(h.calls[0].encoding,'base64');
 assert.deepEqual(Buffer.from(h.calls[0].data,'base64'),bytes);
 const binary=new Uint8Array([0,255,128,32,10]);await h.context.SalaryMateAndroid.saveBlob(new Blob([binary]),'binary.salarymate');
 assert.deepEqual([...Buffer.from(h.calls[1].data,'base64')],[...binary]);
 const bad=harness({plugin:{saveDocument:async()=>({verified:false,size:2,fileName:'bad.json'})}});
 await assert.rejects(bad.context.SalaryMateAndroid.saveBlob(new Blob(['{}'],{type:'application/json'}),'bad.json'),/驗證/);
 await assert.rejects(h.context.SalaryMateAndroid.saveBlob({size:45*1024*1024+1},'huge.json'),/45 MB/);
 assert.equal(h.calls.length,2);
});
test('Native blob save holds data through URL revocation and does not claim success before verification',async()=>{
 const gate=deferred();let called;
 const h=harness({plugin:{saveDocument:options=>{called=options;return gate.promise;}}});
 const blob=new Blob(['{"records":[]}'],{type:'application/json'}),url=h.context.URL.createObjectURL(blob);
 const anchor={href:url,download:'backup.json'};
 const event={target:{closest:selector=>selector==='a[download]'?anchor:null},preventDefault(){},stopImmediatePropagation(){}};
 h.fire('click',event);h.context.URL.revokeObjectURL(url);await pause();
 assert.equal(called.fileName,'backup.json');assert.equal(Buffer.from(called.data,'base64').toString(),' {"records":[]}'.trim());
 h.toast.textContent='已匯出 12 個月出勤分析';h.observers.forEach(callback=>callback());
 assert.match(h.toast.textContent,/請選擇儲存位置/);assert.doesNotMatch(h.toast.textContent,/已完整儲存/);
 gate.resolve({verified:true,size:14,fileName:'backup.json'});await pause();assert.match(h.toast.textContent,/已完整儲存並驗證/);
 const cancelled=harness({plugin:{saveDocument:async()=>{throw Object.assign(new Error('cancel'),{code:'SAVE_CANCELLED'});}}});
 const other={href:cancelled.context.URL.createObjectURL(blob),download:'backup.json'};
 cancelled.fire('click',{...event,target:{closest:selector=>selector==='a[download]'?other:null}});await pause();
 assert.match(cancelled.toast.textContent,/已取消/);assert.doesNotMatch(cancelled.toast.textContent,/已完整儲存/);
});
test('Android Drive factory uses the user document picker and original import preview, with bilingual truthful UI',async()=>{
 for(const language of ['zh','en']){
  let opened,closed=false,imported,originalCalls=0;
  const h=harness({language,plugin:{openDocument:async()=>({data:'{"records":[],"companies":[]}',size:29,fileName:'legacy.salarymate'})}});
  h.context.SalaryMateData={exportPayload:()=>'{"records":[],"companies":[]}',importPayload:async value=>{imported=value;}};
  h.context.SalaryMateGoogleDriveUI=Object.freeze({create(){originalCalls++;throw new Error('GIS must not run');}});
  const ui=h.context.SalaryMateGoogleDriveUI.create({openDialog:(title,html)=>{opened={title,html};},closeDialog:()=>{closed=true;}});ui.open();
  assert.equal(originalCalls,0);assert.ok(Object.isFrozen(ui));
  assert.match(opened.html,language==='en'?/does not provide.*automatic synchronization/:/沒有網站版.*自動同步/);
  assert.match(opened.html,language==='en'?/installed and signed in/:/已安裝並登入/);
  const status={textContent:''},nodes=[];
  const panel={isConnected:true,querySelector:()=>status,querySelectorAll:()=>nodes};
  const button={dataset:{androidDrive:'open'},closest:selector=>selector==='#androidDrivePanel'?panel:null};
  h.fire('click',{target:{closest:selector=>selector==='[data-android-drive]'?button:null},preventDefault(){},stopImmediatePropagation(){}});await pause();
  assert.equal(closed,true);assert.equal(imported,'{"records":[],"companies":[]}');
  assert.doesNotMatch(status.textContent,/已匯入|import complete/i);
 }
});
test('Encrypted backup submission sends ciphertext to native save and awaits verification/cancellation',async()=>{
 const gate=deferred();let nativeOptions;
 const h=harness({plugin:{saveDocument:options=>{nativeOptions=options;return gate.promise;}}});
 h.context.SalaryMateData={exportPayload:()=>JSON.stringify({companies:[],records:[],exportInfo:{appVersion:'5.0.0-dev.2-R99'}})};
 let password;
 h.context.SalaryMateBackup={encrypt:async(value,secret)=>{password=secret;return {format:'salarymate-encrypted-backup',ciphertext:'test-ciphertext'};}};
 const status={textContent:''},button={disabled:false},form={id:'backupExportForm',dataset:{},isConnected:true,reportValidity:()=>true,
  elements:{encrypted:{checked:true},password:{value:'test-password'},confirmation:{value:'test-password'}},
  querySelector:selector=>selector==='.backup-status'?status:button};
 let prevented=false;
 h.fire('submit',{target:form,preventDefault(){prevented=true;},stopImmediatePropagation(){}});await pause();
 assert.equal(prevented,true);assert.equal(password,'test-password');assert.equal(button.disabled,true);
 assert.match(nativeOptions.fileName,/5\.0\.0-dev\.2-R99_encrypted/);
 assert.equal(JSON.parse(nativeOptions.data).ciphertext,'test-ciphertext');assert.doesNotMatch(nativeOptions.data,/test-password/);
 assert.doesNotMatch(status.textContent,/已完整儲存/);
 gate.reject(Object.assign(new Error('cancel'),{code:'SAVE_CANCELLED'}));await pause();
 assert.match(status.textContent,/已取消/);assert.equal(button.disabled,false);assert.equal(form.elements.password.value,'test-password');
});
test('Native Java contracts retain BridgeActivity/security, bounded providers and SHA-256 read-back',()=>{
 const base=new URL('../native-android/android/app/src/main/java/com/salarymate/personal/',import.meta.url);
 const main=fs.readFileSync(new URL('MainActivity.java',base),'utf8'),backup=fs.readFileSync(new URL('BackupFilePlugin.java',base),'utf8');
 assert.match(main,/extends BridgeActivity/);assert.match(main,/new BridgeWebViewClient\(bridge\)/);
 for(const path of ['quotes','nav','lookup','dividends','catalog'])assert.ok(main.includes('/api/stocks/portable/'+path));
 assert.match(main,/request\.isForMainFrame\(\).*MARKET_PATHS\.contains/s);assert.match(main,/uri\.getUserInfo\(\) == null/);
 assert.match(main,/new NativeSecurityController\(this\)/);assert.match(main,/security\.applyScreenProtection\(\)/);
 assert.match(main,/app\.handleBackButton\(\)/);assert.doesNotMatch(main,/webView\.goBack|addJavascriptInterface/);
 assert.match(backup,/MAX_BACKUP_BYTES = 30 \* 1024 \* 1024/);assert.match(backup,/MAX_DOCUMENT_BYTES = 45 \* 1024 \* 1024/);
 assert.match(backup,/getBridge\(\)\.execute\(/);assert.match(backup,/Intent\.ACTION_CREATE_DOCUMENT/);assert.match(backup,/Intent\.ACTION_OPEN_DOCUMENT/);
 assert.match(backup,/"content"\.equals\(uri\.getScheme\(\)\)/);assert.match(backup,/onMalformedInput\(CodingErrorAction\.REPORT\)/);
 assert.match(backup,/MessageDigest\.isEqual\(expectedDigest, digest\.digest\(\)\)/);assert.match(backup,/response\.put\("verified", true\)/);
});
