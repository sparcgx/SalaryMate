(() => {
  'use strict';
  const key = 'salarymate_v5_full_state';
  let lastRead, read = false;
  window.SalaryMateStorage = Object.freeze({
    getItem(name) { const value = localStorage.getItem(name); if (name === key) { lastRead = value; read = true; } return value; },
    setItem(name, value) {
      if (name !== key) throw new Error('Unexpected storage key');
      if (read && localStorage.getItem(key) !== lastRead) throw new Error('資料已由另一分頁更新，請重新整理。');
      localStorage.setItem(key, value); lastRead = String(value); read = true;
      const label = document.getElementById('saveStatus'); if (label) label.textContent = '已儲存';
    },
    removeItem(name) { if (name !== key) throw new Error('Unexpected storage key'); localStorage.removeItem(name); lastRead = null; }
  });
  window.addEventListener('storage', event => {
    if (event.key !== key || event.newValue === lastRead) return;
    const label = document.getElementById('saveStatus');
    if (label) { label.textContent = '另一分頁已更新，請重新整理'; label.classList.add('text-rose'); }
  });
  if (!window.SalaryMatePortable && 'serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(() => {}));
  }
})();

// Desktop horizontal scroll controls stay above the table and mirror wheel/trackpad scrolling.
(() => {
  const controls=new Map();let queued=false;
  const selector='.stock-table-wrap,.table-scroll,.attendance-trend-scroll';
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>schedule()):null;
  function schedule(){if(queued)return;queued=true;const run=()=>{queued=false;refresh();};if(window.requestAnimationFrame)window.requestAnimationFrame(run);else window.setTimeout(run,0);}
  function refresh(){
    if(!window.document?.body)return;
    for(const [box,entry] of controls)if(!box.isConnected){resize?.unobserve(box);resize?.unobserve(entry.table);entry.bar.remove();controls.delete(box);}
    document.querySelectorAll(selector).forEach(box=>{
      const table=box.querySelector('table')||box.firstElementChild;if(!table)return;
      let entry=controls.get(box);
      if(!entry){
        const bar=document.createElement('div'),track=document.createElement('div');bar.className='table-top-scroll';bar.tabIndex=0;bar.setAttribute('role','region');bar.setAttribute('aria-label','表格橫向捲動');track.setAttribute('aria-hidden','true');bar.append(track);box.before(bar);box.classList.add('has-top-scroll');
        bar.addEventListener('scroll',()=>{if(box.scrollLeft!==bar.scrollLeft)box.scrollLeft=bar.scrollLeft;},{passive:true});
        box.addEventListener('scroll',()=>{if(bar.scrollLeft!==box.scrollLeft)bar.scrollLeft=box.scrollLeft;},{passive:true});
        bar.addEventListener('keydown',event=>{const step=Math.max(80,box.clientWidth*.75),values={ArrowLeft:bar.scrollLeft-80,ArrowRight:bar.scrollLeft+80,PageUp:bar.scrollLeft-step,PageDown:bar.scrollLeft+step,Home:0,End:box.scrollWidth};if(event.key in values){event.preventDefault();bar.scrollLeft=values[event.key];box.scrollLeft=bar.scrollLeft;}});
        entry={bar,track,table};controls.set(box,entry);resize?.observe(box);resize?.observe(table);
        window.SalaryMateI18n?.apply(bar);
      }else if(entry.table!==table){resize?.unobserve(entry.table);entry.table=table;resize?.observe(table);}
    });
    const measurements=[...controls].map(([box,entry])=>({entry,width:box.scrollWidth,visible:box.clientWidth,left:box.scrollLeft}));
    for(const {entry:{bar,track},width,visible,left} of measurements){
      const size=width+'px',hidden=visible===0||width<=visible+1;
      if(track.style.width!==size)track.style.width=size;
      if(bar.hidden!==hidden)bar.hidden=hidden;
      if(bar.scrollLeft!==left)bar.scrollLeft=left;
    }
  }
  new MutationObserver(records=>{
    if(records.some(record=>record.target.closest?.(selector)||[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches(selector)||node.querySelector(selector)))))schedule();
  }).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',schedule);document.addEventListener('toggle',schedule,true);
  window.SalaryMateScrollbars=Object.freeze({refresh});schedule();
})();

