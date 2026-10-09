import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import postcss from 'postcss';

// Production functions and native Node objects/callback spies only. No browser,
// DOM emulator, app boot, private data, or live network is involved.
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const app=fs.readFileSync(new URL('app.js',base),'utf8');
const css=fs.readFileSync(new URL('styles.css',base),'utf8');
const sw=fs.readFileSync(new URL('sw.js',base),'utf8');
const builder=fs.readFileSync(new URL('../scripts/build-single-html.mjs',import.meta.url),'utf8');
const origin='https://salarymate.test/dev/v5.0.0-dev.2/';
const ids=['cafe','fuji','desert','ocean'];
const scene=id=>origin+'art/background-autumn-'+id+'-r91.webp';
const copy=value=>JSON.parse(JSON.stringify(value));
function section(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Missing production section: '+start);
 return source.slice(a,b);
}
const styles=section(app,'    const INTERFACE_MODES =','    const PRIMARY_TABS =');
const calculators=section(app,'    const defaultOvertimeCalculator =','    let state =');
const visuals=section(app,'    const normalizeInterfaceStyle =','    const monthLabel =');
const normalization=section(app,'    const normalizeState =','    const ensureSupportedSchema =');
const saving=section(app,'    const saveState =','    const getCompany =');
const choices=section(app,'    const hd2dBackgroundChoicesHtml =','    const surfaceMotionInfoHtml =');
const setters=section(app,'    const setAutumnBackground =','    const setInterfaceMode =');

function fixture(){
 let failWrite=false,saved;
 const calls={stops:0,renders:0,reopens:0,writes:0,focus:[],toasts:[],statuses:[]};
 const datasets=[{styleVariant:'ornate'},{styleVariant:'ornate'}];
 const dialog={scrollTop:83},meta={content:'',setAttribute(name,value){assert.equal(name,'content');this.content=value;}};
 const context={ui:{interfaceStyle:'autumn',autumnBackground:'cafe',hd2dBackground:'harbor',surfaceOpacity:'translucent',interfaceMode:'minimal',colorTheme:'slate',selectedYear:2026,companyFilter:'ALL'},state:{schemaVersion:15,companies:[],records:[{id:'fixture-pay',grossPay:1000}],leaveRecords:[],stockPortfolio:{assets:[{id:'fixture-stock'}],transactions:[]}},
  APP_VERSION:'5.0.0-dev.2-R91',SCHEMA_VERSION:15,STORAGE_KEY:'salarymate_v5_full_state',DEFAULT_DEDUCTION_RULE:'Fixture rule',currentYear:2026,
  numberValue:value=>Number.isFinite(Number(value))?Number(value):0,clamp:(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0)),clone:copy,
  escapeHtml:String,escapeAttr:String,
  document:{body:{dataset:datasets[0]},documentElement:{dataset:datasets[1]}},
  $:selector=>selector==='meta[name="theme-color"]'?meta:selector==='#appDialog'?dialog:{focus:value=>calls.focus.push({selector,value})},
  invalidateCalculationCache(){},syncDataStatusFromState(){},
  acquireOperationLock:()=>true,releaseOperationLock(){},
  setOperationStatus:(...args)=>calls.statuses.push(args),toast:(...args)=>calls.toasts.push(args),
  console:{error(){},warn(){}},
  renderAll(){calls.renders++;context.api.applyVisualPreferences();},
  openInterfaceSettings(){calls.reopens++;dialog.scrollTop=0;},
  normalizeCompany(){throw Error('Unexpected company normalization');},normalizeRecord(){throw Error('Unexpected record normalization');},
  normalizeOvertime(){throw Error('Unexpected overtime normalization');},normalizeLeave(){throw Error('Unexpected leave normalization');},
  normalizeSalaryAdjustment(){throw Error('Unexpected salary adjustment normalization');},normalizeYearEndEstimate(){throw Error('Unexpected year-end normalization');},
  window:{SalaryMateCompanion:{stop:()=>calls.stops++},SalaryMateStocks:{empty:()=>({assets:[],transactions:[]}),normalize:value=>copy(value||{assets:[],transactions:[]})},SalaryMateCompTime:{normalizeCredit:copy,normalizeSettlement:copy},
   SalaryMateStorage:{setItem(name,value){assert.equal(name,'salarymate_v5_full_state');calls.writes++;if(failWrite)throw Error('Fixture quota');saved=value;}}}};
 vm.createContext(context);
 vm.runInContext(styles+calculators+visuals+normalization+saving+choices+setters+'\nglobalThis.api={normalizeInterfaceStyle,interfaceBaseStyle,normalizeAutumnBackground,normalizeHd2dBackground,applyInterfaceStyle,applyVisualPreferences,normalizeState,restoreUiPreferences,saveState,setAutumnBackground,hd2dBackgroundChoicesHtml,autumnBackgroundChoicesHtml,emptyState};',context);
 return {context,calls,datasets,dialog,meta,api:context.api,get saved(){return saved;},fail:value=>{failWrite=value;}};
}

