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
function style(){
 const priorities={};return {
  setProperty(name,value,priority=''){this[name]=String(value);priorities[name]=priority;},
  getPropertyValue(name){return this[name]||'';},getPropertyPriority(name){return priorities[name]||'';},
  removeProperty(name){const value=this[name]||'';delete this[name];delete priorities[name];return value;}
 };
}
function element(tag='div'){
 const classes=new Set();return events({tag,style:style(),dataset:{},children:[],isConnected:true,
 classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:v=>classes.has(v)},
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}},
 setAttribute(name,value){this[name]=value;},remove(){this.removed=true;this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 });
}
function setup({width=390,height=844,seed=3,blended=true,reduced=false,decodeWait=false,renderDecodeWait=false,plates=false,magic=false,casting=false}={}){
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
 if(casting)window.SalaryMateCastArt='./art/jingyu-cast-r76.png';
 if(magic)window.SalaryMateWindArt=['blade','tornado'].map(kind=>'./art/jingyu-wind-'+kind+'-r75.png');
 if(plates)window.SalaryMateFlightSheets=['a','b','c','d'].map(id=>'./art/jingyu-flight-r73-'+id+'.png');
 window.window=window;vm.runInNewContext('// R70:'+source,window);
 const advance=t=>{now=t;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));for(const [key,item] of timers)if(item.at<=now){timers.delete(key);item.fn();}};
 const all=()=>{const out=[];const walk=n=>{out.push(n);n.children?.forEach(walk);};walk(body);return out;};
 const get=cls=>all().filter(n=>n.className===cls);
 const poses=()=>get('jingyu-flight-pose').map(wrapper=>{
  const images=wrapper.children[0].children,sheetIndex=images.findIndex(image=>image.style.display==='block'),image=images[sheetIndex];
  const [x,y]=image.style.transform.match(/[-\d.]+(?=%)/g).map(Number);
  const index=plates
   ?sheetIndex*6+Math.floor((-y/100*1024+1024/parseFloat(image.style.height)*50)/512)*3+Math.floor((-x/100*1536+1536/parseFloat(image.style.width)*50)/512)
   :Math.round(-y/25)*6+Math.round(-x/(100/6));
  return {index,weight:Number(wrapper.style.opacity)};
 });
 const start=async()=>{const pending=window.SalaryMateCompanion.fly(button);for(const image of images){image.naturalWidth=1536;image.naturalHeight=1024;await image.onload?.();}await pending;};
 return {window,document,mq,button,images,frames,timers,start,advance,get,poses,resolveDecode:()=>resolveDecode?.(),renderDecoders,width,height,time:()=>now};
}
function assertClean(h){assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.get('jingyu-flight-layer').length,0);assert.equal(h.button['aria-pressed'],'false');assert.equal(h.window.listenerCount(),0);assert.equal(h.document.listenerCount(),0);assert.equal(h.mq.listenerCount(),0);assert.equal(h.window.visualViewport.listenerCount(),0);assert.equal(h.document.body.classList.contains('jingyu-screen-hit'),false);assert.equal(h.get('jingyu-screen-impact').length,0);}
function flightStats(h,hz){
 const seen=new Set();let samples=0,lastAngle=null,maxTurn=0;
 for(let t=1000/hz;t<17000&&h.frames.size;t+=1000/hz){
  assert.equal(h.frames.size,1);h.advance(t);const actor=h.get('jingyu-flight-actor')[0];if(!actor)break;
  const poses=h.poses();assert.equal(poses.length,2);assert.ok(Math.abs(poses.reduce((sum,p)=>sum+p.weight,0)-1)<1e-8);
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
test('absolute-time wing target poses match across refresh rates without renderer handoff latency',async()=>{
 const snapshots=[];
 for(const hz of [30,60,120]){
  const h=setup({seed:4,blended:false});await h.start();for(let i=1;i<=hz*2;i++)h.advance(i*1000/hz);
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
 const failed=setup();const failure=failed.window.SalaryMateCompanion.fly(failed.button);failed.images[0].onerror();await failure;assert.equal(failed.frames.size,0);failed.advance(2000);assertClean(failed);
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
   const offset=h.time();
   for(const time of [0,16,80,160,350]){
    if(time)h.advance(offset+time);
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
  assert.equal(h.renderDecoders.length,2);
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

test('R73 near/far pass stays within viewport and renders at scale <= 1 across refresh rates',async()=>{
 for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
  const snapshots=[];
  for(const hz of [30,60,120]){
   const h=setup({width,height,seed:7,plates:true});await h.start();
   let maxScale=0,farAfterPeak=1,previous=null,previousTime=0,snapshot=null;
   for(let i=1;i/hz<=17&&h.frames.size;i++){
    const time=i*1000/hz;h.advance(time);const actor=h.get('jingyu-flight-actor')[0];if(!actor)break;
    const v=actor.style.transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px,0\) rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)/).slice(1).map(Number);
    const [x,y,,scale]=v,size=parseFloat(actor.style.width),edge=size*scale*.60;
    assert.ok(scale>0&&scale<=1.0001,'no magnified raster');
    assert.ok(x+size/2>=edge-.02&&x+size/2<=width-edge+.02);
    assert.ok(y+size/2>=edge-.02&&y+size/2<=height-edge+.02);
    if(previous!==null)assert.ok(Math.abs(scale-previous)/(time-previousTime)<.002,'continuous zoom');
    maxScale=Math.max(maxScale,scale);if(maxScale>.99)farAfterPeak=Math.min(farAfterPeak,scale);
    if(i===hz*5)snapshot=[x,y,scale];previous=scale;previousTime=time;
   }
   assert.ok(maxScale>.99);assert.ok(farAfterPeak<.52);assertClean(h);snapshots.push(snapshot);
  }
  for(const point of snapshots.slice(1))assert.deepEqual(point,snapshots[0],'same wall-time position and size');
 }
});
test('R73 four decoded high-detail plates preserve all directions and reuse cache',async()=>{
 const h=setup({plates:true});await h.start();assert.equal(h.images.length,4);
 assert.equal(h.get('jingyu-flight-sheet').length,8);
 const stats=flightStats(h,60);assert.deepEqual([...stats.seen].sort(),[0,1,2,3,4,5,6,7]);assertClean(h);
 await h.window.SalaryMateCompanion.fly(h.button);assert.equal(h.images.length,4);h.window.SalaryMateCompanion.stop();assertClean(h);
});
test('R73 every rendered plate is ready before takeoff, including cancellation during decoding',async()=>{
 for(const cancel of [false,true]){
  const h=setup({plates:true,renderDecodeWait:true});const pending=h.start();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.renderDecoders.length,8);assert.equal(h.button.classList.contains('jingyu-away'),false);
  for(const d of h.renderDecoders.slice(0,7))d.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.frames.size,0);assert.equal(h.button.classList.contains('jingyu-away'),false);
  if(cancel)h.window.SalaryMateCompanion.stop();h.renderDecoders[7].resolve();await pending;
  if(cancel)assertClean(h);else {assert.equal(h.get('jingyu-flight-actor')[0].style.opacity,'1');h.window.SalaryMateCompanion.stop();assertClean(h);}
 }
});
test('R73 partial plate failure and retry cannot start a stale flight',async()=>{
 for(const failedIndex of [0,3]){
  const h=setup({plates:true});const pending=h.window.SalaryMateCompanion.fly(h.button);
  h.images[failedIndex].onerror();await pending;
  assert.equal(h.frames.size,0);assert.equal(h.button.classList.contains('jingyu-away'),false);
  h.window.SalaryMateCompanion.stop();assertClean(h);
  for(const image of h.images){assert.equal(image.onload,null);assert.equal(image.onerror,null);}
  await h.start();assert.equal(h.images.length,8);assert.equal(h.frames.size,1);
  h.window.SalaryMateCompanion.stop();assertClean(h);
 }
 const timeout=setup({plates:true});const pending=timeout.window.SalaryMateCompanion.fly(timeout.button);
 timeout.advance(15001);await pending;assertClean(timeout);
});
test('R73 four-plate compatibility renderer shows one decoded direction without blend support',async()=>{
 const h=setup({plates:true,blended:false});await h.start();h.advance(4200);
 assert.equal(h.get('jingyu-flight-sheet').length,4);assert.equal(h.get('jingyu-flight-sheet').filter(image=>image.style.display==='block').length,1);
 assert.equal(h.poses().length,1);assert.equal(h.poses()[0].weight,1);
 h.window.SalaryMateCompanion.stop();assertClean(h);
});

