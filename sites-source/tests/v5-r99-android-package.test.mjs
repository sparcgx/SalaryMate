import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url),read=name=>fs.readFileSync(new URL(name,root),'utf8');
test('Android development identity is isolated and keeps frozen source out of its launcher',()=>{
 const config=JSON.parse(read('native-android/capacitor.config.json'));
 assert.equal(config.appId,'com.salarymate.personal.dev');
 assert.deepEqual(config.server,{hostname:'salarymate.sparcgx2420.chatgpt.site',androidScheme:'https'});
 const gradle=read('native-android/android/app/build.gradle');
 assert.match(gradle,/applicationId "com.salarymate.personal.dev"/);
 assert.match(gradle,/versionCode 5000099/);assert.match(gradle,/versionName "5.0.0-dev.2-R99"/);
 const manifest=read('native-android/android/app/src/main/AndroidManifest.xml');
 assert.match(manifest,/android:allowBackup="false"/);assert.match(manifest,/android:usesCleartextTraffic="false"/);
 assert.equal((manifest.match(/android.intent.category.LAUNCHER/g)||[]).length,1);
 assert.ok(manifest.indexOf('android:name=".ComposeShellActivity"')<manifest.indexOf('android:exported="false"'));
});
test('Android assets are complete R99 files and preserve the non-blocking first screen and integration order',()=>{
 const meta=JSON.parse(read('native-android/www/android-asset-manifest.json'));assert.equal(meta.version,'5.0.0-dev.2-R99');
 for(const file of meta.files){
  const bytes=fs.readFileSync(new URL('native-android/www/'+file.path,root));
  assert.equal(bytes.length,file.bytes,file.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
  if(['android-runtime.js','android-legacy-backup.js'].includes(file.path))assert.deepEqual(bytes,fs.readFileSync(new URL('scripts/lib/'+file.path,root)),file.path);
  else if(file.path!=='index.html')assert.deepEqual(bytes,fs.readFileSync(new URL('dist/dev/v5.0.0-dev.2/'+file.path,root)),file.path);
 }
 for(const file of ['styles-core.css','styles.css','ornate-flight.js','startup.js','legal-data.js','art/jingyu-flight-r70.png'])assert.ok(meta.files.some(item=>item.path===file));
 const html=read('native-android/www/index.html');
 assert.match(html,/data-startup-style/);assert.match(html,/data-style-core media="print"/);
 assert.match(html,/<input id="jsonImport" type="file" accept="application\/json,application\/octet-stream,\.json,\.salarymate"/);
 assert.ok(html.indexOf('android-runtime.js')<html.indexOf('android-legacy-backup.js'));
 assert.ok(html.indexOf('android-legacy-backup.js')<html.indexOf('legal-data.js'));
 assert.ok(html.indexOf('legal-data.js')<html.indexOf('startup.js?v='));
 assert.match(html,/frame-src 'none'/);assert.match(html,/object-src 'none'/);
 for(const file of meta.files.filter(item=>item.path.endsWith('.js')))new vm.Script(read('native-android/www/'+file.path),{filename:file.path});
});
