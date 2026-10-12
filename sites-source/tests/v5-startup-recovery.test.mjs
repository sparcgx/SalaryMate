import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {JSDOM}=await import(process.env.SALARYMATE_DOM_MODULE||'jsdom');
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',base),'utf8');
const guard=html.match(/<script data-startup-guard>([\s\S]*?)<\/script>/)?.[1];
assert.ok(guard,'The recovery guard must execute before requests can fail.');
const source=fs.readFileSync(new URL('bootstrap.js',base),'utf8');
const start=source.indexOf('// R99 startup screen:'),end=source.indexOf('// Desktop horizontal scroll runtime.',start);
const startup=source.slice(start,end);
function harness(){
 const dom=new JSDOM(html,{url:'https://fixture.test/dev/v5.0.0-dev.2/',runScripts:'outside-only'}),document=dom.window.document;
 const listeners=new Map(),calls={reloads:0,confirms:0};let allowReload=false;
 const window={document,location:{reload(){calls.reloads++;}},confirm(){calls.confirms++;return allowReload;},addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);}};
 Object.defineProperty(window,'localStorage',{get(){throw Error('Startup recovery must not read or write user storage');}});
 const context=vm.createContext({window,document,URL,Date});
 const emit=(type,target,filename)=>{for(const fn of listeners.get(type)||[])fn({type,target,filename});if(target!==window)target.dispatchEvent(new dom.window.Event(type));};
 vm.runInContext(guard,context);
 return {dom,document,window,calls,emit,core:document.querySelector('link[data-style-core]'),script:document.querySelector('script[defer][src]'),boot(){vm.runInContext(startup,context);},allowReload(){allowReload=true;},close(){dom.window.close();}};
}

test('Recovery guard precedes CSS and preserves the existing deferred bundle contract',()=>{
 assert.ok(html.indexOf('data-startup-guard')<html.indexOf('<link rel="stylesheet"'));
 assert.match(html,/<script defer src="\.\/startup\.js\?v=[^"]+"><\/script>/);
});

test('CSS errors before or after bootstrap show one recovery action only after application readiness',()=>{
 for(const early of [true,false]){
  const h=harness();try{
   if(early)h.emit('error',h.core);h.boot();if(!early)h.emit('error',h.core);
   assert.equal(h.document.querySelectorAll('[role="alert"]').length,0);
   h.window.SalaryMateStartup.complete();h.window.SalaryMateStartup.complete();
   assert.equal(h.document.querySelectorAll('[role="alert"]').length,1);
   assert.match(h.document.querySelector('[role="alert"]').textContent,/本機資料仍保留/);
   assert.equal(h.document.body.dataset.startup,'loading');assert.equal(h.calls.reloads,0);
  }finally{h.close();}
 }
});

test('An early CSS error overrides a provisional browser stylesheet object',()=>{
 const h=harness();try{
  Object.defineProperty(h.core,'sheet',{value:{},configurable:true});
  h.emit('error',h.core);h.boot();h.window.SalaryMateStartup.complete();
  assert.equal(h.document.body.dataset.startup,'loading');
  assert.equal(h.document.querySelectorAll('[role="alert"]').length,1);
 }finally{h.close();}
});

test('A later CSS error invalidates an initially available stylesheet object',()=>{
 const h=harness();try{
  Object.defineProperty(h.core,'sheet',{value:{},configurable:true});h.boot();
  h.emit('error',h.core);h.window.SalaryMateStartup.complete();
  assert.equal(h.document.body.dataset.startup,'loading');
  assert.equal(h.document.querySelectorAll('[role="alert"]').length,1);
 }finally{h.close();}
});

test('CSS failure after readiness restores readable fallback without changing an open draft',()=>{
 const h=harness();try{
  Object.defineProperty(h.core,'sheet',{value:{},configurable:true});h.boot();h.window.SalaryMateStartup.complete();
  assert.equal(h.document.body.hasAttribute('data-startup'),false);
  const draft=h.document.createElement('input');draft.value='unsaved fixture';h.document.querySelector('#appDialog').append(draft);
  h.emit('error',h.core);
  assert.equal(h.document.body.dataset.startup,'loading');
  assert.equal(h.document.querySelectorAll('[role="alert"]').length,1);
  assert.equal(draft.value,'unsaved fixture');assert.equal(h.calls.reloads,0);
  h.emit('load',h.core);assert.equal(h.document.body.hasAttribute('data-startup'),false);
 }finally{h.close();}
});