test('R75 only two poses hand off briefly, with a single crisp pose for most samples',async()=>{
 for(const hz of [30,60,120]){
  const h=setup({plates:true});await h.start();let samples=0,crisp=0,run=0,maxRun=0;const wings=new Set();
  for(let i=1;i/hz<17&&h.frames.size;i++){
   h.advance(i*1000/hz);const poses=h.poses();if(!poses.length)break;samples++;
   assert.equal(poses.length,2);assert.ok(Math.abs(poses.reduce((s,p)=>s+p.weight,0)-1)<1e-9);
   const visible=poses.filter(p=>p.weight>.0001);for(const p of visible)wings.add(p.index%3);
   if(visible.length===1){crisp++;run=0;}else {run+=1000/hz;maxRun=Math.max(maxRun,run);}
  }
  assert.ok(crisp/samples>.5,'a clear single pose on most frames');
  assert.ok(maxRun<=64+1000/hz+.001,'handoff cannot become a persistent trail');
  assert.deepEqual([...wings].sort(),[0,1,2]);assertClean(h);
  console.log(`R75 ${hz} Hz single-pose samples: ${crisp}/${samples}`);
 }
});
test('R77 wind blades and tornado converge inside the viewport while growing toward the screen',async()=>{
 for(const [width,height] of [[320,568],[430,932],[844,390],[240,220]])for(const hz of [30,60,120]){
  const h=setup({width,height,plates:true,magic:true});await h.start();const seen=new Set();
  assert.equal(h.get('jingyu-wind-effect').length,4);assert.equal(h.get('jingyu-wind-art').length,4);
  for(let i=1;i/hz<17&&h.frames.size;i++){
   assert.equal(h.frames.size,1);h.advance(i*1000/hz);
   for(const fx of h.get('jingyu-wind-effect')){
    const opacity=Number(fx.style.opacity);assert.ok(Number.isFinite(opacity)&&opacity>=0&&opacity<=.86);
    if(opacity<=0)continue;seen.add(fx.dataset.kind);
    const v=fx.style.transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px,0\) rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)/).slice(1).map(Number);
    assert.ok(v.every(Number.isFinite));const [x,y,,scale]=v,w=parseFloat(fx.style.width),heightFx=parseFloat(fx.style.height),r=Math.hypot(w,heightFx)*scale/2;
    assert.ok(x+w/2>=0&&x+w/2<=width);assert.ok(y+heightFx/2>=0&&y+heightFx/2<=height);
    assert.equal(fx.dataset.target,'screen');assert.ok(scale>=.42&&scale<=3.91,'approaching art is clipped by the fixed flight overlay');
   }
  }
  assert.deepEqual([...seen].sort(),['blade','tornado']);assertClean(h);assert.equal(h.get('jingyu-wind-effect').length,0);
 }
});
test('R75 every cancellation removes active spells; reduced motion starts neither flight nor spells',async()=>{
 for(const reason of ['tap','scroll','resize','pagehide','escape','motion','navigation']){
  const h=setup({plates:true,magic:true});await h.start();
  for(let t=50;t<15000&&!h.get('jingyu-wind-effect').some(fx=>Number(fx.style.opacity)>.1);t+=50)h.advance(t);
  assert.ok(h.get('jingyu-wind-effect').some(fx=>Number(fx.style.opacity)>.1));
  if(reason==='tap')h.window.SalaryMateCompanion.fly(h.button);
  else if(reason==='escape')h.document.emit('keydown',{key:'Escape'});
  else if(reason==='motion'){h.mq.matches=true;h.mq.emit('change');}
  else if(reason==='navigation')h.window.SalaryMateCompanion.stop();
  else h.window.emit(reason);
  assertClean(h);assert.equal(h.get('jingyu-wind-effect').length,0);
 }
 const h=setup({plates:true,magic:true,reduced:true});await h.start();assert.equal(h.images.length,0);assert.equal(h.get('jingyu-wind-effect').length,0);h.advance(2000);assertClean(h);
});
test('R75 optional wind decoding cannot block takeoff or resurrect cancelled effects',async()=>{
 for(const cancel of [false,true]){
  const h=setup({plates:true,magic:true,renderDecodeWait:true});const pending=h.start();await new Promise(r=>setImmediate(r));
  assert.equal(h.renderDecoders.length,8);for(const d of h.renderDecoders)d.resolve();await pending;await new Promise(r=>setImmediate(r));
  assert.equal(h.renderDecoders.length,12);assert.equal(h.frames.size,1);assert.equal(h.get('jingyu-flight-actor')[0].style.opacity,'1');
  if(cancel)h.window.SalaryMateCompanion.stop();
  for(const d of h.renderDecoders.slice(8))cancel?d.resolve():d.reject(new Error('optional art failed'));
  await new Promise(r=>setImmediate(r));
  if(cancel)assertClean(h);
  else {for(const t of [3500,3800,7000,7500]){h.advance(t);assert.ok(h.get('jingyu-wind-effect').every(fx=>fx.style.opacity==='0'));assert.equal(h.frames.size,1);}h.window.SalaryMateCompanion.stop();assertClean(h);}
 }
});

