// Production-function regression tests with fictional records and plain spies.
// No application boot, browser, DOM implementation or network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const directory=fileURLToPath(new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url));
const source=fs.readFileSync(directory+'app.js','utf8');
const bootstrap=fs.readFileSync(directory+'bootstrap.js','utf8').split('// Desktop horizontal scroll controls')[0];
const saveBlock=source.slice(source.indexOf('    const saveState ='),source.indexOf('    const restoreUiPreferences ='));
const preferenceBlock=source.slice(source.indexOf('    const commitVisualPreference ='),source.indexOf('    const refreshVisualPreferences ='));
const copy=value=>JSON.parse(JSON.stringify(value));
const preferences=()=>({companyFilter:'ALL',selectedYear:2026,attendanceTab:'overtime',overtimeMonth:0,leaveMonth:0,leaveStatus:'active',hourlyMonth:0,salaryCalcTab:'overtime',hourlyAdvancedOpen:false,yearEndCompanyId:'',raiseCompanyId:'',interfaceStyle:'autumn',hd2dBackground:'canyon',autumnBackground:'cafe',surfaceOpacity:'frosted',motionEffect:'flow',interfaceMode:'minimal',colorTheme:'slate'});
const fixture=()=>({schemaVersion:15,appVersion:'fixture',updatedAt:'2026-10-01T00:00:00.000Z',records:Array.from({length:10000},(_,i)=>({id:'fixture-'+i,baseSalary:30000+i,note:'測試資料'})),companies:[{id:'company-fixture',name:'測試公司'}],stockPortfolio:{assets:[],transactions:[]},uiPreferences:preferences()});

function storageHarness(initial=null,options={}) {
  let raw=initial;
  const counts={reads:0,writes:[],removes:0,labelChanges:0};
  const callbacks=new Map();
  const label={classList:{add(){}},set textContent(_value){counts.labelChanges++;if(options.failLabel)throw Error('Fixture label failure');}};
  const window={SalaryMatePortable:true,addEventListener(name,handler){callbacks.set(name,handler);}};
  const localStorage={getItem(){counts.reads++;return raw;},setItem(name,value){if(options.failWrite)throw Error('QuotaExceededError');counts.writes.push({name,value});raw=String(value);},removeItem(){counts.removes++;raw=null;}};
  vm.runInNewContext(bootstrap,{window,localStorage,document:{getElementById:()=>label},navigator:{},location:{protocol:'https:'}});
  return {api:window.SalaryMateStorage,window,counts,options,setRaw:value=>{raw=value;},getRaw:()=>raw};
}

function appHarness(options={}) {
  const state=fixture(),ui={...preferences(),draftScope:null};
  const storage=storageHarness(JSON.stringify(state),options);
  storage.api.getItem('salarymate_v5_full_state');
  const counts={clones:0,stringifies:0,cacheClears:0,cloudChanges:0,syncs:0,statuses:[],released:[],logs:[],toasts:[]};
  const locks=new Set();
  const productionClone=vm.runInNewContext(source.match(/const clone = ([^\n]+);/)[1]);
  storage.window.SalaryMateCloud={changed(){counts.cloudChanges++;if(options.failCloud)throw Error('Fixture cloud failure');}};
  const context=vm.createContext({state,ui,APP_VERSION:'fixture',SCHEMA_VERSION:15,STORAGE_KEY:'salarymate_v5_full_state',window:storage.window,console:{error(...args){counts.logs.push(args);},warn(...args){counts.logs.push(args);}},clone(value){counts.clones++;return productionClone(value);},invalidateCalculationCache(){counts.cacheClears++;},syncDataStatusFromState(){counts.syncs++;if(options.failSync)throw Error('Fixture sync failure');},setOperationStatus(value){counts.statuses.push(value);if(options.failStatus===value)throw Error('Fixture operation-status failure');},toast(...args){counts.toasts.push(args);if(options.failToast)throw Error('Fixture toast failure');},acquireOperationLock(key){if(locks.has(key)||options.denyLock)return false;locks.add(key);return true;},releaseOperationLock(key,remember){counts.released.push([key,remember]);locks.delete(key);},normalizeInterfaceStyle:x=>x,normalizeHd2dBackground:x=>x,normalizeAutumnBackground:x=>x,normalizeSurfaceOpacity:x=>x,normalizeMotionEffect:x=>x,normalizeInterfaceMode:x=>x,normalizeColorTheme:x=>x});
  context.JSON={parse:JSON.parse,stringify(...args){counts.stringifies++;return JSON.stringify(...args);}};
  vm.runInContext(saveBlock+'\n'+preferenceBlock+'\nglobalThis.api={saveState,commitStateMutation,commitVisualPreference,commitUiPreferencePatch,getState:()=>state};',context);
  return {api:context.api,state,ui,storage,counts,locks,context};
}