test('A loaded active ornate package remains usable when its disabled core stylesheet fails',()=>{
 const h=harness();try{
  h.boot();h.core.disabled=true;h.window.SalaryMateStartup.styled();h.window.SalaryMateStartup.complete();
  h.emit('error',h.core);
  assert.equal(h.document.body.hasAttribute('data-startup'),false);
  assert.equal(h.document.querySelectorAll('[role="alert"]').length,0);
 }finally{h.close();}
});

test('Manual CSS retries preserve open drafts, deduplicate pending taps and recover after another error',()=>{
 const h=harness();try{
  h.emit('error',h.core);h.boot();h.window.SalaryMateStartup.complete();
  const draft=h.document.createElement('input');draft.value='fictional unsaved draft';h.document.querySelector('#appDialog').append(draft);
  const retry=h.document.querySelector('[role="alert"] button'),original=h.core.href;
  retry.click();const firstRetry=h.core.href;retry.click();
  assert.notEqual(firstRetry,original);assert.equal(h.core.href,firstRetry);assert.equal(retry.disabled,true);
  assert.equal(draft.value,'fictional unsaved draft');assert.equal(h.calls.confirms,0);assert.equal(h.calls.reloads,0);
  h.emit('error',h.core);assert.equal(retry.disabled,false);assert.equal(h.document.querySelectorAll('[role="alert"]').length,1);
  h.document.getElementById('mainContent').replaceChildren(h.document.createElement('section'));
  assert.equal(retry.isConnected,true,'Page rendering must not remove the CSS recovery action.');
  retry.click();assert.notEqual(h.core.href,firstRetry);h.emit('load',h.core);
  assert.equal(h.document.body.hasAttribute('data-startup'),false);assert.equal(h.document.querySelectorAll('[role="alert"]').length,0);
  assert.equal(draft.value,'fictional unsaved draft');assert.equal(h.calls.reloads,0);
 }finally{h.close();}
});

test('Missing startup bundle gives a manual, confirmed retry without clearing storage or unlocking incomplete controls',()=>{
 const h=harness();try{
  h.emit('error',h.script);h.emit('error',h.script);
  assert.equal(h.document.querySelectorAll('[role="alert"]').length,1);assert.equal(h.document.querySelectorAll('[data-startup-inert]').length,3);
  const retry=h.document.querySelector('[role="alert"] button');retry.click();assert.equal(h.calls.reloads,0);assert.equal(retry.disabled,false);
  h.allowReload();retry.click();retry.click();assert.equal(h.calls.reloads,1);assert.equal(h.calls.confirms,2);
 }finally{h.close();}
});

test('An error before body parsing is reported when the body arrives and a startup runtime error also reports',()=>{
 const h=harness();try{
  const body=h.document.body;body.remove();h.emit('error',h.script);assert.equal(h.document.querySelectorAll('[role="alert"]').length,0);
  h.document.documentElement.append(body);h.document.dispatchEvent(new h.dom.window.Event('DOMContentLoaded'));
  assert.equal(h.document.querySelectorAll('[role="alert"]').length,1);
 }finally{h.close();}
 const runtime=harness();try{runtime.emit('error',runtime.window,runtime.script.src);assert.equal(runtime.document.querySelectorAll('[role="alert"]').length,1);}finally{runtime.close();}
});

test('Successful application readiness ignores late errors and an obsolete retry cannot reload an editing session',()=>{
 const h=harness();try{
  h.emit('error',h.script);const oldRetry=h.document.querySelector('[role="alert"] button');
  h.boot();h.window.SalaryMateStartup.complete();h.allowReload();oldRetry.click();
  h.emit('error',h.script);h.emit('error',h.window,h.script.src);
  assert.equal(h.document.querySelectorAll('[role="alert"]').length,0);assert.equal(h.calls.reloads,0);assert.equal(h.calls.confirms,0);
 }finally{h.close();}
});
