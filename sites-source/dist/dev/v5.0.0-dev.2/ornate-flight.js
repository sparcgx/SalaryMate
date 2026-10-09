if(!window.SalaryMateCompanion){
// R70: eight real viewing directions, continuous wing strokes and path-led turning.
(() => {
  let active = null, loadedSheet = null;
  let magicBag=[],lastMagic=null;
  // R78: two spells per flight, shuffled without replacement across five flights.
  const magicBook=[
    {id:'blade',zh:'風刃',en:'Wind Blade',kind:0,life:900},
    {id:'bullet',zh:'疾風彈',en:'Wind Bullet',kind:0,life:1150,hits:[[410,1.25,620]]},
    {id:'vacuum',zh:'真空波',en:'Vacuum Wave',kind:0,life:1000,hits:[[340,.95,440]]},
    {id:'bind',zh:'旋風絞殺',en:'Whirlwind Bind',kind:1,life:2150,hits:[[400,.60,350],[850,.70,350],[1300,.75,350],[1750,1,500]]},
    {id:'gale',zh:'狂風震擊',en:'Gale Burst',kind:1,life:1150,hits:[[230,1.3,620]]},
    {id:'tornado',zh:'龍捲風暴',en:'Tornado',kind:1,life:2350,hits:[[760,.85,450],[1270,.95,450],[1800,1.25,640]]},
    {id:'spear',zh:'風神之矛',en:'Spear of Zephyr',kind:0,life:1300,hits:[[510,1.35,620]]},
    {id:'storm',zh:'千刃風暴',en:'Blade Storm',kind:1,life:1850,hits:[[350,.50,280],[750,.60,280],[1150,.70,280],[1520,1,480]]},
    {id:'implosion',zh:'真空爆破',en:'Void Implosion',kind:1,life:1900,hits:[[1060,1.4,740]]},
    {id:'hurricane',zh:'滅世颶風',en:'Grand Hurricane',kind:1,life:2750,hits:[[650,.75,440],[1200,.90,440],[1780,1.10,480],[2290,1.40,760]]}
  ];
  const drawMagic=()=>{
    if(!magicBag.length){
      magicBag=magicBook.slice();
      for(let i=magicBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[magicBag[i],magicBag[j]]=[magicBag[j],magicBag[i]];}
      if(magicBag.at(-1)?.id===lastMagic)[magicBag[0],magicBag[magicBag.length-1]]=[magicBag.at(-1),magicBag[0]];
    }
    const magic=magicBag.pop();lastMagic=magic.id;return magic;
  };
  const magicParts=id=>{
    const part=(role,art,index=0)=>({role,art,index});
    if(id==='bullet')return [part('bullet',2),part('bullet-ring',4)];
    if(id==='vacuum')return [part('vacuum',4),part('vacuum',4,1)];
    if(id==='bind')return [part('bind-column',1),...Array.from({length:4},(_,i)=>part('bind-blade',0,i))];
    if(id==='gale')return Array.from({length:3},(_,i)=>part('burst-ring',4,i));
    if(id==='tornado')return [part('tornado-column',1),...Array.from({length:3},(_,i)=>part('lift-ring',4,i))];
    if(id==='spear')return [part('spear',3),part('spear-ring',4),part('spear-ring',4,1)];
    if(id==='storm')return Array.from({length:12},(_,i)=>part('rain-blade',0,i));
    if(id==='implosion')return [part('implosion-core',2),...Array.from({length:4},(_,i)=>part('inward-ring',4,i))];
    if(id==='hurricane')return [part('hurricane-eye',4),part('hurricane-column',1),part('hurricane-column',1,1),part('hurricane-ring',4),part('hurricane-ring',4,1),...Array.from({length:5},(_,i)=>part('hurricane-blade',0,i))];
    return [];
  };
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
  // R76: measured rectangles include the forward slash and raised feather tips.
  // Head registration keeps the six poses steady despite irregular atlas spacing.
  const castPoses=[
    [21,123,450,333,350,132], [529,104,563,365,318,136],
    [1066,112,446,377,285,134], [68,537,422,421,251,189],
    [533,474,464,478,270,246], [993,617,537,348,328,103]
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
    listen(document, 'pointerdown', event => { if (!button.contains?.(event.target)) finish(); });
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
    // R80: defer optional attack decoding until flight is already visible.
    const castSource=window.SalaryMateCastArt;
    let castReady=false,castStarted=false;
    const loadCast=()=>{
      if(castStarted||active!==flight)return;
      castStarted=true;
      if(!(typeof castSource==='string'&&(castSource==='./art/jingyu-cast-r76.png'||castSource.startsWith('data:image/png;base64,'))))return;
      let readyCount=0;
      layers.forEach(poseLayer=>{
        const image=document.createElement('img');
        image.className='jingyu-flight-sheet';image.alt='';image.draggable=false;image.decoding='async';image.style.display='none';
        image.src=castSource;poseLayer.images.push(image);poseLayer.crop.append(image);
        const release=()=>{image.onload=image.onerror=null;};
        const ready=()=>{release();if(active===flight&&++readyCount===layers.length)castReady=true;};
        flight.cleanups.push(release);
        if(typeof image.decode==='function')Promise.resolve().then(()=>image.decode()).then(ready,release);
        else {image.onload=ready;image.onerror=release;if(image.complete&&image.naturalWidth)ready();}
      });
      flight.cleanups.push(()=>{castReady=false;});
    };
    const spellSources=window.SalaryMateWindArt,extraSources=window.SalaryMateWindExtras;
    const hasWind=Array.isArray(spellSources)&&spellSources.length===2&&spellSources.every((src,i)=>typeof src==='string'&&(src===`./art/jingyu-wind-${i?'tornado':'blade'}-r75.png`||src.startsWith('data:image/png;base64,')));
    const expanded=hasWind&&Array.isArray(extraSources)&&extraSources.length===3&&extraSources.every((src,i)=>typeof src==='string'&&(src===`./art/jingyu-wind-${['bullet','spear','vortex'][i]}-r78.png`||src.startsWith('data:image/png;base64,')));
    const selected=expanded?[drawMagic(),drawMagic()]:null;
    const casts=selected?selected.map((magic,index)=>({magic,index,kind:magic.kind,at:index?.60:.29,lead:magic.kind?600:420,hold:magic.kind?(magic.id==='hurricane'?1800:1050):280,recovery:magic.kind?400:300,armed:null}))
      :[{kind:0,index:0,at:.29,lead:420,hold:260,recovery:300,armed:null},{kind:1,index:1,at:.60,lead:560,hold:500,recovery:400,armed:null}];
    const sourcesForMagic=expanded?[...spellSources,...extraSources]:spellSources;
    const specs=selected?casts.flatMap(cast=>cast.magic.id==='blade'
      ?[-.24,0,.24].map(fan=>({kind:0,castIndex:cast.index,magic:cast.magic,at:cast.at,fan,life:900,art:0}))
      :magicParts(cast.magic.id).map((part,i)=>({...part,kind:cast.kind,castIndex:cast.index,magic:cast.magic,at:cast.at,fan:0,life:cast.magic.life,striker:i===0})))
      :[{kind:0,castIndex:0,at:.29,fan:-.24,life:900,art:0},{kind:0,castIndex:0,at:.29,fan:0,life:900,art:0},{kind:0,castIndex:0,at:.29,fan:.24,life:900,art:0},{kind:1,castIndex:1,at:.60,fan:0,life:1900,art:1}];
    // Decode only the selected spells' actual nodes; failed art never blocks flight.
    const spells=hasWind?specs.map(spec=>{
      const node=document.createElement('div'),image=document.createElement('img');
      node.className='jingyu-wind-effect';node.dataset.kind=spec.magic?.id||(spec.kind?'tornado':'blade');node.dataset.role=spec.role||'projectile';node.style.opacity='0';
      image.className='jingyu-wind-art';image.alt='';image.draggable=false;image.decoding='async';
      const spell={...spec,node,image,ready:false,fired:false,born:null,hitStep:0};
      const release=()=>{image.onload=image.onerror=null;};
      const ready=()=>{release();if(active===flight)spell.ready=true;};
      flight.cleanups.push(()=>{release();spell.ready=false;});
      node.append(image);layer.append(node);
      spell.load=()=>{
        if(spell.loading||active!==flight)return;spell.loading=true;
        image.src=sourcesForMagic[spec.art];
        if(typeof image.decode==='function')Promise.resolve().then(()=>image.decode()).then(ready,release);
        else {image.onload=ready;image.onerror=release;if(image.complete&&image.naturalWidth)ready();}
      };
      return spell;
    }):[];
    const prepared=[false,false];
    const prepareMagic=elapsed=>{
      for(let index=0;index<casts.length;index++){
        // Stage one follows visible takeoff; stage two precedes its own wind-up.
        const from=index?Math.max(120,duration*casts[index].at-2400):120;
        if(prepared[index]||elapsed<from)continue;
        prepared[index]=true;
        // Never start late downloads after a tab suspension missed the spell.
        if(elapsed>=duration*casts[index].at)continue;
        loadCast();spells.filter(spell=>spell.castIndex===index).forEach(spell=>spell.load());
      }
    };
    const spellName=document.createElement('div');spellName.className='jingyu-spell-name';spellName.style.opacity='0';
    if(expanded)layer.append(spellName);
    // R77: impact uses the same clock/RAF as flight, never transforms body or
    // reparents the app. Fixed menus keep their original viewport containing block.
    const impact=document.createElement('div'),wave=document.createElement('div');
    impact.className='jingyu-screen-impact';wave.className='jingyu-impact-wave';
    impact.style.opacity='0';wave.style.opacity='0';impact.append(wave);
    if(spells.length)layer.append(impact);
    const hits=[],bodyStyle=document.body.style;
    const impactVars=['--jingyu-impact-x','--jingyu-impact-y'];
    const savedImpactVars=impactVars.map(name=>[bodyStyle.getPropertyValue(name),bodyStyle.getPropertyPriority(name)]);
    const hadImpactClass=document.body.classList.contains('jingyu-screen-hit');
    let shaking=false;
    const clearImpact=()=>{
      if(!shaking)return;
      shaking=false;
      if(!hadImpactClass)document.body.classList.remove('jingyu-screen-hit');
      impactVars.forEach((name,i)=>{
        const [value,priority]=savedImpactVars[i];
        if(value)bodyStyle.setProperty(name,value,priority);else bodyStyle.removeProperty(name);
      });
      impact.style.opacity=wave.style.opacity='0';
    };
    flight.cleanups.push(()=>{clearImpact();hits.length=0;});
    const screenHit=elapsed=>{
      let dx=0,dy=0,energy=0,latest=null;
      for(let i=hits.length-1;i>=0;i--){
        const hit=hits[i],age=elapsed-hit.at,p=age/hit.life;
        if(p>=1){hits.splice(i,1);continue;}
        if(p<0)continue;
        const envelope=(1-p)**2*cinematic(clamp(age/22,0,1));
        const strength=(hit.strength??(hit.kind?1.3:1))*envelope,phase=age/1000*TAU;
        dx+=strength*(.68*Math.sin(phase*13.7)+.32*Math.sin(phase*22.3+1.1));
        dy+=strength*(.72*Math.sin(phase*17.1+.7)+.28*Math.cos(phase*25.7));
        energy=Math.max(energy,strength);if(!latest||hit.at>latest.at)latest=hit;
      }
      if(!latest){clearImpact();return;}
      const amplitude=clamp(Math.min(width,height)*.052,12,24);
      document.body.classList.add('jingyu-screen-hit');shaking=true;
      bodyStyle.setProperty(impactVars[0],`${(clamp(dx,-1.4,1.4)*amplitude).toFixed(2)}px`);
      bodyStyle.setProperty(impactVars[1],`${(clamp(dy,-1.2,1.2)*amplitude*.72).toFixed(2)}px`);
      // A soft edge pulse and expanding ring; no full-screen flashing.
      impact.style.opacity=String(Math.min(.64,energy*.48));
      const p=clamp((elapsed-latest.at)/latest.life,0,1),diameter=Math.min(width,height)*.68;
      wave.style.width=wave.style.height=`${diameter}px`;
      wave.style.opacity=String((1-p)**2*.72);
      wave.style.transform=`translate3d(${(latest.x-diameter/2).toFixed(2)}px,${(latest.y-diameter/2).toFixed(2)}px,0) scale(${(.30+1.4*cinematic(p)).toFixed(4)})`;
    };
    document.body.append(layer);
    button.setAttribute('aria-pressed', 'true');
    const duration=clamp(route.length/235*1000+2200,11200,16200),started=window.performance.now();
    let previous=started,heading=0,bank=0,pitch=0;
    const pose = (layer,index,opacity) => {
      layer.wrapper.style.opacity=String(opacity);
      if(index===layer.lastPose)return;
      layer.lastPose=index;
      layer.wrapper.dataset.pose=String(index);
      const casting=index>=24,castIndex=(index-24)%6;
      layer.wrapper.style.transform=casting&&index>=30?'scaleX(-1)':'scaleX(1)';
      layer.crop.style.clipPath='none';
      const sheetIndex=casting?sheets.length:(split?Math.floor(index/6):0),cellIndex=split?index%6:index;
      if(sheetIndex!==layer.activeSheet){
        if(layer.activeSheet>=0)layer.images[layer.activeSheet].style.display='none';
        layer.images[sheetIndex].style.display='block';layer.activeSheet=sheetIndex;
      }
      const image=layer.images[sheetIndex];
      if(casting){
        const [x,y,w,h,headX,headY]=castPoses[castIndex],artScale=.74;
        layer.crop.style.width=`${w/512*size}px`;layer.crop.style.height=`${h/512*size}px`;
        layer.crop.style.transform=`translate3d(${(.5-headX/512*artScale)*size}px,${(.44-headY/512*artScale)*size}px,0) scale(${artScale})`;
        image.style.width=`${1536/w*100}%`;image.style.height=`${1024/h*100}%`;
        image.style.transform=`translate3d(${-x/1536*100}%,${-y/1024*100}%,0)`;
        // These two silhouettes overlap in bounding-box space, not in pixels.
        // Exclude the neighbour without trimming either owl's actual feathers.
        if(castIndex===1)layer.crop.style.clipPath='polygon(0 0,100% 0,100% 53.6986%,95.3819% 53.6986%,95.3819% 100%,0 100%)';
        if(castIndex===2)layer.crop.style.clipPath='polygon(10.3139% 0,100% 0,100% 100%,0 100%,0 49.8674%,10.3139% 49.8674%)';
      }else if(split){
        const [x,y,w,h,headX,headY]=posesR73[index],artScale=.74;
        // Crop each full silhouette BEFORE head registration, with consistent pixel scale.
        layer.crop.style.width=`${w/512*size}px`;layer.crop.style.height=`${h/512*size}px`;
        layer.crop.style.transform=`translate3d(${(.5-headX/512*artScale)*size}px,${(.44-headY/512*artScale)*size}px,0) scale(${artScale})`;
        image.style.width=`${1536/w*100}%`;image.style.height=`${1024/h*100}%`;
        image.style.transform=`translate3d(${-x/1536*100}%,${-y/1024*100}%,0)`;
      }else{
        const [anchorX,anchorY]=anchors[index];
        layer.crop.style.width=layer.crop.style.height='100%';
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
    const attack=(elapsed,heading)=>{
      for(const cast of casts){
        const due=duration*cast.at,relative=elapsed-due;
        if(cast.armed===null&&relative>=-cast.lead){
          // Decide once before wind-up: late/failed art must not pop in mid-attack.
          cast.armed=castReady&&relative<-80&&spells.some(spell=>spell.castIndex===cast.index&&spell.ready);
          cast.side=Math.sin(heading)<0?-1:1;
        }
        if(!cast.armed||relative<-cast.lead||relative>=cast.hold+cast.recovery)continue;
        const stage=relative<-64?0:relative<cast.hold?1:2;
        const strength=cinematic(clamp((relative+cast.lead)/180,0,1))*(1-cinematic(clamp((relative-cast.hold)/cast.recovery,0,1)));
        return {pose:24+(cast.side<0?6:0)+cast.kind*3+stage,side:cast.side,strength,kick:Math.sin(Math.PI*clamp(relative/240,0,1)),kind:cast.kind,stage,id:cast.magic?.id||(cast.kind?'tornado':'blade')};
      }
      return null;
    };
    const renderMagic=(spell,elapsed,x,y)=>{
      const due=duration*spell.at;
      if(!spell.fired&&elapsed>=due){
        if(!spell.ready&&elapsed<due+250)return;
        spell.fired=true;
        if(!spell.ready||elapsed>=due+spell.life)return;
        spell.born=due;spell.x=x;spell.y=y;
        spell.tx=left+width*.50;spell.ty=top+height*.46;
        const unit=Math.min(width,height),column=spell.role.includes('column');
        spell.w=spell.role==='rain-blade'?Math.min(72,unit*.15):spell.role==='spear'?Math.min(280,unit*.72):column?Math.min(210,unit*.47):Math.min(200,unit*.44);
        spell.h=column?spell.w*1.5:spell.role==='spear'?spell.w*2/3:spell.w;
        spell.node.style.width=`${spell.w}px`;spell.node.style.height=`${spell.h}px`;
        spell.node.dataset.target='screen';spell.node.style.zIndex='2';
      }
      if(spell.born===null)return;
      const age=elapsed-spell.born,p=clamp(age/spell.life,0,1),i=spell.index;
      if(spell.striker)while(spell.hitStep<spell.magic.hits.length&&age>=spell.magic.hits[spell.hitStep][0]){
        const [at,strength,life]=spell.magic.hits[spell.hitStep++];
        if(age-at<=100)hits.push({at:spell.born+at,strength,life,kind:spell.kind,x:spell.tx,y:spell.ty});
      }
      if(p>=1){spell.node.style.opacity='0';return;}
      const unit=Math.min(width,height),fade=cinematic(clamp(age/160,0,1))*(1-cinematic(clamp((p-.76)/.24,0,1)));
      let cx=spell.tx,cy=spell.ty,sx=1,sy=1,angle=0,opacity=.78*fade;
      const move=u=>{const t=cinematic(clamp(u,0,1));cx=spell.x+(spell.tx-spell.x)*t;cy=spell.y+(spell.ty-spell.y)*t;};
      switch(spell.role){
        case 'bullet':{
          const u=clamp(age/410,0,1),pop=cinematic(clamp((age-410)/200,0,1));move(u);
          sx=sy=.26+.48*u+1.8*pop;angle=age*.28;
          opacity*=1-cinematic(clamp((age-570)/580,0,1));break;
        }
        case 'bullet-ring':{
          const u=clamp((age-410)/650,0,1);sx=sy=.6+2.5*cinematic(u);angle=-age*.12;
          opacity=age<410?0:.64*Math.sin(Math.PI*u)*(1-u);break;
        }
        case 'vacuum':{
          const u=clamp((age-i*85)/420,0,1);move(u);
          cx+=(i?1:-1)*unit*.07;sx=.30+2.9*u;sy=.05+.17*u;angle=(i?18:-18)+u*22;
          opacity=(age<i*85||age>i*85+700)?0:.28*Math.sin(Math.PI*clamp((age-i*85)/700,0,1));break;
        }
        case 'bind-column':
          sx=.78+.08*Math.sin(age*.018);sy=.88+.16*Math.sin(p*Math.PI);angle=Math.sin(age*.014)*6;break;
        case 'bind-blade':{
          const a=age*.012+i*TAU/4,r=unit*(.21-.045*Math.sin(p*Math.PI));
          cx+=Math.cos(a)*r;cy+=Math.sin(a)*r*.62;sx=.40;sy=.40;angle=a*180/Math.PI+90;
          spell.node.style.zIndex=Math.sin(a)>0?'2':'0';break;
        }
        case 'burst-ring':{
          const u=clamp((age-i*110)/850,0,1);cx=spell.x;cy=spell.y;
          sx=sy=.12+3.5*cinematic(u);angle=age*.09+i*35;
          opacity=age<i*110?0:.82*Math.sin(Math.PI*u)*(1-u*.35);break;
        }
        case 'tornado-column':
          cx+=Math.sin((p-.5)*Math.PI)*width*.23;cy-=Math.sin(p*Math.PI)*height*.10;
          sx=1.0+.45*Math.sin(p*Math.PI);sy=1.18+.25*Math.sin(p*Math.PI);angle=Math.sin(age*.018)*7;break;
        case 'lift-ring':{
          const u=((age/1050+i/3)%1+1)%1;
          cx+=Math.sin((p-.5)*Math.PI)*width*.23;cy+=unit*(.20-u*.60);
          sx=.48+u*.60;sy=sx*.28;angle=age*.20+i*60;opacity*=Math.sin(Math.PI*u);break;
        }
        case 'spear':{
          const u=clamp(age/510,0,1);move(u);sx=.32+1.50*u;sy=.40+.90*u;
          angle=Math.atan2(spell.ty-spell.y,spell.tx-spell.x)*180/Math.PI;
          spell.image.style.transform=`scaleY(${(.90+.10*Math.sin(age*.045)).toFixed(4)})`;
          opacity*=1-cinematic(clamp((age-560)/520,0,1));break;
        }
        case 'spear-ring':{
          const u=clamp((age-i*90)/510,0,1);move(u);sx=.20+.65*u;sy=sx*.26;angle=age*.75+i*90;
          opacity*=age<i*90?0:1-cinematic(clamp((age-510)/420,0,1));break;
        }
        case 'rain-blade':{
          const local=age-i*32,u=((local%520)+520)%520/520,col=i%4,row=Math.floor(i/4);
          cx=left+width*(.06+col*.25)+unit*(u-.5)*.24;
          cy=top+height*(-.12+row*.27+u*.80);sx=sy=.48+.60*u;angle=72+i%3*14;
          opacity=local<0?0:.82*Math.sin(Math.PI*u)*(1-cinematic(clamp((p-.79)/.21,0,1)));break;
        }
        case 'implosion-core':{
          if(age<1060){const u=age/1060;sx=sy=.38*(1-u)+.07;opacity*=.60;}
          else{const u=clamp((age-1060)/650,0,1);sx=sy=.10+2.7*cinematic(u);opacity=.86*(1-u);}
          angle=-age*.28;break;
        }
        case 'inward-ring':{
          const u=clamp(age/1060,0,1),a=i*TAU/4+age*.006,r=unit*.34*(1-cinematic(u));
          cx+=Math.cos(a)*r;cy+=Math.sin(a)*r;sx=sy=.85*(1-u)+.05;angle=-age*.32+i*45;
          opacity*=1-cinematic(clamp((age-1000)/180,0,1));break;
        }
        case 'hurricane-eye':
          sx=sy=1.1+2.0*Math.sin(p*Math.PI);angle=-age*.17;opacity*=.72;break;
        case 'hurricane-column':{
          const a=age*.0028+i*Math.PI;cx+=Math.cos(a)*unit*.27;cy+=Math.sin(a)*unit*.13;
          sx=1.05;sy=1.45;angle=Math.sin(age*.014+i)*9;opacity*=.78;break;
        }
        case 'hurricane-ring':
          sx=sy=1.5+i*.6+Math.sin(p*Math.PI)*.5;angle=age*(i?-.23:.19)+i*60;opacity*=.48;break;
        case 'hurricane-blade':{
          const a=age*.008+i*TAU/5,r=unit*(.28+.10*Math.sin(p*Math.PI));
          cx+=Math.cos(a)*r;cy+=Math.sin(a)*r*.82;sx=sy=.34;angle=a*180/Math.PI+90;break;
        }
      }
      spell.node.style.opacity=String(clamp(opacity,0,.86));
      spell.node.style.transform=`translate3d(${(cx-spell.w/2).toFixed(2)}px,${(cy-spell.h/2).toFixed(2)}px,0) rotate(${angle.toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    };
    const wind=(elapsed,x,y,scale,heading)=>{
      for(const spell of spells){
        if(spell.role){renderMagic(spell,elapsed,x,y);continue;}
        const due=duration*spell.at;
        if(!spell.fired&&elapsed>=due){
          if(!spell.ready&&elapsed<due+250)continue;
          spell.fired=true;
          if(!spell.ready||elapsed>=due+spell.life)continue;
          spell.born=due;
          spell.hit=false;
          spell.hitDelay=spell.kind?980:420+(spell.fan+.24)/.24*75;
          const cast=casts[spell.castIndex];
          const aim=cast.armed?cast.side*Math.PI/2:heading;
          const angle=Math.PI/2-aim+spell.fan;
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
          // Project toward the viewer: converge near the screen centre and grow.
          spell.endX=left+width*(.50+spell.fan*.30);
          spell.endY=top+height*(spell.kind?.47:.46)+spell.fan*Math.min(80,height*.12);
          spell.hitScale=spell.kind?clamp(Math.min(width,height)/spell.h*1.20,1.35,3.4):clamp(Math.min(width,height)/(spell.w*1.1),1.55,3.2);
          spell.node.dataset.target='screen';
        }
        if(spell.born===null)continue;
        const age=elapsed-spell.born,p=clamp(age/spell.life,0,1);
        if(!spell.hit&&age>=spell.hitDelay){
          spell.hit=true;
          // A resumed/stalled frame must not replay an impact the viewer missed.
          if(age-spell.hitDelay<=100)hits.push({at:spell.born+spell.hitDelay,life:spell.kind?780:540,kind:spell.kind,x:spell.endX,y:spell.endY});
        }
        if(p>=1){spell.node.style.opacity='0';continue;}
        const appear=cinematic(clamp(p/(spell.kind?.20:.14),0,1));
        const approach=clamp(age/spell.hitDelay,0,1);
        const after=clamp((age-spell.hitDelay)/(spell.life-spell.hitDelay),0,1);
        const disappear=1-cinematic(after);
        const opacity=.86*appear*disappear;
        const travel=cinematic(approach);
        const cx=spell.x+(spell.endX-spell.x)*travel,cy=spell.y+(spell.endY-spell.y)*travel;
        const rotation=spell.kind?Math.sin(p*TAU*2)*9:spell.angle+approach*70+spell.fan*18;
        const zoom=(.42+(spell.hitScale-.42)*approach**2.3)*(1+after*.15);
        spell.node.style.zIndex=approach>.4?'2':'0';
        spell.node.style.opacity=String(opacity);
        spell.node.style.transform=`translate3d(${(cx-spell.w/2).toFixed(2)}px,${(cy-spell.h/2).toFixed(2)}px,0) rotate(${rotation.toFixed(2)}deg) scale(${zoom.toFixed(4)})`;
        if(spell.kind)spell.image.style.transform=`scaleX(${(.94+.045*Math.sin(p*TAU*6)).toFixed(4)})`;
      }
      if(expanded){
        const named=casts.find(cast=>elapsed>=duration*cast.at-cast.lead&&elapsed<duration*cast.at+cast.magic.life&&(cast.armed||spells.some(spell=>spell.castIndex===cast.index&&spell.born!==null)));
        if(named){
          const text=window.SalaryMateI18n?.language?.()==='en'?named.magic.en:named.magic.zh;
          if(spellName.textContent!==text)spellName.textContent=text;
          spellName.dataset.spell=named.magic.id;
          const age=elapsed-duration*named.at;
          spellName.style.opacity=String(cinematic(clamp((age+named.lead)/180,0,1))*(1-cinematic(clamp((age-named.magic.life+250)/250,0,1))));
        }else spellName.style.opacity='0';
      }
    };
    const tick = now => {
      if(active!==flight)return;
      const elapsed=now-started,t=clamp(elapsed/duration,0,1),dt=clamp(now-previous,0,80);
      previous=now;
      if(t>=1){finish();return;}
      prepareMagic(elapsed);
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
      const casting=attack(elapsed,heading);
      renderPose(casting?casting.pose:targetPose,now);
      actor.dataset.cast=casting?casting.id:'none';
      actor.dataset.castStage=casting?String(casting.stage):'';
      const turn=Math.atan2(point.dx*ahead.dy-point.dy*ahead.dx,point.dx*ahead.dx+point.dy*ahead.dy);
      const settling=1-smooth(clamp((t-.86)/.14,0,1));
      const targetBank=clamp(turn*180/Math.PI*2+(point.dx/(speed||1))*4,-17,17)*settling;
      bank+=(targetBank-bank)*(1-Math.exp(-dt/145));
      const depthMotion=Math.sin(TAU*progress);
      pitch+=((-point.dy/(speed||1)*3+depthMotion*3)*settling-pitch)*(1-Math.exp(-dt/180));
      const recoil=casting?-casting.side*casting.kick*size*.014:0;
      const castLift=casting?-casting.strength*size*.006:0;
      const castTilt=casting?casting.side*(-5*casting.strength+8*casting.kick):0;
      facing.style.transform=`perspective(520px) rotateX(${pitch.toFixed(2)}deg) translate3d(${recoil.toFixed(2)}px,${castLift.toFixed(2)}px,0) rotate(${castTilt.toFixed(2)}deg)`;
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
      screenHit(elapsed);
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

}
