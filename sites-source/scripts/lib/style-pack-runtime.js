// Website-only style packages. The portable edition already contains all code and CSS.
(() => {
 const version='__SALARYMATE_VERSION__';
 const base=new URL('./',document.baseURI);
 const core=document.querySelector('link[data-style-core]');
 let css=null,cssReady=false,cssPending=null,flightPending=null;
 const ornate=style=>['pixel-luxe','macaron-luxe','autumn','doodle','cream','dusk','pencil','studio'].includes(style);
 const ready=style=>!ornate(style)||(cssReady&&(style!=='pixel-luxe'||!!window.SalaryMateCompanion));
 function retain(style){
  try{navigator.serviceWorker?.ready.then(reg=>reg.active?.postMessage({type:'salarymate:cache-style-pack',style})).catch(()=>{});}catch{}
 }
 function loadCss(){
  if(cssReady)return Promise.resolve();if(cssPending)return cssPending;
  cssPending=new Promise((resolve,reject)=>{
   const node=document.createElement('link');let done=false;
   const finish=error=>{if(done)return;done=true;clearTimeout(timer);node.onload=node.onerror=null;if(error){node.remove();reject(error);}else{css=node;cssReady=true;resolve();}};
   const timer=setTimeout(()=>finish(new Error('Style package timed out')),20000);
   node.rel='stylesheet';node.media='not all';node.href=new URL('styles.css?v='+version,base).href;
   node.onload=()=>finish();node.onerror=()=>finish(new Error('Style package unavailable'));
   try{document.head.append(node);}catch(error){finish(error);}
  }).finally(()=>{cssPending=null;});return cssPending;
 }
 function loadFlight(){
  if(window.SalaryMateCompanion)return Promise.resolve();if(flightPending)return flightPending;
  flightPending=new Promise((resolve,reject)=>{
   const node=document.createElement('script');let done=false;
   const finish=error=>{if(done)return;done=true;clearTimeout(timer);node.onload=node.onerror=null;node.remove();if(error)reject(error);else resolve();};
   const timer=setTimeout(()=>finish(new Error('Flight package timed out')),20000);
   node.src=new URL('ornate-flight.js?v='+version,base).href;node.async=true;
   node.onload=()=>finish(window.SalaryMateCompanion?null:new Error('Invalid flight package'));
   node.onerror=()=>finish(new Error('Flight package unavailable'));
   try{document.head.append(node);}catch(error){finish(error);}
  }).finally(()=>{flightPending=null;});return flightPending;
 }
 async function ensure(style){
  if(!ornate(style))return;
  await loadCss();
  if(style==='pixel-luxe')await loadFlight();
  retain(style);
 }
 function activate(style){
  const use=ornate(style)&&ready(style);
  if(css)css.media=use?'all':'not all';
  if(core)core.disabled=use;
  if(use)window.SalaryMateStartup?.styled();
  if(!use)window.SalaryMateCompanion?.stop();
  return use||!ornate(style);
 }
 window.SalaryMateStylePacks=Object.freeze({ensure,ready,activate});
})();
