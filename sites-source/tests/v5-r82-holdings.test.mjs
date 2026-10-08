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
 const context={Intl,Date,URL,console,document:{hidden:true,addEventListener(){},querySelector:()=>null},clearTimeout(){},setTimeout(){throw Error('No timer should start during rendering');},SalaryMateI18n:{user:v=>v,text:v=>v}};
 vm.createContext(context);for(const source of scripts)vm.runInContext(source,context);
 const core=context.SalaryMateStocks;core.validate(portfolio);
 const ui=context.SalaryMateStocksUI.create({state:()=>state,year:()=>2026,today:()=>'2026-10-08',legacyTotal:()=>0,render(){}});
 const before=JSON.stringify(portfolio),model=JSON.stringify(core.calculate(portfolio,2026,'2026-10-08'));
 return {portfolio,ui,render:()=>ui.render(''),assertUnchanged(){assert.equal(JSON.stringify(portfolio),before);assert.equal(JSON.stringify(core.calculate(portfolio,2026,'2026-10-08')),model);}};
}
function ledger(html){
 const table=html.match(/<table class="stock-table stock-ledger stock-holdings-table">([\s\S]*?)<\/table>/)?.[1];assert.ok(table);
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

test('R82 stock list keeps its existing compact date rendering and all portfolio records',()=>{
 const h=setup();h.ui.click({dataset:{stock:'tab',id:'stocks'},closest:()=>null});const html=h.render();assert.ok(html.includes('stock-quotes-list'));assert.ok(!html.includes('stock-quote-timestamp'));assert.match(html,/<time class="stock-quote-date" datetime="2026-10-08"[^>]*>10\/8<\/time>/);h.assertUnchanged();
});
