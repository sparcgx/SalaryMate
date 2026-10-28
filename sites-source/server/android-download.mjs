// Public release bytes are streamed with backpressure; never buffered in the Worker.
export const androidRelease=Object.freeze({
  version:'5.3.2',name:'SalaryMate_v5.3.2_Android.apk',bytes:47925028,
  sha256:'628e131eca4dddbe4d77dddd6faa0bc62f94ac62bfa6eb08608f737ca1786d85',
  parts:Object.freeze([...Array(11).fill(4194304),1787684])
});
const previousAndroidRelease=Object.freeze({
  version:'5.0.0',
  name:'SalaryMate_v5.0.0_Android.apk',bytes:47842699,
  sha256:'fb2abe5c70e5e3672a0ea7d12549ab45b4e6a4325fbbe390e0c8b421c74601b9',
  parts:[16777216,16777216,14288267]
});
const releases=[androidRelease,previousAndroidRelease];
const releaseForPath=pathname=>releases.find(release=>pathname==='/downloads/'+release.name);
export const isAndroidDownloadPath=pathname=>Boolean(releaseForPath(pathname));
export async function androidDownload(request,fetcher=fetch){
  const release=releaseForPath(new URL(request.url).pathname);
  if(!release)return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const headers={'content-type':'application/vnd.android.package-archive',
    'content-disposition':'attachment; filename="'+release.name+'"',
    'content-length':String(release.bytes),'cache-control':'no-store',
    'x-content-type-options':'nosniff','x-checksum-sha256':release.sha256};
  if(request.method==='HEAD')return new Response(null,{headers});
  const abort=new AbortController();let reader;
  const source=async index=>{
    const reply=await fetcher('https://sparcgx.github.io/SalaryMate/apk/data/v'+release.version+'-'+String(index).padStart(2,'0')+'.bin',{signal:abort.signal});
    if(!reply.ok||!reply.body)throw new Error('Release download unavailable');
    return reply;
  };
  let first;
  try{first=await source(0);}catch{return new Response('Download temporarily unavailable; please retry.',{status:502,headers:{'cache-control':'no-store'}});}
  let index=0,received=0;reader=first.body.getReader();
  const body=new ReadableStream({async pull(controller){
    try{
      for(;;){
        const item=await reader.read();
        if(!item.done){received+=item.value.byteLength;if(received>release.parts[index])throw new Error('Invalid release size');controller.enqueue(item.value);return;}
        if(received!==release.parts[index])throw new Error('Incomplete release');
        reader.releaseLock();reader=null;index++;received=0;
        if(index===release.parts.length){controller.close();return;}
        reader=(await source(index)).body.getReader();
      }
    }catch(error){abort.abort();await reader?.cancel().catch(()=>{});controller.error(error);}
  },async cancel(){abort.abort();await reader?.cancel().catch(()=>{});}});
  return new Response(body,{headers});
}