test('autumn normalization and style application clear ornate variants without changing compatibility aliases or HD-2D choice',()=>{
 const f=fixture();
 for(const [value,want] of [['autumn','autumn'],['pixel','pixel-luxe'],['macaron','macaron-luxe'],['white','cards'],['unknown','glass']])assert.equal(f.api.normalizeInterfaceStyle(value),want);
 for(const [value,baseStyle,variant,family,color] of [['pixel-luxe','pixel','ornate','classic','#102635'],['autumn','autumn',undefined,'reference','#fffaf0'],['glass','glass',undefined,'classic','#475569'],['macaron-luxe','macaron','ornate','classic','#fffefa']]){
  assert.equal(f.api.applyInterfaceStyle(value),value);
  for(const dataset of f.datasets){assert.equal(dataset.interfaceStyle,baseStyle);assert.equal(dataset.styleVariant,variant);}
  assert.equal(f.datasets[0].visualFamily,family);assert.equal(f.meta.content,color);assert.equal(f.context.ui.hd2dBackground,'harbor');
 }
 assert.equal(f.calls.stops,4);
 for(const value of ['constructor','__proto__',undefined,'unknown'])assert.equal(f.api.normalizeAutumnBackground(value),'cafe');
 for(const value of ids)assert.equal(f.api.normalizeAutumnBackground(value),value);
});

test('four background choices save and reopen through production functions, retaining financial fixtures and the existing HD-2D choice',()=>{
 for(const id of ids){
  const f=fixture(),before=copy({records:f.context.state.records,stockPortfolio:f.context.state.stockPortfolio});
  f.api.setAutumnBackground(id);
  if(id==='cafe'){assert.equal(f.calls.writes,0);continue;}
  const written=JSON.parse(f.saved);
  assert.equal(written.uiPreferences.autumnBackground,id);assert.equal(written.uiPreferences.interfaceStyle,'autumn');assert.equal(written.uiPreferences.hd2dBackground,'harbor');
  assert.deepEqual({records:written.records,stockPortfolio:written.stockPortfolio},before);
  assert.equal(written.schemaVersion,15);assert.equal(f.dialog.scrollTop,83);assert.equal(f.calls.reopens,1);
  for(const dataset of f.datasets)assert.equal(dataset.autumnBackground,id);
  f.context.ui.autumnBackground='cafe';f.context.ui.hd2dBackground='canyon';f.context.state=written;f.api.restoreUiPreferences();
  assert.equal(f.context.ui.autumnBackground,id);assert.equal(f.context.ui.hd2dBackground,'harbor');
  for(const dataset of f.datasets)assert.equal(dataset.autumnBackground,id);
 }
});

test('failed background writes restore UI and state; another style ignores autumn background actions',()=>{
 const f=fixture(),before=copy(f.context.state);f.fail(true);f.api.setAutumnBackground('ocean');
 assert.equal(f.context.ui.autumnBackground,'cafe');assert.deepEqual(copy(f.context.state),before);assert.equal(f.saved,undefined);
 for(const dataset of f.datasets)assert.equal(dataset.autumnBackground,'cafe');
 assert.equal(f.dialog.scrollTop,83);assert.ok(f.calls.toasts.every(args=>args[0]!=='背景已儲存'));
 const g=fixture();g.context.ui.interfaceStyle='pixel-luxe';g.api.setAutumnBackground('fuji');
 assert.equal(g.context.ui.autumnBackground,'cafe');assert.equal(g.calls.writes,0);assert.equal(g.calls.renders,0);assert.equal(g.calls.reopens,0);
});

