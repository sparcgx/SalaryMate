import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const hash = source => createHash('sha256').update(source).digest('hex');
const version = JSON.parse(read('package.json')).version;
const html = read('dist/index.html');
const app = read('dist/app.js');
const bootstrap = read('dist/bootstrap.js');
const worker = read('dist/sw.js');
const css = read('dist/glass.css');
const glass = read('dist/glass.js');
const manifest = JSON.parse(read('dist/manifest.webmanifest'));
const hosting = JSON.parse(read('.openai/hosting.json'));

assert.equal(hosting.project_id, 'appgprj_6aa0d52f0f308191b5f325b9a8e004e4');
assert.equal(hosting.static.directory, 'dist');
assert(html.includes(`<title>個人薪資管理 v${version}</title>`));
assert(html.includes(`<span class="version">v${version}</span>`));
assert.equal(JSON.parse(read('package.json')).version, version);
assert.equal(JSON.parse(read('package-lock.json')).packages[''].version, version);
assert(manifest.description.includes(version));
assert(app.includes(`const APP_VERSION = '${version}'`));
assert(app.includes('const SCHEMA_VERSION = 13'));
assert(app.includes("const STORAGE_KEY = 'salarymate_v310_state'"));
assert(/getItem:\s*\(key\)\s*=>\s*localStorage\.getItem\(key\)/.test(bootstrap));
assert(!bootstrap.includes('salarymate_v431_dev1_preview:'));
assert(bootstrap.includes(`script.src = "./app.js?v=${version}"`));
assert(worker.includes(`salarymate-shell-v${version}`));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
console.log('PASS: same site, consistent web version, existing payroll storage and schema');

// RC1 is preserved separately. RC2 changes are explicit, all other assets must match RC1.
const freeze1=JSON.parse(read('release-evidence/v4.3.2-RC.1_freeze.json'));
const approved=new Set(['dist/app.js','dist/comp-time.js','dist/index.html','dist/sw.js']);
for(const [path,expected] of Object.entries(freeze1.assets)){
  if(approved.has(path))continue;
  const buffer=fs.readFileSync(new URL('../'+path,import.meta.url));
  const normalized=buffer.includes(0)?buffer:Buffer.from(buffer.toString().replaceAll(version,'__RC_VERSION__').replaceAll('4.3.2-dev.4','__RC_VERSION__'));
  assert.equal(hash(normalized),expected,`Unapproved runtime change: ${path}`);
}
assert.equal(hash(read('dist/styles.css')), 'ab108c7095d6d6191cfd665c5249c545b1f0015b33aea854940d1bb3d047c8d7', 'Frozen base CSS changed');
assert.equal(hash(bootstrap.replaceAll(version, '4.3.0')), '2220e23ad87b399e076b3a4dd1f0fd3d075041f19d727a22edcd8cd60bd37f09', 'Storage/security/backup bootstrap changed beyond version metadata');
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|DeviceOrientationEvent|DeviceMotionEvent)\b/.test(glass));
assert(!/localStorage\.(?:removeItem|clear)\s*\(/.test(glass));
console.log('PASS: RC1 assets outside approved fixes unchanged; storage/security bootstrap and base CSS preserved');

const scope={self:{addEventListener() {}}};
vm.runInNewContext(worker+';self.shell=APP_SHELL;',scope);const shell=scope.self.shell;
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
for (const reference of [...references, ...shell]) {
  if (reference.startsWith('#')) continue;
  assert(!/^(?:https?:)?\/\//i.test(reference), 'No third-party runtime resources');
  const file = reference.replace(/[?#].*$/, '').replace(/^\.\//, '') || 'index.html';
  assert(fs.statSync(new URL(`../dist/${file}`, import.meta.url)).size > 0, `Missing asset: ${reference}`);
}
for (const asset of [`./glass.css?v=${version}`, `./glass.js?v=${version}`, `./bootstrap.js?v=${version}`, `./app.js?v=${version}`]) assert(shell.includes(asset));
assert(html.indexOf('./glass.js') < html.indexOf('./bootstrap.js'));
assert(html.indexOf('./styles.css') < html.indexOf('./glass.css'));
console.log('PASS: every HTML/PWA asset exists; glass assets are cached and loaded in order');

for (const query of ['prefers-reduced-motion: reduce', 'prefers-reduced-transparency: reduce', 'forced-colors: active', 'max-width: 350px']) assert(css.includes(query));
assert(css.includes('@supports not ((backdrop-filter:'));
assert(css.includes('.glass-radio:focus-visible'));
assert(css.includes('animation-play-state: paused'));
assert(css.includes('#securityCover .btn:not(.btn-primary)'));
assert(css.includes('-webkit-backdrop-filter'));
console.log('PASS: motion/transparency/unsupported-browser fallbacks and keyboard focus styles present');
console.log('NOTE: Web source gate only; native Android/iOS and data-safety blocker remain open.');
