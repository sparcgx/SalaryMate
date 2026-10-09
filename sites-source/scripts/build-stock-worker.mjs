import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {salaryMateCsp} from '../server/security-policy.mjs';
import './build-locales.mjs';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist'),files={};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
async function scan(dir,prefix='') {for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name==='server'||entry.name.startsWith('.'))continue;const rel=prefix+'/'+entry.name,full=path.join(dir,entry.name);if(entry.isDirectory())await scan(full,rel);else{const bytes=await readFile(full);files[rel]={body:bytes.toString('base64'),type:types[path.extname(entry.name)]||'application/octet-stream'};}}}
await scan(dist);
const devBase='/dev/v5.0.0-dev.2/';
const devHtml=await readFile(path.join(dist,devBase,'index.html'),'utf8');
const versionedUrls=[...devHtml.matchAll(/(?:href|src)="\.\/([^"?]+\.(?:js|css))\?v=([^"]+)"/g)].map(match=>devBase+match[1]+'?v='+match[2]);
const swSource=await readFile(path.join(dist,devBase,'sw.js'),'utf8');
const optionalMatch=swSource.match(/const OPTIONAL=(\[[^\n;]*\]);/);
if(!optionalMatch)throw Error('Missing optional asset manifest');
for(const asset of JSON.parse(optionalMatch[1])){if(!/^\.\/[a-z-]+\.js\?v=[a-zA-Z0-9.-]+$/.test(asset))throw Error('Unexpected optional asset');versionedUrls.push(devBase+asset.slice(2));}
const immutableArt=Object.keys(files).filter(name=>name.startsWith(devBase+'art/')&&/-(?:r\d+|r\d+-[a-d])\.(?:png|webp)$/.test(name));
const market=(await readFile(path.join(root,'server/stock-market.mjs'),'utf8')).replace("import {createDividendLookup} from './dividend-market.mjs';",'').replace("import {createIntradayNavLookup} from './intraday-nav.mjs';",'').replace('export function createStockMarket','function createStockMarket');
const dividends=(await readFile(path.join(root,'server/dividend-market.mjs'),'utf8')).replace('export function createDividendLookup','function createDividendLookup');
const intraday=(await readFile(path.join(root,'server/intraday-nav.mjs'),'utf8')).replace('export function createIntradayNavLookup','function createIntradayNavLookup');
const portable=(await readFile(path.join(root,'server/portable-market.mjs'),'utf8')).replace('export function createPortableMarket','function createPortableMarket');
const runtime=`
function decodeStaticBody(encoded){
 const binary=atob(encoded),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
const handleMarket=createStockMarket();
const handlePortable=createPortableMarket(handleMarket);
const DEV_SECURITY_HEADERS=${JSON.stringify({'content-security-policy':salaryMateCsp(),'permissions-policy':'camera=(), microphone=(), geolocation=()'})};
const IMMUTABLE_ART=new Set(${JSON.stringify(immutableArt)});
const VERSIONED_ASSETS=new Set(${JSON.stringify(versionedUrls)});
export default {async fetch(request){
 const url=new URL(request.url);
 if(['/api/stocks/quotes','/api/stocks/nav','/api/stocks/lookup','/api/stocks/dividends','/api/stocks/catalog'].includes(url.pathname))return handleMarket(request);
 if(['/api/stocks/portable/quotes','/api/stocks/portable/nav','/api/stocks/portable/lookup','/api/stocks/portable/dividends','/api/stocks/portable/catalog'].includes(url.pathname))return handlePortable(request);
 if(url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const route=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
 const file=STATIC_FILES[route];if(!file)return new Response('Not found',{status:404});
 const headers={'content-type':file.type,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
 if(IMMUTABLE_ART.has(route)||VERSIONED_ASSETS.has(route+url.search))headers['cache-control']='public, max-age=31536000, immutable';
 if(route.startsWith('/dev/v5.0.0-dev.2/'))Object.assign(headers,DEV_SECURITY_HEADERS);
 const body=request.method==='HEAD'?null:decodeStaticBody(file.body);
 return new Response(body,{headers});
}};`;
await mkdir(path.join(dist,'server'),{recursive:true});
await writeFile(path.join(dist,'server/index.js'),`const STATIC_FILES=${JSON.stringify(files)};\n${dividends}\n${intraday}\n${market}\n${portable}\n${runtime}`);
console.log(`Stock API + ${Object.keys(files).length} existing static assets packaged.`);
