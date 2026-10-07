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
