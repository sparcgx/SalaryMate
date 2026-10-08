import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Pure HTML rendering with native object fixtures. No browser, DOM emulator,
// real network, account access or user records.
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const scripts=['stocks.js','stocks-ui.js'].map(name=>fs.readFileSync(new URL(name,base),'utf8'));
const asset=(id,patch={})=>({id,symbol:id==='tw'?'0050':id==='us'?'ACME':'00888',name:id==='tw'?'測試台股 ETF':id==='us'?'Sample US share':'觀察標的',market:id==='us'?'US':'TW',currency:id==='us'?'USD':'TWD',account:id==='tw'?'長期帳戶 <私人>&"':id==='us'?'':'觀察帳戶',quotePrice:120,quoteDate:'2026-10-08',quoteFx:id==='us'?30:1,quoteSource:'TWSE 最新成交',quoteProviderTime:'2026-10-08 13:30:00',quoteCheckedAt:'2026-10-08T14:45:00+08:00',quoteChange:2,quoteChangePercent:1.69,marketInfo:{exchange:id==='us'?'NASDAQ':'TWSE',instrumentType:id==='us'?'stock':'etf'},group:id==='tw'?'長期投資':'',...patch});
const buy=(id)=>({id:'buy-'+id,assetId:id,date:'2026-10-01',time:'10:00',type:'buy',quantity:10,price:100,amount:0,ratio:1,fee:0,tax:0,fx:id==='us'?30:1,note:''});
function setup(patch={}){
 const portfolio={assets:[asset('tw',patch),asset('us'),asset('watch')],transactions:[buy('tw'),buy('us')],marketData:{autoRefresh:false,quoteEnabled:false}};
 const state={stockPortfolio:portfolio};
 const context={Intl,Date,URL,console,AbortController,FormData:class extends Map{constructor(form){super(Object.entries(form.values||{}));}},document:{hidden:true,addEventListener(){},querySelector:()=>null},clearTimeout(){},setTimeout(){throw Error('No timer should start during rendering');},SalaryMateI18n:{user:v=>v,text:v=>v}};
 vm.createContext(context);for(const source of scripts)vm.runInContext(source,context);
 const core=context.SalaryMateStocks;core.validate(portfolio);
 const ui=context.SalaryMateStocksUI.create({state:()=>state,year:()=>2026,today:()=>'2026-10-08',legacyTotal:()=>0,render(){}});
 const before=JSON.stringify(portfolio),model=JSON.stringify(core.calculate(portfolio,2026,'2026-10-08'));
 return {portfolio,ui,context,render:()=>ui.render(''),assertUnchanged(){assert.equal(JSON.stringify(portfolio),before);assert.equal(JSON.stringify(core.calculate(portfolio,2026,'2026-10-08')),model);}};
}
function ledger(html){
 const table=html.match(/<table class="stock-table stock-ledger stock-holdings-table(?: stock-list-table)?">([\s\S]*?)<\/table>/)?.[1];assert.ok(table);
 return {heads:[...table.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m=>m[1]),rows:[...table.split('<tbody>')[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]))};
}
const rowFor=(table,id)=>table.rows.find(row=>row[0].includes('data-id="'+id+'"'));

test('R82 holdings separates classification and account with nine aligned columns and preserved actions',()=>{
 const h=setup(),table=ledger(h.render());
 assert.deepEqual(table.heads,['股票','分類','股數／剩餘均價','行情','持有成本 TWD','市值 TWD','未實現損益 TWD','帳戶','操作']);
 assert.ok(table.rows.every(row=>row.length===9));const tw=rowFor(table,'tw'),us=rowFor(table,'us');
 assert.ok(!tw[0].includes('stock-tags')&&!tw[0].includes('長期帳戶'));
 assert.match(tw[0],/stock-symbol-line[\s\S]*0050[\s\S]*stock-name-copy[\s\S]*測試台股 ETF/);
 for(const text of ['上市','ETF','長期投資','台股'])assert.ok(tw[1].includes(text));
 assert.match(tw[2],/10 股/);assert.equal(tw[4],'$1,000');assert.equal(tw[5],'$1,200');assert.match(tw[6],/\+\$200/);
 assert.equal(tw[7],'長期帳戶 &lt;私人&gt;&amp;&quot;');assert.equal(us[7],'未分帳戶');
 assert.match(tw[8],/data-stock="buy" data-id="tw"/);assert.match(tw[8],/data-stock="sell" data-id="tw"/);h.assertUnchanged();
});

test('R82 watchlist follows the same classification/account order while retaining status and edit action',()=>{
 const h=setup();h.ui.click({dataset:{stock:'tab',id:'watchlist'},closest:()=>null});const table=ledger(h.render());assert.equal(table.heads[2],'狀態');assert.equal(table.heads[7],'帳戶');
 assert.equal(table.rows.length,1);const row=rowFor(table,'watch');assert.equal(row.length,9);assert.match(row[2],/觀察／已出清/);assert.equal(row[7],'觀察帳戶');assert.match(row[8],/data-stock="asset" data-id="watch"/);h.assertUnchanged();
});

