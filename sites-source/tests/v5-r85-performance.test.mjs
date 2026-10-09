import test from 'node:test';
import assert from 'node:assert/strict';
import {currentSources,investmentHarness,translationHarness} from './helpers/v5-performance-native.mjs';
const sources=currentSources();

test('R85 closed income shortcut retains its total without building hidden record content',()=>{
 const h=investmentHarness(sources,1000),before=JSON.stringify(h.state);
 for(const tab of ['overview','stocks','transactions','analysis','watchlist']){h.tab(tab);assert.equal(h.counts.legacyRenders,0);assert.ok(Buffer.byteLength(h.html)<12000);assert.match(h.html,/其他投資收入/);assert.doesNotMatch(h.html,/Fixture income/);}
 assert.equal(JSON.stringify(h.state),before);
});

test('R85 opening income builds once, retains actions, and refreshes expanded content with current data',()=>{
 const h=investmentHarness(sources,3);h.paint();h.toggle(true);assert.equal(h.counts.legacyRenders,1);assert.equal(h.counts.enhanced,1);
 assert.match(h.content.innerHTML,/edit-investment/);assert.match(h.content.innerHTML,/delete-investment/);assert.match(h.content.innerHTML,/export-investment/);
 h.toggle(false);h.toggle(true);assert.equal(h.counts.legacyRenders,1);
 h.state.investmentRecords.push({id:'added',date:'2026-10-09',amount:12.5,name:'Fresh record',note:'',kind:'利息'});h.paint();assert.match(h.html,/stock-legacy-shortcut" open/);assert.match(h.html,/Fresh record/);assert.equal(h.counts.legacyRenders,2);
 h.disclosure.isConnected=false;h.toggle(false);h.paint();assert.match(h.html,/stock-legacy-shortcut" open/);
 h.tab('income');assert.match(h.html,/Fresh record/);assert.doesNotMatch(h.html,/stock-legacy-shortcut/);
});

test('R85 forecast candidates use one transaction pass and retain account/market eligibility',()=>{
 const h=investmentHarness(sources),p=h.state.stockPortfolio;let reads=0;
 p.assets=Array.from({length:200},(_,i)=>({id:'a'+i,symbol:'ETF'+i,market:'TW',currency:'TWD'}));
 p.transactions=[...Array.from({length:9800},()=>({type:'dividend',get assetId(){reads++;return 'a0';}})),...p.assets.map(a=>({type:'buy',get assetId(){reads++;return a.id;}}))];
 assert.equal(h.ui.forecastAssets().length,200);assert.ok(reads<=10000,'must not rescan transactions for every asset');
 p.assets.push({id:'cached',market:'TW',currency:'TWD',dividendForecast:{announcements:[{}]}},{id:'watch',market:'TW',currency:'TWD'},{id:'us',market:'US',currency:'USD'});
 const ids=Array.from(h.ui.forecastAssets(),a=>a.id);assert.ok(ids.includes('cached'));assert.ok(!ids.includes('watch'));assert.ok(!ids.includes('us'));
 p.transactions=[];assert.deepEqual(Array.from(h.ui.forecastAssets(),a=>a.id),['cached'],'no stale eligibility after replacing transactions');
});

test('R85 Chinese startup skips English phrase compilation and repeated English labels reuse results',()=>{
 const h=translationHarness(sources,'zh');for(let i=0;i<1000;i++)assert.equal(h.api.text('目前持有 20 股'),'目前持有 20 股');assert.equal(h.counts.dictionaryCompiles,0);
 h.api.set('en');const label='2026 年 · 目前持有 20 股',translated=h.api.text(label);assert.equal(h.counts.dictionaryCompiles,1);assert.notEqual(translated,label);
 for(let i=0;i<1000;i++)assert.equal(h.api.text(label),translated);assert.equal(h.counts.dictionaryPasses,1);assert.equal(h.counts.constructors,1);
});

test('R85 translation cache stays bounded and language/user-text boundaries remain intact',()=>{
 const h=translationHarness(sources),label='2026 年 · 目前持有 20 股',translated=h.api.text(label);
 for(let i=0;i<600;i++)h.api.text('測試 '+i+' 目前持有 20 股');const passes=h.counts.dictionaryPasses;assert.equal(h.api.text(label),translated);assert.equal(h.counts.dictionaryPasses,passes+1,'old cache entry evicted');
 const personal='我的股票帳戶 <私人> 20 股';assert.equal(h.api.text(h.api.user(personal)),personal);
 h.api.set('zh');assert.equal(h.api.text(label),label);h.api.set('auto');assert.equal(h.api.text(label),label);h.context.navigator.languages=['en-US'];assert.equal(h.api.text(label),translated);
 const large='目前持有 20 股 '.repeat(100),before=h.counts.dictionaryPasses;h.api.text(large);h.api.text(large);assert.equal(h.counts.dictionaryPasses,before+2,'large paragraphs not retained');
});

test('R85 localized nodes restore their source text across language changes and accept new values',()=>{
 const h=translationHarness(sources,'zh'),parent={closest:()=>null},node={nodeValue:'股票',parentElement:parent};
 h.context.document.createTreeWalker=()=>{let visited=false;return {nextNode(){if(visited)return null;visited=true;return node;}};};
 h.api.apply();h.api.set('en');assert.equal(node.nodeValue,h.context.SalaryMateEnglish['股票']);h.api.set('zh');assert.equal(node.nodeValue,'股票');
 node.nodeValue=h.api.user('自己的公司與帳戶');h.api.set('en');assert.equal(node.nodeValue,'自己的公司與帳戶');h.api.set('zh');assert.equal(node.nodeValue,'自己的公司與帳戶');
});