test('R93 production preference patch avoids all-state clone; financial commit retains one clone',()=>{
  const h=appHarness(),references={records:h.state.records,companies:h.state.companies,stockPortfolio:h.state.stockPortfolio};
  assert.equal(h.api.commitUiPreferencePatch({autumnBackground:'fuji'}),true);
  assert.equal(h.counts.clones,0);assert.equal(h.counts.stringifies,1);assert.equal(h.storage.counts.writes.length,1);assert.equal(h.counts.cacheClears,0);assert.equal(h.counts.cloudChanges,1);
  assert.equal(h.state.records,references.records);assert.equal(h.state.companies,references.companies);assert.equal(h.state.stockPortfolio,references.stockPortfolio);
  assert.equal(h.api.commitStateMutation(()=>{h.state.records[0].baseSalary=32000;}),true);
  assert.equal(h.counts.clones,1);assert.equal(h.storage.counts.writes.length,2);assert.equal(h.counts.cacheClears,1);
  assert.equal(JSON.parse(h.storage.getRaw()).records[0].baseSalary,32000);
});

test('R93 quota failure restores exact metadata references, UI scalars and unchanged financial identities',()=>{
  const h=appHarness({failWrite:true}),stateValue=copy(h.state),uiValue=copy(h.ui),preferenceReference=h.state.uiPreferences,recordsReference=h.state.records,raw=h.storage.getRaw();
  assert.equal(h.api.commitUiPreferencePatch({autumnBackground:'fuji',selectedYear:2025,interfaceMode:'large'}),false);
  assert.deepEqual(h.state,stateValue);assert.deepEqual(h.ui,uiValue);assert.equal(h.state.uiPreferences,preferenceReference);assert.equal(h.state.records,recordsReference);
  assert.equal(h.counts.clones,0);assert.equal(h.storage.getRaw(),raw);assert.equal(h.storage.counts.writes.length,0);assert.equal(h.counts.cloudChanges,0);assert.equal(h.locks.size,0);assert.equal(h.counts.released.length,1);
});

test('R93 failed UI patch preserves absent versus own-undefined metadata and UI properties',()=>{
  const h=appHarness({failWrite:true});
  delete h.state.schemaVersion;h.state.appVersion=undefined;delete h.state.uiPreferences;h.state.updatedAt=undefined;delete h.ui.colorTheme;
  const stateKeys=Object.keys(h.state),uiKeys=Object.keys(h.ui),records=h.state.records;
  assert.equal(h.api.commitUiPreferencePatch({colorTheme:'rose'}),false);
  assert.deepEqual(Object.keys(h.state),stateKeys);assert.deepEqual(Object.keys(h.ui),uiKeys);
  assert.equal(Object.hasOwn(h.state,'schemaVersion'),false);assert.equal(Object.hasOwn(h.state,'uiPreferences'),false);assert.equal(Object.hasOwn(h.state,'appVersion'),true);assert.equal(h.state.appVersion,undefined);assert.equal(Object.hasOwn(h.state,'updatedAt'),true);assert.equal(h.state.updatedAt,undefined);assert.equal(Object.hasOwn(h.ui,'colorTheme'),false);assert.equal(h.state.records,records);
});

