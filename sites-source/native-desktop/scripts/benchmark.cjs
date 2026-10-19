'use strict';
// Reproducible Node-only file pipeline benchmark, never an Electron GUI/FPS test.
// Baseline: desktop.2 / 63f3d4ce2a199126e264a0d34aca888305c88f57.
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {spawnSync}=require('node:child_process');
const {writeVerified,VERIFY_CHUNK_BYTES}=require('../src/files.cjs');
const {checkedDocument}=require('../src/security.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function baselineWrite(destination,bytes){
 const temp=destination+'.'+randomUUID()+'.tmp';let handle;
 try{
  handle=await fs.open(temp,'wx',0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
  const readback=await fs.readFile(temp);
  if(readback.length!==bytes.length||hash(readback)!==hash(bytes))throw Error('Verification failed');
  await fs.rename(temp,destination);return {verified:true,size:bytes.length,sha256:hash(bytes)};
 }finally{await handle?.close().catch(()=>{});await fs.unlink(temp).catch(()=>{});}
}
function baselineBase64(bytes){
 const chunks=[];for(let offset=0;offset<bytes.length;offset+=24576)chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset,offset+24576))));
 return chunks.join('');
}
async function child(mode,miB){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'salarymate-bench-'));
 try{
  const bytes=new Uint8Array(miB*1024*1024).fill(37),started=performance.now();
  const data=mode==='before'?baselineBase64(bytes):bytes,encoded=performance.now();
  // Model the documented IPC structured clone, not a live Electron bridge.
  const input=structuredClone({fileName:'synthetic.json',encoding:mode==='before'?'base64':'bytes',data});
  const doc=checkedDocument(input),validated=performance.now();
  const result=await (mode==='before'?baselineWrite:writeVerified)(path.join(dir,'synthetic.json'),doc.bytes);
  const done=performance.now();if(!result.verified||result.size!==bytes.byteLength||result.sha256!==hash(bytes))throw Error('Wrong output');
  console.log(JSON.stringify({mode,miB,encodeMs:encoded-started,cloneAndValidateMs:validated-encoded,writeVerifyMs:done-validated,totalMs:done-started,maxRssKiB:process.resourceUsage().maxRSS,payloadBytes:typeof data==='string'?data.length:data.byteLength,readbackBufferBytes:mode==='before'?bytes.byteLength:VERIFY_CHUNK_BYTES}));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
async function main(){
 if(process.argv[2]==='--child')return child(process.argv[3],Number(process.argv[4]));
 const samples=[];
 for(const miB of [1,10,45])for(let repeat=0;repeat<3;repeat++)for(const mode of ['before','after']){
  const child=spawnSync(process.execPath,[__filename,'--child',mode,String(miB)],{encoding:'utf8',timeout:60000});
  if(child.status!==0)throw Error(child.stderr||'Benchmark child failed');
  samples.push({...JSON.parse(child.stdout),repeat});
 }
 const median=rows=>[...rows].sort((a,b)=>a-b)[Math.floor(rows.length/2)];
 const results=[];
 for(const miB of [1,10,45])for(const mode of ['before','after']){
  const rows=samples.filter(x=>x.miB===miB&&x.mode===mode),item={mode,miB};
  for(const key of ['encodeMs','cloneAndValidateMs','writeVerifyMs','totalMs','maxRssKiB','payloadBytes','readbackBufferBytes'])item[key]=Math.round(median(rows.map(x=>x[key]))*100)/100;
  results.push(item);
 }
 const report={scope:'Synthetic Node file pipeline, 3 isolated processes per size and variant; includes modeled structured clone and verified disk write. No Electron GUI, startup, FPS, installation or real-device acceptance claim.',platform:process.platform,arch:process.arch,node:process.version,desktopBuild:5000105,baselineCommit:'63f3d4ce2a199126e264a0d34aca888305c88f57',sourceCommit:process.env.GITHUB_SHA||'',results,samples};
 const file=path.resolve(process.argv[2]||'desktop-benchmark.json');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({file,results}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