test('backup normalization retains valid autumn preferences and upgrades absent preferences to cafe without altering the HD-2D option set',()=>{
 const f=fixture();
 for(const id of [...ids,undefined,'__proto__']){
  const normalized=f.api.normalizeState({uiPreferences:{interfaceStyle:'autumn',autumnBackground:id,hd2dBackground:'sky'}});
  assert.equal(normalized.uiPreferences.autumnBackground,ids.includes(id)?id:'cafe');assert.equal(normalized.uiPreferences.hd2dBackground,'sky');assert.equal(normalized.uiPreferences.interfaceStyle,'autumn');assert.equal(normalized.schemaVersion,15);
 }
 assert.equal(f.api.emptyState().uiPreferences.autumnBackground,'cafe');
 const autumn=f.api.autumnBackgroundChoicesHtml();assert.deepEqual([...autumn.matchAll(/name="autumnBackground" value="([^"]+)"/g)].map(m=>m[1]),ids);assert.equal(f.api.hd2dBackgroundChoicesHtml(),'');
 f.context.ui.interfaceStyle='pixel-luxe';assert.equal(f.api.autumnBackgroundChoicesHtml(),'');
 assert.deepEqual([...f.api.hd2dBackgroundChoicesHtml().matchAll(/name="hd2dBackground" value="([^"]+)"/g)].map(m=>m[1]),['canyon','forest','harbor','aurora','sky']);
 assert.ok(app.includes('${hd2dBackgroundChoicesHtml()}${autumnBackgroundChoicesHtml()}${surfaceOpacityChoicesHtml()}'));
 assert.match(app,/event\.target\.name === 'autumnBackground'[^\n]+setAutumnBackground\(event\.target\.value\)/);
});

function worker({failPut=false}={}){
 const handlers={},stores=new Map(),requests=[],precache=[],pending=[];let online=true;
 const key=value=>typeof value==='string'?value:value.url;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {
  async match(input){return store.get(key(input))?.clone();},async put(input,response){if(failPut)throw Error('Fixture quota');store.set(key(input),response.clone());},async addAll(urls){precache.push(...urls);}};
 },async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},async match(input){for(const store of stores.values())if(store.has(key(input)))return store.get(key(input)).clone();}};
 const context={URL,Map,Set,Response,caches,self:{location:{href:origin+'sw.js'},addEventListener:(name,fn)=>{handlers[name]=fn;},skipWaiting(){},clients:{claim(){}}},fetch:async input=>{requests.push(key(input));if(!online)throw Error('Fixture offline');return new Response('fixture-image:'+key(input));}};
 vm.runInNewContext(sw+'\nglobalThis.sceneManifest=Object.fromEntries(SCENES);',context);
 const waitUntil=promise=>pending.push(promise);
 return {stores,requests,precache,manifest:copy(context.sceneManifest),online:value=>{online=value;},
  async settle(){while(pending.length)await Promise.all(pending.splice(0));},install(){handlers.install({waitUntil});},activate(){handlers.activate({waitUntil});},
  message(sceneId,source=origin,type='salarymate:cache-background'){handlers.message({data:{type,scene:sceneId},source:{url:source},waitUntil});},
  fetch(url){let result;handlers.fetch({request:new Request(url),waitUntil,respondWith:promise=>{result=promise;}});return result;}};
}

test('service worker installs no background; each autumn scene uses retained cache-first bytes across offline revisits and app activation',async()=>{
 const w=worker();w.install();await w.settle();assert.ok(!w.precache.some(url=>url.includes('background-')));assert.equal(w.requests.length,0);
 for(const id of ids)assert.equal(await(await w.fetch(scene(id))).text(),'fixture-image:'+scene(id));
 assert.deepEqual(w.requests,ids.map(scene));w.online(false);
 for(const id of ids)assert.equal(await(await w.fetch(scene(id))).text(),'fixture-image:'+scene(id));assert.equal(w.requests.length,4);
 w.stores.set('salarymate-v5-full-fixture-old',new Map());w.activate();await w.settle();
 assert.equal(w.stores.get('salarymate-v5-backgrounds-r79').size,4);assert.ok(!w.stores.has('salarymate-v5-full-fixture-old'));
});

test('first-use scene notifications are scoped, coalesce duplicate requests, survive quota failures and permit retry after an offline miss',async()=>{
 const w=worker();
 for(const id of ['autumn-unknown','constructor','__proto__'])w.message(id);
 w.message('autumn-cafe','https://outside.test/');w.message('autumn-cafe','https://salarymate.test/');w.message('autumn-cafe',origin,'wrong-type');await w.settle();assert.equal(w.requests.length,0);
 w.message('autumn-fuji');await w.settle();assert.deepEqual(w.requests,[scene('fuji')]);
 const replies=await Promise.all([w.fetch(scene('desert')),w.fetch(scene('desert'))]);assert.equal(w.requests.filter(url=>url===scene('desert')).length,1);assert.deepEqual(await Promise.all(replies.map(r=>r.text())),Array(2).fill('fixture-image:'+scene('desert')));
 const q=worker({failPut:true});assert.equal((await q.fetch(scene('ocean'))).status,200);
 const retry=worker();retry.online(false);await assert.rejects(retry.fetch(scene('cafe')),/Fixture offline/);retry.online(true);assert.equal((await retry.fetch(scene('cafe'))).status,200);
});

