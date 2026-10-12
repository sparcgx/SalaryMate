import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {salaryMateCsp} from '../server/security-policy.mjs';

// Publication gate: build the actual Worker and portable artifact before running.
// Parse HTML as a browser does; hashing source-file CRLF bytes is not equivalent
// to hashing an inline script's DOM text and would miss Windows-only CSP failures.
const {JSDOM}=await import(process.env.SALARYMATE_DOM_MODULE||'/tmp/salarymate-v5-qa/node_modules/jsdom/lib/api.js');
const root=path.resolve(import.meta.dirname,'..');
const dev='dev/v5.0.0-dev.2/';
const origin='https://salarymate.sparcgx2420.chatgpt.site';
const hostedHtml=fs.readFileSync(path.join(root,'dist',dev,'index.html'),'utf8');
const doms=[];
const parse=html=>{const dom=new JSDOM(html);doms.push(dom);return dom.window.document;};
const hosted=parse(hostedHtml);
const hash=source=>"'sha256-"+createHash('sha256').update(source,'utf8').digest('base64')+"'";
const directives=policy=>new Map(policy.split(';').map(value=>value.trim().split(/\s+/)).filter(([name])=>name).map(([name,...values])=>[name,values]));
const inlineHashes=document=>[...document.querySelectorAll('script:not([src])')].map(script=>hash(script.textContent));
function strictScripts(policy){
  const parsed=directives(policy),scripts=parsed.get('script-src');
  assert.ok(scripts,'Missing script-src');
  assert.ok(!scripts.includes("'unsafe-inline'"));
  assert.ok(!scripts.includes("'unsafe-eval'"));
  assert.deepEqual(parsed.get('script-src-attr'),["'none'"]);
  assert.ok(scripts.includes('https://accounts.google.com/gsi/client'));
  return scripts;
}
function exactInlineCoverage(document,policy){
  const expected=inlineHashes(document),scripts=strictScripts(policy);
  assert.deepEqual(scripts.filter(value=>value.startsWith("'sha256-")).sort(),[...new Set(expected)].sort());
  return expected;
}
let builtWorker;
async function worker(){
  const workerPath=path.join(root,'dist/server/index.js');
  assert.ok(fs.existsSync(workerPath),'Run scripts/build-stock-worker.mjs before this publication gate');
  return builtWorker??=(await import(pathToFileURL(workerPath).href)).default;
}
after(()=>{for(const dom of doms)dom.window.close();});

test('publication: hosted policy permits the early guard while keeping script restrictions',()=>{
  const guards=hosted.querySelectorAll('script[data-startup-guard]');
  assert.equal(guards.length,1);
  const expected=inlineHashes(hosted);
  assert.equal(expected.length,1);
  const policy=salaryMateCsp({scriptHashes:expected});
  const scripts=strictScripts(policy);
  assert.ok(scripts.includes("'self'"));
  assert.ok(scripts.includes(hash(guards[0].textContent)));
  assert.deepEqual(directives(policy).get('frame-ancestors'),["'self'",'https://chatgpt.com']);
  assert.throws(()=>salaryMateCsp({portable:true}),/require CSP hashes/);
});

test('publication: portable CSP covers all 17 browser-parsed scripts including the early guard',()=>{
  assert.ok(process.env.SALARYMATE_SINGLE_HTML,'Build the current portable artifact and supply SALARYMATE_SINGLE_HTML');
  const document=parse(fs.readFileSync(process.env.SALARYMATE_SINGLE_HTML,'utf8'));
  const meta=document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  assert.ok(meta,'Missing portable CSP');
  assert.equal(document.querySelectorAll('script[src],link[rel="stylesheet"],link[rel="manifest"]').length,0);
  assert.equal(document.querySelectorAll('script').length,17);
  assert.equal(document.querySelectorAll('script[data-module]').length,15);
  const guard=document.querySelector('script[data-startup-guard]');
  assert.ok(guard);
  assert.equal(guard.textContent,hosted.querySelector('script[data-startup-guard]').textContent);
  assert.ok(meta.compareDocumentPosition(guard)&4,'CSP must appear before the inline guard');
  assert.equal(document.querySelector('script'),guard,'Early guard must precede application modules');
  const expected=exactInlineCoverage(document,meta.content);
  assert.equal(new Set(expected).size,17);
  const policy=directives(meta.content);
  assert.ok(!policy.get('script-src').includes("'self'"));
  assert.deepEqual(policy.get('worker-src'),["'none'"]);
  assert.equal(policy.has('frame-ancestors'),false);
  assert.ok(policy.get('connect-src').includes(origin));
});

test('publication: built Worker serves the exact development HTML with matching browser CSP hashes',async()=>{
  const handler=await worker();
  for(const route of [dev,dev+'index.html']){
    const response=await handler.fetch(new Request(origin+'/'+route));
    assert.equal(response.status,200);
    const body=await response.text();
    assert.equal(body,hostedHtml,'Worker artifact must be rebuilt after HTML changes');
    exactInlineCoverage(parse(body),response.headers.get('content-security-policy')||'');
    assert.equal(response.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=()');
  }
  const head=await handler.fetch(new Request(origin+'/'+dev,{method:'HEAD'}));
  assert.equal(await head.text(),'');
  exactInlineCoverage(hosted,head.headers.get('content-security-policy')||'');
});

test('publication: built Worker preserves the frozen root bytes and existing header scope',async()=>{
  const response=await (await worker()).fetch(new Request(origin+'/'));
  assert.equal(response.status,200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(path.join(root,'dist/index.html')));
  assert.equal(response.headers.get('content-security-policy'),null);
  assert.equal(response.headers.get('permissions-policy'),null);
});

test('publication: no tracked frozen dist files changed outside the existing development route',()=>{
  const changed=execFileSync('git',['diff','--name-only','HEAD','-z','--','dist'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  assert.deepEqual(changed.filter(file=>!file.startsWith('dist/'+dev)),[]);
});
