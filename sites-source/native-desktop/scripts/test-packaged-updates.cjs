'use strict';
// Run the shipped updater inside Electron's actual ASAR-aware filesystem.
// No windows, private profiles, network calls or installed-app changes.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
async function check(archive,report){
 assert.ok(process.versions.electron,'This regression must run inside Electron');
 const {createContentService,encodePackage,checkedManifest,contentHash,hash,verifyDirectory}=require(path.join(archive,'src/content-updates.cjs'));
 const {version}=require(path.join(archive,'src/updates.cjs'));
 const base=checkedManifest(JSON.parse(await fs.readFile(path.join(archive,'content-manifest.json'),'utf8')));
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'salarymate-packaged-update-'));
 try{
  const userData=path.join(temp,'synthetic-profile');await fs.mkdir(userData);
  const record=path.join(userData,'synthetic-record.json'),original=JSON.stringify({testOnly:true,hours:5.5});await fs.writeFile(record,original);
  const config={userData,baseDirectory:archive,runtimeId:base.runtimeId};
  const entries=new Map();for(const f of base.files)entries.set(f.path,await fs.readFile(path.join(archive,f.path)));
  const parts=version(base.tag),sequence=parts[3]+1,tag=`v${parts.slice(0,3).join('.')}-desktop.${sequence}`;
  entries.set('www/startup.js',Buffer.concat([entries.get('www/startup.js'),Buffer.from('\n/* Synthetic packaged update regression. */\n')]));
  const desktop=JSON.parse(entries.get('www/desktop-asset-manifest.json'));desktop.desktopRelease=sequence;desktop.desktopBuild=base.build+1;
  entries.set('www/desktop-asset-manifest.json',Buffer.from(JSON.stringify(desktop)));
  const files=[...entries].map(([path,b])=>({path,bytes:b.length,sha256:hash(b)})).sort((a,b)=>a.path<b.path?-1:1);
  const target=checkedManifest({...base,tag,build:base.build+1,files,contentHash:contentHash(files)});
  const changed=new Map([...entries].filter(([p,b])=>base.files.find(f=>f.path===p)?.sha256!==hash(b)));
  assert.ok(changed.size<files.length);
  let active=createContentService(config);await active.start();
  const checks=[];
  for(const delta of [true,false]){
   const packed=encodePackage(target,delta?changed:entries,delta?{tag:base.tag,contentHash:base.contentHash}:null);
   const file=path.join(temp,delta?'delta.smupdate':'full.smupdate');await fs.writeFile(file,packed);
   const asset={tag,runtimeId:base.runtimeId,contentHash:target.contentHash,size:packed.length,sha256:hash(packed),delta,baseTag:delta?base.tag:null,baseContentHash:delta?base.contentHash:null};
   await active.stage(file,asset);
   const next=createContentService(config),loaded=await next.start();assert.equal(loaded.manifest.tag,tag);await verifyDirectory(loaded.directory,target);
   await next.ready();assert.equal(next.status().pending,false);assert.equal(next.status().canRollback,true);
   assert.equal(await fs.readFile(record,'utf8'),original);
   await next.rollback();active=createContentService(config);assert.equal((await active.start()).manifest.tag,base.tag);assert.equal(await fs.readFile(record,'utf8'),original);
   checks.push({delivery:delta?'delta':'full',files:files.length,reusedFromArchive:delta?files.length-changed.size:0,startupAcknowledgement:true,rollback:true,syntheticRecordRetained:true});
  }
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(archive,'content-manifest.json'),'utf8')),base);
  const result={platform:process.platform,architecture:process.arch,electron:process.versions.electron,baseTag:base.tag,runtimeId:base.runtimeId,sourceCommit:process.env.GITHUB_SHA||'',checks,guiTested:false};
  await fs.writeFile(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
async function main(){
 if(process.argv[2]==='--child')return check(path.resolve(process.argv[3]),path.resolve(process.argv[4]));
 const arch=process.argv[2];assert.ok(['x64','arm64'].includes(arch));
 const root=path.resolve(__dirname,'..'),win=process.platform==='win32';
 const dir=win?path.join(root,'release/win-unpacked'):path.join(root,'release',arch==='arm64'?'mac-arm64':'mac','SalaryMate.app/Contents');
 const archive=path.join(dir,win?'resources':'Resources','app.asar'),executable=path.join(dir,win?'SalaryMate.exe':'MacOS/SalaryMate');
 const report=path.join(root,'release',`packaged-update-${process.platform}-${arch}.json`);
 const {spawnSync}=require('node:child_process');
 const child=spawnSync(executable,[__filename,'--child',archive,report],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:1024*1024});
 if(child.stdout)process.stdout.write(child.stdout);if(child.stderr)process.stderr.write(child.stderr);
 assert.equal(child.status,0,child.error?.message||'Packaged updater regression failed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