test('R76 both attacks show wind-up, release and recovery, synchronized to effects with at most two poses',async()=>{
 const sides=new Set();
 for(const blended of [true,false])for(const hz of [30,60,120]){
  const h=setup({plates:true,magic:true,casting:true,blended,seed:hz});await h.start();await new Promise(r=>setImmediate(r));
  const stages={blade:new Set(),tornado:new Set()},firstEffects=new Set();let returned=false,hadAttack=false;
  for(let i=1;i/hz<17&&h.frames.size;i++){
   assert.equal(h.frames.size,1);h.advance(i*1000/hz);
   const actor=h.get('jingyu-flight-actor')[0];if(!actor)break;
   const poses=h.get('jingyu-flight-pose'),visible=poses.filter(p=>Number(p.style.opacity)>.0001);
   assert.ok(visible.length<=2);assert.ok(Math.abs(poses.reduce((sum,p)=>sum+Number(p.style.opacity),0)-1)<1e-9);
   if(actor.dataset.cast!=='none'){
    hadAttack=true;stages[actor.dataset.cast].add(Number(actor.dataset.castStage));
   }else if(hadAttack)returned=true;
   for(const pose of visible){
    const index=Number(pose.dataset.pose);if(index<24)continue;
    sides.add(pose.style.transform);
    assert.ok(index<36);const images=pose.children[0].children.filter(img=>img.style.display==='block');
    assert.equal(images.length,1);assert.equal(images[0].src,'./art/jingyu-cast-r76.png');
   }
   for(const fx of h.get('jingyu-wind-effect'))if(Number(fx.style.opacity)>.001&&!firstEffects.has(fx.dataset.kind)){
    firstEffects.add(fx.dataset.kind);assert.equal(actor.dataset.cast,fx.dataset.kind);assert.equal(actor.dataset.castStage,'1');
   }
  }
  assert.deepEqual([...stages.blade].sort(),[0,1,2]);assert.deepEqual([...stages.tornado].sort(),[0,1,2]);
  assert.equal(firstEffects.size,2);assert.ok(returned);assertClean(h);
 }
 assert.deepEqual([...sides].sort(),['scaleX(-1)','scaleX(1)']);
});

