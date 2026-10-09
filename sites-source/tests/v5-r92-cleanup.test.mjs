import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Production functions, native promises/controllers and callback spies only.
// No browser, DOM emulator, private data, network or persistent storage.
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const stockSource=fs.readFileSync(new URL('stocks-ui.js',base),'utf8');
const driveSource=fs.readFileSync(new URL('google-drive-ui.js',base),'utf8');
const appSource=fs.readFileSync(new URL('app.js',base),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(){
 const selectors=new Map(),rows=[],events=new Map(),dialogEvents=new Map(),cleared=[],timers=[];
 const counts={translations:0,renders:0,commits:0};
 const state={stockPortfolio:{assets:[{id:'fixture-a',symbol:'TEST',market:'TW',currency:'TWD'}],transactions:[],marketData:{autoRefresh:false,quoteEnabled:false}}};
 const dialog={open:true,addEventListener:(name,fn)=>{dialogEvents.set(name,fn);}};
 selectors.set('#appDialog',dialog);
 const document={hidden:false,querySelector:name=>selectors.get(name)||null,querySelectorAll:name=>name==='#stockBatchRows [data-batch-row]'?rows:[],addEventListener:(name,fn)=>{events.set('document:'+name,fn);}};
 const services={};
 const context={document,navigator:{onLine:true},AbortController,Intl,Date,console,
  setTimeout(fn,delay){const id=timers.length+1;timers.push({id,fn,delay});return id;},clearTimeout:id=>cleared.push(id),
  addEventListener:(name,fn)=>{events.set('window:'+name,fn);},
  SalaryMateStocks:{dateOK:()=>true},SalaryMateStockServices:services,
  SalaryMateI18n:{user:String,apply:()=>counts.translations++},SalaryMateScrollbars:{refresh(){}}};
 vm.createContext(context);
 const probe=`return {__test:{searchCatalog,lookupName,loadDividends,loadBatchDividend,saveBatch,readBatchTransactions,
  setRequests(value){catalogController=value.catalog;lookupController=value.lookup;dividendController=value.dividend;lookupTimer=value.timer;},
  setBatch(value){batchDraft=value;},
  state(){return {catalogController,lookupController,dividendController,lookupTimer,catalogSequence,lookupSequence,dividendSequence,batchDraft,marketController,marketTimer,forecastController,forecastSequence};},
  setBackground(value){marketController=value.market;marketTimer=value.timer;forecastController=value.forecast;}},render,click,submit,`;
 assert.ok(stockSource.includes('return {render,click,submit,'),'Missing stock API exposure point');
 vm.runInContext(stockSource.replace('return {render,click,submit,',probe),context);
 const callbacks={state:()=>state,render:()=>counts.renders++,commit:()=>{counts.commits++;throw Error('Unexpected data write');},today:()=>'2026-10-09',id:()=>'fixture-id'};
 const api=context.SalaryMateStocksUI.create(callbacks);
 return {context,document,services,state,dialog,selectors,rows,events,dialogEvents,cleared,timers,counts,callbacks,api,probe:api.__test};
}
function rowFixture(){
 const fields={type:{value:'dividend'},assetId:{value:'fixture-a'},date:{value:'2026-10-09'},dividendPeriod:{value:'',innerHTML:''},autoDividend:{checked:false},exDividendDate:{value:'2026-09-01'},cashDividend:{value:'1'}};
 const status={textContent:''};
 const row={isConnected:true,querySelector:name=>name==='[data-batch-dividend-status]'?status:fields[name.match(/^\[name="(.+)"\]$/)?.[1]]||null};
 return {row,fields,status};
}
function batchFixture(h){
 const batch={dividendCache:new Map(),dividendController:null,review:{checked:true}};
 const preview={innerHTML:'checked'},submit={disabled:false};
 const form={querySelector:name=>name==='[type="submit"]'?submit:name==='#stockBatchPreview'?preview:null};
 h.selectors.set('#stockBatchForm',form);h.probe.setBatch(batch);
 return {batch,form,preview,submit};
}
function controllerSpy(){const c=new AbortController();let calls=0;const abort=c.abort.bind(c);c.abort=()=>{calls++;abort();};return {c,get calls(){return calls;}};}
function appClosingFixture(h,{dirty=true,allowed=false,onClose=()=>{}}={}){
 const calls={closes:0,blurs:0,confirmations:0,scopeClears:0,painted:0,focuses:0,scrolls:0};
 const active={blur:()=>calls.blurs++};h.document.activeElement=active;
 h.dialog.contains=value=>value===active;
 h.dialog.close=()=>{onClose();calls.closes++;h.dialog.open=false;};
 const target={isConnected:true,focus:()=>calls.focuses++};
 const context={stocksUI:h.api,document:h.document,ui:{confirmAction:()=>{},dialogBaseline:'fixture-dirty',draftScope:{entityType:'stock-batch'}},
  $:name=>name==='#appDialog'?h.dialog:target,
  dialogHasUnsavedChanges:()=>dirty,clearDraftScope(){calls.scopeClears++;context.ui.draftScope=null;},
  afterPaint:fn=>{calls.painted++;fn();},dialogReturnScrollY:37,dialogReturnFocus:target,
  window:{confirm:()=>{calls.confirmations++;return allowed;},scrollTo:value=>{assert.equal(value.top,37);calls.scrolls++;}}};
 const start=appSource.indexOf('    const requestCloseDialog ='),end=appSource.indexOf('    const interfaceStylePreview =',start);
 assert.ok(start>=0&&end>start,'Missing production dialog closing section');vm.createContext(context);
 vm.runInContext(appSource.slice(start,end)+'\nglobalThis.closing={requestCloseDialog,closeDialog};',context);
 return {context,calls,api:context.closing};
}

test('R92 app refusing to discard a dirty dialog preserves pending requests and draft state',()=>{
 const h=fixture(),request=controllerSpy(),{batch}=batchFixture(h);batch.dividendController=request.c;
 batch.dividendCache.set('TEST:2026',Promise.resolve({}));const before=copy(h.state),closing=appClosingFixture(h);
 closing.api.requestCloseDialog();assert.equal(closing.calls.confirmations,1);assert.equal(closing.calls.closes,0);assert.equal(closing.calls.scopeClears,0);
 assert.equal(request.c.signal.aborted,false);assert.equal(batch.dividendCache.size,1);assert.equal(h.dialog.open,true);assert.equal(closing.context.ui.dialogBaseline,'fixture-dirty');assert.equal(h.probe.state().dividendSequence,0);assert.deepEqual(h.state,before);
});

test('R92 app accepting dialog close cancels requests before native close and retains existing focus cleanup',()=>{
 const h=fixture(),request=controllerSpy(),{batch}=batchFixture(h);batch.dividendController=request.c;const before=copy(h.state);
 const closing=appClosingFixture(h,{allowed:true,onClose:()=>assert.equal(request.c.signal.aborted,true,'root close must first cancel pending work')});
 closing.api.requestCloseDialog();assert.equal(closing.calls.confirmations,1);assert.equal(closing.calls.closes,1);assert.equal(closing.calls.blurs,1);assert.equal(closing.calls.scopeClears,1);
 assert.equal(h.dialog.open,false);assert.equal(batch.dividendController,null);assert.equal(closing.context.ui.dialogBaseline,'');assert.equal(closing.context.ui.confirmAction,null);assert.equal(closing.context.ui.draftScope,null);assert.equal(closing.calls.painted,2);assert.equal(closing.calls.focuses,1);assert.equal(closing.calls.scrolls,1);assert.deepEqual(h.state,before);
 closing.api.closeDialog();assert.equal(closing.calls.closes,1,'closing an already closed dialog must remain harmless');assert.equal(request.calls,1);assert.equal(h.counts.commits,0);
});

test('R92 successful batch saving cancels a pending manual announcement before clearing its draft',async()=>{
 const h=fixture(),{batch,form}=batchFixture(h),a=rowFixture(),request=deferred();h.rows.push(a.row);
 Object.assign(a.fields,{time:{value:'12:00'},quantity:{value:'0'},price:{value:'0'},amount:{value:'2'},ratio:{value:'1'},fee:{value:'0'},tax:{value:'0'},fx:{value:'1'},note:{value:'Fixture manual dividend'}});
 for(const [name,field] of Object.entries(a.fields)){field.name=name;field.type=name==='autoDividend'?'checkbox':'text';}
 a.row.dataset={batchRow:'fixture-row'};a.row.querySelectorAll=()=>Object.values(a.fields);
 batch.id='fixture-batch';batch.baseline=JSON.stringify(h.state.stockPortfolio);
 h.services.dividends=()=>request.promise;const pending=h.probe.loadBatchDividend(a.row),controller=batch.dividendController;
 assert.equal(a.row._dividendPending,true);assert.equal(a.fields.autoDividend.checked,false,'manual values may be reviewed while a request is pending');
 const rows=h.probe.readBatchTransactions();batch.review={rows:JSON.stringify(rows),result:{duplicates:[]}};
 h.context.SalaryMateStocks.prepareBatch=(portfolio,transactions)=>({next:{...copy(portfolio),transactions:[...portfolio.transactions,...copy(transactions)]},events:transactions,duplicates:[]});
 const closing=appClosingFixture(h,{dirty:false,onClose:()=>assert.equal(controller.signal.aborted,true,'draft controller must be cancelled before native close')});
 h.callbacks.validate=()=>true;h.callbacks.assert=()=>true;h.callbacks.close=closing.api.closeDialog;h.callbacks.toast=()=>{};h.callbacks.error=(_form,message)=>assert.fail(message);
 h.callbacks.commit=mutate=>{h.counts.commits++;mutate();return true;};
 h.probe.saveBatch(form);assert.equal(controller.signal.aborted,true);assert.equal(h.probe.state().batchDraft,null);assert.equal(closing.calls.closes,1);assert.equal(h.counts.commits,1);assert.equal(h.state.stockPortfolio.transactions.length,1);
 const saved=copy(h.state),cash=a.fields.cashDividend.value;
 request.resolve({announcements:[{symbol:'TEST',market:'TW',currency:'TWD',exDividendDate:'2026-10-01',cashDividend:7}],errors:[]});await pending;
 assert.deepEqual(h.state,saved);assert.equal(a.fields.cashDividend.value,cash);assert.equal(h.counts.commits,1);assert.equal(a.row._dividendPending,false);
});

test('R92 dialog cancellation aborts presentation requests, invalidates callbacks and preserves background controllers',()=>{
 const h=fixture(),requests=Object.fromEntries(['catalog','lookup','dividend','batch','market','forecast'].map(key=>[key,controllerSpy()]));
 const row=rowFixture();row.row._dividendPending=true;row.row._dividendKey='old';h.rows.push(row.row);
 const {batch}=batchFixture(h);batch.dividendController=requests.batch.c;batch.dividendCache.set('TEST:2026',Promise.resolve({}));
 const button={disabled:true,removeAttribute(name){assert.equal(name,'aria-busy');}};
 const form={_iconSequence:2,_dividendKey:'old',querySelector:()=>button};h.selectors.set('#stockForm',form);
 h.probe.setRequests({catalog:requests.catalog.c,lookup:requests.lookup.c,dividend:requests.dividend.c,timer:44});
 h.probe.setBackground({market:requests.market.c,forecast:requests.forecast.c,timer:55});
 h.api.cancelDialogRequests();const after=h.probe.state();
 for(const key of ['catalog','lookup','dividend','batch']){assert.equal(requests[key].c.signal.aborted,true);assert.equal(requests[key].calls,1);}
 for(const key of ['market','forecast']){assert.equal(requests[key].c.signal.aborted,false);assert.equal(requests[key].calls,0);}
 assert.equal(after.catalogSequence,1);assert.equal(after.lookupSequence,1);assert.equal(after.dividendSequence,1);
 assert.equal(after.catalogController,null);assert.equal(after.lookupController,null);assert.equal(after.dividendController,null);assert.equal(after.lookupTimer,null);
 assert.equal(after.marketTimer,55);assert.equal(after.forecastSequence,0);assert.ok(h.cleared.includes(44));
 assert.equal(batch.dividendController,null);assert.equal(batch.dividendCache.size,0);assert.equal(row.row._dividendPending,false);assert.equal(row.row._dividendKey,'');assert.equal(row.row._dividendSequence,1);
 assert.equal(form._iconSequence,3);assert.equal(form._dividendKey,'');assert.equal(button.disabled,false);assert.equal(h.counts.commits,0);
 h.api.cancelDialogRequests();assert.equal(requests.catalog.calls,1);assert.equal(requests.batch.calls,1);assert.equal(h.counts.commits,0);
});

test('R92 catalog and name results arriving after cancellation cannot rewrite retained form labels or values',async()=>{
 const h=fixture(),catalog=deferred(),lookup=deferred();let catalogSignal,lookupSignal;
 h.services.catalog=(_query,signal)=>{catalogSignal=signal;return catalog.promise;};h.services.lookup=(_market,_symbol,signal)=>{lookupSignal=signal;return lookup.promise;};
 const box={isConnected:true,innerHTML:''};h.selectors.set('#stockCatalogResults',box);
 const status={textContent:''},elements={symbol:{value:'TEST'},market:{value:'TW'},name:{value:'Fixture original'},currency:{value:'TWD'}};
 const form={elements,isConnected:true,querySelector:name=>name==='[data-stock="lookup-dividends"]'?null:status};
 h.selectors.set('#stockForm',form);h.selectors.set('#stockForm[data-kind="asset"]',form);h.selectors.set('#stockLookupStatus',status);
 const catalogWork=h.probe.searchCatalog('TEST'),nameWork=h.probe.lookupName();
 const content=box.innerHTML,notice=status.textContent;h.dialog.open=false;h.api.cancelDialogRequests();
 catalog.resolve({quotes:[{symbol:'TEST',name:'Late catalog'}],errors:[],total:1});lookup.resolve({quotes:[{market:'TW',symbol:'TEST',name:'Late name',currency:'TWD'}],errors:[]});
 await Promise.all([catalogWork,nameWork]);assert.equal(catalogSignal.aborted,true);assert.equal(lookupSignal.aborted,true);
 assert.equal(box.innerHTML,content);assert.equal(status.textContent,notice);assert.equal(elements.name.value,'Fixture original');assert.equal(h.counts.translations,0);assert.equal(h.counts.commits,0);
});

test('R92 single-dividend cancellation re-enables lookup and ignores a late announcement',async()=>{
 const h=fixture(),work=deferred();let signal;
 h.services.dividends=(_market,_symbol,_year,s)=>{signal=s;return work.promise;};
 const status={textContent:''},choices={hidden:false},button={disabled:false,setAttribute(){},removeAttribute(){}},source={innerHTML:''};
 const elements={type:{value:'dividend'},assetId:{value:'fixture-a'},date:{value:'2026-10-09'},autoDividend:{checked:false},exDividendDate:{value:'2026-09-01'},cashDividend:{value:'1'}};
 const form={elements,isConnected:true,querySelector:name=>({'#stockDividendStatus':status,'#stockDividendChoices':choices,'[data-stock="lookup-dividends"]':button,'#stockDividendSource':source})[name]||null};
 h.selectors.set('#stockForm',form);h.selectors.set('#stockForm[data-kind="transaction"]',form);
 const pending=h.probe.loadDividends(),notice=status.textContent,translations=h.counts.translations;
 assert.equal(button.disabled,true);h.dialog.open=false;h.api.cancelDialogRequests();assert.equal(button.disabled,false);
 work.resolve({announcements:[{symbol:'TEST',market:'TW',currency:'TWD',exDividendDate:'2026-10-01',cashDividend:7}],errors:[]});await pending;
 assert.equal(signal.aborted,true);assert.equal(status.textContent,notice);assert.equal(form._dividendRows.length,0);assert.equal(form._dividendKey,'');assert.equal(elements.cashDividend.value,'1');assert.equal(h.counts.translations,translations);assert.equal(h.counts.commits,0);
});

test('R92 batch dividend rows share one cancellable request and a closed retained dialog never accepts its result',async()=>{
 const h=fixture(),{batch}=batchFixture(h),a=rowFixture(),b=rowFixture(),request=deferred();h.rows.push(a.row,b.row);
 const calls=[];h.services.dividends=(...args)=>{calls.push(args);return request.promise;};
 const first=h.probe.loadBatchDividend(a.row),second=h.probe.loadBatchDividend(b.row);assert.equal(calls.length,1);assert.equal(calls[0][3],batch.dividendController.signal);assert.equal(a.row._dividendPending,true);
 const before=copy(h.state),notice=a.status.textContent,translated=h.counts.translations;h.dialog.open=false;
 request.resolve({announcements:[{symbol:'TEST',market:'TW',currency:'TWD',exDividendDate:'2026-10-01',cashDividend:7}],errors:[]});await Promise.all([first,second]);
 assert.equal(a.row._dividendRows,null);assert.equal(b.row._dividendRows,null);assert.equal(a.status.textContent,notice);assert.equal(a.fields.cashDividend.value,'1');assert.equal(h.counts.translations,translated);assert.deepEqual(h.state,before);assert.equal(h.counts.commits,0);
 h.api.cancelDialogRequests();assert.equal(calls[0][3].aborted,true);assert.equal(batch.dividendCache.size,0);assert.equal(a.row._dividendPending,false);
 await h.probe.loadBatchDividend(a.row);assert.equal(calls.length,1,'closed dialog must not begin new work');
});

test('R92 cancelled batch work cannot evict a reopened request and the new controller accepts its own announcement',async()=>{
 const h=fixture(),{batch}=batchFixture(h),a=rowFixture(),old=deferred(),fresh=deferred();h.rows.push(a.row);let n=0;
 h.services.dividends=()=>++n===1?old.promise:fresh.promise;
 const first=h.probe.loadBatchDividend(a.row),oldController=batch.dividendController;h.api.cancelDialogRequests();
 const second=h.probe.loadBatchDividend(a.row),nextController=batch.dividendController,nextPromise=batch.dividendCache.get('TEST:2026');assert.notEqual(nextController,oldController);assert.equal(oldController.signal.aborted,true);
 old.reject(Error('cancelled'));await first;assert.equal(batch.dividendCache.get('TEST:2026'),nextPromise);assert.equal(a.row._dividendPending,true);
 fresh.resolve({announcements:[{symbol:'TEST',market:'TW',currency:'TWD',exDividendDate:'2026-10-01',cashDividend:7}],errors:[]});await second;
 assert.equal(a.row._dividendRows.length,1);assert.equal(a.row._dividendRows[0].cashDividend,7);assert.equal(a.row._dividendPending,false);assert.equal(nextController.signal.aborted,false);assert.equal(h.counts.commits,0);
});

test('R92 hidden pages, leaving investment and pagehide cancel dialogs while existing forecast cleanup still runs',()=>{
 for(const path of ['hidden','suspend','pagehide']){
  const h=fixture(),lookup=controllerSpy(),forecast=controllerSpy(),market=controllerSpy();
  h.probe.setRequests({lookup:lookup.c,timer:17});h.probe.setBackground({forecast:forecast.c,market:market.c,timer:18});
  if(path==='hidden'){h.document.hidden=true;h.events.get('document:visibilitychange')();}
  if(path==='suspend')h.api.suspend();if(path==='pagehide')h.events.get('window:pagehide')();
  assert.equal(lookup.c.signal.aborted,true);assert.equal(forecast.c.signal.aborted,true);assert.equal(h.probe.state().forecastSequence,1);assert.equal(h.counts.commits,0);
  assert.equal(market.c.signal.aborted,path==='hidden','retain the existing background quote policy');
 }
});

function visualFingerprint(){
 const start=driveSource.indexOf('    const visualPreferenceKeys='),end=driveSource.indexOf('    const localTime=',start);assert.ok(start>=0&&end>start,'Missing Drive visual preference fingerprint');
 const context={};vm.createContext(context);vm.runInContext(driveSource.slice(start,end)+'\nglobalThis.fingerprint=fingerprint;',context);return context.fingerprint;
}
const snapshot=()=>({companies:[{id:'fiction',name:'Fixture'}],records:[],stockPortfolio:{assets:[],transactions:[]},updatedAt:'2026-10-09T00:00:00Z',exportInfo:{exportedAt:'2026-10-09T00:00:00Z'},uiPreferences:{interfaceStyle:'glass',hd2dBackground:'canyon',autumnBackground:'cafe',surfaceOpacity:'frosted',motionEffect:'flow',interfaceMode:'standard',colorTheme:'teal',companyFilter:'fixture',selectedYear:2026,attendanceTab:'overtime'}});

test('R92 Drive fingerprint detects every saved visual preference and retains business data changes',()=>{
 const fingerprint=visualFingerprint(),a=snapshot(),before=copy(a),key=fingerprint(a);
 const changes={interfaceStyle:'autumn',hd2dBackground:'sky',autumnBackground:'ocean',surfaceOpacity:'dynamic',motionEffect:'aurora',interfaceMode:'compact',colorTheme:'pink'};
 for(const [name,value] of Object.entries(changes)){const b=copy(a);b.uiPreferences[name]=value;assert.notEqual(fingerprint(b),key,name);}
 const b=copy(a);b.records.push({id:'fixture-record',amount:100});assert.notEqual(fingerprint(b),key);assert.deepEqual(a,before,'fingerprinting must not mutate the snapshot');
});

test('R92 metadata and filter movements do not create needless Drive backups, and old snapshots remain supported',()=>{
 const fingerprint=visualFingerprint(),a=snapshot(),b=copy(a);b.updatedAt='2026-10-09T05:00:00Z';b.exportInfo={exportedAt:'new'};Object.assign(b.uiPreferences,{companyFilter:'ALL',selectedYear:2025,attendanceTab:'leave',overtimeMonth:12,leaveMonth:3,leaveStatus:'all',hourlyMonth:6,salaryCalcTab:'raises',hourlyAdvancedOpen:true,yearEndCompanyId:'other',raiseCompanyId:'other'});
 assert.equal(fingerprint(a),fingerprint(b));delete a.uiPreferences;assert.doesNotThrow(()=>fingerprint(a));a.uiPreferences={};assert.equal(fingerprint(a),fingerprint({...a,uiPreferences:undefined}));
});
