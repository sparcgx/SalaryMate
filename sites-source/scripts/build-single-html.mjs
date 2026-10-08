import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {salaryMateCsp} from '../server/security-policy.mjs';
import './build-locales.mjs';

const output=process.argv[2],origin=process.argv[3];
if(!output||!path.isAbsolute(output)||!origin||new URL(origin).protocol!=='https:'||new URL(origin).origin!==origin)throw new Error('Usage: node build-single-html.mjs /absolute/output.html https://verified-site-origin');
const base=path.resolve(import.meta.dirname,'../dist/dev/v5.0.0-dev.2');
let html=await readFile(path.join(base,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script defer src="\.\/([^"?]+)(?:\?[^"]*)?"><\/script>/g)];
if(scripts.length!==15)throw new Error('Unexpected script manifest; inspect dependencies before bundling.');
const notes='單一 HTML 版：資料保存在目前瀏覽器。網站資料可由備份匯入；移動檔案或更換瀏覽器前請先備份。股價、名稱、盤中淨值與配息公告查詢需要連線。';
const scriptsInline=[`<script>
window.SalaryMatePortable=Object.freeze(${JSON.stringify({marketOrigin:origin})});
// Some local-file browser contexts reject URL rewrites. Keep history state usable.
if(location.protocol==='file:')for(const name of ['pushState','replaceState']){
  const original=history[name].bind(history);
  history[name]=function(state,title,url){try{return original(state,title,url);}catch(error){if(error.name!=='SecurityError')throw error;return original(state,title);}};
}
</script>`];
for(const match of scripts){
  const name=match[1];if(path.basename(name)!==name)throw new Error('Unexpected module path');
  let source=await readFile(path.join(base,name),'utf8');
  if(name==='app.js'){
    const companionPath='./art/jingyu-hd2d-r62.webp';
    const marker="const HD2D_COMPANION_SRC = '"+companionPath+"';";
    if(!source.includes(marker))throw new Error('Missing HD-2D companion asset declaration');
    const bytes=await readFile(path.join(base,companionPath));
    source=source.replace(marker,()=>"const HD2D_COMPANION_SRC = 'data:image/webp;base64,"+bytes.toString('base64')+"';");
    const flightPaths=['a','b','c','d'].map(id=>'./art/jingyu-flight-r73-'+id+'.png');
    const flightMarker='const HD2D_FLIGHT_SOURCES = Object.freeze('+JSON.stringify(flightPaths)+');';
    if(!source.includes(flightMarker))throw new Error('Missing HD-2D flight plates declaration');
    const flightSources=await Promise.all(flightPaths.map(async name=>'data:image/png;base64,'+(await readFile(path.join(base,name))).toString('base64')));
    source=source.replace(flightMarker,()=>'const HD2D_FLIGHT_SOURCES = Object.freeze('+JSON.stringify(flightSources)+');');
  }
  if(name==='i18n-en.js')source+='\nObject.assign(window.SalaryMateEnglish,'+JSON.stringify({
    '單一 HTML 版':'Single HTML edition',
    [notes]:'Single HTML edition: data stays in this browser. Import a backup to bring over website data. Back up before moving the file or changing browsers. Price, name, intraday NAV and dividend announcement lookup require an internet connection.'
  })+');';
  if(name==='app.js')source=source.replace('<span class="v5-group-title">資料管理</span></summary><div class="v5-settings-content">',`<span class="v5-group-title">資料管理</span></summary><div class="v5-settings-content"><p class="hint">${notes}</p>`);
  scriptsInline.push(`<script data-module="${name}">\n${source.replace(/<\/script/gi,'<\\/script')}\n</script>`);
  html=html.replace(match[0],'');
}
const css=await readFile(path.join(base,'styles.css'),'utf8');
if(/@import\s|url\((?!["']?data:)/i.test(css))throw new Error('External CSS asset must be embedded');
html=html.replace(/<link rel="stylesheet" href="\.\/styles\.css[^"]*">/,()=>`<style>\n${css.replace(/<\/style/gi,'<\\/style')}\n</style>`);
html=html.replace(/\s*<link rel="manifest"[^>]*>/,'');
for(const rel of ['icon','apple-touch-icon']){
  const pattern=new RegExp(`<link rel="${rel}" href="\\./([^"?]+)(?:\\?[^\"]*)?">`),match=html.match(pattern);
  if(match){const bytes=await readFile(path.join(base,match[1]));html=html.replace(match[0],`<link rel="${rel}" href="data:image/png;base64,${bytes.toString('base64')}">`);}
}
html=html.replace('SalaryMate · 全介面重製開發版','SalaryMate · 單一 HTML 版');
const scriptHashes=scriptsInline.map(block=>{
  const content=block.match(/^<script\b[^>]*>([\s\S]*)<\/script>$/)?.[1];
  if(content===undefined)throw new Error('Cannot hash portable script');
  return "'sha256-"+createHash('sha256').update(content).digest('base64')+"'";
});
const csp=salaryMateCsp({scriptHashes,marketOrigin:origin,portable:true});
html=html.replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
html=html.replace('</body>',()=>scriptsInline.join('\n')+'\n</body>');
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,html);
console.log(JSON.stringify({file:output,bytes:Buffer.byteLength(html),modules:scripts.length}));
