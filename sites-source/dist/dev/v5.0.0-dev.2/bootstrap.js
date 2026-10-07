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

// R67: a finite, on-demand flight. No timers, observers or storage work while idle.
(() => {
  let active = null;
  const stop = () => {
    if (!active) return;
    const flight = active;
    active = null;
    if (flight.animation) {
      flight.animation.onfinish = null;
      flight.animation.oncancel = null;
      flight.animation.cancel();
    }
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
    const flight = { button, cleanups: [], layer: null, animation: null, timer: null };
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
      button.classList.add('jingyu-greeting');
      const message = document.createElement('span');
      message.className = 'sr-only';
      message.setAttribute('role', 'status');
      button.append(message);
      message.textContent = window.SalaryMateI18n?.text('晶羽向你打招呼') || '晶羽向你打招呼';
      flight.layer = message;
      flight.timer = window.setTimeout(finish, 1800);
    };
    if (reduced?.matches || typeof art.animate !== 'function' || !art.complete || !art.naturalWidth) { greet(); return; }

    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const size = Math.min(80, width * .19, height * .19);
    if (size < 24) { greet(); return; }
    // Reserve room for rotation, the phone safe area, and the bottom menu.
    const radius = size * .66;
    const minX = left + 12 + radius, maxX = Math.max(minX, left + width - 12 - radius);
    const minY = top + Math.min(40, height * .08) + radius;
    const maxY = Math.max(minY, top + height - Math.min(100, height * .18) - radius);
    const homePoint = { x: home.left + home.width / 2, y: home.top + home.height / 2, scale: home.width / size, angle: 0 };
    const transform = point => `translate3d(${(point.x - size / 2).toFixed(2)}px,${(point.y - size / 2).toFixed(2)}px,0) rotate(${point.angle}deg) scale(${point.scale})`;
    const points = [homePoint], clockwise = Math.random() > .5;
    const quadrants = clockwise ? [[1,0],[1,1],[0,1],[0,0]] : [[0,1],[1,1],[1,0],[0,0]];
    for (const [right, bottom] of quadrants) {
      const x = minX + (maxX - minX) * (right * .5 + .08 + Math.random() * .34);
      const y = minY + (maxY - minY) * (bottom * .5 + .08 + Math.random() * .34);
      points.push({ x, y, scale: 1, angle: x > points.at(-1).x ? 8 : -8 });
    }
    points.push(homePoint);
    const layer = document.createElement('div');
    layer.className = 'jingyu-flight-layer';
    layer.setAttribute('aria-hidden', 'true');
    const actor = document.createElement('div');
    actor.className = 'jingyu-flight-actor';
    actor.style.width = actor.style.height = `${size}px`;
    actor.style.transform = transform(homePoint);
    const image = document.createElement('img');
    image.className = 'jingyu-flight-art';
    image.src = art.currentSrc || art.src;
    image.alt = '';
    image.draggable = false;
    actor.append(image);
    for (let index = 0; index < 3; index++) {
      const spark = document.createElement('i');
      spark.className = 'jingyu-flight-spark';
      actor.append(spark);
    }
    layer.append(actor);
    document.body.append(layer);
    flight.layer = layer;
    button.classList.add('jingyu-away');
    button.setAttribute('aria-pressed', 'true');
    try {
      flight.animation = actor.animate(points.map((point, index) => ({
        transform: transform(point), offset: index / (points.length - 1), easing: 'cubic-bezier(.4,0,.6,1)'
      })), { duration: 6000, fill: 'forwards', iterations: 1 });
      flight.animation.onfinish = finish;
      flight.animation.oncancel = finish;
      flight.timer = window.setTimeout(finish, 6300);
    } catch { finish(); }
  };
  window.SalaryMateCompanion = Object.freeze({ fly, stop });
})();