test('R93 invalid UI patches never change data, write, clone or acquire a lock',()=>{
  for(const patch of [{records:[]},{unknown:'x'},{interfaceMode:{}},{selectedYear:NaN},{selectedYear:Infinity},{interfaceStyle:()=>{}},{},null]){
    const h=appHarness(),before=JSON.stringify(h.state),ui=JSON.stringify(h.ui);
    assert.throws(()=>h.api.commitUiPreferencePatch(patch));assert.equal(JSON.stringify(h.state),before);assert.equal(JSON.stringify(h.ui),ui);assert.equal(h.counts.clones,0);assert.equal(h.storage.counts.writes.length,0);assert.equal(h.counts.released.length,0);assert.equal(h.locks.size,0);
  }
});

test('R93 repeated UI scalar patch skips storage serialization/write and preserves updatedAt',()=>{
  const h=appHarness(),before=h.state.updatedAt,preferences=h.state.uiPreferences;
  for(let i=0;i<5;i++)assert.equal(h.api.commitUiPreferencePatch({selectedYear:2026,autumnBackground:'cafe'}),true);
  assert.equal(h.storage.counts.writes.length,0);assert.equal(h.counts.clones,0);assert.equal(h.counts.stringifies,0);assert.equal(h.counts.cloudChanges,0);assert.equal(h.counts.cacheClears,0);assert.equal(h.state.updatedAt,before);assert.equal(h.state.uiPreferences,preferences);assert.equal(h.locks.size,0);
});

test('R93 repeated UI scalar patch still rejects another tab update before reporting success',()=>{
  const h=appHarness(),initial=JSON.stringify(h.state),changed=JSON.stringify({...h.state,updatedAt:'2026-10-08T00:00:00.000Z'});
  h.storage.setRaw(changed);
  assert.equal(h.api.commitUiPreferencePatch({selectedYear:2026}),false);assert.equal(JSON.stringify(h.state),initial);assert.equal(h.storage.getRaw(),changed);assert.equal(h.storage.counts.writes.length,0);assert.equal(h.counts.cloudChanges,0);assert.equal(h.counts.clones,0);assert.equal(h.locks.size,0);
});

test('R93 bootstrap exact-string duplicate saves skip native setItem after conflict validation',()=>{
  const h=storageHarness('fictional-original'),key='salarymate_v5_full_state';h.api.getItem(key);h.api.setItem(key,'fictional-original');assert.equal(h.counts.writes.length,0);h.api.assertCurrent();
  h.api.setItem(key,'fictional-next');assert.equal(h.counts.writes.length,1);
  h.setRaw('another-tab');assert.throws(()=>h.api.setItem(key,'another-tab'),/另一分頁/);assert.equal(h.counts.writes.length,1);assert.equal(h.getRaw(),'another-tab');assert.throws(()=>h.api.assertCurrent(),/另一分頁/);
});

test('R93 resetSnapshots=true retains the explicit forced-write contract',()=>{
  const h=storageHarness('fictional-original'),key='salarymate_v5_full_state';h.api.getItem(key);h.api.setItem(key,'fictional-original',true);assert.equal(h.counts.writes.length,1);
});

test('R93 bootstrap quota error keeps its confirmed baseline so retry and conflict checks remain sound',()=>{
  const h=storageHarness('fictional-original',{failWrite:true}),key='salarymate_v5_full_state';h.api.getItem(key);
  assert.throws(()=>h.api.setItem(key,'fictional-next'),/Quota/);assert.equal(h.getRaw(),'fictional-original');assert.doesNotThrow(()=>h.api.assertCurrent());
  h.options.failWrite=false;h.api.setItem(key,'fictional-next');assert.equal(h.getRaw(),'fictional-next');assert.equal(h.counts.writes.length,1);assert.throws(()=>h.api.setItem('wrong-key','x'),/Unexpected/);
});

test('R93 bootstrap status notification failure cannot turn a durable write into reported failure',()=>{
  const h=storageHarness('fictional-original',{failLabel:true}),key='salarymate_v5_full_state';h.api.getItem(key);
  assert.doesNotThrow(()=>h.api.setItem(key,'fictional-next'));assert.equal(h.getRaw(),'fictional-next');assert.equal(h.counts.writes.length,1);assert.doesNotThrow(()=>h.api.assertCurrent());
});

