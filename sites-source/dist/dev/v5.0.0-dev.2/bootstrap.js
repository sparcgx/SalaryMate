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
  const cinematic = t => t*t*t*(t*(t*6-15)+10);
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
  // R73: measured source rectangles preserve wing tips beyond the nominal 512px grid.
  // [sourceX, sourceY, width, height, headXWithinCrop, headYWithinCrop]
  const posesR73 = [
    [41,63,427,408,215,192],
    [492,156,553,305,276,100],
    [1056,156,449,323,240,99],
    [55,509,442,435,266,225],
    [534,617,526,316,304,115],
    [1102,621,413,334,252,109],
    [54,45,417,423,310,219],
    [541,137,439,330,327,128],
    [1074,142,415,356,297,123],
    [67,522,419,412,231,176],
    [522,614,523,315,298,93],
    [1087,625,404,361,280,95],
    [48,55,447,385,217,165],
    [515,140,517,301,258,80],
    [1062,136,401,306,202,80],
    [64,507,416,410,249,174],
    [511,587,515,329,267,85],
    [1071,592,409,339,194,92],
    [84,22,378,462,101,235],
    [591,142,437,342,104,120],
    [1099,124,412,381,117,125],
    [67,512,416,426,160,208],
    [510,619,540,318,244,104],
    [1071,625,436,346,187,101],
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
    if (flight.loading) for(const image of flight.loading){image.onload=null;image.onerror=null;}
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
    const begin = async sheets => {
    if(active!==flight)return;
    if(reduced?.matches){greet();return;}
    window.clearTimeout(flight.timer);
    flight.timer=window.setTimeout(finish,6000);
    button.classList.remove('jingyu-greeting');
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    // R73: render at the closest pass size, then scale DOWN at a distance.
    // This avoids enlarging an already-rasterized low-resolution compositor layer.
    const nearDepth=1.55,farDepth=.64;
    const size = Math.min(192, width * .32, height * .29) * nearDepth;
    if (size < 24) { greet(); return; }
    // Reserve room for rotation, the phone safe area, and the bottom menu.
    const radius = size * .60;
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
    const split=sheets.length===4;
    const layers=Array.from({length:blended?2:1},()=>{
      const wrapper=document.createElement('div'),crop=document.createElement('div');
      wrapper.className='jingyu-flight-pose';crop.className='jingyu-flight-cell';
      const images=sheets.map(sheet=>{
        const image=document.createElement('img');
        image.className='jingyu-flight-sheet';image.decoding='sync';image.src=sheet.src;image.alt='';image.draggable=false;
        image.style.width=split?'300%':'600%';image.style.height=split?'200%':'400%';image.style.display='none';
        crop.append(image);return image;
      });
      wrapper.append(crop);frame.append(wrapper);
      return {wrapper,crop,images,lastPose:-1,activeSheet:-1};
    });
    facing.append(frame);
    actor.append(facing);
    layer.append(actor);
    flight.layer = layer;
    // R72: decode the actual rendered nodes, not only the preload Image.
    // Keep the perched bird visible throughout cold-cache / iOS decoding.
    try {
      await Promise.all(layers.flatMap(layer=>layer.images).map(image => {
        if(typeof image.decode==='function')return image.decode();
        if(image.complete&&image.naturalWidth)return Promise.resolve();
        return new Promise((resolve,reject)=>{
          image.onload=()=>{image.onload=image.onerror=null;resolve();};
          image.onerror=()=>{image.onload=image.onerror=null;reject(new Error('Flight image unavailable'));};
          flight.cleanups.push(()=>{image.onload=image.onerror=null;resolve();});
        });
      }));
    } catch { if(active===flight){layer.remove();flight.layer=null;greet();} return; }
    if(active!==flight)return;
    window.clearTimeout(flight.timer);
    // Optional spell art never delays takeoff. Use the actual displayed images;
    // a failed/late image simply skips that spell, and stop() owns every node.
    const spellSources=window.SalaryMateWindArt;
    const spells=Array.isArray(spellSources)&&spellSources.length===2&&spellSources.every((src,i)=>typeof src==='string'&&(src===`./art/jingyu-wind-${i?'tornado':'blade'}-r75.png`||src.startsWith('data:image/png;base64,')))
      ?[{kind:0,at:.29,fan:-.24,life:900},{kind:0,at:.29,fan:0,life:900},{kind:0,at:.29,fan:.24,life:900},{kind:1,at:.60,fan:0,life:1900}].map(spec=>{
        const node=document.createElement('div'),image=document.createElement('img');
        node.className='jingyu-wind-effect';node.dataset.kind=spec.kind?'tornado':'blade';node.style.opacity='0';
        image.className='jingyu-wind-art';image.alt='';image.draggable=false;image.decoding='async';
        const spell={...spec,node,image,ready:false,fired:false,born:null};
        const release=()=>{image.onload=image.onerror=null;};
        const ready=()=>{release();if(active===flight)spell.ready=true;};
        flight.cleanups.push(()=>{release();spell.ready=false;});
        image.src=spellSources[spec.kind];node.append(image);layer.append(node);
        if(typeof image.decode==='function')Promise.resolve().then(()=>image.decode()).then(ready,release);
        else {image.onload=ready;image.onerror=release;if(image.complete&&image.naturalWidth)ready();}
        return spell;
      }):[];
    document.body.append(layer);
    button.setAttribute('aria-pressed', 'true');
    const duration=clamp(route.length/235*1000+2200,11200,16200),started=window.performance.now();
    let previous=started,heading=0,bank=0,pitch=0;
    const pose = (layer,index,opacity) => {
      layer.wrapper.style.opacity=String(opacity);
      if(index===layer.lastPose)return;
      layer.lastPose=index;
      const sheetIndex=split?Math.floor(index/6):0,cellIndex=split?index%6:index;
      if(sheetIndex!==layer.activeSheet){
        if(layer.activeSheet>=0)layer.images[layer.activeSheet].style.display='none';
        layer.images[sheetIndex].style.display='block';layer.activeSheet=sheetIndex;
      }
      const image=layer.images[sheetIndex];
      if(split){
        const [x,y,w,h,headX,headY]=posesR73[index],artScale=.74;
        // Crop each full silhouette BEFORE head registration, with consistent pixel scale.
        layer.crop.style.width=`${w/512*size}px`;layer.crop.style.height=`${h/512*size}px`;
        layer.crop.style.transform=`translate3d(${(.5-headX/512*artScale)*size}px,${(.44-headY/512*artScale)*size}px,0) scale(${artScale})`;
        image.style.width=`${1536/w*100}%`;image.style.height=`${1024/h*100}%`;
        image.style.transform=`translate3d(${-x/1536*100}%,${-y/1024*100}%,0)`;
      }else{
        const [anchorX,anchorY]=anchors[index];
        layer.crop.style.transform=`translate3d(${(.5-anchorX/256*.84)*100}%,${(.44-anchorY/256*.84)*100}%,0) scale(.84)`;
        image.style.transform=`translate3d(${-(cellIndex%6)/6*100}%,${-Math.floor(cellIndex/6)/4*100}%,0)`;
      }
    };
    // R75: one clear pose most of the time, with only a short TWO-pose handoff.
    // Never blend two wing phases across two viewing directions simultaneously.
    let shownPose=-1,nextPose=-1,handoffAt=0;
    const handoffMs=64;
    const renderPose=(target,now)=>{
      if(!blended){pose(layers[0],target,1);return;}
      if(shownPose<0)shownPose=target;
      if(nextPose>=0&&now-handoffAt>=handoffMs){shownPose=nextPose;nextPose=-1;}
      if(nextPose<0&&target!==shownPose){nextPose=target;handoffAt=now;}
      const mix=nextPose<0?0:cinematic(clamp((now-handoffAt)/handoffMs,0,1));
      pose(layers[0],shownPose,1-mix);
      pose(layers[1],nextPose<0?shownPose:nextPose,mix);
    };
    const wind=(elapsed,x,y,scale,heading)=>{
      for(const spell of spells){
        const due=duration*spell.at;
        if(!spell.fired&&elapsed>=due){
          if(!spell.ready&&elapsed<due+250)continue;
          spell.fired=true;
          if(!spell.ready||elapsed>=due+spell.life)continue;
          spell.born=due;
          const angle=Math.PI/2-heading+spell.fan;
          spell.vx=Math.cos(angle);spell.vy=Math.sin(angle);spell.angle=angle*180/Math.PI;
          spell.w=spell.kind?clamp(size*.56,88,152):clamp(size*.48,64,128);
          spell.h=spell.kind?clamp(spell.w*1.45,128,204):spell.w;
          const availableRadius=Math.max(10,(Math.min(width,height)-20)/2);
          const fit=Math.min(1,(availableRadius-6)/(Math.hypot(spell.w,spell.h)*.55));
          spell.w*=fit;spell.h*=fit;
          spell.node.style.width=`${spell.w}px`;spell.node.style.height=`${spell.h}px`;
          spell.radius=Math.hypot(spell.w,spell.h)*.55+6;
          const forward=size*scale*(spell.kind?.54:.18);
          spell.x=clamp(x+spell.vx*forward,left+spell.radius,left+width-spell.radius);
          spell.y=clamp(y+spell.vy*forward,top+spell.radius,top+height-spell.radius);
          const distance=spell.kind?Math.min(42,width*.10):Math.min(180,width*.38,height*.30);
          spell.endX=clamp(spell.x+spell.vx*distance,left+spell.radius,left+width-spell.radius);
          spell.endY=clamp(spell.y+spell.vy*distance,top+spell.radius,top+height-spell.radius);
        }
        if(spell.born===null)continue;
        const p=clamp((elapsed-spell.born)/spell.life,0,1);
        if(p>=1){spell.node.style.opacity='0';continue;}
        const appear=cinematic(clamp(p/(spell.kind?.20:.14),0,1));
        const disappear=1-cinematic(clamp((p-(spell.kind?.68:.55))/(spell.kind?.32:.45),0,1));
        const opacity=.86*appear*disappear;
        const travel=spell.kind?smooth(p):1-(1-p)*(1-p);
        const cx=spell.x+(spell.endX-spell.x)*travel,cy=spell.y+(spell.endY-spell.y)*travel;
        const rotation=spell.kind?Math.sin(p*TAU*2)*5:spell.angle+Math.sin(p*Math.PI)*spell.fan*18;
        const zoom=spell.kind?(.55+.43*appear)*(.97+.025*Math.sin(p*TAU*5)):.76+.22*appear;
        spell.node.style.opacity=String(opacity);
        spell.node.style.transform=`translate3d(${(cx-spell.w/2).toFixed(2)}px,${(cy-spell.h/2).toFixed(2)}px,0) rotate(${rotation.toFixed(2)}deg) scale(${zoom.toFixed(4)})`;
        if(spell.kind)spell.image.style.transform=`scaleX(${(.94+.045*Math.sin(p*TAU*6)).toFixed(4)})`;
      }
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
      // Continuous absolute-time glide envelopes avoid refresh-rate-dependent transitions.
      const glideWindow=(a,b,c,d)=>cinematic(clamp((t-a)/(b-a),0,1))*(1-cinematic(clamp((t-c)/(d-c),0,1)));
      const glideBlend=glideWindow(.24,.28,.36,.40)+glideWindow(.59,.63,.71,.75);
      // Absolute elapsed time keeps wing phase consistent across refresh rates.
      const phase=elapsed/740;
      const stroke=1-Math.cos(phase*TAU)*(1-glideBlend);
      const targetPose=(directionMix>.5?toDirection:fromDirection)*3+Math.round(stroke);
      renderPose(targetPose,now);
      const turn=Math.atan2(point.dx*ahead.dy-point.dy*ahead.dx,point.dx*ahead.dx+point.dy*ahead.dy);
      const settling=1-smooth(clamp((t-.86)/.14,0,1));
      const targetBank=clamp(turn*180/Math.PI*2+(point.dx/(speed||1))*4,-17,17)*settling;
      bank+=(targetBank-bank)*(1-Math.exp(-dt/145));
      const depthMotion=Math.sin(TAU*progress);
      pitch+=((-point.dy/(speed||1)*3+depthMotion*3)*settling-pitch)*(1-Math.exp(-dt/180));
      facing.style.transform=`perspective(520px) rotateX(${pitch.toFixed(2)}deg)`;
      const lift=cinematic(clamp(Math.min(t/.14,(1-t)/.18),0,1));
      // One continuous approach/recede pass follows route progress, not turn direction.
      const nearWeight=(1-Math.cos(TAU*progress))/2;
      const depth=(farDepth+(nearDepth-farDepth)*nearWeight)/nearDepth;
      const scale=homeScale+(depth-homeScale)*lift;
      const bob=Math.sin(phase*TAU)*.7*lift*(1-glideBlend);
      const edge=size*scale*.60;
      const x=clamp(point.x,left+edge,left+width-edge);
      const y=clamp(point.y+bob,top+edge,top+height-edge);
      actor.style.transform=`translate3d(${(x-size/2).toFixed(2)}px,${(y-size/2).toFixed(2)}px,0) rotate(${bank.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      // The first flight frame is opaque; only fade when the perched bird returns.
      actor.style.opacity=String(1-smooth(clamp((t-.978)/.022,0,1)));
      if(t>.978)button.classList.remove('jingyu-away');
      wind(elapsed,x,y,scale,heading);
      flight.frame=window.requestAnimationFrame(tick);
    };
    tick(started);
    button.classList.add('jingyu-away');
    flight.timer=window.setTimeout(finish,duration+350);
    };
    // High-detail plates live once in app memory; do not duplicate large data URLs in every render.
    const source=window.SalaryMateFlightSheets||button.dataset.flightSrc;
    const sources=Array.isArray(source)?source:[source];
    if(![1,4].includes(sources.length)||sources.some(src=>typeof src!=='string'||!(src==='./art/jingyu-flight-r70.png'||/^\.\/art\/jingyu-flight-r73-[abcd]\.png$/.test(src)||src.startsWith('data:image/png;base64,')))){greet();return;}
    if(loadedSheet?.source===source)return begin(loadedSheet.images);
    button.classList.add('jingyu-greeting');
    const images=sources.map(()=>new window.Image());
    flight.loading=images;
    flight.timer=window.setTimeout(finish,sources.length===4?15000:6000);
    const loading=images.map((image,index)=>new Promise((resolve,reject)=>{
      const release=()=>{image.onload=image.onerror=null;};
      image.decoding='async';
      image.onload=async()=>{
        release();
        try{if(typeof image.decode==='function')await image.decode();}catch(error){reject(error);return;}
        resolve(active===flight?image:null);
      };
      image.onerror=()=>{release();reject(new Error('Flight image unavailable'));};
      flight.cleanups.push(()=>{release();resolve(null);});
      image.src=sources[index];
    }));
    return Promise.all(loading).then(images=>{
      if(active!==flight||images.some(image=>!image))return;
      flight.loading=null;loadedSheet={source,images};return begin(images);
    }).catch(()=>{if(active===flight){flight.loading=null;greet();}});
  };
  window.SalaryMateCompanion = Object.freeze({ fly, stop });
})();