test('R82 quote timestamp follows price, preserves source zones and never substitutes retrieval time',()=>{
 const cases=[
  [{quoteProviderTime:'2026-10-08 13:30:00'},'10/8 13:30:00'],
  [{quoteProviderTime:'2026-10-08',quoteSource:'TWSE 上市收盤'},'10/8'],
  [{quoteProviderTime:'',quoteMarketAt:'2026-10-08T05:30:00Z'},'10/8 05:30:00Z'],
  [{quoteProviderTime:'',quoteMarketAt:'2026-10-08T13:30:00+08:00'},'10/8 13:30:00+08:00'],
  [{quoteProviderTime:'Oct 7, 2026 4:00 PM ET'},'Oct 7, 2026 4:00 PM ET'],
  [{quoteProviderTime:'',quoteMarketAt:''},'10/8'],
  [{quotePrice:0,quoteProviderTime:'2026-10-08 13:30:00'},'10/8 13:30:00']
 ];
 for(const [patch,stamp]of cases){const h=setup(patch),cell=rowFor(ledger(h.render()),'tw')[3];assert.match(cell,/stock-quote-value[^>]*>[\s\S]*?<\/strong><span class="stock-quote-date stock-quote-timestamp"/);assert.ok(cell.includes('>'+stamp+'</span>'));assert.ok(!cell.includes('14:45'));h.assertUnchanged();}
 const missing=setup({quotePrice:null,quoteProviderTime:'',quoteDate:'',quoteMarketAt:''}),cell=rowFor(ledger(missing.render()),'tw')[3];assert.ok(cell.includes('待更新'));assert.ok(!cell.includes('stock-quote-timestamp'));missing.assertUnchanged();
});

test('R83 stock list shares all nine holdings columns, values and inline time while retaining list actions',()=>{
 const h=setup(),overview=ledger(h.render());h.ui.click({dataset:{stock:'tab',id:'stocks'},closest:()=>null});const html=h.render(),list=ledger(html);
 assert.deepEqual(list.heads,overview.heads);assert.equal(list.rows.length,3);assert.ok(list.rows.every(r=>r.length===9));
 const tw=rowFor(list,'tw');assert.deepEqual(tw.slice(1,8),rowFor(overview,'tw').slice(1,8));assert.ok(tw[3].includes('10/8 13:30:00'));
 assert.match(tw[0],/data-stock="favorite" data-id="tw"/);for(const action of ['buy','asset','delete-asset'])assert.ok(tw[8].includes(`data-stock="${action}" data-id="tw"`));
 assert.match(rowFor(list,'watch')[2],/>0 股</);assert.equal(rowFor(list,'watch')[4],'$0');assert.equal(rowFor(list,'watch')[7],'觀察帳戶');h.assertUnchanged();
});

test('R83 stock list preserves all-assets sorting and combined search, classification and favorite filters',()=>{
 const h=setup({favorite:true,quoteChangePercent:5});h.ui.click({dataset:{stock:'tab',id:'stocks'},closest:()=>null});
 const ids=()=>ledger(h.render()).rows.map(r=>r[0].match(/data-stock="detail" data-id="([^"]+)"/)[1]);
 for(const [sort,expected]of [['favorite',['tw','watch','us']],['symbol',['tw','watch','us']],['change',['tw','us','watch']]]){assert.equal(h.ui.submit({id:'stockListForm',values:{sort}}),true);assert.deepEqual(ids(),expected);}
 h.ui.submit({id:'stockListForm',values:{search:'長期帳戶',exchange:'TWSE',category:'ETF',favorites:'on'}});assert.deepEqual(ids(),['tw']);
 h.ui.submit({id:'stockListForm',values:{exchange:'NASDAQ'}});assert.deepEqual(ids(),['us']);
 h.ui.submit({id:'stockListForm',values:{search:'不存在的股票'}});assert.ok(h.render().includes('沒有符合條件的股票'));
 h.ui.submit({id:'stockListForm',values:{}});assert.equal(ids().length,3);h.assertUnchanged();
});

test('R83 each investment tab has one persistent refresh and preserves the three menu actions',()=>{
 const h=setup();for(const tab of ['overview','stocks','transactions','income','analysis','watchlist']){
  h.ui.click({dataset:{stock:'tab',id:tab},closest:()=>null});const html=h.render();assert.equal((html.match(/data-stock="refresh"/g)||[]).length,1);
  const actions=html.match(/id="stockHeadActions" class="stock-head-actions">([\s\S]*?)<\/div>/)[1];assert.ok(!actions.includes('data-stock="refresh"'));for(const action of ['asset','buy','batch'])assert.ok(actions.includes(`data-stock="${action}"`));
  assert.ok(html.indexOf('data-stock="refresh"')<html.indexOf('id="stockHeadActions"'));
 }h.assertUnchanged();
});

test('R83 the single refresh stays busy, rejects duplicate requests and recovers from a failed update',async()=>{
 const h=setup(),card={outerHTML:''};let calls=0,reject;
 const pending=new Promise((resolve,rejectRequest)=>{reject=rejectRequest;});
 // Attach the service before create: create captures this reference.
 h.context.SalaryMateStockServices={fetchQuotes(){calls++;return pending;}};
 const ui=h.context.SalaryMateStocksUI.create({state:()=>({stockPortfolio:h.portfolio}),year:()=>2026,today:()=>'2026-10-08',legacyTotal:()=>0,render(){}});
 h.context.document.hidden=false;h.context.document.querySelector=selector=>selector==='.stock-view'?{}:selector==='[data-market-card]'?card:null;
 const click=()=>ui.click({dataset:{stock:'refresh'},closest:()=>null});click();click();assert.equal(calls,1);
 assert.match(card.outerHTML,/data-stock="refresh"[^>]*disabled aria-busy="true"/);assert.ok(card.outerHTML.includes('更新中…'));
 reject(Error('fixture source unavailable'));await new Promise(setImmediate);
 assert.equal((card.outerHTML.match(/data-stock="refresh"/g)||[]).length,1);assert.doesNotMatch(card.outerHTML,/data-stock="refresh"[^>]*disabled/);assert.ok(card.outerHTML.includes('更新失敗，已保留上次匯率與價格。'));h.assertUnchanged();
});
