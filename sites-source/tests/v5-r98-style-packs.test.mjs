import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';
import {ornateSelector} from '../scripts/lib/style-pack-build.mjs';
const root=new URL('..',import.meta.url),base=new URL('dist/dev/v5.0.0-dev.2/',root);
const read=name=>fs.readFileSync(new URL(name,base),'utf8');
const runtime=fs.readFileSync(new URL('scripts/lib/style-pack-runtime.js',root),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const nodes=[],timers=new Map(),posts=[],core={disabled:false};let next=0,stops=0;
 const context={URL,Promise,Error,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),
  document:{baseURI:'https://fixture.test/dev/v5.0.0-dev.2/',querySelector:()=>core,createElement:tag=>({tag,remove(){this.removed=true;}}),head:{append:node=>nodes.push(node)}},
  navigator:{serviceWorker:{ready:Promise.resolve({active:{postMessage:value=>posts.push(value)}})}}};
 context.window=context;vm.runInNewContext(runtime,context);
 return {api:context.SalaryMateStylePacks,nodes,timers,posts,core,context,get stops(){return stops;},flight(){context.SalaryMateCompanion={stop(){stops++;}};}};
}

test('R98 ordinary startup and ordinary selection make no package requests',async()=>{
 const h=harness();assert.equal(h.nodes.length,0);
 for(const style of ['glass','cards','dark']){await h.api.ensure(style);assert.equal(h.api.ready(style),true);h.api.activate(style);}
 assert.equal(h.nodes.length,0);assert.equal(h.timers.size,0);assert.equal(h.core.disabled,false);
});
test('R98 all eight ornate choices share one CSS download and no non-pixel flight download',async()=>{
 const h=harness(),styles=['autumn','doodle','cream','dusk','pencil','studio','macaron-luxe'];
 const pending=styles.map(style=>h.api.ensure(style));assert.equal(h.nodes.length,1);assert.equal(h.nodes[0].media,'not all');assert.equal(h.core.disabled,false);
 h.nodes[0].onload();await Promise.all(pending);
 for(const style of styles)assert.equal(h.api.ready(style),true);
 h.api.activate('autumn');assert.equal(h.core.disabled,true);assert.equal(h.nodes[0].media,'all');
 h.api.activate('glass');assert.equal(h.core.disabled,false);assert.equal(h.nodes[0].media,'not all');
 await h.api.ensure('autumn');assert.equal(h.nodes.length,1);
});
test('R98 pixel waits for CSS and flight before activation, reuses both and stops on normal style',async()=>{
 const h=harness(),a=h.api.ensure('pixel-luxe'),b=h.api.ensure('pixel-luxe');
 assert.equal(h.nodes.length,1);h.nodes[0].onload();await tick();assert.equal(h.nodes.length,2);assert.equal(h.nodes[1].tag,'script');
 assert.equal(h.api.activate('pixel-luxe'),false);assert.equal(h.core.disabled,false);
 h.flight();h.nodes[1].onload();await Promise.all([a,b]);
 assert.equal(h.api.activate('pixel-luxe'),true);assert.equal(h.core.disabled,true);
 h.api.activate('cards');assert.equal(h.core.disabled,false);assert.ok(h.stops>0);
 await h.api.ensure('pixel-luxe');assert.equal(h.nodes.length,2);assert.equal(h.timers.size,0);
});
test('R98 stylesheet failure and timeout retain current CSS and permit retry without late completion',async()=>{
 for(const failure of ['error','timeout']){
  const h=harness(),a=h.api.ensure('autumn'),rejected=assert.rejects(a),node=h.nodes[0],late=node.onload;
  if(failure==='error')node.onerror();else [...h.timers.values()][0]();await rejected;
  assert.equal(h.core.disabled,false);assert.equal(node.removed,true);late();assert.equal(h.api.ready('autumn'),false);
  const b=h.api.ensure('autumn');assert.equal(h.nodes.length,2);h.nodes[1].onload();await b;assert.equal(h.api.ready('autumn'),true);
 }
});
test('R98 missing flight export fails cleanly and can retry using already loaded CSS',async()=>{
 const h=harness(),a=h.api.ensure('pixel-luxe'),rejected=assert.rejects(a);
 h.nodes[0].onload();await tick();h.nodes[1].onload();await rejected;assert.equal(h.core.disabled,false);
 const b=h.api.ensure('pixel-luxe');await tick();assert.equal(h.nodes.length,3);h.flight();h.nodes[2].onload();await b;
 assert.equal(h.api.ready('pixel-luxe'),true);
});
test('R98 common CSS removes only positively scoped ornate rules; complete CSS and flight remain available',()=>{
 for(const selector of ['body:is([data-interface-style=pixel],.ordinary)','body:not([data-interface-style=pixel])','.ordinary :is(.v5-companion,.button)'])assert.equal(ornateSelector(selector),false);
 for(const selector of ['body[data-interface-style=pixel] .card','body[data-interface-style=autumn] .btn','.v5-companion-flight'])assert.equal(ornateSelector(selector),true);
 const full=read('styles.css'),expected=postcss.parse(full);
 expected.walkRules(rule=>{if(postcss.list.comma(rule.selector).every(ornateSelector))rule.remove();});
 expected.walkRules(rule=>{if(rule.selector.includes('data-preview-style='))rule.walkDecls(decl=>{if(decl.value.includes('-scene'))decl.remove();});});
 assert.equal(read('styles-core.css'),expected.toString());assert.ok(Buffer.byteLength(read('styles-core.css'))<Buffer.byteLength(full));
 const original=read('bootstrap.js').slice(read('bootstrap.js').indexOf('// R70:'));
 assert.equal(read('ornate-flight.js'),'if(!window.SalaryMateCompanion){\n'+original+'\n}\n');new vm.Script(read('ornate-flight.js'));
 assert.ok(!read('startup.js').includes('const magicBook='));assert.ok(read('startup.js').includes('SalaryMateStylePacks'));
});
test('R98 download-before-save keeps old selection on failure and ignores obsolete completions',async()=>{
 const source=read('app.js'),start=source.indexOf('    let styleSelectionRequest ='),end=source.indexOf('    const setSurfaceOpacity =',start);
 const pending=[],calls=[],context={ui:{interfaceStyle:'glass'},normalizeInterfaceStyle:value=>value,toast(){},openInterfaceSettings(){},applyVisualPreferences(){},renderAll(){},
  setVisualChoice:(key,value)=>{calls.push(value);context.ui[key]=value;},window:{SalaryMateStylePacks:{ready:style=>['glass','cards'].includes(style),ensure:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}}};
 vm.runInNewContext(source.slice(start,end)+'\nglobalThis.select=setInterfaceStyle;',context);
 const failed=context.select('autumn');assert.equal(context.ui.interfaceStyle,'glass');pending[0].reject(Error('offline'));await failed;assert.equal(calls.length,0);
 const old=context.select('pixel-luxe');context.select('cards');pending[1].resolve();await old;assert.equal(context.ui.interfaceStyle,'cards');assert.deepEqual(calls,['cards']);
 const next=context.select('autumn');pending[2].resolve();await next;assert.equal(context.ui.interfaceStyle,'autumn');
});
test('R98 service worker declares versioned packages outside mandatory install and guards message origin',()=>{
 const source=read('sw.js'),packages=JSON.parse(source.match(/const STYLE_PACKS=(\[[^;]+\]);/)[1]),shell=JSON.parse(source.match(/const SHELL=(\[[^;]+\]);/)[1]);
 assert.equal(packages.length,2);assert.ok(packages.every(path=>!shell.includes(path)));assert.ok(shell.some(path=>path.includes('styles-core.css')));
 assert.match(source,/\.\.\.OPTIONAL,\.\.\.STYLE_PACKS/);assert.match(source,/source.origin!==BASE.origin\|\|!source.pathname.startsWith\(BASE.pathname\)/);
});
