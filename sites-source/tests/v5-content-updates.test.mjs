import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {FORMAT,MAX_JSON,hash,contentHash,safePath,encodePackage,decodePackage,createContentService}=require('../native-desktop/src/content-updates.cjs');
const {createUpdateService,releaseInfo,REPO,RELEASES}=require('../native-desktop/src/updates.cjs');
const runtimeId=hash(Buffer.from('stable-runtime'));
const required=['www/index.html','www/startup.js','www/desktop-runtime.js','www/desktop-features.js','www/desktop-updates.js','api/stock-market.mjs','api/reference-api.mjs'];
function content(patch=0,overrides={}){
 const tag='v5.3.'+patch+'-desktop.1',entries=new Map(required.map(f=>[f,Buffer.from(f==='www/startup.js'?'version='+patch:'unchanged '+f)]));
 entries.set('www/desktop-asset-manifest.json',Buffer.from(JSON.stringify({version:'5.3.'+patch,desktopRelease:1,desktopBuild:5030001+patch,schema:15,stateKey:'salarymate_v5_full_state'})));
 entries.set('www/art/retained.webp',Buffer.from('a'.repeat(20000)));
 const files=[...entries].map(([path,b])=>({path,bytes:b.length,sha256:hash(b)})).sort((a,b)=>a.path<b.path?-1:1);
 const manifest={format:FORMAT,tag,build:5030001+patch,runtimeId,schema:15,files,contentHash:contentHash(files),...overrides};
 return {manifest,entries};
}
async function fixture(t){
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'salarymate-content-')));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const base=content(),baseDirectory=path.join(dir,'application'),userData=path.join(dir,'profile');
 for(const [f,b] of base.entries){await fs.mkdir(path.dirname(path.join(baseDirectory,f)),{recursive:true});await fs.writeFile(path.join(baseDirectory,f),b);}
 await fs.writeFile(path.join(baseDirectory,'content-manifest.json'),JSON.stringify(base.manifest));
 await fs.mkdir(userData);await fs.writeFile(path.join(userData,'financial-data-test.txt'),'private record');
 const config={userData,baseDirectory,runtimeId},service=createContentService(config);await service.start();
 return {dir,base,config,service};
}
async function packageFile(f,target,base=null){
 const changed=new Map([...target.entries].filter(([p,b])=>!base||!base.entries.has(p)||hash(base.entries.get(p))!==hash(b)));
 const packed=encodePackage(target.manifest,changed,base?{tag:base.manifest.tag,contentHash:base.manifest.contentHash}:null);
 const asset={tag:target.manifest.tag,contentHash:target.manifest.contentHash,runtimeId:target.manifest.runtimeId,size:packed.length,sha256:hash(packed),delta:!!base,baseTag:base?.manifest.tag||null,baseContentHash:base?.manifest.contentHash||null};
 const file=path.join(f.dir,'package-'+target.manifest.tag+(base?'-delta':'-full')+'.smupdate');await fs.writeFile(file,packed);return {file,asset,packed};
}
test('content packages update without rewriting the installed runtime or private profile',async t=>{
 const f=await fixture(t),next=content(1),p=await packageFile(f,next);
 await f.service.stage(p.file,p.asset);
 const fresh=createContentService(f.config),trial=await fresh.start();
 assert.equal(trial.manifest.tag,next.manifest.tag);assert.equal(fresh.status().pending,true);
 assert.equal((await fs.readFile(path.join(trial.directory,'www/startup.js'))).toString(),'version=1');
 await fresh.ready();
 const reopened=createContentService(f.config);assert.equal((await reopened.start()).manifest.tag,next.manifest.tag);assert.equal(reopened.status().canRollback,true);
 assert.equal(await fs.readFile(path.join(f.config.baseDirectory,'www/startup.js'),'utf8'),'version=0');
 assert.equal(await fs.readFile(path.join(f.config.userData,'financial-data-test.txt'),'utf8'),'private record');
});
test('a delta reuses verified unchanged files; the complete new inventory handles deletions',async t=>{
 const f=await fixture(t),next=content(1);
 next.entries.delete('www/art/retained.webp');next.manifest.files=next.manifest.files.filter(x=>x.path!=='www/art/retained.webp');next.manifest.contentHash=contentHash(next.manifest.files);
 const delta=await packageFile(f,next,f.base);assert.ok(decodePackage(delta.packed).entries.size<next.entries.size);
 await f.service.stage(delta.file,delta.asset);const after=createContentService(f.config),active=await after.start();await after.ready();
 assert.equal(await fs.readFile(path.join(active.directory,'api/reference-api.mjs'),'utf8'),'unchanged api/reference-api.mjs');
 await assert.rejects(fs.stat(path.join(active.directory,'www/art/retained.webp')),e=>e.code==='ENOENT');
});
test('a crash before startup acknowledgement rolls back once and retains user records',async t=>{
 const f=await fixture(t),p=await packageFile(f,content(1));await f.service.stage(p.file,p.asset);
 const crashed=createContentService(f.config);assert.equal((await crashed.start()).manifest.tag,'v5.3.1-desktop.1');
 const restarted=createContentService(f.config);assert.equal((await restarted.start()).manifest.tag,'v5.3.0-desktop.1');assert.equal(restarted.status().rolledBack,true);
 const stable=createContentService(f.config);assert.equal((await stable.start()).manifest.tag,'v5.3.0-desktop.1');assert.equal(stable.status().pending,false);
 assert.equal(await fs.readFile(path.join(f.config.userData,'financial-data-test.txt'),'utf8'),'private record');
});
test('manual rollback restores the prior content after two acknowledged updates',async t=>{
 const f=await fixture(t);let current=f.service;
 for(const patch of [1,2]){const p=await packageFile(f,content(patch));await current.stage(p.file,p.asset);current=createContentService(f.config);await current.start();await current.ready();}
 await current.rollback();const restored=createContentService(f.config);assert.equal((await restored.start()).manifest.tag,'v5.3.1-desktop.1');await restored.ready();
 await restored.rollback();const again=createContentService(f.config);assert.equal((await again.start()).manifest.tag,'v5.3.2-desktop.1');
});
test('corrupt active content falls back to the verified prior version; new native runtime ignores incompatible content',async t=>{
 const f=await fixture(t),p=await packageFile(f,content(1));await f.service.stage(p.file,p.asset);
 const active=createContentService(f.config),loaded=await active.start();await active.ready();
 await fs.writeFile(path.join(loaded.directory,'www/startup.js'),'corrupt');
 const fallback=createContentService(f.config);assert.equal((await fallback.start()).manifest.tag,'v5.3.0-desktop.1');assert.equal(fallback.status().rolledBack,true);
 const other=createContentService({...f.config,runtimeId:hash(Buffer.from('different'))});await assert.rejects(other.start(),e=>e.code==='UPDATE_PACKAGE_INCOMPATIBLE');
});
test('package checksum, runtime, version and delta base mismatches cannot change active content',async t=>{
 const f=await fixture(t);
 const wrong=await packageFile(f,content(1,{runtimeId:hash(Buffer.from('other'))}));await assert.rejects(f.service.stage(wrong.file,wrong.asset),e=>e.code==='UPDATE_PACKAGE_INCOMPATIBLE');
 const stale=await packageFile(f,content());await assert.rejects(f.service.stage(stale.file,stale.asset),e=>e.code==='UPDATE_PACKAGE_INCOMPATIBLE');
 const delta=await packageFile(f,content(2),content(1));await assert.rejects(f.service.stage(delta.file,delta.asset),e=>e.code==='UPDATE_PACKAGE_INCOMPATIBLE');
 const valid=await packageFile(f,content(1));await fs.appendFile(valid.file,'bad');await assert.rejects(f.service.stage(valid.file,valid.asset),e=>e.code==='UPDATE_INTEGRITY');
 assert.equal(f.service.status().tag,'v5.3.0-desktop.1');assert.equal(f.service.status().pending,false);
});
test('path traversal, case collisions, native files, malformed base64 and gzip bombs are rejected',()=>{
 for(const p of ['../secret','www/../secret','www/C:/file','www/a\\b','www/CON.txt','www/a.','src/main.cjs','api//file'])assert.equal(safePath(p),false,p);
 const c=content(),packed=encodePackage(c.manifest,c.entries),raw=JSON.parse(gunzipSync(packed));
 for(const edit of [
  r=>{r.manifest.files[0].path='www/../../private';},
  r=>{r.entries[0].data='!!!!';},
  r=>{r.entries.push(r.entries[0]);},
  r=>{r.manifest.files.push({...r.manifest.files.at(-1),path:'WWW/index.html'});},
  r=>{r.manifest.schema=16;},
  r=>{r.manifest.files[0].bytes=Infinity;},
  r=>{r.entries.pop();}
 ]){const r=structuredClone(raw);edit(r);assert.throws(()=>decodePackage(gzipSync(Buffer.from(JSON.stringify(r)))));}
 const bomb=gzipSync(Buffer.alloc(MAX_JSON+1));assert.throws(()=>decodePackage(bomb),e=>e.code==='UPDATE_PACKAGE_INVALID');
});
test('changed base files and stage write failures never publish a partially applied package',async t=>{
 const f=await fixture(t),delta=await packageFile(f,content(1),f.base);
 await fs.writeFile(path.join(f.config.baseDirectory,'api/reference-api.mjs'),'tampered');
 await assert.rejects(f.service.stage(delta.file,delta.asset),e=>e.code==='UPDATE_INTEGRITY');
 assert.equal(f.service.status().pending,false);
 const full=await packageFile(f,content(1)),io={...fs,rename:async(a,b)=>{if(b.endsWith('startup.js'))throw Object.assign(Error('disk full'),{code:'ENOSPC'});return fs.rename(a,b);}};
 const broken=createContentService({...f.config,io});await broken.start();await assert.rejects(broken.stage(full.file,full.asset));
 assert.equal(broken.status().pending,false);assert.ok((await fs.readdir(path.join(f.config.userData,'content-updates'))).every(p=>!p.startsWith('.stage-')));
});
test('symlink entries in retained content are refused before delta reuse',async t=>{
 const f=await fixture(t),target=path.join(f.config.baseDirectory,'api/reference-api.mjs');
 await fs.unlink(target);
 try{await fs.symlink(path.join(f.config.userData,'financial-data-test.txt'),target);}catch(e){if(['EPERM','EACCES'].includes(e.code)){t.skip('Host does not permit symlink creation');return;}throw e;}
 const delta=await packageFile(f,content(1),f.base);await assert.rejects(f.service.stage(delta.file,delta.asset),e=>e.code==='UPDATE_INTEGRITY');
});
const backup=JSON.stringify({schemaVersion:15,companies:[],records:[],overtimeLogs:[],leaveRecords:[],investmentRecords:[],compTimeCredits:[],compTimeSettlements:[],yearEndEstimates:[],salaryAdjustments:[],stockPortfolio:{assets:[],transactions:[]}});

