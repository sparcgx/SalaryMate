import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'dist/dev/v5.0.0-dev.2');
const target=path.join(root,'native-android/www');
const stage=target+'.building';
const version=fs.readFileSync(path.join(source,'app.js'),'utf8').match(/const APP_VERSION = '([^']+)'/)?.[1];
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--baseline-apk'))throw new Error('Use --baseline-apk /absolute/path/SalaryMate.apk.');
const baselineApk=args.length?path.resolve(args[1]):null;
// Native classes and web assets can advance separately. Never silently rebuild
// an R101 package from the stale R99 native release configuration.
const nativeVersion=JSON.parse(fs.readFileSync(path.join(root,'native-android/package.json'),'utf8')).version;
if(!baselineApk&&version!==nativeVersion)throw new Error('Web/native release versions differ; use the verified baseline APK or reconcile the native release before compiling.');
const runtimes=['android-runtime.js','android-legacy-backup.js'];
for(const name of runtimes)if(!fs.existsSync(path.join(root,'scripts/lib',name)))throw new Error('Android integration is missing: '+name);
fs.rmSync(stage,{recursive:true,force:true});
if(baselineApk){
 execFileSync('python3',[path.join(root,'scripts/extract-android-assets.py'),baselineApk,stage],{stdio:'pipe'});
 const manifest=JSON.parse(fs.readFileSync(path.join(stage,'android-asset-manifest.json'),'utf8'));
 if(manifest.version!==version)throw new Error('APK and source development versions differ.');
 const legacy=fs.readFileSync(path.join(stage,'android-legacy-backup.js'),'utf8').replace(/\r\n?/g,'\n');
 if(legacy!==fs.readFileSync(path.join(root,'scripts/lib/android-legacy-backup.js'),'utf8').replace(/\r\n?/g,'\n'))throw new Error('Legacy backup adapter differs; review before replacing it.');
 fs.copyFileSync(path.join(root,'scripts/lib/android-runtime.js'),path.join(stage,'android-runtime.js'));
 fs.rmSync(path.join(stage,'android-asset-manifest.json'));
}else{
 fs.cpSync(source,stage,{recursive:true});
 for(const name of runtimes)fs.copyFileSync(path.join(root,'scripts/lib',name),path.join(stage,name));
}
let html=fs.readFileSync(path.join(stage,'index.html'),'utf8');
const startup=`<script defer src="./startup.js?v=${version}"></script>`;
if(!html.includes(startup))throw new Error('Unexpected startup entry.');
if(!baselineApk){
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
}
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
fs.writeFileSync(path.join(stage,'android-asset-manifest.json'),JSON.stringify({version,source:baselineApk?'verified APK: '+path.basename(baselineApk):'dist/dev/v5.0.0-dev.2',files},null,2)+'\n');
fs.rmSync(target,{recursive:true,force:true});
fs.renameSync(stage,target);
console.log(JSON.stringify({version,files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0),directory:target}));
