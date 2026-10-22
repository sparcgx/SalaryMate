'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {RELEASES,releaseInfo,compare,downloadVerified}=require('../src/updates.cjs');
const {decodePackage}=require('../src/content-updates.cjs');
async function main(){
 const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),tag='v'+pkg.version+'-desktop.'+pkg.desktopRelease;
 const headers={'Accept':'application/vnd.github+json','User-Agent':'SalaryMate-Content-Builder'};
 if(process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
 const response=await fetch(RELEASES,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Unable to verify previous published package: '+response.status);
 const releases=await response.json();
 const candidates=releases.map(r=>releaseInfo(r,'win32','x64')).filter(r=>r?.contentManifest&&compare(r.tag,tag)<0).sort((a,b)=>compare(b.tag,a.tag));
 if(!candidates.length){console.log('First content-package release: full content only, runtime excluded.');return;}
 const latest=candidates[0],asset=latest.contentAssets.find(a=>a.name==='SalaryMate_v'+latest.version+'_content.smupdate');
 if(!asset)throw Error('Missing full content baseline');
 const file=path.join(root,'.content-base.smupdate');
 await downloadVerified(asset,file);
 const base=decodePackage(await fs.readFile(file));
 if(base.base||base.manifest.tag!==latest.tag)throw Error('Invalid baseline');
 console.log(JSON.stringify({baseline:latest.tag,size:asset.size,sha256:asset.sha256}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

