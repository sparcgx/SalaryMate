import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const {safeAsset,documentURL,publicApiPath,checkedDocument,MAX_DOCUMENT_BYTES}=require('../native-desktop/src/security.cjs');
const {createFileService,writeVerified}=require('../native-desktop/src/files.cjs');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const temporary=async t=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'salarymate-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;};
test('local protocol only serves exact bundled paths; rejects traversal and foreign origins',()=>{
 const files={'index.html':{},'art/a.png':{}};
 assert.equal(safeAsset('salarymate://app/?v=1',files),'index.html');
 assert.equal(safeAsset('salarymate://app/art/a.png?v=1',files),'art/a.png');
 for(const url of ['file:///etc/passwd','salarymate://other/index.html','salarymate://user@app/index.html','salarymate://app/art/%2e%2e%2fprivate','salarymate://app/%5c..%5cfoo','salarymate://app/%00','salarymate://app/%zz','salarymate://app/missing'])assert.equal(safeAsset(url,files),null,url);
 assert.ok(documentURL('salarymate://app/index.html?tab=calendar'));
 assert.equal(documentURL('salarymate://app/legal.html'),false);
});
test('public API routes are closed to arbitrary proxy and private data paths',()=>{
 assert.equal(publicApiPath('salarymate://app/api/reference/fx?date=2026-10-01'),'/api/reference/fx?date=2026-10-01');
 for(const url of ['salarymate://app/api/private','https://evil.example/api/stocks/quotes','salarymate://app/api/stocks/quotes/extra','salarymate://app/api/proxy?url=https://evil.example'])assert.equal(publicApiPath(url),null);
});
test('document validation preserves BOM and binary bytes and restricts size/name/type',()=>{
 const input={fileName:'股票.csv',data:Buffer.from('\uFEFF股票,3\r\n').toString('base64'),encoding:'base64'};
 assert.deepEqual(checkedDocument(input).bytes,Buffer.from('\uFEFF股票,3\r\n'));
 for(const fileName of ['../data.json','a\\b.json','a.exe','a.json\0','a:123.json'])assert.throws(()=>checkedDocument({...input,fileName}));
 for(const data of ['@!??','Zg=','Zg===','Zh==',''])assert.throws(()=>checkedDocument({...input,data}));
 assert.throws(()=>checkedDocument({fileName:'a.json',encoding:'utf8',data:'中'.repeat(Math.floor(MAX_DOCUMENT_BYTES/3)+1)}));
});
test('native export is verified before replacement and cancellation leaves prior backup intact',async t=>{
 const dir=await temporary(t),file=path.join(dir,'backup.json');await fs.writeFile(file,'original');
 const service=createFileService({parent:()=>null,dialog:{showSaveDialog:async()=>({canceled:false,filePath:file})}});
 const result=await service.save({fileName:'backup.json',encoding:'utf8',data:'{"company":"示範"}'});
 assert.equal(result.ok,true);assert.equal(result.verified,true);assert.equal(sha(await fs.readFile(file)),result.sha256);
 const cancel=createFileService({parent:()=>null,dialog:{showSaveDialog:async()=>({canceled:true})}});
 const prior=await fs.readFile(file);assert.equal((await cancel.save({fileName:'backup.json',encoding:'utf8',data:'new'})).code,'SAVE_CANCELLED');assert.deepEqual(await fs.readFile(file),prior);
});
test('read-back and rename failures preserve existing destination and remove temporary files',async t=>{
 const dir=await temporary(t),file=path.join(dir,'backup.json');await fs.writeFile(file,'original');
 await assert.rejects(writeVerified(file,Buffer.from('replacement'),{...fs,readFile:async()=>Buffer.from('corrupt')}));
 assert.equal(await fs.readFile(file,'utf8'),'original');assert.deepEqual(await fs.readdir(dir),['backup.json']);
 await assert.rejects(writeVerified(file,Buffer.from('replacement'),{...fs,rename:async()=>{throw Error('locked');}}));
 assert.equal(await fs.readFile(file,'utf8'),'original');assert.deepEqual(await fs.readdir(dir),['backup.json']);
});
test('export rejects changed extension and concurrent dialog operations',async t=>{
 const dir=await temporary(t);let release;
 const service=createFileService({parent:()=>null,dialog:{showSaveDialog:()=>new Promise(r=>{release=r;})}});
 const pending=service.save({fileName:'b.json',encoding:'utf8',data:'{}'});
 assert.equal(service.isBusy(),true);assert.equal((await service.open()).code,'DOCUMENT_BUSY');
 release({filePath:path.join(dir,'b.exe')});assert.equal((await pending).code,'SAVE_EXTENSION_CHANGED');assert.equal(service.isBusy(),false);assert.deepEqual(await fs.readdir(dir),[]);
});
test('native import enforces UTF-8 and size without changing any application state',async t=>{
 const dir=await temporary(t),file=path.join(dir,'b.json');
 const service=createFileService({parent:()=>null,dialog:{showOpenDialog:async()=>({filePaths:[file]})}});
 await fs.writeFile(file,'\uFEFF{"schemaVersion":15}');let result=await service.open();assert.equal(result.ok,true);assert.equal(Buffer.byteLength(result.data),result.size);
 await fs.writeFile(file,Buffer.from([255,255]));assert.equal((await service.open()).code,'OPEN_FAILED');
 await fs.writeFile(file,'');assert.equal((await service.open()).code,'OPEN_FAILED');
});
test('snapshot contains current calendar, every offline scene and original payroll/stock modules',async()=>{
 const manifest=JSON.parse(await read('native-desktop/www/desktop-asset-manifest.json'));
 assert.equal(manifest.version,'5.0.0');assert.equal(manifest.schema,15);assert.equal(manifest.stateKey,'salarymate_v5_full_state');
 for(const f of manifest.files){const bytes=await fs.readFile(path.join(root,'native-desktop/www',f.path));assert.equal(bytes.length,f.bytes,f.path);assert.equal(sha(bytes),f.sha256,f.path);}
 for(const name of ['app.js','bootstrap.js','stocks.js','backup.js','reconcile.js','comp-time.js','annual-analysis.js','reference-data.js','styles.css','styles-core.css','ornate-flight.js'])assert.equal(await read('native-desktop/www/'+name),await read('dist/dev/v5.0.0-dev.2/'+name),name);
 for(const f of manifest.api)assert.equal(sha(await fs.readFile(path.join(root,'server',f.path))),f.sha256,f.path);
 assert.equal(manifest.files.filter(f=>/art\/background-/.test(f.path)).length,10);
 assert.match(await read('native-desktop/www/app.js'),/officeCalendarBadge/);
});
test('desktop scripts pass syntax and exact CSP without enabling Node in renderer',async()=>{
 const html=await read('native-desktop/www/index.html'),manifest=JSON.parse(await read('native-desktop/www/desktop-asset-manifest.json'));
 for(const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  new vm.Script(m[1]);assert.ok(manifest.csp.includes("'sha256-"+createHash('sha256').update(m[1].replace(/\r\n?/g,'\n')).digest('base64')+"'"));
 }
 assert.match(manifest.csp,/connect-src 'self'/);assert.doesNotMatch(manifest.csp,/unsafe-eval|script-src[^;]*unsafe-inline/);
 for(const f of manifest.files.filter(f=>f.path.endsWith('.js')))new vm.Script(await read('native-desktop/www/'+f.path),{filename:f.path});
 const main=await read('native-desktop/src/main.cjs');assert.match(main,/nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true/);assert.match(main,/senderFrame !== window.webContents.mainFrame/);
 assert.doesNotMatch(main,/clearStorageData|disable-web-security|remote-debugging|--no-sandbox/);
 assert.match(main,/app\.setPath\('userData', path\.join\(app\.getPath\('appData'\), 'SalaryMate'\)\)/);
});
function harness(source,platform='win32'){
 const listeners=new Map(),calls=[],toast={textContent:'',setAttribute(){}};
 class LocalURL extends URL{static createObjectURL(){return 'blob:salarymate://app/example';}static revokeObjectURL(){}}
 const bridge={platform,saveDocument:async input=>{calls.push(input);return {verified:true,size:Buffer.from(input.data,input.encoding==='base64'?'base64':'utf8').length,fileName:input.fileName};},openDocument:async()=>({data:'{}',size:2})};
 const context={URL:LocalURL,Blob,Uint8Array,TextEncoder,Map,Promise,Date,JSON,Object,Number,String,Error,SalaryMateDesktop:bridge,btoa:s=>Buffer.from(s,'binary').toString('base64'),SalaryMateI18n:{language:()=> 'zh'},addEventListener(){},document:{getElementById:()=>toast,addEventListener:(type,fn)=>{const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows);}}};
 vm.runInNewContext(source,context);return {context,bridge,calls,listeners};
}
test('desktop adapter keeps isolated bridge, waits for verified saves and remains inert on other platforms',async()=>{
 const source=await read('native-desktop/www/desktop-runtime.js');
 for(const platform of ['win32','darwin']){const h=harness(source,platform);assert.equal(h.context.SalaryMateDesktop,h.bridge);const result=await h.context.SalaryMateDesktopFiles.saveBlob(new Blob(['\uFEFF測試']), 'backup.json');assert.equal(result.verified,true);assert.deepEqual(Buffer.from(h.calls[0].data,'base64'),Buffer.from('\uFEFF測試'));h.bridge.saveDocument=async()=>({verified:false});await assert.rejects(h.context.SalaryMateDesktopFiles.saveBlob(new Blob(['{}']),'a.json'));}
 assert.equal(harness(source,'linux').context.SalaryMateDesktopFiles,undefined);
 assert.doesNotMatch(source,/localStorage\.(?:setItem|clear|removeItem)|accounts\.google\.com/);
 assert.match(source,/Drive 電腦版/);
});
test('installer settings retain profile, provide two Mac architectures, and make signature limits explicit',async()=>{
 const pkg=JSON.parse(await read('native-desktop/package.json'));
 assert.equal(pkg.build.nsis.deleteAppDataOnUninstall,false);assert.equal(pkg.build.nsis.runAfterFinish,false);
 assert.equal(pkg.build.mac.identity,'-');assert.equal(pkg.build.mac.notarize,false);
 const flow=await read('.github/workflows/salarymate-desktop.yml');assert.match(flow,/arch: arm64/);assert.match(flow,/arch: x64/);assert.doesNotMatch(flow,/playwright|puppeteer|xvfb/i);
});

test('Drive native import validates original bytes then consumes UTF-8 BOM like File.text()',async()=>{
 const source=await read('native-desktop/www/desktop-runtime.js');
 const fn=source.match(/function importSelectedBackup\(result,api\)\{[\s\S]*?\n \}/)?.[0];assert.ok(fn);
 const payload={schemaVersion:15,companies:[],records:[]};
 let closed=0,imported;
 const context={checkedSize:size=>assert.ok(size>0&&size<=MAX_DOCUMENT_BYTES),checkedTextSize:value=>Buffer.byteLength(value),operationError:code=>Error(code),root:{SalaryMateData:{importPayload:text=>{imported=JSON.parse(text);return imported;}}}};
 vm.runInNewContext(fn+';globalThis.run=importSelectedBackup;',context);
 for(const bom of ['', '\uFEFF']){const data=bom+JSON.stringify(payload);context.run({data,size:Buffer.byteLength(data)},{closeDialog(){closed++;}});assert.deepEqual(imported,payload);}
 assert.equal(closed,2);assert.throws(()=>context.run({data:'{}',size:9},{closeDialog(){throw Error('Must not close on failed verification');}}),/OPEN_FAILED/);
});
