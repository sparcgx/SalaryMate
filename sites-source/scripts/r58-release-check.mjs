import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import worker from '../dist/server/index.js';
import {salaryMateCsp} from '../server/security-policy.mjs';

const artifact=process.argv[2];assert.ok(artifact,'Portable artifact path is required');
const version=process.argv[3]||'5.0.0-dev.2-R58';
assert.match(version,/^5\.0\.0-dev\.2-R\d+$/);
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const html=fs.readFileSync(artifact,'utf8');
const modules=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
assert.equal(modules.length,16);assert.ok(!/<script\b[^>]*\bsrc=/.test(html));
const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
assert.ok(meta);assert.ok(meta.index<html.indexOf('<script'));
const policy=meta[1],scriptDirective=policy.split(';').find(x=>x.trim().startsWith('script-src '));
assert.ok(!scriptDirective.includes('unsafe-inline'));assert.ok(!scriptDirective.includes('unsafe-eval'));
for(const [index,block] of modules.entries()){
  new vm.Script(block[2],{filename:'portable-module-'+index});
  const hash="'sha256-"+createHash('sha256').update(block[2]).digest('base64')+"'";
  assert.ok(scriptDirective.split(' ').includes(hash),'Inline script hash must match exact emitted bytes');
}
assert.match(policy,/connect-src 'self' https:\/\/salarymate\.sparcgx2420\.chatgpt\.site /);
assert.ok(!policy.includes('frame-ancestors'),'Unsupported meta directives must not imply framing protection');
for(const path of ['/dev/v5.0.0-dev.2/','/dev/v5.0.0-dev.2/index.html','/dev/v5.0.0-dev.2/legal.html']){
  const response=await worker.fetch(new Request('https://site.test'+path,{method:'HEAD'}));
  assert.equal(response.status,200);assert.equal(response.headers.get('content-security-policy'),salaryMateCsp());
  assert.equal(response.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=()');
}
const stable=await worker.fetch(new Request('https://site.test/'));
assert.equal(stable.headers.get('content-security-policy'),null);
assert.equal(stable.headers.get('permissions-policy'),null);
assert.equal(await stable.text(),fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'));
const changed=execFileSync('git',['diff','--name-only','c1bf346ac6c2f5cc27bb0eaccfed8edda759ee5d','--','dist'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert.ok(changed.every(path=>path.startsWith('dist/dev/v5.0.0-dev.2/')||path==='dist/server/index.js'),'Frozen pages must not change');
const app=fs.readFileSync(new URL('app.js',base),'utf8');
assert.ok(app.includes("const SCHEMA_VERSION = 15;"));assert.ok(app.includes("const STORAGE_KEY = 'salarymate_v5_full_state';"));
for(const name of ['app.js','index.html','sw.js'])assert.ok(fs.readFileSync(new URL(name,base),'utf8').includes(version));
const locales=fs.readFileSync(new URL('i18n-en.js',base),'utf8');assert.ok(locales.includes('The backup contains an invalid date. Use YYYY-MM-DD.'));
console.log(JSON.stringify({version:'v'+version,portableScripts:16,exactCspHashes:'PASS',scriptSyntax:'PASS',hostedHeaders:'PASS',frozenPages:'unchanged',schema:15,storageKey:'salarymate_v5_full_state',browserTest:'not performed'}));
