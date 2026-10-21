import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..'),base=path.join(root,'dist/dev/v5.0.0-dev.2'),native=path.join(root,'native-desktop');
const target=path.join(native,'www'),stage=target+'.building';
const pkg=JSON.parse(await fs.readFile(path.join(native,'package.json'),'utf8'));
const app=await fs.readFile(path.join(base,'app.js'),'utf8');
if(app.match(/const APP_VERSION = '([^']+)'/)?.[1]!==pkg.version)throw Error('Desktop/web versions differ');
await fs.rm(stage,{recursive:true,force:true});await fs.cp(base,stage,{recursive:true});
function once(source,old,value){if(!source.includes(old)||source.indexOf(old)!==source.lastIndexOf(old))throw Error('Unexpected desktop adapter boundary: '+old.slice(0,70));return source.replace(old,value);}
// Retain the tested backup adapter; change only its native bridge and platform copy.
let runtime=(await fs.readFile(path.join(root,'scripts/lib/android-runtime.js'),'utf8')).replace(/\r\n?/g,'\n');
runtime=once(runtime," const cap=root.Capacitor;\n if(!cap?.isNativePlatform?.()||cap.getPlatform?.()!=='android'||(root.top&&root.top!==root))return;", " const desktop=root.SalaryMateDesktop;\n if(!desktop||!['win32','darwin'].includes(desktop.platform)||(root.top&&root.top!==root))return;");
runtime=once(runtime," root.SalaryMatePortable=Object.freeze({marketOrigin:'https://salarymate.sparcgx2420.chatgpt.site'});",'');
runtime=once(runtime,'const files=cap.Plugins?.BackupFile;','const files=desktop;');
runtime=runtime.replaceAll('Android','Desktop').replaceAll('android','desktop');
runtime=once(runtime,'此 Desktop 版使用系統檔案選擇器。設備已安裝並登入 Google Drive 時，可在位置清單選擇自己的 Drive；若清單沒有 Drive，請先安裝或改選本機位置。','此桌面版使用系統檔案選擇器。請安裝並登入自己的 Google Drive 電腦版，將備份儲存到自己的 Drive 同步資料夾，或從該資料夾選擇備份。未設定 Drive 時可先存本機。');
runtime=once(runtime,'This Desktop app uses the system document picker. If Google Drive is installed and signed in, choose your own Drive in the location list. If Drive is unavailable, install it or choose local storage.','Use your own Google Drive for desktop sync folder in the system file picker, or choose local storage. Drive for desktop must be installed and signed in.');
runtime=once(runtime,'手動備份至 Drive 或本機；Drive 需安裝並登入，不會自動同步。','手動備份至自己的 Drive 同步資料夾或本機。');
runtime=once(runtime,'Manually back up to Drive or local storage. Drive must be installed and signed in; no automatic sync.','Manually save backups to your own Drive sync folder or local storage.');
runtime=once(runtime,'此入口不使用內嵌 Google 登入，也沒有網站版的 API 清單或自動同步。','此入口使用 Drive 電腦版同步所選資料夾；同步完成狀態請在 Drive 電腦版確認。App 不會自動合併資料，也不使用網站版的 API 檔案清單。');
runtime=once(runtime,'This entry does not use embedded Google sign-in and does not provide the website API file list or automatic synchronization.','Drive for desktop handles cloud synchronization; check its sync status separately. The app does not merge data or use the website API file list.');
runtime=runtime.replaceAll('Desktop 檔案服務','桌面檔案服務');
// Match File.text(): verify original UTF-8 bytes, then consume an optional BOM.
runtime=once(runtime,'return root.SalaryMateData.importPayload(result.data);',String.raw`return root.SalaryMateData.importPayload(result.data.replace(/^\uFEFF/,''));`);
// Electron accepts typed arrays through its isolated bridge and IPC. Keep the
// Android adapter unchanged; avoid base64 expansion for desktop Blob exports.
const base64Helper=runtime.match(/ const base64=bytes=>\{[\s\S]*?\n \};/)?.[0];
if(!base64Helper)throw Error('Missing base64 adapter boundary');
runtime=once(runtime,base64Helper,'');
runtime=once(runtime,"data:base64(bytes),fileName,mimeType,encoding:'base64'","data:bytes,fileName,mimeType,encoding:'bytes'");
// The adapter's public utility name must not replace the isolated native bridge.
runtime=once(runtime,'root.SalaryMateDesktop=Object.freeze({saveBlob,createDriveUI,maxDocumentBytes:MAX_BYTES});','root.SalaryMateDesktopFiles=Object.freeze({saveBlob,createDriveUI,maxDocumentBytes:MAX_BYTES});');
runtime=once(runtime,'changed(){}','changed(){root.SalaryMateDesktopFeatures?.changed();}');
new vm.Script(runtime);await fs.writeFile(path.join(stage,'desktop-runtime.js'),runtime);
const updates=await fs.readFile(path.join(native,'renderer/updates.js'),'utf8');
new vm.Script(updates);await fs.writeFile(path.join(stage,'desktop-updates.js'),updates);
const features=await fs.readFile(path.join(native,'renderer/features.js'),'utf8');
new vm.Script(features);await fs.writeFile(path.join(stage,'desktop-features.js'),features);
// Preserve validated migration for older Android encrypted backups too.
await fs.copyFile(path.join(root,'scripts/lib/android-legacy-backup.js'),path.join(stage,'desktop-legacy-backup.js'));
let html=await fs.readFile(path.join(stage,'index.html'),'utf8');
// The installer becomes public together with this release; retain current live
// web links until the release workflow has published both verified packages.
html=html.replace(/v5\.0\.0-desktop\.5/g,`v${pkg.version}-desktop.${pkg.desktopRelease}`).replace(/SalaryMate_v5\.0\.0_(win|mac)_/g,`SalaryMate_v${pkg.version}_$1_`);
const entry=html.match(/<script defer src="\.\/startup\.js\?v=[^"]+"><\/script>/)?.[0];if(!entry)throw Error('Missing startup entry');
html=once(html,entry,'<script defer src="./desktop-runtime.js"></script>\n  <script defer src="./desktop-legacy-backup.js"></script>\n  <script defer src="./desktop-updates.js"></script>\n  <script defer src="./desktop-features.js"></script>\n  '+entry);
html=html.replace(/\s*<link rel="manifest"[^>]*>/,'');
html=once(html,'accept="application/json,.json"','accept="application/json,application/octet-stream,.json,.salarymate"');
html=html.replace(`SalaryMate · v${pkg.version} 正式版</title>`,`SalaryMate · v${pkg.version} 正式版 · 桌面版</title>`);
const hashes=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>"'sha256-"+createHash('sha256').update(m[1].replace(/\r\n?/g,'\n')).digest('base64')+"'");
const csp=["default-src 'self'","script-src 'self' "+hashes.join(' '),"script-src-attr 'none'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self' data:","connect-src 'self'","frame-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'","worker-src 'none'"].join('; ');
html=once(html,'<meta charset="utf-8">','<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="'+csp+'">');
await fs.writeFile(path.join(stage,'index.html'),html);
// Copy changes only: web source and payroll modules remain byte-for-byte intact.
const zhOld='資料預設儲存在目前瀏覽器；啟用 Google Drive 備份後，備份會傳至你授權的 Google 帳戶。';
const zhNew='桌面版資料儲存在此電腦，與網站及 Android 分開。一般／加密備份可手動搬移；Drive 備份請選自己的 Drive 電腦版同步資料夾。';
let startup=await fs.readFile(path.join(stage,'startup.js'),'utf8');
startup=startup.replace(/v5\.0\.0-desktop\.5/g,`v${pkg.version}-desktop.${pkg.desktopRelease}`).replace(/SalaryMate_v5\.0\.0_(win|mac)_/g,`SalaryMate_v${pkg.version}_$1_`);
// i18n keys and the app each contain this label, so replace both consistently.
if(!startup.includes(zhOld))throw Error('Missing desktop data notice');
startup=startup.replaceAll(zhOld,zhNew);
const downloads='<details class="v5-settings-section v5-settings-disclosure"><summary class="v5-settings-summary"><span class="v5-group-title">下載應用程式</span>';
startup=once(startup,downloads,'${window.SalaryMateDesktopFeatures.sectionHTML()}'+downloads);
const reportStart=startup.indexOf('    const downloadAnnualPrint = () => {'),reportEnd=startup.indexOf('    const exportAnnualReport = () => {',reportStart);
if(reportStart<0||reportEnd<=reportStart)throw Error('Missing native PDF adapter boundary');
startup=startup.slice(0,reportStart)+'    const downloadAnnualPrint = () => {void window.SalaryMateDesktopFeatures.savePdf();};\n'+startup.slice(reportEnd);
startup=startup.replaceAll('下載列印版／PDF 用','儲存 PDF');
startup=once(startup,'Download printable / PDF version','Save PDF');
startup=once(startup,"      const generation = contextGeneration();\n      setOperationStatus('loading', 'restore-read'","      if(!await window.SalaryMateDesktopFeatures.beforeImport())return;\n      const generation = contextGeneration();\n      setOperationStatus('loading', 'restore-read'");
const hooks=await fs.readFile(path.join(native,'renderer/app-hooks.js'),'utf8');
startup=once(startup,'    window.SalaryMateStartup?.complete();',hooks+'\n    window.SalaryMateStartup?.complete();');
startup+='\nObject.assign(window.SalaryMateEnglish,'+JSON.stringify({[zhNew]:'Desktop data is stored on this computer, separately from the website and Android. Transfer records with a plain or encrypted backup. For Drive, choose your own Drive for desktop sync folder.'})+');\n';
new vm.Script(startup);await fs.writeFile(path.join(stage,'startup.js'),startup);
let reference=await fs.readFile(path.join(stage,'reference-tools.js'),'utf8');
reference=once(reference,'root.SalaryMatePortable?.marketOrigin||location.origin',"'salarymate://app'");await fs.writeFile(path.join(stage,'reference-tools.js'),reference);
const apiFiles=['stock-market.mjs','market-hours.mjs','dividend-market.mjs','intraday-nav.mjs','twse-close.mjs','reference-api.mjs'];
await fs.mkdir(path.join(native,'api'),{recursive:true});
for(const file of apiFiles)await fs.copyFile(path.join(root,'server',file),path.join(native,'api',file));
// Retired images only. Current and compatibility flight assets remain intact.
// Fail closed if any shipped text starts referring to a retired image again.
const retired=['art/jingyu-hd2d-r61.png','art/jingyu-hd2d-r62.webp','art/jingyu-flight-r68.png'];
const omitted=[];
async function auditRetired(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){
 const full=path.join(dir,item.name);
 if(item.isDirectory())await auditRetired(full);
 else if(/\.(?:js|html|css|json|webmanifest|csv)$/.test(item.name)){
  const text=await fs.readFile(full,'utf8');
  for(const file of retired)if(text.includes(path.basename(file)))throw Error('Retired asset is referenced: '+file);
 }
}}
await auditRetired(stage);
for(const file of retired){const bytes=await fs.readFile(path.join(stage,file));omitted.push({path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),reason:'retired and unreferenced'});await fs.unlink(path.join(stage,file));}
const files=[];
async function collect(dir,prefix=''){for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const key=prefix+entry.name,full=path.join(dir,entry.name);if(entry.isDirectory())await collect(full,key+'/');else if(entry.isFile()){const bytes=await fs.readFile(full);files.push({path:key,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}else throw Error('Non-regular asset');}}
await collect(stage);
const manifest={version:pkg.version,desktopBuild:pkg.build.buildVersion,desktopRelease:pkg.desktopRelease,source:'dist/dev/v5.0.0-dev.2',stateKey:'salarymate_v5_full_state',schema:15,csp,files,omitted,api:await Promise.all(apiFiles.map(async file=>({path:file,sha256:createHash('sha256').update(await fs.readFile(path.join(native,'api',file))).digest('hex')})))};
await fs.writeFile(path.join(stage,'desktop-asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.rm(target,{recursive:true,force:true});await fs.rename(stage,target);
console.log(JSON.stringify({version:pkg.version,files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),firstScreen:'local; optional content stays lazy'}));
