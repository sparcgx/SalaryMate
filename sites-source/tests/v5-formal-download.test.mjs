import test from 'node:test';
import assert from 'node:assert/strict';
import {androidDownload,androidRelease,isAndroidDownloadPath} from '../server/android-download.mjs';

const request=method=>new Request('https://salarymate.sparcgx2420.chatgpt.site/downloads/'+androidRelease.name,{method});
test('formal APK HEAD and unsupported methods do not download release bytes',async()=>{
  const never=()=>{throw Error('unexpected network');};
  const head=await androidDownload(request('HEAD'),never);
  assert.equal(head.headers.get('content-length'),String(androidRelease.bytes));
  assert.equal(head.headers.get('x-checksum-sha256'),androidRelease.sha256);
  assert.equal(await head.text(),'');
  assert.equal((await androidDownload(request('POST'),never)).status,405);
});
test('formal APK streams the exact ordered part lengths without preloading later parts',async()=>{
  const calls=[];
  const response=await androidDownload(request('GET'),async url=>{
    assert.match(url,/\/apk\/data\/v5\.3\.2-\d+\.bin$/);
    const index=Number(url.match(/-(\d+)\.bin$/)[1]);calls.push(index);
    let left=androidRelease.parts[index];
    return new Response(new ReadableStream({pull(c){if(!left){c.close();return;}const size=Math.min(left,65536);left-=size;c.enqueue(new Uint8Array(size).fill(index+1));}}));
  });
  assert.deepEqual(calls,[0]);
  assert.match(response.headers.get('content-disposition'),/\.apk/);
  let total=0,index=0,part=0;
  for await(const bytes of response.body){
    assert.equal(bytes[0],index+1);assert.equal(bytes.at(-1),index+1);
    total+=bytes.length;part+=bytes.length;
    if(part===androidRelease.parts[index]){index++;part=0;}
  }
  assert.equal(total,androidRelease.bytes);assert.deepEqual(calls,androidRelease.parts.map((_,i)=>i));
});

test('versioned APK links retain their own identity and unknown versions cannot fetch data',async()=>{
  const oldRequest=new Request('https://salarymate.sparcgx2420.chatgpt.site/downloads/SalaryMate_v5.0.0_Android.apk',{method:'HEAD'});
  const never=()=>{throw Error('unexpected network');};
  const head=await androidDownload(oldRequest,never);
  assert.equal(head.headers.get('content-length'),'47842699');
  assert.match(head.headers.get('content-disposition'),/SalaryMate_v5\.0\.0_Android\.apk/);
  assert.equal(head.headers.get('x-checksum-sha256'),'fb2abe5c70e5e3672a0ea7d12549ab45b4e6a4325fbbe390e0c8b421c74601b9');
  assert.equal(isAndroidDownloadPath('/downloads/'+androidRelease.name),true);
  assert.equal(isAndroidDownloadPath(new URL(oldRequest.url).pathname),true);
  for(const path of ['/downloads/SalaryMate_v9.9.9_Android.apk','/downloads/../apk/data/v5.3.2-00.bin','/downloads/'+androidRelease.name+'/']){
    assert.equal(isAndroidDownloadPath(path),false);
    assert.equal((await androidDownload(new Request('https://salarymate.sparcgx2420.chatgpt.site'+path),never)).status,404);
  }
});
test('formal APK rejects unavailable and truncated releases',async()=>{
  assert.equal((await androidDownload(request('GET'),async()=>new Response('',{status:404}))).status,502);
  const response=await androidDownload(request('GET'),async()=>new Response(new Uint8Array(8)));
  await assert.rejects(response.arrayBuffer(),/Incomplete release/);
});
test('formal APK cancellation aborts its transfer without loading another part',async()=>{
  let calls=0,signal,cancelled=0;
  const response=await androidDownload(request('GET'),async(url,options)=>{
    calls++;signal=options.signal;
    return new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(32));},cancel(){cancelled++;}}));
  });
  const reader=response.body.getReader();await reader.read();await reader.cancel();
  assert.equal(calls,1);assert.equal(signal.aborted,true);assert.equal(cancelled,1);
});
