import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url),read=name=>fs.readFileSync(new URL(name,base),'utf8');
function harness({embedded=false,preloaded=false}={}){
 const bootstrap=read('bootstrap.js'),start=bootstrap.indexOf('// R99 startup screen:'),end=bootstrap.indexOf('// Desktop horizontal scroll runtime.',start);
 const callbacks={},removed=[],notices=[],core={sheet:preloaded?{}:null,addEventListener:(type,fn)=>{callbacks[type]=fn;}};
 const context={document:{querySelector:()=>embedded?null:core,querySelectorAll:()=>[{removeAttribute:name=>removed.push(name)}],body:{removeAttribute:name=>removed.push(name)},createElement:()=>({setAttribute(){}}),getElementById:()=>({prepend:notice=>notices.push(notice)})}};
 context.window=context;vm.runInNewContext(bootstrap.slice(start,end),context);
 return {api:context.SalaryMateStartup,callbacks,removed,notices,core};
}
test('R99 initial HTML has an inline styled, truthful screen without blocking on external CSS or fabricated amounts',()=>{
 const html=read('index.html'),style=html.match(/<style data-startup-style>([\s\S]*?)<\/style>/)?.[1];
 assert.ok(style);postcss.parse(style);assert.doesNotMatch(style,/url\(|@import|animation:/);
 assert.match(html,/<link rel="stylesheet"[^>]+data-style-core media="print" fetchpriority="high">/);
 assert.ok(html.indexOf('data-startup-style')<html.indexOf('startup.js?v='));
 const screen=html.match(/<section class="startup-panel"[\s\S]*?<\/section>/)?.[0];assert.ok(screen);
 assert.match(screen,/role="status"/);assert.doesNotMatch(screen,/\$|0\.00|已儲存|資料已載入/);
 assert.match(html,/data-startup-inert inert/);
});
test('R99 handoff opens controls only after application is ready and retains initial styling until CSS arrives',()=>{
 const h=harness();assert.equal(h.core.media,'all');assert.equal(h.removed.length,0);
 h.callbacks.load();assert.equal(h.removed.length,0);h.api.complete();assert.ok(h.removed.includes('inert'));assert.ok(h.removed.includes('data-startup'));
 const delayed=harness();delayed.api.complete();assert.ok(delayed.removed.includes('inert'));assert.ok(!delayed.removed.includes('data-startup'));
 delayed.callbacks.load();assert.ok(delayed.removed.includes('data-startup'));
});
test('R99 embedded or already-loaded styles complete directly; failed core retains readable fallback and warns once',()=>{
 for(const options of [{embedded:true},{preloaded:true}]){const h=harness(options);h.api.complete();assert.ok(h.removed.includes('data-startup'));}
 const h=harness();h.callbacks.error();assert.equal(h.notices.length,0);h.api.complete();h.api.complete();assert.equal(h.notices.length,1);assert.match(h.notices[0].textContent,/本機資料仍保留/);assert.ok(!h.removed.includes('data-startup'));
 h.api.styled();assert.ok(h.removed.includes('data-startup'));
});