test('R76 slow/failed attack art never blocks takeoff or pops into an attack after wind-up',async()=>{
 for(const outcome of ['failed','late','cancelled']){
  const h=setup({plates:true,magic:true,casting:true,renderDecodeWait:true});const pending=h.start();await new Promise(r=>setImmediate(r));
  assert.equal(h.renderDecoders.length,8);h.renderDecoders.forEach(d=>d.resolve());await pending;await new Promise(r=>setImmediate(r));
  assert.equal(h.renderDecoders.length,14);assert.equal(h.frames.size,1);assert.equal(h.get('jingyu-flight-actor')[0].style.opacity,'1');
  h.renderDecoders.slice(10).forEach(d=>d.resolve());await new Promise(r=>setImmediate(r));
  if(outcome==='cancelled')h.window.SalaryMateCompanion.stop();
  if(outcome==='late')for(let t=50;t<=3350;t+=50)h.advance(t);
  h.renderDecoders.slice(8,10).forEach(d=>outcome==='failed'?d.reject(new Error('attack failed')):d.resolve());
  await new Promise(r=>setImmediate(r));
  if(outcome==='cancelled'){assertClean(h);continue;}
  for(let t=3400;t<=3800;t+=50){h.advance(t);assert.equal(h.get('jingyu-flight-actor')[0].dataset.cast,'none');}
  assert.ok(h.get('jingyu-wind-effect').some(fx=>Number(fx.style.opacity)>0));
  h.window.SalaryMateCompanion.stop();assertClean(h);
 }
});

