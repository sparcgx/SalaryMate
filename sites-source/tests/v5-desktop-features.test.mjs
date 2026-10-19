import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const {createBackupService,checkedOptions}=require('../native-desktop/src/backups.cjs');
const {createQuickEntry}=require('../native-desktop/src/quick-entry.cjs');
const {createPdfService,renderPdf,checkedReport}=require('../native-desktop/src/pdf.cjs');
const snapshot=(n=1,time='2026-10-19T00:00:00Z')=>JSON.stringify({schemaVersion:15,appVersion:'5.0.0',updatedAt:time,exportInfo:{exportedAt:time},companies:[{id:'c',name:'Test only'}],records:Array.from({length:n},(_,i)=>({id:'r'+i,baseSalary:30000+i})),overtimeLogs:[],leaveRecords:[],investmentRecords:[],compTimeCredits:[],compTimeSettlements:[],yearEndEstimates:[],salaryAdjustments:[],stockPortfolio:{assets:[],transactions:[]},uiPreferences:{}});
const prefs=(extra={})=>({enabled:true,intervalMinutes:15,retention:10,shortcutEnabled:false,shortcut:'CommandOrControl+Shift+M',...extra});
async function fixture(t,io){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'salarymate-features-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const userData=path.join(dir,'profile');const service=createBackupService({userData,chooseDirectory:async()=>dir,io});await service.choose();await service.setOptions(prefs());return {service,dir,userData};}
test('automatic backups preserve import-compatible JSON, deduplicate timestamps, and create import checkpoints',async t=>{
 const {service,userData,dir}=await fixture(t);
 const a=await service.save({data:snapshot(),reason:'auto'});assert.equal(a.verified,true);
 const same=await service.save({data:snapshot(1,'2026-10-20T00:00:00Z'),reason:'auto'});assert.equal(same.skipped,true);
 const before=await service.save({data:snapshot(),reason:'before-import'});assert.notEqual(before.entry.id,a.entry.id);
 assert.equal((await service.list()).length,2);
 const read=await service.read(a.entry.id);assert.equal(read.data,snapshot());assert.equal(read.verified,true);
 const reopened=createBackupService({userData,chooseDirectory:async()=>dir});assert.equal((await reopened.options()).enabled,true);assert.equal((await reopened.list()).length,2);
});
test('retention only prunes this installation after verification; unrelated files and another profile survive',async t=>{
 const {service,dir}=await fixture(t);await fs.writeFile(path.join(dir,'personal.json'),'keep');
 const second=createBackupService({userData:path.join(dir,'profile2'),chooseDirectory:async()=>dir});await second.choose();await second.setOptions(prefs());
 const other=await second.save({data:snapshot(),reason:'manual'});const first=await service.save({data:snapshot(),reason:'manual'});
 for(let i=2;i<=12;i++)await service.save({data:snapshot(i),reason:'auto'});
 const list=await service.list();assert.equal(list.length,10);assert.equal(list[0].summary.records,12);assert.ok(!list.some(x=>x.id===first.entry.id));
 await assert.rejects(service.read(first.entry.id));assert.equal((await second.read(other.entry.id)).verified,true);assert.equal(await fs.readFile(path.join(dir,'personal.json'),'utf8'),'keep');
});
test('snapshot/hash corruption is refused and a missing latest file cannot suppress an automatic replacement',async t=>{
 const {service,dir}=await fixture(t),options=await service.options();const folder=path.join(dir,'SalaryMate-Backups',options.deviceId);
 const saved=await service.save({data:snapshot(),reason:'auto'}),file=path.join(folder,saved.entry.id+'.json');await fs.appendFile(file,' ');
 await assert.rejects(service.read(saved.entry.id),e=>e.code==='BACKUP_INTEGRITY');
 const next=await service.save({data:snapshot(),reason:'auto'});assert.equal(next.verified,true);
 await fs.unlink(path.join(folder,next.entry.id+'.json'));assert.equal((await service.save({data:snapshot(),reason:'auto'})).verified,true);
 for(const id of ['../../profile/desktop-preferences','x',null])await assert.rejects(service.read(id));
});
test('failed history commit retains the previous index and snapshots, and removes the uncommitted new file',async t=>{
 let fail=false;const io={...fs,rename:async(a,b)=>{if(fail&&path.basename(b)==='history.json')throw Error('disk full');return fs.rename(a,b);}};
 const {service,dir}=await fixture(t,io);const one=await service.save({data:snapshot(),reason:'manual'});const options=await service.options();const folder=path.join(dir,'SalaryMate-Backups',options.deviceId),files=await fs.readdir(folder);
 fail=true;await assert.rejects(service.save({data:snapshot(2),reason:'manual'}));assert.deepEqual(await fs.readdir(folder),files);assert.equal((await service.read(one.entry.id)).data,snapshot());
});
test('corrupt history fails closed without deleting snapshots; symlinked snapshots are never read',async t=>{
 const {service,dir}=await fixture(t),one=await service.save({data:snapshot(),reason:'manual'}),options=await service.options();const folder=path.join(dir,'SalaryMate-Backups',options.deviceId),file=path.join(folder,one.entry.id+'.json');
 // Windows standard-user CI cannot always create symlinks; lstat boundary is
 // exercised with an injected filesystem response on every platform instead.
 const rejecting=createBackupService({userData:path.join(dir,'profile'),chooseDirectory:async()=>dir,io:{...fs,lstat:async p=>p===file?{isFile:()=>true,isSymbolicLink:()=>true,size:10}:fs.lstat(p)}});
 await assert.rejects(rejecting.read(one.entry.id),e=>e.code==='BACKUP_UNREADABLE');
 await fs.writeFile(path.join(folder,'history.json'),'broken');await assert.rejects(service.save({data:snapshot(2),reason:'auto'}),e=>e.code==='HISTORY_UNREADABLE');assert.equal(await fs.readFile(file,'utf8'),snapshot());
});
test('invalid settings/payloads and cancelled selection do not mutate preferences or backups',async t=>{
 const {service,userData}=await fixture(t),before=await service.options();
 for(const patch of [prefs({retention:0}),prefs({intervalMinutes:1}),prefs({shortcut:'Alt+F4'}),{...prefs(),directory:'/arbitrary'}])await assert.rejects(service.setOptions(patch));
 for(const data of ['{}','not-json',snapshot().replace('"schemaVersion":15','"schemaVersion":16')])await assert.rejects(service.save({data,reason:'manual'}));
 assert.deepEqual(await service.options(),before);assert.deepEqual(await service.list(),[]);
 const cancelled=createBackupService({userData,chooseDirectory:async()=>null});await assert.rejects(cancelled.choose(),e=>e.code==='OPEN_CANCELLED');assert.deepEqual(await cancelled.options(),before);
 await service.setOptions(prefs({enabled:false}));assert.equal((await service.save({data:snapshot(),reason:'auto'})).disabled,true);
});
test('concurrent folder selection prevents snapshot/config writes and failed preferences writes retain prior config',async t=>{
 let release;const {service,dir,userData}=await fixture(t);const before=await service.options();
 const concurrent=createBackupService({userData,chooseDirectory:()=>new Promise(r=>{release=r;})});const pending=concurrent.choose();
 while(!release)await new Promise(r=>setImmediate(r));
 await assert.rejects(concurrent.save({data:snapshot(),reason:'manual'}),e=>e.code==='DESKTOP_BUSY');release(null);await assert.rejects(pending);
 const failing=createBackupService({userData,chooseDirectory:async()=>dir,io:{...fs,rename:async()=>{throw Error('read-only');}}});await assert.rejects(failing.setOptions(prefs({retention:60})));assert.deepEqual(await failing.options(),before);
});
test('shortcut conflicts preserve the working shortcut; disable and quit release registrations and tray',()=>{
 const active=new Map(),sent=[];let destroyed=0;
 const globalShortcut={register:(key,fn)=>{if(key.endsWith('Y'))return false;active.set(key,fn);return true;},unregister:key=>active.delete(key)};
 const quick=createQuickEntry({globalShortcut,makeTray:()=>({destroy(){destroyed++;}}),send:x=>sent.push(x)});
 quick.configure(prefs({shortcutEnabled:true}));active.values().next().value();assert.deepEqual(sent,['quick']);
 assert.throws(()=>quick.configure(prefs({shortcutEnabled:true,shortcut:'CommandOrControl+Shift+Y'})),e=>e.code==='SHORTCUT_UNAVAILABLE');assert.equal(active.size,1);
 quick.configure(prefs({shortcutEnabled:true,shortcut:'CommandOrControl+Alt+M'}));assert.equal(active.size,1);assert.ok(active.has('CommandOrControl+Alt+M'));
 quick.configure(prefs());assert.equal(active.size,0);assert.equal(destroyed,1);quick.dispose();assert.equal(destroyed,1);
});
const report={html:'<section><h2>2026 年度測試報表</h2><table><tr><td>123</td></tr></table></section>',fileName:'SalaryMate_2026_01-12_report.pdf',landscape:true};
test('PDF save cancellation/extension errors avoid rendering and successful output is verified before replacement',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'salarymate-pdf-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'report.pdf');await fs.writeFile(file,'original');let calls=0,choice={canceled:true};
 const service=createPdfService({parent:()=>null,dialog:{showSaveDialog:async()=>choice},render:async()=>{calls++;return Buffer.from('%PDF-1.7\nfixture\n%%EOF');}});
 await assert.rejects(service.save(report),e=>e.code==='SAVE_CANCELLED');assert.equal(calls,0);choice={filePath:file+'.exe'};await assert.rejects(service.save(report),e=>e.code==='SAVE_EXTENSION_CHANGED');assert.equal(calls,0);
 choice={filePath:file};const saved=await service.save(report);assert.equal(saved.verified,true);assert.equal(saved.size,(await fs.stat(file)).size);assert.equal(calls,1);
 const broken=createPdfService({parent:()=>null,dialog:{showSaveDialog:async()=>choice},render:async()=>{throw Error('print failed');}});const before=await fs.readFile(file);await assert.rejects(broken.save(report));assert.deepEqual(await fs.readFile(file),before);
});
test('PDF input refuses active/remote content and invalid filenames before opening a dialog',()=>{
 for(const html of ['<script>alert(1)</script>','<img src="file:///secret">','<iframe></iframe>','<a href="https://example.test">x</a>','<div onclick="x()">x</div>','a'.repeat(1024*1024+1)])assert.throws(()=>checkedReport({...report,html}));
 for(const fileName of ['../report.pdf','x.exe','SalaryMate_2026_01-12_report.pdf/secret'])assert.throws(()=>checkedReport({...report,fileName}));
 assert.equal(checkedReport(report),report);
});
function pdfHarness(print){
 let network,created,printOptions,destroyed=0;
 const partition={setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest:fn=>{network=fn;}}};
 class FakePrintJob {constructor(options){created=options;this.webContents={setWindowOpenHandler(){},on(){},printToPDF:async value=>{printOptions=value;return print();}};}async loadURL(url){assert.ok(url.startsWith('data:'));let result;network({url:'file:///secret'},r=>{result=r;});assert.equal(result.cancel,true);network({url:'https://example.test'},r=>{result=r;});assert.equal(result.cancel,true);}isDestroyed(){return false;}destroy(){destroyed++;}}
 return {dependencies:{BrowserWindow:FakePrintJob,session:{fromPartition:()=>partition},timeoutMs:20},inspect:()=>({created,printOptions,destroyed,network})};
}
test('isolated PDF job uses A4, page numbers, no JavaScript/preload/network and always destroys its resources',async()=>{
 const h=pdfHarness(async()=>Buffer.from('%PDF-1.7\nfixture'));await renderPdf(report,h.dependencies);const s=h.inspect();
 assert.equal(s.created.show,false);assert.equal(s.created.webPreferences.javascript,false);assert.equal(s.created.webPreferences.nodeIntegration,false);assert.equal(s.created.webPreferences.sandbox,true);assert.equal(s.created.webPreferences.preload,undefined);
 assert.equal(s.printOptions.pageSize,'A4');assert.equal(s.printOptions.landscape,true);assert.match(s.printOptions.footerTemplate,/pageNumber/);assert.equal(s.destroyed,1);assert.equal(s.network,null);
 const timeout=pdfHarness(()=>new Promise(()=>{}));await assert.rejects(renderPdf(report,timeout.dependencies),e=>e.code==='PDF_TIMEOUT');assert.equal(timeout.inspect().destroyed,1);
});
test('desktop scheduler does no snapshot work per keystroke, coalesces changes, and blocks imports after backup failure',async()=>{
 const source=await fs.readFile(path.join(root,'native-desktop/renderer/features.js'),'utf8');const timers=new Map();let serial=0,exports=0,saves=0,fail=false;
 const bridge={platform:'win32',featuresState:async()=>({options:prefs()}),onDesktopAction:()=>()=>{},backupSnapshot:async input=>{saves++;if(fail)throw Object.assign(Error('disk'),{code:'DESKTOP_FAILED'});return {verified:true,entry:{createdAt:'2026-10-19'}};}};
 const context={SalaryMateDesktop:bridge,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},setTimeout:(fn,ms)=>{assert.equal(ms,900000);timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),console};vm.runInNewContext(source,context);
 const controller=context.SalaryMateDesktopFeatures;controller.attach({canBackup:()=>true,canOpen:()=>true,toast(){},snapshot:async()=>{exports++;return snapshot();}});
 await new Promise(r=>setImmediate(r));for(let i=0;i<100;i++)controller.changed();assert.equal(exports,0);
 await timers.values().next().value();await new Promise(r=>setImmediate(r));assert.equal(exports,1);assert.equal(saves,1);
 await timers.values().next().value();await new Promise(r=>setImmediate(r));assert.equal(exports,1);
 fail=true;assert.equal(await controller.beforeImport(),false);assert.equal(saves,2);
});
test('desktop import checkpoint failure stops before reading or mutating incoming data',async()=>{
 const source=await fs.readFile(path.join(root,'native-desktop/www/startup.js'),'utf8');const start=source.indexOf('    const importJson = async file => {'),end=source.indexOf('    const clearData =',start);assert.ok(start>0&&end>start);
 let read=0;const context={hasDirtyDraft:()=>false,window:{SalaryMateDesktopFeatures:{beforeImport:async()=>false}}};vm.runInNewContext(source.slice(start,end)+';globalThis.run=importJson;',context);
 await context.run({text:async()=>{read++;return snapshot();}});assert.equal(read,0);
});
test('desktop app hooks preserve unfinished forms and never export a snapshot after flush failure',async()=>{
 const source=await fs.readFile(path.join(root,'native-desktop/renderer/app-hooks.js'),'utf8');let attached,opened=0,exported=0;
 const context={window:{SalaryMateDesktopFeatures:{attach:a=>{attached=a;}},SalaryMateStorage:{flush:async()=>{throw Error('storage failed');}},SalaryMateData:{exportPayload:()=>{exported++;return snapshot();}}},openDialog:()=>opened++,closeDialog(){},toast(){},captureDialogBaseline(){},hasDirtyDraft:()=>true,$:()=>({open:true}),document:{querySelector:()=>null},runtimeState:{dataStatus:'ready',operationStatus:'idle'},previewAnnualReport(){}};
 vm.runInNewContext(source,context);attached.quick('record');assert.equal(opened,0);assert.equal(attached.close(),false);await assert.rejects(attached.snapshot());assert.equal(exported,0);
});
