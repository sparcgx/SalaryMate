// Read-only public market data for the downloaded file. No account or payroll APIs.
export function createPortableMarket(handleMarket) {
  const routes=new Map([
    ['/api/stocks/portable/catalog','/api/stocks/catalog'],
    ['/api/stocks/portable/quotes','/api/stocks/quotes'],
    ['/api/stocks/portable/nav','/api/stocks/nav'],
    ['/api/stocks/portable/lookup','/api/stocks/lookup'],
    ['/api/stocks/portable/dividends','/api/stocks/dividends']
  ]);
  return async request=>{
    const url=new URL(request.url),target=routes.get(url.pathname),origin=request.headers.get('origin');
    if(!target)return new Response('Not found',{status:404});
    // Local HTML files have an opaque origin. Other websites keep the original restriction.
    if(origin!=='null'&&origin!==url.origin)return new Response('Origin not allowed',{status:403});
    const cors={'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type','access-control-max-age':'3600','vary':'Origin','cache-control':'no-store','x-content-type-options':'nosniff'};
    if(request.method==='OPTIONS'){
      const method=request.headers.get('access-control-request-method');
      const headers=(request.headers.get('access-control-request-headers')||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
      return new Response(null,{status:method==='POST'&&headers.every(x=>x==='content-type')?204:403,headers:cors});
    }
    if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:cors});
    const headers=new Headers(request.headers);headers.delete('origin');headers.delete('authorization');headers.delete('cookie');
    const forwarded=new Request(new URL(target,url.origin),{method:'POST',headers,body:request.body,duplex:'half'});
    const result=await handleMarket(forwarded),responseHeaders=new Headers(result.headers);
    for(const [key,value] of Object.entries(cors))responseHeaders.set(key,value);
    return new Response(result.body,{status:result.status,headers:responseHeaders});
  };
}
