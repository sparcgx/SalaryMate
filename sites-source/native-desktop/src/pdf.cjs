'use strict';
const {randomUUID}=require('node:crypto');
const path=require('node:path');
const {writeVerified}=require('./files.cjs');
const fault=code=>Object.assign(Error(code),{code});
const PDF_CSP="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
function checkedReport(input) {
  if(!input||typeof input.html!=='string'||!input.html.length||Buffer.byteLength(input.html)>1024*1024||!/^SalaryMate_\d{4}_01-\d{2}_report\.pdf$/.test(input.fileName)||typeof input.landscape!=='boolean')throw fault('INVALID_REPORT');
  if(/<(?:script|iframe|object|embed|link|meta|base|img|svg|math|style|form|input|audio|video)\b|\s(?:src|href|on\w+)\s*=/i.test(input.html))throw fault('INVALID_REPORT');
  return input;
}
function reportDocument(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PDF_CSP}"><style>body{font-family:"Microsoft JhengHei","PingFang TC",system-ui,sans-serif;color:#172d29;font-size:11px;line-height:1.6}h2{font-size:20px}table{width:100%;border-collapse:collapse;margin:14px 0;font-size:9px}th,td{padding:5px;text-align:right;border-bottom:1px solid #cbd8d4}th:first-child,td:first-child{text-align:left}caption{text-align:left;font-weight:bold}tr{break-inside:avoid}thead{display:table-header-group}.annual-structure{display:flex;gap:20px}.annual-structure>*{flex:1}.summary-row{display:flex;justify-content:space-between;gap:8px}p{orphans:3;widows:3}.hint{color:#49605b}</style></head><body>${body}</body></html>`;
}
async function renderPdf(input,{BrowserWindow,session,timeoutMs=30000}) {
  checkedReport(input);
  const partition=session.fromPartition('salarymate-pdf-'+randomUUID());
  partition.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  partition.setPermissionCheckHandler(()=>false);
  // This isolated, short-lived print job has no app bridge, storage or network.
  const url='data:text/html;charset=utf-8,'+encodeURIComponent(reportDocument(input.html));
  partition.webRequest.onBeforeRequest((request,cb)=>cb({cancel:request.url!==url}));
  const window=new BrowserWindow({show:false,webPreferences:{session:partition,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,javascript:false,webviewTag:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event)=>event.preventDefault());
  window.webContents.on('will-redirect',(event)=>event.preventDefault());
  let timer;
  try {
    return await Promise.race([(async()=>{
      await window.loadURL(url);
      const bytes=await window.webContents.printToPDF({pageSize:'A4',landscape:input.landscape,printBackground:false,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#555">SalaryMate · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',margins:{top:0.47,bottom:0.55,left:0.47,right:0.47}});
      if(!Buffer.isBuffer(bytes)||bytes.length<8||bytes.length>45*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-')throw fault('PDF_FAILED');
      return bytes;
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(fault('PDF_TIMEOUT')),timeoutMs);})]);
  } finally {clearTimeout(timer);if(!window.isDestroyed())window.destroy();partition.webRequest.onBeforeRequest(null);}
}
function createPdfService({dialog,parent,render,io}) {
  let busy=false;
  return {isBusy:()=>busy,async save(input){
    if(busy)throw fault('DESKTOP_BUSY');busy=true;
    try{
      checkedReport(input);
      const choice=await dialog.showSaveDialog(parent(),{title:'儲存年度報表 PDF / Save annual report PDF',defaultPath:input.fileName,filters:[{name:'PDF',extensions:['pdf']}]});
      if(choice.canceled||!choice.filePath)throw fault('SAVE_CANCELLED');
      if(path.extname(choice.filePath).toLowerCase()!=='.pdf')throw fault('SAVE_EXTENSION_CHANGED');
      const bytes=await render(input);
      return await writeVerified(choice.filePath,bytes,io);
    }finally{busy=false;}
  }};
}
module.exports={checkedReport,reportDocument,renderPdf,createPdfService,PDF_CSP};
