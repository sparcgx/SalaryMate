import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortableMarket} from '../server/portable-market.mjs';
const endpoint='https://salarymate.sparcgx2420.chatgpt.site/api/stocks/portable/quotes';
test('GitHub Pages public market preflight and POST preserve credential isolation',async()=>{
 let forwarded;
 const handler=createPortableMarket(async r=>{forwarded=r;return Response.json({ok:true});});
 const origin='https://sparcgx.github.io';
 const preflight=await handler(new Request(endpoint,{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type'}}));
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.equal(forwarded,undefined);
 const response=await handler(new Request(endpoint,{method:'POST',headers:{origin,authorization:'Bearer synthetic',cookie:'synthetic=1','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);assert.equal(response.headers.get('access-control-allow-credentials'),null);
 for(const name of ['origin','authorization','cookie'])assert.equal(forwarded.headers.get(name),null);
 assert.equal(new URL(forwarded.url).pathname,'/api/stocks/quotes');
});
test('Pages allowlist rejects lookalikes, foreign origins and unauthorized preflight headers',async()=>{
 let calls=0;const handler=createPortableMarket(async()=>{calls++;return new Response('ok');});
 for(const origin of ['https://other.github.io','http://sparcgx.github.io','https://sparcgx.github.io.evil.test','https://evil.test'])assert.equal((await handler(new Request(endpoint,{method:'POST',headers:{origin},body:'{}'}))).status,403);
 assert.equal((await handler(new Request(endpoint,{method:'OPTIONS',headers:{origin:'https://sparcgx.github.io','access-control-request-method':'POST','access-control-request-headers':'authorization'}}))).status,403);
 assert.equal(calls,0);
});