test('R93 saveState Cloud and data-status notification failures retain successful UI/financial writes',()=>{
  for(const options of [{failCloud:true},{failSync:true}]){
    const h=appHarness(options);assert.equal(h.api.commitUiPreferencePatch({autumnBackground:'fuji'}),true);assert.equal(h.state.uiPreferences.autumnBackground,'fuji');assert.equal(JSON.parse(h.storage.getRaw()).uiPreferences.autumnBackground,'fuji');assert.equal(h.storage.counts.writes.length,1);
    assert.equal(h.api.commitStateMutation(()=>{h.state.records[0].baseSalary=32000;}),true);assert.equal(h.api.getState().records[0].baseSalary,32000);assert.equal(JSON.parse(h.storage.getRaw()).records[0].baseSalary,32000);assert.equal(h.storage.counts.writes.length,2);assert.equal(h.locks.size,0);
  }
});

test('R93 commit completion notification failure must not roll back persisted financial data or report UI failure',()=>{
  const ui=appHarness({failStatus:'idle'});assert.equal(ui.api.commitUiPreferencePatch({autumnBackground:'fuji'}),true);assert.equal(ui.api.getState().uiPreferences.autumnBackground,'fuji');assert.equal(JSON.parse(ui.storage.getRaw()).uiPreferences.autumnBackground,'fuji');assert.equal(ui.locks.size,0);
  const financial=appHarness({failStatus:'idle'});assert.equal(financial.api.commitStateMutation(()=>{financial.state.records[0].baseSalary=32000;}),true);assert.equal(financial.api.getState().records[0].baseSalary,32000);assert.equal(JSON.parse(financial.storage.getRaw()).records[0].baseSalary,32000);assert.equal(financial.locks.size,0);
});

test('R93 failed persistence releases UI lock even when rollback notifications also fail',()=>{
  for(const options of [{failWrite:true,failSync:true},{failWrite:true,failStatus:'failure'},{failWrite:true,failToast:true}]){
    const h=appHarness(options),before=JSON.stringify(h.state),ui=JSON.stringify(h.ui);
    assert.equal(h.api.commitUiPreferencePatch({autumnBackground:'fuji'}),false);assert.equal(JSON.stringify(h.state),before);assert.equal(JSON.stringify(h.ui),ui);assert.equal(h.locks.size,0);assert.equal(h.storage.counts.writes.length,0);
  }
});

test('R93 production exportPayload preserves exact JSON with no full-state clone',()=>{
  const h=appHarness(),expression=source.match(/exportPayload:\s*\(\)\s*=>\s*(JSON\.stringify\([^\n]+\)),\n/)[1];
  vm.runInContext('globalThis.exportPayload=()=>'+expression+';',h.context);
  const actual=h.context.exportPayload(),exportedAt=JSON.parse(actual).exportInfo.exportedAt;
  const expected=JSON.stringify({...copy(h.state),exportInfo:{app:'個人薪資與投資管理',appVersion:'fixture',schemaVersion:15,exportedAt}},null,2);
  assert.equal(actual,expected);assert.equal(h.counts.clones,0);assert.equal(JSON.parse(actual).records.length,10000);
  const isolated=JSON.parse(actual);isolated.records[0].baseSalary=1;assert.equal(h.state.records[0].baseSalary,30000);
});

test('R93 actual backup encrypt captures plaintext before first await without mutating live state',async()=>{
  const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa:value=>Buffer.from(value,'binary').toString('base64'),atob:value=>Buffer.from(value,'base64').toString('binary')});
  vm.runInContext(fs.readFileSync(directory+'backup.js','utf8'),context);
  const state={records:[{id:'fixture',baseSalary:32000}],uiPreferences:{interfaceStyle:'autumn'}},exportInfo={app:'SalaryMate',schemaVersion:15};
  const encrypted=context.SalaryMateBackup.encrypt({...state,exportInfo},'fixture-only-password');state.records[0].baseSalary=1;
  const decrypted=await context.SalaryMateBackup.decrypt(await encrypted,'fixture-only-password');
  assert.equal(decrypted.records[0].baseSalary,32000);assert.equal(state.records[0].baseSalary,1);assert.equal(decrypted.exportInfo.schemaVersion,15);
});
