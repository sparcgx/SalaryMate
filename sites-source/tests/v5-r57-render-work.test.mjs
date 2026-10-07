import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {source} from './helpers/r57-core.mjs';

// Small object fixtures for translation and observer contracts. No browser,
// layout engine or DOM emulator is launched; visual/touch QA remains separate.
function element(tag='span',text='',attrs={}){
 const el={nodeType:1,tag,attrs:{...attrs},children:[],parentElement:null,isConnected:true,
  append(child){child.parentElement=this;this.children.push(child);},
  hasAttribute(name){return Object.hasOwn(this.attrs,name);},getAttribute(name){return this.attrs[name]??null;},setAttribute(name,value){this.attrs[name]=String(value);},
  matches(selector){return selector.split(',').some(s=>s==='*'||s===this.tag||s==='option:not([value])'&&this.tag==='option'&&!this.hasAttribute('value')||s==='[translate="no"]'&&this.attrs.translate==='no'||/^\[[\w-]+\]$/.test(s)&&this.hasAttribute(s.slice(1,-1)));},
  closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;},
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
  querySelectorAll(selector){const result=[];const visit=n=>{for(const child of n.children||[])if(child.nodeType===1){if(child.matches(selector))result.push(child);visit(child);}};visit(this);return result;},
  get textContent(){return this.children.map(c=>c.nodeType===3?c.nodeValue:c.textContent).join('');}};
 if(text)el.append({nodeType:3,nodeValue:text,parentElement:null});return el;
}
function translations(before=false){
 const html=element('html'),body=element('body');html.append(body);
 const labels=Array.from({length:400},()=>element('span','更新'));labels.forEach(n=>body.append(n));
 let observer,visited=0;
 const document={documentElement:html,children:[html],querySelectorAll:s=>html.querySelectorAll(s),addEventListener(){},createTreeWalker(scope){
  const nodes=[],walk=n=>{for(const child of n.children||[]){if(child.nodeType===3)nodes.push(child);else walk(child);}};walk(scope);
  let i=0;return {nextNode(){const n=nodes[i++];if(n)visited++;return n||null;}};
 }};
 const c=vm.createContext({document,navigator:{languages:['en']},localStorage:{getItem:()=> 'en',setItem(){}},NodeFilter:{SHOW_TEXT:4},MutationObserver:class{constructor(fn){observer=this;this.run=fn;}observe(){}disconnect(){}},CustomEvent:class{},addEventListener(){},dispatchEvent(){}});
 vm.runInContext(source('i18n-en.js',before),c);vm.runInContext(source('i18n.js',before),c);
 return {api:c.SalaryMateI18n,body,labels,mutate:records=>{visited=0;observer.run(records);return visited;}};
}
test('a single translated label update visits one local text node instead of the whole page',()=>{
 const a=translations(true),b=translations();
 for(const h of [a,b])h.labels[0].children[0].nodeValue='手動';
 assert.equal(a.mutate([{type:'characterData',target:a.labels[0].children[0]}]),400);
 assert.equal(b.mutate([{type:'characterData',target:b.labels[0].children[0]}]),1);
 assert.equal(b.labels[0].textContent,'Manual');assert.equal(a.labels[0].textContent,b.labels[0].textContent);
});
test('observer batches nested changes once and translates the scope root attributes',()=>{
 const h=translations(),box=element('section'),label=element('button','展開',{title:'展開市場資訊','aria-label':'展開市場資訊'});box.append(label);h.body.append(box);
 const count=h.mutate([{type:'childList',addedNodes:[box]},{type:'attributes',target:label},{type:'characterData',target:label.children[0]}]);
 assert.equal(count,1);assert.equal(label.getAttribute('aria-label'),'Expand market info');assert.equal(label.textContent,'Expand');
 label.setAttribute('title','手動');h.api.apply(label);assert.equal(label.getAttribute('title'),'Manual');
 h.api.set('zh');assert.equal(label.getAttribute('title'),'手動');assert.equal(label.textContent,'展開');
});
test('translation preserves option values, protected user text and language switching',()=>{
 const h=translations(),option=element('option','手動'),privateLabel=element('span','\uE100我的公司\uE101'),fixed=element('span','更新',{translate:'no'});
 for(const node of [option,privateLabel,fixed])h.body.append(node);
 h.mutate([{type:'childList',addedNodes:[option,privateLabel,fixed]}]);
 assert.equal(option.getAttribute('value'),'手動');assert.equal(option.textContent,'Manual');assert.equal(privateLabel.textContent,'我的公司');assert.equal(fixed.textContent,'更新');
 h.api.set('zh');assert.equal(option.textContent,'手動');assert.equal(privateLabel.textContent,'我的公司');
 h.api.set('en');assert.equal(option.textContent,'Manual');assert.equal(option.getAttribute('value'),'手動');
 const detached=element('span','更新');detached.isConnected=false;assert.equal(h.mutate([{type:'childList',addedNodes:[detached]}]),0);
});
function scrollbars(){
 const frames=[],events=new Map(),created=[],translated=[];let mutations,scans=0,writes=0;
 const table={},box={nodeType:1,isConnected:true,clientWidth:200,scrollWidth:500,scrollLeft:0,firstElementChild:table,querySelector:()=>table,closest:()=>box,classList:{add(){}},addEventListener(){},before(){}};
 let boxes=[box];
 const document={body:{},getElementById:()=>null,addEventListener:(type,fn)=>events.set(type,fn),querySelectorAll:()=>{scans++;return boxes;},createElement:tag=>{
  const el={style:new Proxy({},{set(object,key,value){writes++;object[key]=value;return true;}}),scrollLeft:0,setAttribute(){},append(){},addEventListener(){},remove(){this.removed=true;}};created.push(el);return el;
 }};
 const c=vm.createContext({document,navigator:{},location:{protocol:'file:'},SalaryMatePortable:true,SalaryMateI18n:{apply:scope=>translated.push(scope)},requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>frames.push(fn),addEventListener:(type,fn)=>events.set(type,fn),MutationObserver:class{constructor(fn){mutations=fn;}observe(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}}});c.window=c;
 vm.runInContext(source('bootstrap.js'),c);
 return {box,frames,events,created,translated,mutate:records=>mutations(records),flush:()=>{while(frames.length)frames.shift()();},scans:()=>scans,writes:()=>writes,remove:()=>{box.isConnected=false;boxes=[];},refresh:()=>c.SalaryMateScrollbars.refresh()};
}
test('table controls ignore unrelated messages and coalesce repeated relevant changes',()=>{
 const h=scrollbars();h.flush();assert.equal(h.scans(),1);assert.equal(h.translated.length,1);assert.ok(h.translated[0]);
 const toast=element('span','已儲存');h.mutate([{target:{},addedNodes:[toast],removedNodes:[]}]);assert.equal(h.frames.length,0);
 const row={target:h.box,addedNodes:[],removedNodes:[]};h.mutate([row]);h.mutate([row]);h.events.get('resize')();assert.equal(h.frames.length,1);
 const writes=h.writes();h.flush();assert.equal(h.scans(),2);assert.equal(h.writes(),writes);assert.equal(h.translated.length,1);
 h.remove();h.refresh();assert.equal(h.created[0].removed,true);
});
