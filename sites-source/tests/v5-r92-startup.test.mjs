import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {currentSources} from './helpers/v5-performance-native.mjs';
import {countedTranslation,productionDecoder,workerFixture,digest} from '../scripts/r92-startup-check.mjs';

const sources=currentSources();

test('R92 Chinese startup and protected/ASCII labels do not build the English dictionary',()=>{
  const h=countedTranslation(sources,'zh');
  for(const label of [...Object.keys(h.context.SalaryMateEnglish),'共 123 家公司','2026 年 · 目前持有 20 股'])assert.equal(h.api.text(label),label);
  h.api.set('en');
  for(const label of ['ABC / $123,456.75','2026','',null])assert.equal(h.api.text(label),String(label??''));
  const personal='私人公司 <股票> 帳戶 20 股';assert.equal(h.api.text(h.api.user(personal)),personal);
  assert.equal(h.context.dictionaryBuilds||0,0);assert.equal(h.context.dictionaryComparisons||0,0);
});

test('R92 the first English Han label builds the dictionary once across repeated translations and language switches',()=>{
  const h=countedTranslation(sources,'en');
  assert.equal(h.context.dictionaryBuilds||0,0);
  assert.equal(h.api.text('股票'),h.context.SalaryMateEnglish['股票']);
  assert.equal(h.context.dictionaryBuilds,1);assert.ok(h.context.dictionaryComparisons>0);
  const comparisons=h.context.dictionaryComparisons,label='2026 年 · 目前持有 20 股',translated=h.api.text(label);
  assert.notEqual(translated,label);
  for(let i=0;i<1000;i++)assert.equal(h.api.text(label),translated);
  h.api.set('zh');assert.equal(h.api.text(label),label);
  h.api.set('auto');assert.equal(h.api.text(label),label);
  h.context.navigator.languages=['en-US'];assert.equal(h.api.text(label),translated);
  h.api.set('en');assert.equal(h.api.text(label),translated);
  assert.equal(h.context.dictionaryBuilds,1);assert.equal(h.context.dictionaryComparisons,comparisons);
});

test('R92 all canonical dictionary entries retain exact translations, whitespace and protected user values',()=>{
  const h=countedTranslation(sources,'en'),entries=Object.entries(h.context.SalaryMateEnglish);
  assert.ok(entries.length>=2677,'complete catalog remains available');
  for(const [key,value] of entries){
    const expected=/\p{Script=Han}/u.test(key)?value:key;
    assert.equal(h.api.text(key),expected,key);
    if(key.trim()===key&&!key.includes('\uE100')&&!key.includes('\uE101'))assert.equal(h.api.text('  '+key+'  '),'  '+expected+'  ',key);
    assert.equal(h.api.text(h.api.user(key)),key,'protected '+key);
  }
  assert.equal(h.context.dictionaryBuilds,1);
  h.api.set('zh');for(const [key] of entries)assert.equal(h.api.text(key),key);
});

test('R92 static body decoder retains empty, high-bit, zero and repeated binary bytes',()=>{
  const decode=productionDecoder();
  const fixtures=[Buffer.alloc(0),Buffer.from([0,128,255,1,127,0]),Buffer.from(Array.from({length:256},(_,i)=>i)),Buffer.alloc(65537,255)];
  for(const expected of fixtures){const encoded=expected.toString('base64');assert.deepEqual(Buffer.from(decode(encoded)),expected);assert.deepEqual(Buffer.from(decode(encoded)),Buffer.from(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))));}
});

test('R92 static decoder preserves exact PNG, WebP, CSS and JavaScript asset hashes',()=>{
  const decode=productionDecoder();
  for(const name of ['app.js','styles.css','i18n-en.js','legal-data.js','art/jingyu-flight-r73-a.png','art/background-autumn-cafe-r91.webp']){
    const expected=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/'+name,import.meta.url)),encoded=expected.toString('base64');
    assert.equal(digest(decode(encoded)),digest(expected),name);
    assert.equal(digest(decode(encoded)),digest(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))),name+' legacy equality');
  }
});

test('R92 production Worker HEAD and rejected/missing requests never decode; GET retains body and headers',async()=>{
  const bytes=Buffer.from([0,255,128,1,127,0]),w=workerFixture({'/fixture.png':{body:bytes.toString('base64'),type:'image/png'}});
  const head=await w.fetch(new Request('https://fixture.test/fixture.png',{method:'HEAD'}));
  assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'image/png');assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(w.decodes,0);
  const missing=await w.fetch(new Request('https://fixture.test/missing.png'));assert.equal(missing.status,404);
  const rejected=await w.fetch(new Request('https://fixture.test/fixture.png',{method:'POST'}));assert.equal(rejected.status,405);assert.equal(w.decodes,0);
  const get=await w.fetch(new Request('https://fixture.test/fixture.png'));
  assert.equal(get.status,200);assert.equal(w.decodes,1);assert.deepEqual(Buffer.from(await get.arrayBuffer()),bytes);
  assert.equal(get.headers.get('content-type'),head.headers.get('content-type'));assert.equal(get.headers.get('cache-control'),'no-cache');assert.equal(get.headers.get('x-content-type-options'),'nosniff');
});
