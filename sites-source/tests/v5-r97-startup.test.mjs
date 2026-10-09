import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {websiteBootstrap} from '../scripts/lib/style-pack-build.mjs';
import {fileURLToPath} from 'node:url';
import {startupModules,buildStartupBundle} from '../scripts/lib/startup-bundle.mjs';
const root=new URL('..',import.meta.url),base=new URL('dist/dev/v5.0.0-dev.2/',root);
const read=name=>fs.readFileSync(new URL(name,base),'utf8');

test('R97 single deferred startup bundle preserves module order and exact generated website payloads',async()=>{
 const before=execFileSync('git',['show','97b22193e627e83032215bd5e74a37ebdfb9accc:dist/dev/v5.0.0-dev.2/index.html'],{cwd:root,encoding:'utf8'});
 const oldOrder=[...before.matchAll(/<script defer src="\.\/([^?]+)\?/g)].map(match=>match[1]);
 assert.deepEqual([...startupModules],oldOrder);
 const parts=await Promise.all(startupModules.map(async name=>`\n;/* SalaryMate module: ${name} */\n${name==='bootstrap.js'?await websiteBootstrap(fileURLToPath(base)):read(name)}\n`));
 const expected=parts.join('');
 assert.equal(read('startup.js'),expected);new vm.Script(expected);
 const scripts=[...read('index.html').matchAll(/<script defer src="([^"]+)"/g)];
 assert.equal(scripts.length,1);assert.equal(scripts[0][1],'./startup.js?v='+read('app.js').match(/const APP_VERSION = '([^']+)'/)[1]);
 assert.match(read('index.html'),/role="status">正在載入 SalaryMate/);
});

test('R97 precache contains startup once, excludes separate modules, and keeps legal content optional',()=>{
 const sw=read('sw.js'),shell=JSON.parse(sw.match(/const SHELL=(\[[^;]+\]);/)[1]);
 assert.equal(shell.length,7);assert.equal(new Set(shell).size,7);
 assert.equal(shell.filter(file=>/startup\.js/.test(file)).length,1);
 assert.ok(shell.every(file=>!startupModules.some(name=>file.startsWith('./'+name))&&!/art\/|legal/.test(file)));
 assert.match(sw,/const OPTIONAL=\["\.\/legal-data\.js\?v=/);
});

test('R97 missing startup source fails the build without publishing a partial bundle',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'salarymate-r97-'));
 try{await assert.rejects(buildStartupBundle(temp),/ENOENT/);assert.equal(fs.existsSync(path.join(temp,'startup.js')),false);}finally{fs.rmSync(temp,{recursive:true,force:true});}

});

test('R97 portable remains complete and does not fetch the hosted bundle',()=>{
 const file=process.env.SALARYMATE_PORTABLE;assert.ok(file,'Set SALARYMATE_PORTABLE to validate offline output');
 const html=fs.readFileSync(file,'utf8');
 assert.doesNotMatch(html,/<script[^>]+src=/);
 const modules=[...html.matchAll(/<script data-module="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(modules,['legal-data.js',...startupModules]);
 assert.ok(html.includes('data:image/webp;base64,'));
});
