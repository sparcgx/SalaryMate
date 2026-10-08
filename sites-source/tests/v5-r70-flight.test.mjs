import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Native object fixtures only: no browser or layout engine. These are algorithm
// and lifecycle checks; they cannot establish device frame rate or visual quality.
const source=readFileSync(new URL('../dist/dev/v5.0.0-dev.2/bootstrap.js',import.meta.url),'utf8').split('// R70:')[1];
const tau=Math.PI*2;
function events(obj={}){
 const listeners=new Map();return Object.assign(obj,{
 addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
 removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
 emit(type,event={}){for(const fn of [...(listeners.get(type)||[])])fn(event);},
 listenerCount(){return [...listeners.values()].reduce((n,s)=>n+s.size,0);}
 });
}
function element(tag='div'){
 const classes=new Set();return events({tag,style:{},dataset:{},children:[],isConnected:true,
 classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:v=>classes.has(v)},
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}},
 setAttribute(name,value){this[name]=value;},remove(){this.removed=true;this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 });
}
function setup({width=390,height=844,seed=3,blended=true,reduced=false,decodeWait=false,renderDecodeWait=false}={}){
 let now=0,id=0,rng=seed,resolveDecode;const frames=new Map(),timers=new Map(),images=[];
 const renderDecoders=[];
 const createElement=tag=>{const el=element(tag);if(tag==='img'){el.complete=true;el.naturalWidth=1536;if(renderDecodeWait)el.decode=()=>new Promise((resolve,reject)=>renderDecoders.push({resolve,reject}));}return el;};
 const body=element();body.dataset.interfaceStyle='pixel';
 const document=events({body,hidden:false,dialog:false,querySelector(){return this.dialog?{}:null;},createElement});
 const mq=events({matches:reduced});
 const art={complete:true,naturalWidth:128,getBoundingClientRect:()=>({left:width-64,top:12,width:42,height:42})};
 const button=element('button');button.dataset.flightSrc='./art/jingyu-flight-r70.png';button.querySelector=()=>art;
 const math=Object.create(Math);math.random=()=>{rng=(1664525*rng+1013904223)>>>0;return rng/2**32;};
 const window=events({document,Math:math,innerWidth:width,innerHeight:height,visualViewport:events({width,height,offsetLeft:0,offsetTop:0}),
 CSS:{supports:()=>blended},matchMedia:()=>mq,performance:{now:()=>now},
 requestAnimationFrame(fn){const key=++id;frames.set(key,fn);return key;},cancelAnimationFrame:key=>frames.delete(key),
 setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key;},clearTimeout:key=>timers.delete(key),
 Image:class{constructor(){images.push(this);}decode(){return decodeWait?new Promise(resolve=>resolveDecode=resolve):Promise.resolve();}}
 });
 window.window=window;vm.runInNewContext('// R70:'+source,window);
 const advance=t=>{now=t;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));for(const [key,item] of timers)if(item.at<=now){timers.delete(key);item.fn();}};
 const all=()=>{const out=[];const walk=n=>{out.push(n);n.children?.forEach(walk);};walk(body);return out;};
 const get=cls=>all().filter(n=>n.className===cls);
 const poses=()=>get('jingyu-flight-pose').map(wrapper=>{
  const [x,y]=wrapper.children[0].children[0].style.transform.match(/[-\d.]+(?=%)/g).map(Number);
  return {index:Math.round(-y/25)*6+Math.round(-x/(100/6)),weight:Number(wrapper.style.opacity)};
 });
 const start=async()=>{window.SalaryMateCompanion.fly(button);if(images.length){images.at(-1).naturalWidth=1536;images.at(-1).naturalHeight=1024;await images.at(-1).onload?.();}};
 return {window,document,mq,button,images,frames,timers,start,advance,get,poses,resolveDecode:()=>resolveDecode?.(),renderDecoders,width,height};
}
function assertClean(h){assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.get('jingyu-flight-layer').length,0);assert.equal(h.button['aria-pressed'],'false');assert.equal(h.window.listenerCount(),0);assert.equal(h.document.listenerCount(),0);assert.equal(h.mq.listenerCount(),0);assert.equal(h.window.visualViewport.listenerCount(),0);}
function flightStats(h,hz){
 const seen=new Set();let samples=0,lastAngle=null,maxTurn=0;
 for(let t=1000/hz;t<17000&&h.frames.size;t+=1000/hz){
  assert.equal(h.frames.size,1);h.advance(t);const actor=h.get('jingyu-flight-actor')[0];if(!actor)break;
  const poses=h.poses();assert.equal(poses.length,4);assert.ok(Math.abs(poses.reduce((sum,p)=>sum+p.weight,0)-1)<1e-8);
  for(const p of poses){assert.ok(p.index>=0&&p.index<24);assert.ok(p.weight>=0&&p.weight<=1);if(p.weight>.3)seen.add(Math.floor(p.index/3));}
  const [x,y,bank,scale]=actor.style.transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px,0\) rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)/).slice(1).map(Number);
  const size=parseFloat(actor.style.width),cx=x+size/2,cy=y+size/2,edge=size*scale*.60;
  assert.ok(cx>=edge-.02&&cx<=h.width-edge+.02);assert.ok(cy>=edge-.02&&cy<=h.height-edge+.02);assert.ok(Math.abs(bank)<=17.01);
  const angle=Math.atan2(poses.reduce((s,p)=>s+Math.sin(Math.floor(p.index/3)*tau/8)*p.weight,0),poses.reduce((s,p)=>s+Math.cos(Math.floor(p.index/3)*tau/8)*p.weight,0));
  if(lastAngle!==null)maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(angle-lastAngle),Math.cos(angle-lastAngle))));lastAngle=angle;samples++;
 }
 return {seen,samples,maxTurn};
}
test('full orbit exposes eight directions with bounded positions and normalized blends at 30/60/120 Hz',async()=>{
 let samples=0;
 for(const [width,height] of [[390,844],[844,390],[1440,900],[320,568]])for(const hz of [30,60,120]){
  const h=setup({width,height,seed:hz});await h.start();const stats=flightStats(h,hz);samples+=stats.samples;
  assert.deepEqual([...stats.seen].sort(),[0,1,2,3,4,5,6,7]);assert.ok(stats.maxTurn<.7,'no abrupt half-turn');assertClean(h);
 }
 console.log('R70 position/blend samples:',samples);
});
test('wing phases are time based and interpolate all three phases while directions wrap smoothly',async()=>{
 const snapshots=[];
 for(const hz of [30,60,120]){
  const h=setup({seed:4});await h.start();for(let i=1;i<=hz*2;i++)h.advance(i*1000/hz);
  const wings=[0,0,0];for(const p of h.poses())wings[p.index%3]+=p.weight;snapshots.push(wings);h.window.SalaryMateCompanion.stop();assertClean(h);
 }
 for(let i=1;i<snapshots.length;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(snapshots[0][k]-snapshots[i][k])<1e-8);
});
test('repeat tap, viewport/page events and explicit navigation cleanup leave no flight work',async()=>{
 for(const reason of ['tap','scroll','resize','pagehide','beforeprint','escape','hidden','motion','visual-scroll','navigation']){
  const h=setup();await h.start();h.advance(450);
  if(reason==='tap')h.window.SalaryMateCompanion.fly(h.button);
  else if(reason==='escape')h.document.emit('keydown',{key:'Escape'});
  else if(reason==='hidden'){h.document.hidden=true;h.document.emit('visibilitychange');}
  else if(reason==='motion'){h.mq.matches=true;h.mq.emit('change');}
  else if(reason==='visual-scroll')h.window.visualViewport.emit('scroll');
  else if(reason==='navigation')h.window.SalaryMateCompanion.stop();
  else h.window.emit(reason);
  assertClean(h);
 }
});
test('decode cancellation, image failure and reduced motion do not start an animation',async()=>{
 const h=setup({decodeWait:true});h.window.SalaryMateCompanion.fly(h.button);const loading=h.images[0].onload();h.window.SalaryMateCompanion.stop();h.resolveDecode();await loading;assertClean(h);
 const reduced=setup({reduced:true});await reduced.start();assert.equal(reduced.images.length,0);assert.equal(reduced.frames.size,0);reduced.advance(2000);assertClean(reduced);
 const failed=setup();failed.window.SalaryMateCompanion.fly(failed.button);failed.images[0].onerror();assert.equal(failed.frames.size,0);failed.advance(2000);assertClean(failed);
 const dialog=setup();dialog.document.dialog=true;await dialog.start();assert.equal(dialog.images.length,0);assert.equal(dialog.frames.size,0);
});
test('unsupported blending uses one real directional frame and cached art is reused',async()=>{
 const h=setup({blended:false});await h.start();h.advance(2400);assert.equal(h.poses().length,1);assert.equal(h.poses()[0].weight,1);h.window.SalaryMateCompanion.stop();assertClean(h);
 await h.window.SalaryMateCompanion.fly(h.button);assert.equal(h.images.length,1);assert.equal(h.frames.size,1);h.window.SalaryMateCompanion.stop();assertClean(h);
});