test('R76 cancelling during a casting pose removes art and effects, and reduced motion never creates either',async()=>{
 for(const reason of ['tap','scroll','resize','pagehide','escape','motion','navigation']){
  const h=setup({plates:true,magic:true,casting:true});await h.start();await new Promise(r=>setImmediate(r));
  for(let t=50;t<15000&&h.get('jingyu-flight-actor')[0]?.dataset.cast!=='blade';t+=50)h.advance(t);
  assert.equal(h.get('jingyu-flight-actor')[0].dataset.cast,'blade');
  if(reason==='tap')h.window.SalaryMateCompanion.fly(h.button);
  else if(reason==='escape')h.document.emit('keydown',{key:'Escape'});
  else if(reason==='motion'){h.mq.matches=true;h.mq.emit('change');}
  else if(reason==='navigation')h.window.SalaryMateCompanion.stop();
  else h.window.emit(reason);
  assertClean(h);assert.equal(h.get('jingyu-flight-sheet').length,0);assert.equal(h.get('jingyu-wind-effect').length,0);
 }
 const h=setup({plates:true,magic:true,casting:true,reduced:true});await h.start();assert.equal(h.get('jingyu-flight-sheet').length,0);h.advance(2000);assertClean(h);
});

test('R77 visible hits produce strong bounded screen shake and settle between attacks at 30/60/120 Hz',async()=>{
 for(const [width,height] of [[390,844],[844,390],[1440,900],[240,220]])for(const hz of [30,60,120]){
  const h=setup({width,height,plates:true,magic:true,casting:true});await h.start();await new Promise(r=>setImmediate(r));
  const duration=[...h.timers.values()][0].at-350;let peak=0,blade=false,tornado=false,quietBetween=false;
  for(let i=1;i/hz<17&&h.frames.size;i++){
   const t=i*1000/hz;assert.equal(h.frames.size,1);h.advance(t);
   const body=h.document.body,active=body.classList.contains('jingyu-screen-hit');
   const x=parseFloat(body.style.getPropertyValue('--jingyu-impact-x')||'0'),y=parseFloat(body.style.getPropertyValue('--jingyu-impact-y')||'0');
   assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(Math.abs(x)<=33.61&&Math.abs(y)<=20.74);peak=Math.max(peak,Math.abs(x));
   if(t<duration*.29+420)assert.equal(active,false,'no shake before a visible hit');
   if(active){if(t<duration*.5)blade=true;else tornado=true;}
   if(t>duration*.29+1200&&t<duration*.60){assert.equal(active,false);quietBetween=true;}
  }
  assert.ok(peak>=10,'impact must have a clearly visible displacement');assert.ok(blade&&tornado&&quietBetween);
  assert.equal(h.document.body.style.getPropertyValue('--jingyu-impact-x'),'');assert.equal(h.document.body.style.getPropertyValue('--jingyu-impact-y'),'');assertClean(h);
 }
});