// R70: eight real viewing directions, continuous wing strokes and path-led turning.
(() => {
  let active = null, loadedSheet = null;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = t => t * t * (3 - 2 * t);
  const travelProgress = t => {
    const takeoff=.12,landing=.18,area=1-(takeoff+landing)/2;
    if(t<takeoff){const u=t/takeoff;return takeoff*(u/2-Math.sin(Math.PI*u)/(2*Math.PI))/area;}
    if(t<=1-landing)return (t-takeoff/2)/area;
    const u=(t-1+landing)/landing;
    return (1-landing-takeoff/2+landing*(u/2+Math.sin(Math.PI*u)/(2*Math.PI)))/area;
  };
  const TAU = Math.PI * 2;
  const angleDelta = (from, to) => Math.atan2(Math.sin(to-from), Math.cos(to-from));
  // Atlas: 6 columns x 4 rows. Each three-frame group is up / level / down.
  // Directions: front, front-right, right, back-right, back, back-left, left, front-left.
  const anchors = [
    [142,150],[125,152],[130,153], [151,156],[143,157],[144,160],
    [179,129],[177,130],[174,132], [144,121],[145,122],[143,124],
    [143,103],[128,107],[126,107], [105,108],[114,115],[107,119],
    [107,113],[99,113],[96,114], [103,114],[92,118],[113,121]
  ];
  const makeRoute = (points, bounds) => {
    const samples = [{...points[0], distance:0, segment:0, t:0}],segments=[];
    // One tangent is shared by both sides of each waypoint, avoiding sharp joins.
    const tangents=points.map((point,i)=>{
      if(i===0||i===points.length-1)return {x:0,y:0};
      const before=points[i-1],after=points[i+1];
      const x=(after.x-before.x)*.19,y=(after.y-before.y)*.19;
      const limitX=x?Math.min(point.x-bounds.minX,bounds.maxX-point.x)/Math.abs(x):1;
      const limitY=y?Math.min(point.y-bounds.minY,bounds.maxY-point.y)/Math.abs(y):1;
      const limit=clamp(Math.min(1,limitX,limitY),0,1);
      return {x:x*limit,y:y*limit};
    });
    const evaluate=(segment,t)=>{
      const {p1,a,b,p2}=segment,u=1-t;
      return {x:u*u*u*p1.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*p2.x,
        y:u*u*u*p1.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*p2.y,
        dx:3*u*u*(a.x-p1.x)+6*u*t*(b.x-a.x)+3*t*t*(p2.x-b.x),
        dy:3*u*u*(a.y-p1.y)+6*u*t*(b.y-a.y)+3*t*t*(p2.y-b.y)};
    };
    for (let i=0;i<points.length-1;i++) {
      const p1=points[i],p2=points[i+1];
      const a={x:p1.x+tangents[i].x,y:p1.y+tangents[i].y};
      const b={x:p2.x-tangents[i+1].x,y:p2.y-tangents[i+1].y};
      const segment={p1,a,b,p2};segments.push(segment);
      for(let step=1;step<=64;step++){
        const t=step/64,{x,y}=evaluate(segment,t);
        const previous=samples.at(-1);
        samples.push({x,y,distance:previous.distance+Math.hypot(x-previous.x,y-previous.y),segment:i,t});
      }
    }
    const length=samples.at(-1).distance;
    const at = progress => {
      const distance=clamp(progress,0,1)*length;
      let low=1,high=samples.length-1;
      while(low<high){const mid=(low+high)>>1;if(samples[mid].distance<distance)low=mid+1;else high=mid;}
      const a=samples[low-1],b=samples[low],t=(distance-a.distance)/(b.distance-a.distance||1);
      const start=a.segment===b.segment?a.t:0;
      return evaluate(segments[b.segment],start+(b.t-start)*t);
    };
    return {at,length};
  };
  const stop = () => {
    if (!active) return;
    const flight = active;
    active = null;
    if (flight.frame !== null) window.cancelAnimationFrame(flight.frame);
    if (flight.loading) { flight.loading.onload=null; flight.loading.onerror=null; }
    window.clearTimeout(flight.timer);
    flight.cleanups.forEach(cleanup => cleanup());
    flight.layer?.remove();
    flight.button.classList.remove('jingyu-away', 'jingyu-greeting');
    flight.button.setAttribute('aria-pressed', 'false');
  };
  const fly = button => {
    if (active) { stop(); return; }
    const art = button?.querySelector('.v5-companion-art');
    if (!art || !button.isConnected || document.hidden || document.body.dataset.interfaceStyle !== 'pixel' || document.querySelector('dialog[open]')) return;
    const home = art.getBoundingClientRect();
    if (home.width <= 0 || home.height <= 0) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const flight = { button, cleanups: [], layer: null, frame: null, loading: null, timer: null };
    active = flight;
    const finish = () => { if (active === flight) stop(); };
    const listen = (target, event, handler = finish) => {
      if (!target?.addEventListener) return;
      target.addEventListener(event, handler, { passive: true });
      flight.cleanups.push(() => target.removeEventListener(event, handler));
    };
    listen(document, 'visibilitychange', () => { if (document.hidden) finish(); });
    listen(document, 'keydown', event => { if (event.key === 'Escape') finish(); });
    for (const event of ['pagehide', 'resize', 'scroll', 'beforeprint']) listen(window, event);
    for (const event of ['resize', 'scroll']) listen(window.visualViewport, event);
    listen(reduced, 'change');
    const greet = () => {
      window.clearTimeout(flight.timer);
      button.classList.add('jingyu-greeting');
      const message = document.createElement('span');
      message.className = 'sr-only';
      message.setAttribute('role', 'status');
      button.append(message);
      message.textContent = window.SalaryMateI18n?.text('晶羽向你打招呼') || '晶羽向你打招呼';
      flight.layer = message;
      flight.timer = window.setTimeout(finish, 1800);
    };
    if (reduced?.matches || typeof window.requestAnimationFrame !== 'function' || !art.complete || !art.naturalWidth) { greet(); return; }
    const begin = sheet => {
    if(active!==flight)return;
    if(reduced?.matches){greet();return;}
    window.clearTimeout(flight.timer);
    button.classList.remove('jingyu-greeting');
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const size = Math.min(172, width * .39, height * .34);
    if (size < 24) { greet(); return; }
    // Reserve room for rotation, the phone safe area, and the bottom menu.
    const radius = size * .55;
    const minX = left + 12 + radius, maxX = Math.max(minX, left + width - 12 - radius);
    const minY = top + Math.min(40, height * .08) + radius;
    const maxY = Math.max(minY, top + height - Math.min(100, height * .18) - radius);
    const homePoint = { x: home.left + home.width / 2, y: home.top + home.height / 2 };
    const homeScale = Math.min(1, home.width / (size * .64));
    const center={x:(minX+maxX)/2,y:(minY+maxY)/2};
    const rx=(maxX-minX)*(.40+Math.random()*.08),ry=(maxY-minY)*(.40+Math.random()*.08);
    const startAngle=Math.atan2((homePoint.y-center.y)/(ry||1),(homePoint.x-center.x)/(rx||1));
    const direction=Math.random()>.5?1:-1;
    const points=[homePoint];
    // A rounded full orbit naturally exposes both profiles and the back on each flight.
    for(let i=0;i<=8;i++){
      const angle=startAngle+direction*(i+.35)*TAU/8;
      points.push({x:center.x+Math.cos(angle)*rx,y:center.y+Math.sin(angle)*ry});
    }
    points.push(homePoint);
    const route = makeRoute(points, {minX,maxX,minY,maxY});
    const layer = document.createElement('div');
    layer.className = 'jingyu-flight-layer';
    layer.setAttribute('aria-hidden', 'true');
    const actor = document.createElement('div');
    actor.className = 'jingyu-flight-actor';
    actor.style.width = actor.style.height = `${size}px`;
    const facing = document.createElement('div');
    facing.className = 'jingyu-flight-facing';
    const frame = document.createElement('div');
    frame.className = 'jingyu-flight-sprite';
    const blended=window.CSS?.supports?.('mix-blend-mode','plus-lighter')===true;
    const layers=Array.from({length:blended?4:1},()=>{
      const wrapper=document.createElement('div'),crop=document.createElement('div'),image=document.createElement('img');
      wrapper.className='jingyu-flight-pose';crop.className='jingyu-flight-cell';
      image.className='jingyu-flight-sheet';image.src=sheet.src;image.alt='';image.draggable=false;
      crop.append(image);wrapper.append(crop);frame.append(wrapper);
      return {wrapper,crop,image,lastPose:-1};
    });
    facing.append(frame);
    actor.append(facing);
    layer.append(actor);
    document.body.append(layer);
    flight.layer = layer;
    button.classList.add('jingyu-away');
    button.setAttribute('aria-pressed', 'true');
    const duration=clamp(route.length/255*1000+1800,9800,15500),started=window.performance.now();
    let previous=started,heading=0,bank=0,pitch=0,glideBlend=0;
    const pose = (layer,index,opacity) => {
      layer.wrapper.style.opacity=String(opacity);
      if(index===layer.lastPose)return;
      layer.lastPose=index;
      const [anchorX,anchorY]=anchors[index];
      // Clip the source cell before registration so offsets cannot expose a neighbor.
      layer.crop.style.transform=`translate3d(${(.5-anchorX/256*.84)*100}%,${(.44-anchorY/256*.84)*100}%,0) scale(.84)`;
      layer.image.style.transform=`translate3d(${-(index%6)/6*100}%,${-Math.floor(index/6)/4*100}%,0)`;
    };
    const tick = now => {
      if(active!==flight)return;
      const elapsed=now-started,t=clamp(elapsed/duration,0,1),dt=clamp(now-previous,0,80);
      previous=now;
      if(t>=1){finish();return;}
      const progress=travelProgress(t),point=route.at(progress);
      const ahead=route.at(Math.min(1,progress+Math.min(.018,22/(route.length||1))));
      const speed=Math.hypot(point.dx,point.dy);
      const landing=smooth(clamp((t-.90)/.10,0,1));
      let targetHeading=speed>.001?Math.atan2(point.dx,point.dy):heading;
      targetHeading+=angleDelta(targetHeading,0)*landing;
      // Wrapped angular damping crosses 359→0 smoothly and never flips a flat front image.
      const headingStep=angleDelta(heading,targetHeading)*(1-Math.exp(-dt/105));
      heading+=clamp(headingStep,-dt*.0042,dt*.0042);
      const directionPosition=((heading/TAU*8)%8+8)%8;
      const fromDirection=Math.floor(directionPosition),toDirection=(fromDirection+1)%8;
      const directionMix=smooth(directionPosition-fromDirection);
      const gliding=(t>.24&&t<.38)||(t>.59&&t<.73);
      glideBlend+=((gliding?1:0)-glideBlend)*(1-Math.exp(-dt/155));
      // Absolute elapsed time keeps wing phase consistent across refresh rates.
      const phase=elapsed/620;
      const stroke=1-Math.cos(phase*TAU)*(1-glideBlend);
      const fromWing=Math.min(1,Math.floor(stroke)),toWing=fromWing+1,wingMix=stroke-fromWing;
      if(blended){
        pose(layers[0],fromDirection*3+fromWing,(1-directionMix)*(1-wingMix));
        pose(layers[1],fromDirection*3+toWing,(1-directionMix)*wingMix);
        pose(layers[2],toDirection*3+fromWing,directionMix*(1-wingMix));
        pose(layers[3],toDirection*3+toWing,directionMix*wingMix);
      }else pose(layers[0],(directionMix>.5?toDirection:fromDirection)*3+(wingMix>.5?toWing:fromWing),1);
      const turn=Math.atan2(point.dx*ahead.dy-point.dy*ahead.dx,point.dx*ahead.dx+point.dy*ahead.dy);
      const settling=1-smooth(clamp((t-.86)/.14,0,1));
      const targetBank=clamp(turn*180/Math.PI*2+(point.dx/(speed||1))*4,-17,17)*settling;
      bank+=(targetBank-bank)*(1-Math.exp(-dt/145));
      pitch+=(-point.dy/(speed||1)*5*settling-pitch)*(1-Math.exp(-dt/180));
      facing.style.transform=`perspective(520px) rotateX(${pitch.toFixed(2)}deg)`;
      const lift=smooth(clamp(Math.min(t/.12,(1-t)/.16),0,1));
      const depth=1-.10*(1-Math.cos(heading))/2;
      const scale=homeScale+(depth-homeScale)*lift;
      const bob=Math.sin(phase*TAU)*.7*lift*(1-glideBlend);
      const edge=size*scale*.60;
      const x=clamp(point.x,left+edge,left+width-edge);
      const y=clamp(point.y+bob,top+edge,top+height-edge);
      actor.style.transform=`translate3d(${(x-size/2).toFixed(2)}px,${(y-size/2).toFixed(2)}px,0) rotate(${bank.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      actor.style.opacity=String(smooth(clamp(Math.min(t/.035,(1-t)/.035),0,1)));
      if(t>.978)button.classList.remove('jingyu-away');
      flight.frame=window.requestAnimationFrame(tick);
    };
    tick(started);
    flight.timer=window.setTimeout(finish,duration+350);
    };
    const source=button.dataset.flightSrc;
    if(!source || !(source==='./art/jingyu-flight-r70.png'||source.startsWith('data:image/png;base64,'))){greet();return;}
    if(loadedSheet?.source===source){begin(loadedSheet.image);return;}
    button.classList.add('jingyu-greeting');
    const image=new window.Image();
    flight.loading=image;
    image.decoding='async';
    image.onload=async()=>{
      image.onload=image.onerror=null;
      try{if(typeof image.decode==='function')await image.decode();}catch{if(active===flight){flight.loading=null;greet();}return;}
      if(active!==flight)return;
      flight.loading=null;loadedSheet={source,image};begin(image);
    };
    image.onerror=()=>{image.onload=image.onerror=null;if(active===flight){flight.loading=null;greet();}};
    flight.timer=window.setTimeout(finish,6000);
    image.src=source;
  };
  window.SalaryMateCompanion = Object.freeze({ fly, stop });
})();
