import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {currentSources,sourceSet,translationHarness} from '../tests/helpers/v5-performance-native.mjs';

// Production functions with native objects/callback spies only: no browser,
// DOM emulator, private user data or network calls.
export const builderSource=()=>fs.readFileSync(new URL('./build-stock-worker.mjs',import.meta.url),'utf8');
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function countedTranslation(sources,preference='zh'){
  let source=sources['i18n.js'];
  const entries='Object.entries(root.SalaryMateEnglish||{})';
  const comparator='b[0].length-a[0].length';
  assert.equal(source.split(entries).length-1,1,'one production dictionary source');
  assert.equal(source.split(comparator).length-1,1,'one production dictionary sort');
  source=source.replace(entries,'(root.dictionaryBuilds=(root.dictionaryBuilds||0)+1,Object.entries(root.SalaryMateEnglish||{}))')
    .replace(comparator,'(root.dictionaryComparisons=(root.dictionaryComparisons||0)+1,b[0].length-a[0].length)');
  return translationHarness({...sources,'i18n.js':source},preference);
}

export function productionRuntime(source=builderSource()){
  const start=source.indexOf('const runtime='),end=source.indexOf('\nawait mkdir',start);
  assert.ok(start>=0&&end>start,'production Worker runtime boundaries');
  const context={JSON,immutableArt:[],versionedUrls:[],salaryMateCsp:()=>"default-src 'self'"};
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.productionRuntime=runtime;',context);
  return context.productionRuntime;
}

export function productionDecoder(source=builderSource()){
  const runtime=productionRuntime(source);
  const body=runtime.match(/function decodeStaticBody\(encoded\)\s*\{[\s\S]*?return bytes;\s*\}/)?.[0];
  assert.ok(body,'production decodeStaticBody helper');
  const context={atob,Uint8Array};
  vm.runInNewContext(body+'\nglobalThis.decode=decodeStaticBody;',context);
  return context.decode;
}

export function workerFixture(files,source=builderSource()){
  let decodes=0;
  const context={URL,Response,Uint8Array,STATIC_FILES:files,
    atob(encoded){decodes++;return atob(encoded);},
    createStockMarket:()=>()=>new Response('fixture-market'),
    createPortableMarket:()=>()=>new Response('fixture-portable')};
  const runtime=productionRuntime(source).replace('export default {','globalThis.worker={');
  assert.ok(runtime.includes('globalThis.worker={'),'production fetch entry');
  vm.runInNewContext(runtime,context);
  return {fetch:request=>context.worker.fetch(request),get decodes(){return decodes;}};
}

export function translationEquivalence(before,after){
  const a=translationHarness(before),b=translationHarness(after);
  const oldCatalog=a.context.SalaryMateEnglish,newCatalog=b.context.SalaryMateEnglish;
  // Existing labels may not silently change when adding a new version label.
  for(const [key,value] of Object.entries(oldCatalog))assert.equal(newCatalog[key],value,key);
  const labels=[...Object.keys(oldCatalog),'  股票  ','2026 年 · 目前持有 20 股','共 123 家公司',
    '2026 對 2025','1.25 股 · 10 筆 · 5 天','測試未知中文字','ABC / $123,456.75',null,
    a.api.user('私人公司 <股票>')+' · 股票',a.api.user('salarymate_v5_full_state 帳戶 薪資'),
    '股票：'+a.api.user('私人投資帳戶 20 股')+'／2026 年'];
  let comparisons=0;
  const modes=[['zh','zh-TW'],['en','zh-TW'],['auto','zh-TW'],['auto','en-US']];
  for(const [preference,system] of modes){
    a.context.navigator.languages=[system];b.context.navigator.languages=[system];
    a.api.set(preference);b.api.set(preference);
    for(const label of labels){assert.equal(b.api.text(label),a.api.text(label),String(label));comparisons++;}
  }
  return {baselineCatalogEntries:Object.keys(oldCatalog).length,currentCatalogEntries:Object.keys(newCatalog).length,inputs:labels.length,languageModes:modes.length,comparisons,allEqual:true};
}

const median9=fn=>{
  for(let i=0;i<2;i++)fn();
  const values=[];
  for(let i=0;i<9;i++){const start=performance.now();fn();values.push(performance.now()-start);}
  return +values.sort((a,b)=>a-b)[4].toFixed(3);
};

export function measureStartup(baselineDirectory){
  assert.ok(baselineDirectory&&path.isAbsolute(baselineDirectory),'Supply --baseline /absolute/R91-source-directory');
  const before=sourceSet(pathToFileURL(baselineDirectory+'/')),after=currentSources();
  const beforeZh=countedTranslation(before,'zh'),afterZh=countedTranslation(after,'zh');
  for(let i=0;i<1000;i++)assert.equal(afterZh.api.text('目前持有 20 股'),'目前持有 20 股');
  const chinese={R91:{builds:beforeZh.context.dictionaryBuilds||0,sortComparisons:beforeZh.context.dictionaryComparisons||0},R92:{builds:afterZh.context.dictionaryBuilds||0,sortComparisons:afterZh.context.dictionaryComparisons||0}};
  assert.equal(chinese.R92.builds,0);assert.equal(chinese.R92.sortComparisons,0);
  afterZh.api.set('en');afterZh.api.text('2026 年 · 目前持有 20 股');
  const englishFirst={builds:afterZh.context.dictionaryBuilds||0,sortComparisons:afterZh.context.dictionaryComparisons||0};
  for(let i=0;i<1000;i++)afterZh.api.text('2026 年 · 目前持有 20 股');
  assert.equal(afterZh.context.dictionaryBuilds,englishFirst.builds);
  assert.equal(afterZh.context.dictionaryComparisons,englishFirst.sortComparisons);
  const decode=productionDecoder(),old=encoded=>Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const assets=['styles.css','app.js','art/jingyu-flight-r73-a.png'].map(name=>{
    const bytes=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/'+name,import.meta.url)),encoded=bytes.toString('base64');
    assert.equal(digest(decode(encoded)),digest(bytes));assert.equal(digest(old(encoded)),digest(bytes));
    return {name,bytes:bytes.length,sha256:digest(bytes),R91MedianMs:median9(()=>old(encoded)),R92MedianMs:median9(()=>decode(encoded))};
  });
  return {environment:`${process.version}; native Node VM production execution; no browser or DOM emulator`,
    method:'Decode: 2 warm-ups, median of 9 samples. Byte sizes, dictionary counts and decode microbenchmarks are not network latency, device startup timing or FPS.',
    equivalence:translationEquivalence(before,after),dictionary:{chineseStartup:chinese,englishFirst,repeatedLabels:1000,additionalBuilds:0,additionalSortComparisons:0},decode:assets};
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const args=process.argv.slice(2),index=args.indexOf('--baseline');
  console.log(JSON.stringify(measureStartup(index>=0?args[index+1]:args[0]),null,2));
}