// R72 regression: handoff must never hide the only visible bird during takeoff.
test('R72 cold and cached takeoff show an opaque positioned first frame',async()=>{
 for(const blended of [true,false]){
  const h=setup({blended});
  for(let attempt=0;attempt<2;attempt++){
   if(attempt)await h.window.SalaryMateCompanion.fly(h.button);else await h.start();
   for(const time of [0,16,80,160,350]){
    if(time)h.advance(time);
    const actor=h.get('jingyu-flight-actor')[0];
    assert.ok(actor.style.transform.includes('translate3d('));
    assert.equal(Number(actor.style.opacity),1);
    assert.ok(h.poses().some(p=>p.weight>0));
    assert.equal(h.button.classList.contains('jingyu-away'),true);
   }
   h.window.SalaryMateCompanion.stop();assertClean(h);
  }
 }
});
test('R72 pending rendered-image decode preserves perched bird; cancel and failure stay clean',async()=>{
 for(const outcome of ['ready','cancel','error']){
  const h=setup({renderDecodeWait:true});const start=h.start();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.renderDecoders.length,4);
  assert.equal(h.button.classList.contains('jingyu-away'),false);
  assert.equal(h.get('jingyu-flight-layer').length,0);
  assert.equal(h.frames.size,0);
  if(outcome==='cancel')h.window.SalaryMateCompanion.stop();
  for(const d of h.renderDecoders)outcome==='error'?d.reject(new Error('decode failed')):d.resolve();
  await start;
  if(outcome==='ready'){assert.equal(Number(h.get('jingyu-flight-actor')[0].style.opacity),1);assert.equal(h.frames.size,1);}
  else assert.equal(h.frames.size,0);
  h.window.SalaryMateCompanion.stop();assertClean(h);
 }
});
