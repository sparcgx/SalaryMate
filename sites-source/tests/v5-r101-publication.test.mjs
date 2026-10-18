import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const base=path.join(root,'dist/dev/v5.0.0-dev.2');
const version='5.0.0';
const assetVersion='5.0.0-calendar1';
const origin='https://salarymate.sparcgx2420.chatgpt.site';
const normalize=text=>text.replace(/\r\n?/g,'\n');
const read=name=>readFile(path.join(base,name),'utf8');
let built;
const worker=async()=>built??=(await import(pathToFileURL(path.join(root,'dist/server/index.js')).href)).default;

test('v5.0.0: install labels and data contracts preserve the existing entry',async()=>{
  const [manifest,app,index]=await Promise.all(['manifest.webmanifest','app.js','index.html'].map(read));
  const pwa=JSON.parse(manifest);
  assert.equal(pwa.name,'SalaryMate v5.0.0 正式版');
  assert.equal(pwa.short_name,'v5.0.0 正式版');
  assert.equal(pwa.id,'./');
  assert.equal(pwa.start_url,'./');
  assert.ok(app.includes("const SCHEMA_VERSION = 15"));
  assert.ok(app.includes("const STORAGE_KEY = 'salarymate_v5_full_state'"));
  assert.ok(index.includes('SalaryMate v5.0.0'));
  assert.ok(!index.includes('開發測試版'));
});

test('R101: shipped application, style loader, page URLs and service-worker cache agree',async()=>{
  const [app,index,startup,sw]=await Promise.all(['app.js','index.html','startup.js','sw.js'].map(read));
  assert.ok(app.includes(`const APP_VERSION = '${version}'`));
  assert.ok(startup.includes(`const APP_VERSION = '${version}'`));
  for(const text of [index,sw]){
    assert.ok(text.includes(`styles-core.css?v=${assetVersion}`));
    assert.ok(text.includes(`startup.js?v=${assetVersion}`));
    assert.ok(!text.includes('R100'),'a previous-version URL could reuse an outdated asset');
  }
  assert.ok(index.includes('v5.0.0 正式版'));
  assert.ok(sw.includes(`const CACHE='salarymate-v5-full-${assetVersion}'`));
  for(const asset of ['styles.css','ornate-flight.js','legal-data.js'])assert.ok(sw.includes(`${asset}?v=${assetVersion}`));
  assert.ok(startup.includes(`const version='${version}'`),'lazy styles are stamped during startup generation');
});

test('R101: generated startup and core styles include both approved fixes',async()=>{
  const [startup,core,app,integrations,ui]=await Promise.all(['startup.js','styles-core.css','app.js','stocks-integrations.js','stocks-ui.js'].map(read));
  for(const source of [app,integrations,ui])assert.ok(normalize(startup).includes(normalize(source)), 'generated startup must contain the current source modules');
  assert.ok(core.includes('.v5-worklog-view'));
  assert.ok(core.includes('min-width:0'));
  assert.ok(integrations.includes("q.priceKind!=='close'"));
  assert.ok(integrations.includes('同日收盤價已保存，不改用盤中成交'));
});

test('R101: built worker serves current assets without changing the frozen root',async()=>{
  const handler=await worker();
  for(const asset of ['index.html','startup.js','styles-core.css','styles.css','sw.js']){
    const route=`/dev/v5.0.0-dev.2/${asset}${/\.(?:css|js)$/.test(asset)&&asset!=='sw.js'?`?v=${assetVersion}`:''}`;
    const response=await handler.fetch(new Request(origin+route));
    assert.equal(response.status,200);
    assert.equal(normalize(await response.text()),normalize(await read(asset)));
    if(route.includes('?v='))assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable');
  }
  const stable=await handler.fetch(new Request(origin+'/'));
  assert.equal(stable.status,302);
  assert.equal(stable.headers.get('location'),origin+'/dev/v5.0.0-dev.2/');
  assert.equal(stable.headers.get('cache-control'),'no-store');
  for(const entry of ['/index.html','/v5.0.0/']){
    const reply=await handler.fetch(new Request(origin+entry+'?from=public'));
    assert.equal(reply.status,302);
    assert.equal(reply.headers.get('location'),origin+'/dev/v5.0.0-dev.2/?from=public');
  }
});

test('R101: public health is versioned, uncached and does not require quote requests',async()=>{
  const handler=await worker();
  const response=await handler.fetch(new Request(origin+'/api/health'));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{ok:true,service:'salarymate-market',version});
  const head=await handler.fetch(new Request(origin+'/api/health',{method:'HEAD'}));
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
  assert.equal((await handler.fetch(new Request(origin+'/api/health',{method:'POST'}))).status,405);
});
