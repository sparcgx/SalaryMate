import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'dist/dev/v5.0.0-dev.2');
const target=path.join(root,'native-android/www');
const stage=target+'.building';
const version=fs.readFileSync(path.join(source,'app.js'),'utf8').match(/const APP_VERSION = '([^']+)'/)?.[1];
if(version!=='5.0.0-dev.2-R99')throw new Error('Inspect the Android version before packaging another web release.');
const runtimes=['android-runtime.js','android-legacy-backup.js'];
for(const name of runtimes)if(!fs.existsSync(path.join(root,'scripts/lib',name)))throw new Error('Android integration is missing: '+name);
fs.rmSync(stage,{recursive:true,force:true});
fs.cpSync(source,stage,{recursive:true});
for(const name of runtimes)fs.copyFileSync(path.join(root,'scripts/lib',name),path.join(stage,name));
let html=fs.readFileSync(path.join(stage,'index.html'),'utf8');
const startup=`<script defer src="./startup.js?v=${version}"></script>`;
if(!html.includes(startup))throw new Error('Unexpected startup entry.');
// Old native encrypted backups use .salarymate/octet-stream. Keep the
// website picker unchanged and admit those files only in the Android package.
const backupInput='<input id="jsonImport" type="file" accept="application/json,.json"';
if(!html.includes(backupInput))throw new Error('Unexpected backup import picker.');
html=html.replace(backupInput,'<input id="jsonImport" type="file" accept="application/json,application/octet-stream,.json,.salarymate"');
// Capacitor injects its trusted bridge after <head>. These deferred scripts
// keep the small first screen and initialize Android integration first.
html=html.replace(startup,`<script defer src="./android-runtime.js?v=${version}"></script>\n  <script defer src="./android-legacy-backup.js?v=${version}"></script>\n  <script defer src="./legal-data.js?v=${version}"></script>\n  ${startup}`);
const csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'";
html=html.replace('<meta charset="utf-8">',`<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
fs.writeFileSync(path.join(stage,'index.html'),html);
const files=[];
function collect(directory,prefix=''){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const relative=prefix+entry.name,full=path.join(directory,entry.name);
    if(entry.isDirectory())collect(full,relative+'/');
    else if(entry.isFile()){
      const bytes=fs.readFileSync(full);files.push({path:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }else throw new Error('Unexpected non-regular Android asset: '+relative);
  }
}
collect(stage);
fs.writeFileSync(path.join(stage,'android-asset-manifest.json'),JSON.stringify({version,source:'dist/dev/v5.0.0-dev.2',files},null,2)+'\n');
fs.rmSync(target,{recursive:true,force:true});
fs.renameSync(stage,target);
console.log(JSON.stringify({version,files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0),directory:target}));
