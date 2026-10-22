'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {FORMAT,hash,contentHash,checkedManifest,encodePackage,decodePackage,verifyDirectory}=require('../src/content-updates.cjs');
const {version,compare}=require('../src/updates.cjs');
async function buildContent(root){
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')),files=[],entries=new Map(),native=[];
 async function walk(dir,prefix){
  for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:1)){
   const key=prefix+e.name,full=path.join(dir,e.name);
   if(e.isDirectory())await walk(full,key+'/');
   else if(e.isFile()){const bytes=await fs.readFile(full);entries.set(key,bytes);files.push({path:key,bytes:bytes.length,sha256:hash(bytes)});}
   else throw Error('Non-regular content: '+key);
  }
 }
 for(const name of (await fs.readdir(path.join(root,'src'))).sort()){
  if(!name.endsWith('.cjs'))throw Error('Unexpected native file');
  native.push([name,hash(Buffer.from((await fs.readFile(path.join(root,'src',name),'utf8')).replace(/\r\n?/g,'\n')))]);
 }
 // Compatibility covers the trusted loader, native bridge and exact Electron
 // runtime. Web/API updates may not silently replace native capabilities.
 const runtimeId=hash(Buffer.from(JSON.stringify({format:FORMAT,electron:pkg.devDependencies.electron,schema:15,native})));
 await walk(path.join(root,'api'),'api/');await walk(path.join(root,'www'),'www/');
 files.sort((a,b)=>a.path<b.path?-1:1);
 const tag='v'+pkg.version+'-desktop.'+pkg.desktopRelease;
 const manifest=checkedManifest({format:FORMAT,tag,build:Number(pkg.build.buildVersion),runtimeId,schema:15,contentHash:contentHash(files),files});
 await verifyDirectory(root,manifest);
 await fs.writeFile(path.join(root,'content-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const out=path.join(root,'release');await fs.mkdir(out,{recursive:true});
 const prefix='SalaryMate_v'+pkg.version+'_content',packages=[];
 async function write(name,bytes,extra){await fs.writeFile(path.join(out,name),bytes);packages.push({name,size:bytes.length,sha256:hash(bytes),...extra});}
 const full=encodePackage(manifest,entries);
 await write(prefix+'.smupdate',full,{kind:'full'});
 const baseFile=process.env.SALARYMATE_CONTENT_BASE;
 if(baseFile){
  let baseBytes;try{baseBytes=await fs.readFile(baseFile);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(baseBytes){
   const previous=decodePackage(baseBytes),old=previous.manifest;
   if(previous.base)throw Error('Baseline must be a full content package');
   if(old.runtimeId===runtimeId&&compare(old.tag,tag)<0){
    const changed=new Map([...entries].filter(([key,b])=>!old.files.some(f=>f.path===key&&f.bytes===b.length&&f.sha256===hash(b))));
    const delta=encodePackage(manifest,changed,{tag:old.tag,contentHash:old.contentHash});
    await write(prefix+'_from_'+old.tag+'.smupdate',delta,{kind:'delta',baseTag:old.tag,baseContentHash:old.contentHash});
   }
  }
 }
 const metadata={format:FORMAT,tag,version:version(tag).slice(0,3).join('.'),runtimeId,contentHash:manifest.contentHash,schema:15,packages};
 await fs.writeFile(path.join(out,prefix+'.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log(JSON.stringify({contentUpdate:tag,runtimeId,packages:packages.map(p=>({name:p.name,bytes:p.size,kind:p.kind}))}));
 return {manifest,metadata};
}
module.exports={buildContent};
if(require.main===module)buildContent(path.resolve(__dirname,'..')).catch(e=>{console.error(e);process.exitCode=1;});