test('R77 interrupted impacts restore prior styling and stop immediately for controls, navigation and motion changes',async()=>{
 for(const reason of ['tap','pointer','scroll','resize','pagehide','escape','motion','dialog','navigation']){
  const h=setup({plates:true,magic:true,casting:true});
  h.document.body.style.setProperty('--jingyu-impact-x','2px','important');h.document.body.style.setProperty('--jingyu-impact-y','3px');
  h.document.body.style.transform='none';
  await h.start();await new Promise(r=>setImmediate(r));
  for(let t=20;t<9000&&!h.document.body.classList.contains('jingyu-screen-hit');t+=20)h.advance(t);
  assert.ok(h.document.body.classList.contains('jingyu-screen-hit'));
  if(reason==='tap')h.window.SalaryMateCompanion.fly(h.button);
  else if(reason==='pointer')h.document.emit('pointerdown',{target:{}});
  else if(reason==='escape')h.document.emit('keydown',{key:'Escape'});
  else if(reason==='motion'){h.mq.matches=true;h.mq.emit('change');}
  else if(reason==='navigation'||reason==='dialog'){h.document.dialog=reason==='dialog';h.window.SalaryMateCompanion.stop();}
  else h.window.emit(reason);
  assertClean(h);h.advance(17000);assertClean(h);
  assert.equal(h.document.body.style.getPropertyValue('--jingyu-impact-x'),'2px');assert.equal(h.document.body.style.getPropertyPriority('--jingyu-impact-x'),'important');
  assert.equal(h.document.body.style.getPropertyValue('--jingyu-impact-y'),'3px');assert.equal(h.document.body.style.transform,'none');
 }
});

test('R77 missed frames, unavailable wind art and reduced motion never replay a hidden impact',async()=>{
 const paused=setup({plates:true,magic:true,casting:true});await paused.start();
 for(let t=50;t<3500;t+=50)paused.advance(t);
 paused.advance(6000);assert.equal(paused.document.body.classList.contains('jingyu-screen-hit'),false);
 paused.advance(10000);assert.equal(paused.document.body.classList.contains('jingyu-screen-hit'),false);
 paused.window.SalaryMateCompanion.stop();assertClean(paused);
 const failed=setup({plates:true,magic:true,casting:true,renderDecodeWait:true});const pending=failed.start();await new Promise(r=>setImmediate(r));
 failed.renderDecoders.forEach(d=>d.resolve());await pending;await new Promise(r=>setImmediate(r));
 failed.renderDecoders.slice(8,10).forEach(d=>d.resolve());failed.renderDecoders.slice(10).forEach(d=>d.reject(new Error('wind unavailable')));await new Promise(r=>setImmediate(r));
 for(let t=50;t<17000&&failed.frames.size;t+=50){failed.advance(t);assert.equal(failed.document.body.classList.contains('jingyu-screen-hit'),false);}
 assertClean(failed);
 const reduced=setup({plates:true,magic:true,casting:true,reduced:true});await reduced.start();assert.equal(reduced.get('jingyu-screen-impact').length,0);assert.equal(reduced.document.body.classList.contains('jingyu-screen-hit'),false);reduced.advance(2000);assertClean(reduced);
});
