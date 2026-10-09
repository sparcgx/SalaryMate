import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {currentSources,sourceSet,investmentHarness,translationHarness} from '../tests/helpers/v5-performance-native.mjs';

const directory=process.argv[2];
if(!directory||!path.isAbsolute(directory))throw Error('Supply the absolute directory containing R84 app.js, stocks.js, stocks-ui.js, i18n.js and i18n-en.js.');
const before=sourceSet(pathToFileURL(directory+'/')),after=currentSources();
const measure=fn=>{for(let i=0;i<2;i++)fn();const samples=[];for(let i=0;i<9;i++){const start=performance.now();fn();samples.push(performance.now()-start);}return +samples.sort((a,b)=>a-b)[4].toFixed(3);};
function profile(sources){
 const income=investmentHarness(sources,1000),first=income.paint(),legacyRenders=income.counts.legacyRenders;
 const collapsedMedianMs=measure(()=>income.paint());income.tab('income');const expandedMedianMs=measure(()=>income.paint());
 const h=investmentHarness(sources),p=h.state.stockPortfolio;let reads=0;
 p.assets=Array.from({length:200},(_,i)=>({id:'a'+i,symbol:'ETF'+i,market:'TW',currency:'TWD'}));
 p.transactions=[...Array.from({length:9800},()=>({type:'dividend',get assetId(){reads++;return 'a0';}})),...p.assets.map(a=>({type:'buy',get assetId(){reads++;return a.id;}}))];
 h.ui.forecastAssets();const candidateIdReads=reads,candidateMedianMs=measure(()=>h.ui.forecastAssets());
 const zh=translationHarness(sources,'zh'),en=translationHarness(sources,'en'),label='2026 年 · 目前持有 20 股';
 const translate=()=>{for(let i=0;i<1000;i++)en.api.text(label);};translate();const first1000={...en.counts},translationMedianMs=measure(translate);
 return {income:{records:1000,collapsedBytes:Buffer.byteLength(first),collapsedLegacyRenders:legacyRenders,collapsedMedianMs,expandedMedianMs},forecastCandidates:{assets:200,transactions:10000,candidateIdReads,candidateMedianMs},translation:{repetitions:1000,zhStartupDictionaryCompiles:zh.counts.dictionaryCompiles,...first1000,translationMedianMs}};
}

// Compare actual old/new outputs, including all translations and dynamic labels.
const left=investmentHarness(before,1000),right=investmentHarness(after,1000);left.tab('income');right.tab('income');assert.equal(right.html,left.html);assert.equal(JSON.stringify(right.state),JSON.stringify(left.state));
const a=translationHarness(before),b=translationHarness(after),labels=[...Object.keys(a.context.SalaryMateEnglish),'  股票  ','2026 年 · 目前持有 20 股','共 123 家公司','2026 對 2025','1.25 股 · 10 筆 · 5 天',a.api.user('私人公司 <股票>')+' · 股票','測試未知中文字','ABC / $123,456.75',null];
for(const preference of ['en','zh','auto']){a.api.set(preference);b.api.set(preference);for(const label of labels)assert.equal(b.api.text(label),a.api.text(label),String(label));}
console.log(JSON.stringify({environment:'Node native source execution; not browser timing or FPS',method:'2 warm-ups, median of 9 samples; fictional data',equivalence:{incomeHTML:true,unchangedState:true,translationInputs:labels.length,languages:3},R84:profile(before),R85:profile(after)},null,2));
