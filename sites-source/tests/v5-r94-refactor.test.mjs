import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {visualCommitHarness, currentSources} from '../scripts/r92-performance-check.mjs';
import {embedPortableArtwork} from '../scripts/lib/portable-artwork.mjs';

// Compare actual R93 and current production functions with fictional values.
// Native callbacks only: no browser, DOM emulator, private data or network.
const root=path.resolve(import.meta.dirname,'..');
const base=path.join(root,'dist/dev/v5.0.0-dev.2');
const baseline='a5f3654ef5e9d8a63cf91c486d7a1cf2aba2225b';
const prior=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:20e6});
const current=currentSources();
const previous={...current,'app.js':prior('dist/dev/v5.0.0-dev.2/app.js'),'stocks-ui.js':prior('dist/dev/v5.0.0-dev.2/stocks-ui.js')};
const plain=value=>JSON.parse(JSON.stringify(value));

for(const [action,value,style] of [
  ['setInterfaceStyle','pixel-luxe','autumn'],
  ['setSurfaceOpacity','frosted','autumn'],
  ['setHd2dBackground','harbor','pixel-luxe'],
  ['setAutumnBackground','fuji','autumn'],
  ['setColorTheme','rose','autumn']
])test(`R94 ${action} preserves R93 success, rollback, blocked and unchanged behavior`,()=>{
  for(const options of [{},{failWrite:true},{denyLock:true}]){
    const a=visualCommitHarness(previous,options),b=visualCommitHarness(current,options);
    a.ui.interfaceStyle=b.ui.interfaceStyle=style;
    for(const h of [a,b])h.api[action](value);
    // Wall-clock timestamps are metadata, not a deterministic UI result.
    const snapshot=h=>{
      const state=plain(h.state),counts=plain(h.counts);
      delete state.updatedAt;
      counts.writes=counts.writes.map(row=>{const saved=JSON.parse(row.value);delete saved.updatedAt;return {...row,value:saved};});
      return {state,ui:plain(h.ui),counts,scrollTop:h.dialog.scrollTop};
    };
    assert.deepEqual(snapshot(b),snapshot(a));
    if(!options.failWrite&&!options.denyLock){
      const before=snapshot(b);
      a.api[action](value);b.api[action](value);
      assert.deepEqual(snapshot(b),before);
      assert.deepEqual(snapshot(b),snapshot(a));
    }
  }
});

function eventHarness(source){
  const context={Intl,Date,navigator:{onLine:true},document:{hidden:true,addEventListener(){},querySelector:()=>null},SalaryMateI18n:{user:value=>value,text:value=>value},setTimeout(){throw Error('Unexpected timer');},clearTimeout(){}};
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(base,'stocks.js'),'utf8'),context);
  const marker='return {render,click,submit,updateTradeForm,onInput,onChange,cancelDialogRequests,';
  assert.ok(source.includes(marker));
  vm.runInContext(source.replace(marker,'return {eventTable,eventFrames,eventPages,'+marker.slice(8)),context);
  return context.SalaryMateStocksUI.create({state:()=>({stockPortfolio:{assets:[],transactions:[],marketData:{autoRefresh:false,quoteEnabled:false}}}),year:()=>2026,today:()=>'2026-10-09'});
}
function events(count,dividendsOnly=false){
  const types=['buy','sell','dividend','split','opening'];
  return Array.from({length:count},(_,i)=>({
    id:'fixture-'+i,type:dividendsOnly?'dividend':types[i%5],date:'2026-10-01',time:'08:30',
    asset:{id:'fixture',symbol:'<FIX&>',name:'Fictional "name"',market:'TW',currency:i%2?'USD':'TWD',account:i%3?'Fixture <account>':''},
    note:i%2?'Fictional & note':'',quantity:.123456789,price:15.123456,amount:21.123,ratio:2.5,
    exDividendDate:i%2?'2026-09-01':'',cashDividend:i%3?0:null,fee:.125,tax:.375,fx:31.1234567,
    cash:i%2?100:-100,realized:i%3-1,costBasisTwd:123.456,matchedLots:[]
  }));
}
for(const dividendsOnly of [false,true])test(`R94 ${dividendsOnly?'dividend':'mixed transaction'} pages preserve byte-exact R93 markup and snapshots`,()=>{
  const a=eventHarness(previous['stocks-ui.js']),b=eventHarness(current['stocks-ui.js']);
  for(const count of [0,1,49,50,51,101])for(const showActions of [false,true])for(const paged of [false,true]){
    const input=events(count,dividendsOnly),original=JSON.stringify(input);
    const options={scope:paged?'detail':'batch',paged,signature:`${count}/${showActions}/${paged}`};
    const pages=paged?Math.max(1,Math.ceil(count/50)):1;
    for(let page=0;page<pages;page++){
      if(page){a.eventPages.get(options.scope).page=page;b.eventPages.get(options.scope).page=page;}
      assert.equal(b.eventTable(input,showActions,options),a.eventTable(input,showActions,options));
      assert.deepEqual(plain(b.eventPages.get(options.scope)),plain(a.eventPages.get(options.scope)));
      assert.deepEqual([...b.eventFrames.get(options.scope).sales.keys()],[...a.eventFrames.get(options.scope).sales.keys()]);
    }
    assert.equal(JSON.stringify(input),original);
  }
});

test('R94 shared artwork bundler produces byte-exact R93 embedded image declarations',async()=>{
  const oldBuilder=prior('scripts/build-single-html.mjs');
  const start=oldBuilder.indexOf("  if(name==='app.js'){\n    const companionPath=");
  const end=oldBuilder.indexOf("  if(name==='i18n-en.js')",start);
  assert.ok(start>=0&&end>start);
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const embedBefore=new AsyncFunction('source','base','readFile','path',"const name='app.js';\n"+oldBuilder.slice(start,end)+'\nreturn source;');
  assert.equal(await embedPortableArtwork(current['app.js'],base),await embedBefore(current['app.js'],base,readFile,path));
});

test('R94 missing artwork declarations fail packaging rather than silently leaving a network dependency',async()=>{
  for(const name of ['HD2D_COMPANION_SRC','HD2D_FLIGHT_SOURCES','HD2D_CAST_SRC','HD2D_WIND_EXTRAS','HD2D_WIND_SOURCES']){
    const source=current['app.js'].replace('const '+name+' =','const MISSING =');
    await assert.rejects(embedPortableArtwork(source,base),new RegExp('Missing artwork declaration: '+name));
  }
});
