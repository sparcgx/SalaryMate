'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const asar=require('@electron/asar');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),arch=process.argv[2];
assert.ok(['x64','arm64'].includes(arch));
const win=process.platform==='win32';
const dir=win?path.join(root,'release','win-unpacked'):path.join(root,'release',arch==='arm64'?'mac-arm64':'mac','SalaryMate.app','Contents');
const archive=path.join(dir,win?'resources':'Resources','app.asar');
const get=name=>asar.extractFile(archive,path.normalize(name));
const manifest=JSON.parse(get('www/desktop-asset-manifest.json'));
for(const f of manifest.files){const bytes=get('www/'+f.path);assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.path);}
for(const f of manifest.api)assert.equal(createHash('sha256').update(get('api/'+f.path)).digest('hex'),f.sha256);
for(const name of ['main.cjs','preload.cjs','security.cjs','files.cjs'])new vm.Script(get('src/'+name).toString(),{filename:name});
const pkg=JSON.parse(get('package.json'));assert.equal(pkg.version,'5.0.0');assert.equal(pkg.build?.buildVersion,undefined); // builder removes build-only configuration.
const binary=fs.readFileSync(path.join(dir,win?'SalaryMate.exe':'MacOS/SalaryMate'));
if(win){assert.equal(binary.subarray(0,2).toString(),'MZ');assert.equal(binary.readUInt16LE(binary.readUInt32LE(0x3c)+4),0x8664);}
else{assert.equal(binary.readUInt32LE(0),0xfeedfacf);assert.equal(binary.readUInt32LE(4),arch==='arm64'?0x100000c:0x1000007);}
const artifacts=fs.readdirSync(path.join(root,'release')).filter(x=>x.endsWith(win?'.exe':'.dmg'));
assert.equal(artifacts.length,1);
const rows=artifacts.map(name=>{const bytes=fs.readFileSync(path.join(root,'release',name));return {name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
fs.writeFileSync(path.join(root,'release','SHA256SUMS-'+process.platform+'-'+arch+'.txt'),rows.map(x=>x.sha256+'  '+x.name).join('\n')+'\n');
fs.writeFileSync(path.join(root,'release','verification-'+process.platform+'-'+arch+'.json'),JSON.stringify({version:'5.0.0',desktopBuild:5000103,architecture:arch,platform:process.platform,assetFiles:manifest.files.length,sourceCommit:process.env.GITHUB_SHA||'',checks:'package contents, SHA-256, script syntax, binary architecture; no GUI or device test',publisherSigned:false,notarized:false,artifacts:rows},null,2)+'\n');
console.log(JSON.stringify({platform:process.platform,arch,assetFiles:manifest.files.length,artifacts:rows}));