test('bootstrap first-page notification chooses exactly the selected autumn scene and is disabled for portable files',async()=>{
 const first=fs.readFileSync(new URL('bootstrap.js',base),'utf8').split('// Desktop horizontal')[0];
 for(const [style,id,expected,portable] of [...ids.map(id=>['autumn',id,'autumn-'+id,false]),['pixel','ocean','sky',false],['macaron','ocean','macaron',false],['glass','ocean',null,false],['autumn','fuji',null,true]]){
  const events={},sent=[],registrations=[];
  const context={window:{SalaryMatePortable:portable,addEventListener:(event,fn)=>{events[event]=fn;}},document:{body:{dataset:{interfaceStyle:style,hd2dBackground:'sky',autumnBackground:id}}},navigator:{serviceWorker:{register:async(...args)=>registrations.push(args),ready:Promise.resolve({active:{postMessage:message=>sent.push(message)}})}},location:{protocol:'https:'}};
  vm.runInNewContext(first,context);await events.load?.();assert.deepEqual(sent.map(m=>m.scene),expected?[expected]:[]);assert.equal(registrations.length,portable?0:1);
 }
});

const ast=postcss.parse(css);
function declaration(selector,prop){let value;ast.walkRules(rule=>{if(rule.selector===selector)for(const node of rule.nodes)if(node.type==='decl'&&node.prop===prop)value=node.value;});assert.ok(value!==undefined,selector+' '+prop);return value;}
function rgb(value){assert.match(value,/^#[\da-f]{6}$/i);return value.slice(1).match(/../g).map(v=>parseInt(v,16));}
function luminosity(value){return value.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminosity(a),y=luminosity(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('autumn text, financial colors and field borders remain readable over opaque paper and worst-case translucent backing',()=>{
 const selector='body[data-interface-style=autumn][data-visual-family=reference]';
 const surface=rgb(declaration(selector,'--surface')),surface2=rgb(declaration(selector,'--surface-2'));
 const alpha=Number(declaration(selector+'[data-surface-opacity=translucent]','--panel-alpha'));
 const panelRgb=declaration(selector+'[data-surface-opacity]','--panel-rgb').split(',').map(Number);
 const darkest=panelRgb.map(channel=>channel*alpha);
 const inks=['--ink','--muted','--theme-accent'].map(name=>({name,rgb:rgb(declaration(selector,name))}));
 for(const name of ['.stock-profit','.stock-loss'])inks.push({name,rgb:rgb(declaration(name,'color'))});
 for(const {name,rgb:ink} of inks)for(const [label,bg] of [['surface',surface],['surface-2',surface2],['worst-case panel',darkest]])assert.ok(contrast(ink,bg)>=4.5,`${name} on ${label}: ${contrast(ink,bg).toFixed(3)}`);
 for(const bg of [surface,surface2,darkest])assert.ok(contrast(rgb(declaration(selector,'--line')),bg)>=3,'field border contrast');
 assert.ok(contrast([255,255,255],rgb(declaration(selector,'--theme-accent')))>=4.5,'primary button text');
 // This is a mathematical color bound, not device rendering/FPS acceptance.
});

test('CSS, service worker and portable production manifests agree on all ten versioned background files; autumn visual rules remain screen-only',()=>{
 const w=worker(),cssUrls=[...css.matchAll(/url\("(\.\/art\/background-[^"]+)"\)/g)].map(m=>m[1]);
 assert.equal(cssUrls.length,10);assert.equal(new Set(cssUrls).size,10);assert.deepEqual(cssUrls.map(url=>new URL(url,origin).href).sort(),Object.values(w.manifest).sort());
 const source=section(builder,'const scenes=','for(const match of scenes)');
 const context={css};vm.runInNewContext(source+'\nglobalThis.paths=scenes.map(match=>match[1]);',context);
 assert.deepEqual(Array.from(context.paths).sort(),cssUrls.slice().sort());
 for(const url of cssUrls){const bytes=fs.readFileSync(new URL(url,base));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length>1000);}
 const assets=JSON.parse(fs.readFileSync(new URL('../R91-BACKGROUND-ASSETS.json',import.meta.url),'utf8'));
 assert.equal(assets.style,'autumn');assert.deepEqual(assets.assets.map(asset=>asset.id),ids);
 for(const asset of assets.assets){
  const bytes=fs.readFileSync(new URL('../'+asset.path,import.meta.url));
  assert.equal(asset.path,'dist/dev/v5.0.0-dev.2/art/background-autumn-'+asset.id+'-r91.webp');
  assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
 }
 for(const id of ids){assert.equal(w.manifest['autumn-'+id],scene(id));assert.equal(declaration('.v5-background-preview[data-autumn-preview='+id+']','background-image'),'var(--autumn-'+id+'-scene)');}
 ast.walkRules(rule=>{if(!/autumn/.test(rule.selector)||rule.selector===':root')return;let screen=false;
  for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='atrule'&&parent.name==='media'&&/\bscreen\b/.test(parent.params))screen=true;
  assert.ok(screen,'autumn rule may override printing: '+rule.selector);
 });
 assert.match(css,/prefers-reduced-transparency:reduce/);assert.match(css,/prefers-contrast:more/);assert.match(css,/prefers-reduced-motion:reduce/);
});
