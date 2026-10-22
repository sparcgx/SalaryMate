'use strict';
// Versioned web/API content lives beside the profile, never inside the signed app.
// Only release-bound, SHA-256 verified packages reach stage(); no archive paths
// are extracted and no native executable, preload or main-process file is replaced.
const fs=require('node:fs/promises'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {gunzipSync,gzipSync}=require('node:zlib');
const {readBounded}=require('./backups.cjs');
const {writeVerified}=require('./files.cjs');
const {version,compare}=require('./updates.cjs');
const FORMAT='salarymate-content-v1',MAX_PACKAGE=64*1024*1024,MAX_CONTENT=128*1024*1024,MAX_JSON=192*1024*1024;
const fault=code=>Object.assign(Error(code),{code});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const required=['www/index.html','www/startup.js','www/desktop-runtime.js','www/desktop-features.js','www/desktop-updates.js','www/desktop-asset-manifest.json','api/stock-market.mjs','api/reference-api.mjs'];
function safePath(value){
 if(typeof value!=='string'||value.length>220||!/^(www|api)\/[A-Za-z0-9_.\/-]+$/.test(value))return false;
 return value.split('/').every(p=>p!=='.'&&p!=='..'&&p.length&& !/[. ]$/.test(p)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p));
}
function contentHash(files){return hash(Buffer.from(JSON.stringify(files.map(f=>({path:f.path,bytes:f.bytes,sha256:f.sha256})))));}
function checkedManifest(raw){
 if(raw?.format!==FORMAT||!version(raw.tag)||!hex(raw.runtimeId)||!hex(raw.contentHash)||raw.schema!==15||!Number.isSafeInteger(raw.build)||raw.build<1||!Array.isArray(raw.files)||raw.files.length>2000)throw fault('UPDATE_PACKAGE_INVALID');
 const seen=new Set();let total=0,previous='';
 const files=raw.files.map(f=>{
  if(!safePath(f?.path)||f.path<=previous||seen.has(f.path.toLowerCase())||!Number.isSafeInteger(f.bytes)||f.bytes<0||f.bytes>64*1024*1024||!hex(f.sha256))throw fault('UPDATE_PACKAGE_INVALID');
  previous=f.path;seen.add(f.path.toLowerCase());total+=f.bytes;
  return {path:f.path,bytes:f.bytes,sha256:f.sha256};
 });
 if(total>MAX_CONTENT||required.some(p=>!seen.has(p))||files.some(f=>f.path.split('/').slice(0,-1).some((_v,i,a)=>seen.has(a.slice(0,i+1).join('/').toLowerCase())))||contentHash(files)!==raw.contentHash)throw fault('UPDATE_PACKAGE_INVALID');
 return {format:FORMAT,tag:raw.tag,build:raw.build,runtimeId:raw.runtimeId,schema:15,contentHash:raw.contentHash,files};
}
function decodePackage(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_PACKAGE)throw fault('UPDATE_PACKAGE_INVALID');
 let raw;try{raw=JSON.parse(gunzipSync(bytes,{maxOutputLength:MAX_JSON}).toString('utf8'));}catch{throw fault('UPDATE_PACKAGE_INVALID');}
 const manifest=checkedManifest(raw.manifest),base=raw.base;
 if(base!==null&&(!version(base?.tag)||!hex(base?.contentHash)||compare(base.tag,manifest.tag)>=0))throw fault('UPDATE_PACKAGE_INVALID');
 if(!Array.isArray(raw.entries)||raw.entries.length>manifest.files.length)throw fault('UPDATE_PACKAGE_INVALID');
 const files=new Map(manifest.files.map(f=>[f.path,f])),entries=new Map();
 for(const e of raw.entries){
  const f=files.get(e?.path);
  if(!f||entries.has(e.path)||typeof e.data!=='string'||e.data.length!==4*Math.ceil(f.bytes/3))throw fault('UPDATE_PACKAGE_INVALID');
  const b=Buffer.from(e.data,'base64');
  if(b.toString('base64')!==e.data||b.length!==f.bytes||hash(b)!==f.sha256)throw fault('UPDATE_INTEGRITY');
  entries.set(e.path,b);
 }
 if(base===null&&entries.size!==files.size)throw fault('UPDATE_PACKAGE_INVALID');
 return {manifest,base,entries};
}
function encodePackage(manifest,entries,base=null){
 checkedManifest(manifest);
 const bytes=gzipSync(Buffer.from(JSON.stringify({manifest,base,entries:[...entries].map(([path,data])=>({path,data:Buffer.from(data).toString('base64')}))})),{level:9});
 if(bytes.length>MAX_PACKAGE)throw fault('UPDATE_PACKAGE_INVALID');
 decodePackage(bytes);return bytes;
}
async function regularRead(directory,key,max,io=fs){
 const parts=key.split('/');let full=directory;
 for(let i=0;i<parts.length;i++){
  full=path.join(full,parts[i]);const s=await io.lstat(full);
  if(s.isSymbolicLink()||(i<parts.length-1?!s.isDirectory():!s.isFile()))throw fault('UPDATE_INTEGRITY');
 }
 return readBounded(full,max,io);
}
async function verifyDirectory(directory,manifest,io=fs){
 for(const f of manifest.files){const b=await regularRead(directory,f.path,Math.max(1,f.bytes),io);if(b.length!==f.bytes||hash(b)!==f.sha256)throw fault('UPDATE_INTEGRITY');}
 const desktop=JSON.parse((await regularRead(directory,'www/desktop-asset-manifest.json',2*1024*1024,io)).toString('utf8'));
 if(desktop.version!==version(manifest.tag).slice(0,3).join('.')||desktop.desktopRelease!==version(manifest.tag)[3]||Number(desktop.desktopBuild)!==manifest.build||desktop.schema!==15||desktop.stateKey!=='salarymate_v5_full_state')throw fault('UPDATE_PACKAGE_INVALID');
}
function createContentService({userData,baseDirectory,runtimeId,io=fs}){
 if(!hex(runtimeId))throw fault('UPDATE_PACKAGE_INVALID');
 const root=path.join(userData,'content-updates'),stateFile=path.join(root,'state.json');
 let record={format:1,current:null,previous:null,pending:null},current,base,rolledBack=false;
 const ref=m=>({slot:version(m.tag).join('-')+'-'+m.contentHash,tag:m.tag,contentHash:m.contentHash});
 const validRef=r=>r&&typeof r.slot==='string'&&version(r.tag)&&hex(r.contentHash)&&r.slot===ref({tag:r.tag,contentHash:r.contentHash}).slot;
 async function ensureRoot(){
  await io.mkdir(root,{recursive:true});
  const s=await io.lstat(root);if(!s.isDirectory()||s.isSymbolicLink())throw fault('UPDATE_INTEGRITY');
 }
 const save=()=>writeVerified(stateFile,Buffer.from(JSON.stringify(record)),io);
 async function readRef(r){
  if(r===null)return base;
  if(!validRef(r))throw fault('UPDATE_PACKAGE_INVALID');
  const directory=path.join(root,r.slot),stat=await io.lstat(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw fault('UPDATE_INTEGRITY');
  const manifest=checkedManifest(JSON.parse((await regularRead(directory,'content-manifest.json',2*1024*1024,io)).toString('utf8')));
  if(manifest.runtimeId!==runtimeId||manifest.tag!==r.tag||manifest.contentHash!==r.contentHash||compare(manifest.tag,base.manifest.tag)<0)throw fault('UPDATE_PACKAGE_INCOMPATIBLE');
  await verifyDirectory(directory,manifest,io);return {directory,manifest};
 }
 async function start(){
  base={directory:baseDirectory,manifest:checkedManifest(JSON.parse((await io.readFile(path.join(baseDirectory,'content-manifest.json'))).toString('utf8')))};
  if(base.manifest.runtimeId!==runtimeId)throw fault('UPDATE_PACKAGE_INCOMPATIBLE');
  await ensureRoot();
  try{
   const raw=JSON.parse((await readBounded(stateFile,16384,io)).toString('utf8'));
   if(raw.format!==1||![raw.current,raw.previous].every(r=>r===null||validRef(r))||(raw.pending!==null&&(!validRef(raw.pending?.target)||typeof raw.pending?.attempted!=='boolean')))throw Error('state');
   record=raw;
  }catch(e){if(e.code!=='ENOENT')rolledBack=true;}
  if(record.pending){
   const pending=record.pending;
   if(!pending.attempted){
    try{current=await readRef(pending.target);record.pending.attempted=true;await save();return current;}catch{rolledBack=true;}
   }else rolledBack=true;
   record.pending=null;
  }
  try{current=await readRef(record.current);}
  catch{
   rolledBack=true;
   try{current=await readRef(record.previous);record.current=record.previous;}catch{current=base;record.current=null;}
   record.previous=null;
  }
  await save();return current;
 }
 async function ready(){
  if(record.pending&&current?.manifest.contentHash===record.pending.target.contentHash){
   record.previous=record.current;record.current=record.pending.target;record.pending=null;await save();
  }
  return status();
 }
 function status(){return {enabled:true,runtimeId,tag:current?.manifest.tag,contentHash:current?.manifest.contentHash,baseTag:base?.manifest.tag,pending:Boolean(record.pending),canRollback:Boolean(record.current),rolledBack};}
 function choose(metadata,release){
  if(metadata?.format!==FORMAT||metadata.tag!==release.tag||!hex(metadata.runtimeId)||!Array.isArray(metadata.packages)||metadata.packages.length>20)throw fault('UPDATE_PACKAGE_INVALID');
  if(metadata.runtimeId!==runtimeId)return {kind:'installer',reason:'runtime'};
  if(!hex(metadata.contentHash)||metadata.schema!==15)throw fault('UPDATE_PACKAGE_INVALID');
  const choices=metadata.packages.map(p=>{
   const asset=release.contentAssets?.find(a=>a.name===p.name);
   if(!asset||asset.sha256!==p.sha256||asset.size!==p.size||asset.size>MAX_PACKAGE||!['full','delta'].includes(p.kind)||p.kind==='delta'&&(!version(p.baseTag)||!hex(p.baseContentHash)))throw fault('UPDATE_PACKAGE_INVALID');
   return {...asset,kind:'content',delta:p.kind==='delta',tag:metadata.tag,contentHash:metadata.contentHash,runtimeId,baseTag:p.baseTag||null,baseContentHash:p.baseContentHash||null};
  });
  const full=choices.filter(a=>!a.delta),delta=choices.filter(a=>a.delta&&a.baseTag===current.manifest.tag&&a.baseContentHash===current.manifest.contentHash);
  if(full.length!==1||delta.length>1)throw fault('UPDATE_PACKAGE_INVALID');
  return {kind:'content',asset:delta[0]&&delta[0].size<full[0].size?delta[0]:full[0],alternatives:[...full,...delta]};
 }
 async function stage(file,asset){
  if(!current||record.pending)throw fault('DESKTOP_BUSY');
  const packed=await readBounded(file,MAX_PACKAGE,io);
  if(packed.length!==asset.size||hash(packed)!==asset.sha256)throw fault('UPDATE_INTEGRITY');
  const data=decodePackage(packed),m=data.manifest;
  if(m.runtimeId!==runtimeId||m.tag!==asset.tag||m.contentHash!==asset.contentHash||compare(m.tag,current.manifest.tag)<=0)throw fault('UPDATE_PACKAGE_INCOMPATIBLE');
  if(Boolean(data.base)!==Boolean(asset.delta)||data.base&&(data.base.tag!==current.manifest.tag||data.base.contentHash!==current.manifest.contentHash||data.base.tag!==asset.baseTag||data.base.contentHash!==asset.baseContentHash))throw fault('UPDATE_PACKAGE_INCOMPATIBLE');
  const target=ref(m),destination=path.join(root,target.slot),staging=path.join(root,'.stage-'+randomUUID());
  await ensureRoot();await io.mkdir(staging);
  try{
   for(const f of m.files){
    let bytes=data.entries.get(f.path);
    if(!bytes){
     const old=current.manifest.files.find(x=>x.path===f.path&&x.bytes===f.bytes&&x.sha256===f.sha256);
     if(!data.base||!old)throw fault('UPDATE_INTEGRITY');
     bytes=await regularRead(current.directory,f.path,Math.max(1,f.bytes),io);
    }
    if(bytes.length!==f.bytes||hash(bytes)!==f.sha256)throw fault('UPDATE_INTEGRITY');
    const dest=path.join(staging,f.path);await io.mkdir(path.dirname(dest),{recursive:true});await writeVerified(dest,bytes,io);
   }
   await writeVerified(path.join(staging,'content-manifest.json'),Buffer.from(JSON.stringify(m)),io);
   await verifyDirectory(staging,m,io);
   // Existing immutable slots are reused only after a complete verification.
   try{await io.rename(staging,destination);}
   catch(e){if(!['EEXIST','ENOTEMPTY','EPERM'].includes(e.code))throw e;await readRef(target);}
   record.pending={target,attempted:false};
   try{await save();}catch(e){record.pending=null;throw e;}
   return status();
  }finally{
   // Only the freshly generated staging directory can be removed.
   if(path.dirname(staging)!==root||!path.basename(staging).startsWith('.stage-'))throw fault('UPDATE_INTEGRITY');
   await io.rm(staging,{recursive:true,force:true}).catch(()=>{});
  }
 }
 async function rollback(){
  if(!record.current||record.pending)throw fault('UPDATE_NO_ROLLBACK');
  await readRef(record.previous);record.pending={target:record.previous,attempted:false};
  // Built-in content is represented by null; restore it without a trial slot.
  if(record.previous===null){record.current=null;record.previous=null;record.pending=null;}
  await save();return status();
 }
 return {start,ready,status,choose,stage,rollback};
}
module.exports={FORMAT,MAX_PACKAGE,MAX_CONTENT,MAX_JSON,hash,safePath,contentHash,checkedManifest,decodePackage,encodePackage,regularRead,verifyDirectory,createContentService};