function stateWrites(f){
 const file=path.join(f.config.userData,'content-updates','state.json');let fail=false,writes=0;
 return {file,block:value=>{fail=value;},count:()=>writes,read:()=>fs.readFile(file,'utf8'),io:{...fs,rename:async(a,b)=>{
  if(b===file){writes++;if(fail)throw Object.assign(Error('fixture storage unavailable'),{code:'ENOSPC'});}
  return fs.rename(a,b);
 }}};
}
test('failed startup acknowledgement remains pending and can be retried without losing rollback history',async t=>{
 const f=await fixture(t),p=await packageFile(f,content(1)),disk=stateWrites(f);await f.service.stage(p.file,p.asset);
 const active=createContentService({...f.config,io:disk.io});await active.start();const before=await disk.read();
 disk.block(true);await assert.rejects(active.ready(),e=>e.code==='UPDATE_STATE_WRITE');
 assert.equal(active.status().pending,true);assert.equal(await disk.read(),before);
 disk.block(false);await active.ready();assert.equal(active.status().pending,false);assert.equal(active.status().canRollback,true);
 const reopened=createContentService(f.config);assert.equal((await reopened.start()).manifest.tag,p.asset.tag);
 await reopened.rollback();assert.equal((await createContentService(f.config).start()).manifest.tag,f.base.manifest.tag);
});
test('failed acknowledgement followed by a crash restores the prior version',async t=>{
 const f=await fixture(t),p=await packageFile(f,content(1)),disk=stateWrites(f);await f.service.stage(p.file,p.asset);
 const active=createContentService({...f.config,io:disk.io});await active.start();disk.block(true);
 await assert.rejects(active.ready(),e=>e.code==='UPDATE_STATE_WRITE');
 const reopened=createContentService(f.config);assert.equal((await reopened.start()).manifest.tag,f.base.manifest.tag);assert.equal(reopened.status().rolledBack,true);
});
test('failed manual rollback leaves both built-in and previous-slot recovery available for retry',async t=>{
 for(const count of [1,2]){
  const f=await fixture(t),disk=stateWrites(f);let active=f.service;
  for(let n=1;n<=count;n++){const p=await packageFile(f,content(n));await active.stage(p.file,p.asset);active=createContentService({...f.config,io:disk.io});await active.start();await active.ready();}
  const before=await disk.read();disk.block(true);await assert.rejects(active.rollback(),e=>e.code==='UPDATE_STATE_WRITE');
  assert.equal(active.status().canRollback,true);assert.equal(active.status().pending,false);assert.equal(await disk.read(),before);
  disk.block(false);await active.rollback();assert.equal((await createContentService(f.config).start()).manifest.tag,content(count-1).manifest.tag);
 }
});
test('a failed staging commit can reuse the fully verified slot on retry',async t=>{
 const f=await fixture(t),disk=stateWrites(f),active=createContentService({...f.config,io:disk.io});await active.start();
 const p=await packageFile(f,content(1)),before=await disk.read();disk.block(true);
 await assert.rejects(active.stage(p.file,p.asset),e=>e.code==='UPDATE_STATE_WRITE');assert.equal(active.status().pending,false);assert.equal(await disk.read(),before);
 disk.block(false);await active.stage(p.file,p.asset);assert.equal((await createContentService(f.config).start()).manifest.tag,p.asset.tag);
});
test('stable startup does not require rewriting the version state',async t=>{
 const f=await fixture(t),disk=stateWrites(f);disk.block(true);
 const active=createContentService({...f.config,io:disk.io});assert.equal((await active.start()).manifest.tag,f.base.manifest.tag);
 assert.equal(disk.count(),0);assert.equal(active.status().rolledBack,false);
});
test('unwritable recovery state opens verified content with package changes disabled instead of a restart loop',async t=>{
 const f=await fixture(t),disk=stateWrites(f),p=await packageFile(f,content(1));await f.service.stage(p.file,p.asset);
 const before=await disk.read();disk.block(true);const recovered=createContentService({...f.config,io:disk.io});
 assert.equal((await recovered.start()).manifest.tag,f.base.manifest.tag);
 assert.equal(recovered.status().pending,false);assert.equal(recovered.status().storageError,true);assert.equal(recovered.status().enabled,false);
 assert.equal(await disk.read(),before);await assert.rejects(recovered.stage(p.file,p.asset),e=>e.code==='UPDATE_STATE_WRITE');
 assert.equal(await fs.readFile(path.join(f.config.userData,'financial-data-test.txt'),'utf8'),'private record');
});
test('duplicate acknowledgements cannot replace the previous version while a state write is pending',async t=>{
 const f=await fixture(t),p=await packageFile(f,content(1));await f.service.stage(p.file,p.asset);
 let release,entered;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});let pause=false,writes=0;
 const io={...fs,rename:async(a,b)=>{if(pause&&b.endsWith('state.json')){writes++;entered();await gate;}return fs.rename(a,b);}};
 const active=createContentService({...f.config,io});await active.start();pause=true;
 const first=active.ready();await started;const second=active.ready();assert.equal(active.status().pending,true);release();await Promise.all([first,second]);
 assert.equal(writes,1);await active.rollback();assert.equal((await createContentService(f.config).start()).manifest.tag,f.base.manifest.tag);
});
test('updater chooses a compatible verified package, imports it, backs up, stages and requests relaunch without installer',async t=>{
 const f=await fixture(t),next=content(1),p=await packageFile(f,next,f.base),full=await packageFile(f,next);
 const tag=next.manifest.tag,prefix='SalaryMate_v5.3.1_content',name=prefix+'_from_v5.3.0-desktop.1.smupdate';
 const metadata={format:FORMAT,tag,runtimeId,contentHash:next.manifest.contentHash,schema:15,packages:[{name:prefix+'.smupdate',...full.asset,kind:'full'},{name,...p.asset,kind:'delta'}]};
 const metaBytes=Buffer.from(JSON.stringify(metadata)),asset=(name,b)=>({name,state:'uploaded',browser_download_url:REPO+'/releases/download/'+tag+'/'+name,size:b.length,digest:'sha256:'+hash(b)});
 const raw={tag_name:tag,draft:false,prerelease:false,html_url:REPO+'/releases/tag/'+tag,published_at:'2026-10-23T00:00:00Z',body:'test',assets:[asset(prefix+'.json',metaBytes),asset(prefix+'.smupdate',full.packed),asset(name,p.packed),asset('SalaryMate_v5.3.1_win_x64.exe',Buffer.alloc(5000))]};
 let relaunches=0,opens=0,saves=0,allowBackup=false;const urls=[];
 const chosen=f.service.choose(metadata,releaseInfo(raw,'win32','x64'));
 const imported=full; // A downloaded official full package is accepted even when delta is preferred.
 // Different gzip compression can make a tiny fixture delta larger than full.
 const service=createUpdateService({userData:f.config.userData,currentTag:f.base.manifest.tag,build:5030001,platform:'win32',arch:'x64',parent:()=>null,contentService:f.service,dialog:{showOpenDialog:async()=>({filePaths:[imported.file]}),showMessageBox:async()=>({response:1})},fetcher:async url=>{urls.push(url);return url===RELEASES?Response.json([raw]):new Response(metaBytes);},saveBackup:async()=>{saves++;return allowBackup?{ok:true,verified:true,fileName:'backup.json'}:{ok:false};},openPath:async()=>{opens++;},relaunch:()=>relaunches++});
 const checked=await service.check();assert.equal(checked.latest.delivery.kind,'content');assert.equal(checked.total,chosen.asset.size);
 assert.equal((await service.importPackage()).total,full.asset.size);
 const rechecked=await service.check();assert.equal(rechecked.downloaded.sha256,full.asset.sha256);assert.equal(rechecked.phase,'ready');
 await assert.rejects(service.install(backup),e=>e.code==='UPDATE_BACKUP_FAILED');assert.equal(f.service.status().pending,false);
 allowBackup=true;assert.equal((await service.install(backup)).phase,'restarting');await new Promise(r=>setImmediate(r));
 assert.equal(relaunches,1);assert.equal(opens,0);assert.equal(saves,2);assert.equal(urls.length,4);assert.ok(urls.every(u=>u.startsWith('https://')));
 const restarted=createContentService(f.config);assert.equal((await restarted.start()).manifest.tag,tag);await restarted.ready();
});
test('package discovery rejects untrusted descriptors and explicitly falls back for native changes',async t=>{
 const f=await fixture(t),target=content(1),p=await packageFile(f,target),name='SalaryMate_v5.3.1_content.smupdate';
 const metadata={format:FORMAT,tag:target.manifest.tag,runtimeId,contentHash:target.manifest.contentHash,schema:15,packages:[{name,size:p.asset.size,sha256:p.asset.sha256,kind:'full'}]};
 const release={tag:target.manifest.tag,contentAssets:[{name,...p.asset}]};
 assert.equal(f.service.choose(metadata,release).kind,'content');
 assert.equal(f.service.choose({...metadata,runtimeId:hash(Buffer.from('changed-native'))},release).reason,'runtime');
 assert.throws(()=>f.service.choose({...metadata,tag:'v9.0.0-desktop.1'},release));
 assert.throws(()=>f.service.choose(metadata,{...release,contentAssets:[{...release.contentAssets[0],sha256:hash(Buffer.from('other'))}]}));
});

