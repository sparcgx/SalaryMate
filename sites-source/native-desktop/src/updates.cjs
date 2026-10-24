'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {writeVerified,VERIFY_CHUNK_BYTES}=require('./files.cjs');
const {checkedPayload,readBounded}=require('./backups.cjs');
const REPO='https://github.com/sparcgx/SalaryMate';
const RELEASES='https://api.github.com/repos/sparcgx/SalaryMate/releases?per_page=100';
const MAX_INSTALLER=512*1024*1024,MAX_METADATA=2*1024*1024;
const fault=code=>Object.assign(Error(code),{code});
function releaseAsset(raw,tag,name,max=MAX_INSTALLER){
 const candidates=Array.isArray(raw.assets)?raw.assets.filter(a=>a.name===name):[];
 if(candidates.length!==1)return null;
 const a=candidates[0],url=REPO+'/releases/download/'+tag+'/'+name;
 return a.state==='uploaded'&&a.browser_download_url===url&&Number.isSafeInteger(a.size)&&a.size>0&&a.size<=max&&/^sha256:[a-f0-9]{64}$/.test(a.digest||'')?{name,url,size:a.size,sha256:a.digest.slice(7)}:null;
}
function version(tag){
 const match=/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-desktop\.([1-9]\d*)$/.exec(tag||'');
 if(!match)return null;const parts=match.slice(1).map(Number);
 return parts.every(Number.isSafeInteger)?parts:null;
}
function compare(a,b){const x=version(a),y=version(b);if(!x||!y)throw fault('UPDATE_INVALID');for(let i=0;i<4;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;}
function releaseInfo(raw,platform,arch){
 const parts=version(raw?.tag_name);
 if(!parts||raw.draft!==false||raw.prerelease!==false||raw.html_url!==REPO+'/releases/tag/'+raw.tag_name||!Number.isFinite(Date.parse(raw.published_at)))return null;
 const os=platform==='win32'&&arch==='x64'?'win':platform==='darwin'&&arch==='arm64'?'mac':null;
 const name=os?`SalaryMate_v${parts.slice(0,3).join('.')}_${os}_${arch}.${os==='win'?'exe':'dmg'}`:null;
 const candidates=Array.isArray(raw.assets)?raw.assets.filter(a=>a.name===name):[];
 let asset=null;
 if(candidates.length===1){const a=candidates[0],url=REPO+'/releases/download/'+raw.tag_name+'/'+name;
  if(a.state==='uploaded'&&a.browser_download_url===url&&Number.isSafeInteger(a.size)&&a.size>0&&a.size<=MAX_INSTALLER&&/^sha256:[a-f0-9]{64}$/.test(a.digest||''))asset={name,url,size:a.size,sha256:a.digest.slice(7)};
 }
 const prefix=`SalaryMate_v${parts.slice(0,3).join('.')}_content`;
 const contentManifest=releaseAsset(raw,raw.tag_name,prefix+'.json',MAX_METADATA);
 const contentAssets=(raw.assets||[]).filter(a=>typeof a.name==='string'&&a.name.startsWith(prefix)&&/^SalaryMate_v\d+\.\d+\.\d+_content(?:_from_v\d+\.\d+\.\d+-desktop\.\d+)?\.smupdate$/.test(a.name)).map(a=>releaseAsset(raw,raw.tag_name,a.name,64*1024*1024)).filter(Boolean);
 return {tag:raw.tag_name,version:parts.slice(0,3).join('.'),sequence:parts[3],url:raw.html_url,publishedAt:raw.published_at,notes:String(raw.body||'').slice(0,16000),asset,contentManifest,contentAssets};
}
async function verifiedJson(asset,fetcher,signal){
 const response=await installerResponse(asset,fetcher,signal),chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>asset.size||size>MAX_METADATA)throw fault('UPDATE_INVALID');chunks.push(Buffer.from(chunk));}
 const bytes=Buffer.concat(chunks);
 if(size!==asset.size||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw fault('UPDATE_INTEGRITY');
 try{return JSON.parse(bytes.toString('utf8'));}catch{throw fault('UPDATE_INVALID');}
}
async function jsonResponse(response){
 const parts=[];let size=0;
 for await(const bytes of response.body){size+=bytes.length;if(size>MAX_METADATA)throw fault('UPDATE_INVALID');parts.push(Buffer.from(bytes));}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw fault('UPDATE_INVALID');}
}
function downloadURL(value,initial){
 let url;try{url=new URL(value);}catch{throw fault('UPDATE_INVALID');}
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash)throw fault('UPDATE_INVALID');
 if(value===initial)return value;
 if(!['release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(url.hostname))throw fault('UPDATE_INVALID');
 return url.href;
}
async function installerResponse(asset,fetcher,signal){
 let url=asset.url;
 for(let step=0;step<4;step++){
  downloadURL(url,asset.url);
  const response=await fetcher(url,{signal,redirect:'manual',credentials:'omit',headers:{'User-Agent':'SalaryMate-Desktop-Updater','Accept':'application/octet-stream'}});
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');await response.body?.cancel();
   if(!location)throw fault('UPDATE_DOWNLOAD_FAILED');url=downloadURL(new URL(location,url).href,asset.url);continue;
  }
  if(response.status!==200)throw fault('UPDATE_DOWNLOAD_FAILED');
  const size=response.headers.get('content-length');if(size!==null&&Number(size)!==asset.size){await response.body?.cancel();throw fault('UPDATE_INTEGRITY');}
  return response;
 }
 throw fault('UPDATE_DOWNLOAD_FAILED');
}
async function verifyInstaller(file,asset,{io=fs,signal,progress=()=>{}}={}){
 const before=await io.lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.size!==asset.size)throw fault('UPDATE_INTEGRITY');
 const reader=await io.open(file,'r');
 try{
  const stat=await reader.stat();if(!stat.isFile()||stat.ino!==before.ino||stat.size!==before.size)throw fault('UPDATE_INTEGRITY');
  const hash=createHash('sha256'),buffer=Buffer.allocUnsafe(VERIFY_CHUNK_BYTES);let size=0;
  for(;;){signal?.throwIfAborted();const r=await reader.read(buffer,0,buffer.length,size);if(!r.bytesRead)break;size+=r.bytesRead;if(size>asset.size)throw fault('UPDATE_INTEGRITY');hash.update(buffer.subarray(0,r.bytesRead));progress(size);}
  if(size!==asset.size||hash.digest('hex')!==asset.sha256)throw fault('UPDATE_INTEGRITY');
 }finally{await reader.close();}
}
async function downloadVerified(asset,destination,{fetcher=fetch,io=fs,controller=new AbortController(),progress=()=>{},stallMs=30000}={}){
 const temp=path.join(path.dirname(destination),'.'+path.basename(destination)+'.'+randomUUID()+'.download');let handle,reader,timer;
 const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(fault('UPDATE_TIMEOUT')),stallMs);};
 try{
  reset();const response=await installerResponse(asset,fetcher,controller.signal);controller.signal.throwIfAborted();
  if(!response.body)throw fault('UPDATE_DOWNLOAD_FAILED');reader=response.body.getReader();
  handle=await io.open(temp,'wx',0o600);let size=0;const hash=createHash('sha256');
  for(;;){controller.signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;reset();size+=chunk.value.length;
   if(size>asset.size)throw fault('UPDATE_INTEGRITY');await handle.writeFile(chunk.value);hash.update(chunk.value);progress('downloading',size);
  }
  if(size!==asset.size||hash.digest('hex')!==asset.sha256)throw fault('UPDATE_INTEGRITY');
  await handle.sync();await handle.close();handle=null;clearTimeout(timer);
  progress('verifying',0);await verifyInstaller(temp,asset,{io,signal:controller.signal,progress:n=>progress('verifying',n)});
  controller.signal.throwIfAborted();await io.rename(temp,destination);
  return {verified:true,fileName:path.basename(destination),size:asset.size,sha256:asset.sha256};
 }catch(e){if(controller.signal.aborted)throw controller.signal.reason;throw e;}
 finally{clearTimeout(timer);await reader?.cancel().catch(()=>{});await handle?.close().catch(()=>{});await io.unlink(temp).catch(()=>{});}
}
function createUpdateService({userData,currentTag,build,platform,arch,dialog,parent,fetcher=fetch,io=fs,notify=()=>{},saveBackup,openPath,showItemInFolder,quit,relaunch,contentService,now=()=>new Date()}){
 if(!version(currentTag))throw fault('UPDATE_INVALID');
 const cacheFile=path.join(userData,'desktop-update-cache.json');
 let cache=null,loaded=false,fresh=false,phase='idle',error='',checkedAt='',latest=null,downloaded=null,controller=null,busy=false,bytes=0,lastNotice=0;
 const selected=()=>latest?.delivery?.asset||latest?.asset;
 const state=()=>({current:{tag:currentTag,version:version(currentTag).slice(0,3).join('.'),sequence:version(currentTag)[3],build,platform,arch},phase,error,checkedAt,fresh,latest,content:contentService?.status(),
  available:Boolean(latest&&compare(latest.tag,currentTag)>0),canDownload:Boolean(fresh&&selected()&&compare(latest.tag,currentTag)>0),downloaded:downloaded?{fileName:path.basename(downloaded.file),tag:downloaded.tag,sha256:downloaded.asset.sha256,kind:downloaded.kind}:null,bytes,total:downloaded?.asset.size||selected()?.size||0});
 function send(force=false){if(force||Date.now()-lastNotice>150){lastNotice=Date.now();try{notify(state());}catch{}}}
 async function load(){if(loaded)return;loaded=true;try{
  const raw=JSON.parse((await readBounded(cacheFile,MAX_METADATA,io)).toString('utf8'));
  const info=releaseInfo(raw.release,platform,arch);
  if(raw.version===1&&info&&typeof raw.etag==='string'&&raw.etag.length<300&&Number.isFinite(Date.parse(raw.checkedAt))){cache=raw;latest=info;checkedAt=raw.checkedAt;}
 }catch{}}
 async function exclusive(work){if(busy)throw fault('DESKTOP_BUSY');busy=true;error='';try{await load();return await work();}catch(e){error=e.code==='UPDATE_CANCELLED'?'':e.code||'UPDATE_NETWORK';phase=e.code==='UPDATE_CANCELLED'?'cancelled':'error';send(true);throw e;}finally{busy=false;}}
 async function check(){return exclusive(async()=>{
  phase='checking';send(true);controller=new AbortController();const timer=setTimeout(()=>controller.abort(fault('UPDATE_TIMEOUT')),15000);
  try{
   const headers={'Accept':'application/vnd.github+json','User-Agent':'SalaryMate-Desktop-Updater','X-GitHub-Api-Version':'2022-11-28'};
   if(cache?.etag)headers['If-None-Match']=cache.etag;
   const response=await fetcher(RELEASES,{signal:controller.signal,redirect:'error',credentials:'omit',headers});
   let raw,etag=response.headers.get('etag')||'';
   if(response.status===304&&cache){raw=cache.release;etag=cache.etag;}
   else{
    if([403,429].includes(response.status))throw fault('UPDATE_RATE_LIMIT');if(response.status!==200)throw fault('UPDATE_UNAVAILABLE');
    const releases=await jsonResponse(response);if(!Array.isArray(releases)||releases.length>100)throw fault('UPDATE_INVALID');
    const candidates=releases.map(r=>({raw:r,info:releaseInfo(r,platform,arch)})).filter(r=>r.info).sort((a,b)=>compare(b.info.tag,a.info.tag));
    if(!candidates.length)throw fault('UPDATE_UNAVAILABLE');raw=candidates[0].raw;
   }
   const info=releaseInfo(raw,platform,arch);if(!info)throw fault('UPDATE_INVALID');
   if(contentService&&info.contentManifest){const metadata=await verifiedJson(info.contentManifest,fetcher,controller.signal);info.delivery=contentService.choose(metadata,info);}
   checkedAt=now().toISOString();latest=info;fresh=true;error='';phase='idle';
   const allowed=info.delivery?.kind==='content'?info.delivery.alternatives:[info.asset];
   if(downloaded&&(downloaded.tag!==info.tag||!allowed?.some(a=>a&&a.name===downloaded.asset.name&&a.sha256===downloaded.asset.sha256&&a.size===downloaded.asset.size)))downloaded=null;
   if(downloaded)phase='ready';
   const names=new Set([info.asset?.name,info.contentManifest?.name,...info.contentAssets.map(a=>a.name)]);
   cache={version:1,release:{tag_name:raw.tag_name,draft:false,prerelease:false,html_url:raw.html_url,published_at:raw.published_at,body:info.notes,assets:raw.assets?.filter(a=>names.has(a.name))||[]},etag:etag.slice(0,299),checkedAt};
   await io.mkdir(userData,{recursive:true});await writeVerified(cacheFile,Buffer.from(JSON.stringify(cache)),io).catch(()=>{});
   send(true);return state();
  }catch(e){fresh=false;if(controller.signal.aborted)throw controller.signal.reason;throw e;}
  finally{clearTimeout(timer);controller=null;}
 });}
 return {
  isBusy:()=>busy,state:async()=>{await load();return state();},check,
  cancel(){if(controller){controller.abort(fault('UPDATE_CANCELLED'));return {cancelRequested:true};}return {cancelRequested:false};},
  download:()=>exclusive(async()=>{
   if(!fresh||!selected()||compare(latest.tag,currentTag)<=0)throw fault('UPDATE_CHECK_REQUIRED');
   phase='choosing';send(true);const asset=selected(),tag=latest.tag;
   const choice=await dialog.showSaveDialog(parent(),{title:'下載 SalaryMate 更新 / Download update',defaultPath:asset.name,filters:[{name:'SalaryMate update',extensions:[path.extname(asset.name).slice(1)]}]});
   if(choice.canceled||!choice.filePath)throw fault('UPDATE_CANCELLED');
   if(path.extname(choice.filePath).toLowerCase()!==path.extname(asset.name))throw fault('UPDATE_EXTENSION');
   controller=new AbortController();bytes=0;
   try{await downloadVerified(asset,choice.filePath,{fetcher,io,controller,progress:(next,n)=>{phase=next;bytes=n;send();}});
    downloaded={file:choice.filePath,asset,tag,kind:asset.kind==='content'?'content':'installer'};phase='ready';send(true);return state();
   }finally{controller=null;}
  }),
  importPackage:()=>exclusive(async()=>{
   if(!fresh||!selected()||selected().kind!=='content'||compare(latest.tag,currentTag)<=0)throw fault('UPDATE_CHECK_REQUIRED');
   const choice=await dialog.showOpenDialog(parent(),{title:'匯入更新套件 / Import update package',properties:['openFile'],filters:[{name:'SalaryMate update',extensions:['smupdate']}]});
   if(choice.canceled||choice.filePaths?.length!==1)throw fault('UPDATE_CANCELLED');
   const file=choice.filePaths[0];if(path.extname(file).toLowerCase()!=='.smupdate')throw fault('UPDATE_EXTENSION');
   controller=new AbortController();phase='verifying';bytes=0;send(true);
   try{
    const payload=await readBounded(file,64*1024*1024,io);controller.signal.throwIfAborted();
    const checksum=createHash('sha256').update(payload).digest('hex');
    const asset=(latest.delivery.alternatives||[selected()]).find(a=>a.size===payload.length&&a.sha256===checksum);
    if(!asset)throw fault('UPDATE_INTEGRITY');bytes=payload.length;downloaded={file,asset,tag:latest.tag,kind:'content'};phase='ready';send(true);return state();
   }
   finally{controller=null;}
  }),
  rollback:data=>exclusive(async()=>{
   if(!contentService?.status().canRollback)throw fault('UPDATE_NO_ROLLBACK');checkedPayload(data);
   const answer=await dialog.showMessageBox(parent(),{type:'question',buttons:['取消 / Cancel','備份並還原 / Back up and restore'],defaultId:0,cancelId:0,message:'還原上一個程式版本？ / Restore the previous application version?',detail:'先保存備份，再重新啟動。只還原程式內容，薪資與投資紀錄保持不變。 / Save a backup, then restart. Only application content is restored; your records are retained.'});
   if(answer.response!==1)throw fault('UPDATE_CANCELLED');
   phase='backing-up';send(true);
   const saved=await saveBackup({data,fileName:'SalaryMate_before_rollback_'+now().toISOString().replace(/[:.]/g,'-')+'.json',encoding:'utf8'});
   if(!saved?.ok||!saved.verified)throw fault(saved?.code==='SAVE_CANCELLED'?'UPDATE_CANCELLED':'UPDATE_BACKUP_FAILED');
   await contentService.rollback();phase='restarting';send(true);setImmediate(relaunch);return state();
  }),
  reveal:()=>exclusive(async()=>{if(!downloaded)throw fault('UPDATE_NOT_DOWNLOADED');await showItemInFolder(downloaded.file);return state();}),
  install:data=>exclusive(async()=>{
   if(!downloaded)throw fault('UPDATE_NOT_DOWNLOADED');checkedPayload(data);
   if(downloaded.kind==='content'){
    const answer=await dialog.showMessageBox(parent(),{type:'question',buttons:['取消 / Cancel','備份並套用 / Back up and apply'],defaultId:0,cancelId:0,message:'套用更新套件並重新啟動？ / Apply the update package and restart?',detail:'先選擇私人位置保存備份。套件校驗完成後重新啟動，不重新下載主系統；新版無法啟動時會還原上一版。 / Choose a private backup location. After verification, restart using the new content without downloading the runtime. A failed startup restores the previous version.'});
    if(answer.response!==1)throw fault('UPDATE_CANCELLED');phase='backing-up';send(true);
    const saved=await saveBackup({data,fileName:'SalaryMate_before_update_'+now().toISOString().replace(/[:.]/g,'-')+'.json',encoding:'utf8'});
    if(!saved?.ok||!saved.verified)throw fault(saved?.code==='SAVE_CANCELLED'?'UPDATE_CANCELLED':'UPDATE_BACKUP_FAILED');
    phase='applying';send(true);await contentService.stage(downloaded.file,downloaded.asset);
    phase='restarting';send(true);setImmediate(relaunch);return {...state(),backup:saved.fileName};
   }
   const answer=await dialog.showMessageBox(parent(),{type:'question',buttons:['取消 / Cancel','備份並開啟 / Back up and open'],defaultId:0,cancelId:0,message:'備份後開啟更新安裝檔？ / Back up and open the update installer?',detail:'接著選擇私人備份位置。備份及安裝檔校驗成功後，開啟安裝檔並結束 SalaryMate。\nWindows 依安裝精靈操作；Mac 將 App 拖到 Applications 取代原程式。\n沒有發行者簽章／Apple 公證，請依系統提示核對來源。\nChoose a private backup location. After verification, the installer opens and SalaryMate quits. Follow the installer; on Mac replace the app in Applications. No publisher certificate or Apple notarization.'});
   if(answer.response!==1)throw fault('UPDATE_CANCELLED');
   phase='backing-up';send(true);
   const saved=await saveBackup({data,fileName:'SalaryMate_before_update_'+now().toISOString().replace(/[:.]/g,'-')+'.json',encoding:'utf8'});
   if(!saved?.ok||!saved.verified)throw fault(saved?.code==='SAVE_CANCELLED'?'UPDATE_CANCELLED':'UPDATE_BACKUP_FAILED');
   phase='verifying';bytes=0;send(true);controller=new AbortController();
   try{
    await verifyInstaller(downloaded.file,downloaded.asset,{io,signal:controller.signal,progress:n=>{bytes=n;send();}});controller.signal.throwIfAborted();
    const failure=await openPath(downloaded.file);if(failure)throw fault('UPDATE_OPEN_FAILED');
    phase='opened';send(true);setImmediate(quit);return {...state(),backup:saved.fileName};
   }finally{controller=null;}
  })
 };
}
module.exports={createUpdateService,releaseInfo,version,compare,downloadVerified,verifyInstaller,downloadURL,REPO,RELEASES,MAX_INSTALLER};
