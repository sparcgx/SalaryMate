import test from 'node:test';
import assert from 'node:assert/strict';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
import {boot,fixture} from './helpers/v5-full-dom.mjs';

const req=(body,path='quotes',origin='null',method='POST',headers={})=>new Request('https://site.test/api/stocks/portable/'+path,{method,headers:{origin,'content-type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const fakeSource=async url=>new Response(JSON.stringify(url.includes('STOCK_DAY_ALL')?[{Code:'2330',Name:'台積電',Date:'1151002',ClosingPrice:'1200'}]:[]));

test('Portable market: file-origin preflight and public quote/name lookup work without credentials',async()=>{
  const handle=createPortableMarket(createStockMarket(fakeSource));
  const preflight=await handle(req(null,'quotes','null','OPTIONS',{'access-control-request-method':'POST','access-control-request-headers':'content-type'}));
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'null');assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
  for(const [path,body] of [['quotes',{instruments:[{market:'TW',symbol:'2330'}]}],['lookup',{market:'TW',symbol:'2330'}]]){
    const response=await handle(req(body,path));assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'null');const data=await response.json();assert.equal(data.quotes[0].name,'台積電');assert.equal(data.quotes[0].price,1200);
  }
});

test('Portable market: unrelated origins, paths, methods and credential preflight are rejected',async()=>{
  let called=0;const handle=createPortableMarket(async()=>{called++;return new Response('{}');});
  assert.equal((await handle(req({},'quotes','https://unrelated.test'))).status,403);
  assert.equal((await handle(req({},'payroll'))).status,404);
  assert.equal((await handle(req(null,'quotes','null','GET'))).status,405);
  assert.equal((await handle(req(null,'quotes','null','OPTIONS',{'access-control-request-method':'POST','access-control-request-headers':'authorization'}))).status,403);
  assert.equal(called,0);
});

test('Portable market: original origin restriction, validation and rate limit remain effective',async()=>{
  let calls=0;const market=createStockMarket(async url=>{calls++;return fakeSource(url);}),handle=createPortableMarket(market);
  assert.equal((await market(new Request('https://site.test/api/stocks/quotes',{method:'POST',headers:{origin:'null'},body:'{}'}))).status,403);
  assert.equal((await handle(req({market:'TW',symbol:'https://not-a-symbol.test'},'lookup'))).status,400);assert.equal(calls,0);
  assert.equal((await handle(req({instruments:Array(21).fill({market:'TW',symbol:'2330'})}))).status,400);
  const limited=()=>handle(req({instruments:[]},'quotes','null','POST',{'cf-connecting-ip':'192.0.2.7'}));
  for(let i=0;i<30;i++)assert.equal((await limited()).status,400);
  const response=await limited();assert.equal(response.status,429);assert.equal(response.headers.get('access-control-allow-origin'),'null');
});

test('Single HTML: embedded resources, local-file navigation, language and encrypted backup round-trip',async()=>{
  assert.ok(process.env.SALARYMATE_SINGLE_HTML,'Build the standalone HTML and supply SALARYMATE_SINGLE_HTML');
  const b=boot(fixture(),{url:'file:///SalaryMate.html'});
  assert.equal(b.w.document.querySelectorAll('script[src],link[rel="stylesheet"],link[rel="manifest"]').length,0);
  for(const link of b.w.document.querySelectorAll('link[href]'))assert.ok(link.href.startsWith('data:'),link.href);
  for(const tab of ['dashboard','records','calendar','investment','tax','settings'])b.tab(tab);
  b.click('[data-language="en"]');assert.equal(b.q('main h2').textContent,'Settings');
  b.click('[data-action="open-legal"]');assert.ok(b.q('#dialogContent').textContent.includes('MIT'));
  const data=b.state(),encrypted=await b.w.SalaryMateBackup.encrypt(data,'file-password-123');
  const decrypted=await b.w.SalaryMateBackup.decrypt(encrypted,'file-password-123');assert.equal(JSON.stringify(decrypted),JSON.stringify(data));
  assert.deepEqual(b.errors,[]);b.close();
});

test('Single HTML: live buttons send only public instrument identifiers to the portable route',async()=>{
  const f=fixture();f.stockPortfolio={assets:[{id:'a',symbol:'2330',name:'Test',market:'TW',currency:'TWD',account:'Private account'}],transactions:[]};
  const b=boot(f),sent=[],handle=createPortableMarket(createStockMarket(fakeSource));
  b.w.fetch=async(url,init)=>{sent.push({url,body:JSON.parse(init.body),credentials:init.credentials});return handle(new Request(url,{method:init.method,body:init.body,headers:{...init.headers,origin:'null'}}));};
  b.tab('investment');b.click('[data-stock="refresh"]');
  for(let i=0;i<50&&!b.q('.stock-sync-result');i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(b.state().stockPortfolio.assets[0].quotePrice,1200);assert.match(sent[0].url,/\/api\/stocks\/portable\/quotes$/);assert.deepEqual(sent[0].body,{instruments:[{market:'TW',symbol:'2330'}]});assert.equal(sent[0].credentials,'omit');assert.deepEqual(b.errors,[]);b.close();
});
