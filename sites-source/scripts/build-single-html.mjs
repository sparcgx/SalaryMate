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
const notes="單一 HTML 版：資料預設儲存在目前瀏覽器，不會隨程式更新自動從其他入口同步。更換瀏覽器，或移動／更名檔案前，請先匯出備份，再於新入口匯入並核對。Google Drive 備份會傳至你授權的帳戶；股價、名稱、淨值與配息查詢需要連線。";
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
    const companionPath='./art/jingyu-hd2d-r74.png';
    const marker="const HD2D_COMPANION_SRC = '"+companionPath+"';";
    if(!source.includes(marker))throw new Error('Missing HD-2D companion asset declaration');
    const bytes=await readFile(path.join(base,companionPath));
    source=source.replace(marker,()=>"const HD2D_COMPANION_SRC = 'data:image/png;base64,"+bytes.toString('base64')+"';");
    const flightPaths=['a','b','c','d'].map(id=>'./art/jingyu-flight-r73-'+id+'.png');
    const flightMarker='const HD2D_FLIGHT_SOURCES = Object.freeze('+JSON.stringify(flightPaths)+');';
    if(!source.includes(flightMarker))throw new Error('Missing HD-2D flight plates declaration');
    const flightSources=await Promise.all(flightPaths.map(async name=>'data:image/png;base64,'+(await readFile(path.join(base,name))).toString('base64')));
    source=source.replace(flightMarker,()=>'const HD2D_FLIGHT_SOURCES = Object.freeze('+JSON.stringify(flightSources)+');');
    const castPath='./art/jingyu-cast-r76.png';
    const castMarker="const HD2D_CAST_SRC = '"+castPath+"';";
    if(!source.includes(castMarker))throw new Error('Missing HD-2D attack asset declaration');
    const castBytes=await readFile(path.join(base,castPath));
    source=source.replace(castMarker,()=>"const HD2D_CAST_SRC = 'data:image/png;base64,"+castBytes.toString('base64')+"';");
    const extraPaths=['bullet','spear','vortex'].map(kind=>'./art/jingyu-wind-'+kind+'-r78.png');
    const extraMarker='const HD2D_WIND_EXTRAS = Object.freeze('+JSON.stringify(extraPaths)+');';
    if(!source.includes(extraMarker))throw new Error('Missing expanded wind magic declarations');
    const extraSources=await Promise.all(extraPaths.map(async name=>'data:image/png;base64,'+(await readFile(path.join(base,name))).toString('base64')));
    source=source.replace(extraMarker,()=>'const HD2D_WIND_EXTRAS = Object.freeze('+JSON.stringify(extraSources)+');');
    const windPaths=['blade','tornado'].map(kind=>'./art/jingyu-wind-'+kind+'-r75.png');
    const windMarker='const HD2D_WIND_SOURCES = Object.freeze('+JSON.stringify(windPaths)+');';
    if(!source.includes(windMarker))throw new Error('Missing HD-2D wind spell declarations');
    const windSources=await Promise.all(windPaths.map(async name=>'data:image/png;base64,'+(await readFile(path.join(base,name))).toString('base64')));
    source=source.replace(windMarker,()=>'const HD2D_WIND_SOURCES = Object.freeze('+JSON.stringify(windSources)+');');
  }
  if(name==='i18n-en.js')source+='\nObject.assign(window.SalaryMateEnglish,'+JSON.stringify({
    '單一 HTML 版':'Single HTML edition',
    [notes]:"Single HTML edition: data is stored in this browser by default and does not synchronize from other locations when the software is updated. Before changing browsers or moving or renaming the file, export a backup, import it at the new location and check the records. Google Drive backups go to your authorized account; price, name, NAV and dividend lookups require an internet connection."
  })+');';
  if(name==='app.js'){
    const dataNotes=/(<span class="v5-group-title">資料管理<\/span><\/summary><div class="v5-settings-content">)<p class="hint">資料預設儲存在目前瀏覽器[^<]*<\/p><p class="hint">各入口同步的是程式版本[^<]*<\/p>/;
    if(!dataNotes.test(source))throw new Error('Missing data-transfer notice; inspect before bundling.');
    source=source.replace(dataNotes,(_match,heading)=>`${heading}<p class="hint">${notes}</p>`);
  }
  scriptsInline.push(`<script data-module="${name}">\n${source.replace(/<\/script/gi,'<\\/script')}\n</script>`);
  html=html.replace(match[0],'');
}
let css=await readFile(path.join(base,'styles.css'),'utf8');
// The hosted CSS references only used scenes. The portable edition deliberately
// embeds the same bytes so every background remains available without a network.
const scenes=[...css.matchAll(/url\("(\.\/art\/background-(?:canyon|forest|harbor|aurora|sky|macaron)-r79\.webp)"\)/g)];
if(scenes.length!==6||new Set(scenes.map(match=>match[1])).size!==6)throw new Error('Unexpected background asset manifest');
for(const match of scenes){
  const bytes=await readFile(path.join(base,match[1]));
  css=css.replace(match[0],()=>`url("data:image/webp;base64,${bytes.toString('base64')}")`);
}
if(/@import\s|url\((?!["']?data:)/i.test(css))throw new Error('External CSS asset must be embedded');
html=html.replace(/<link rel="stylesheet" href="\.\/styles\.css[^"]*">/,()=>`<style>\n${css.replace(/<\/style/gi,'<\\/style')}\n</style>`);
html=html.replace(/\s*<link rel="manifest"[^>]*>/,'');
for(const rel of ['icon','apple-touch-icon']){
  const pattern=new RegExp(`<link rel="${rel}" href="\\./([^"?]+)(?:\\?[^\"]*)?">`),match=html.match(pattern);
  if(match){const bytes=await readFile(path.join(base,match[1]));html=html.replace(match[0],`<link rel="${rel}" href="data:image/png;base64,${bytes.toString('base64')}">`);}
}
html=html.replace(/SalaryMate · (R\d+) 開發測試版/g,'SalaryMate · $1 開發測試版 · 單一 HTML');
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
