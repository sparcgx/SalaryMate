import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('dist/index.html');
const app = read('dist/app.js');
const bootstrap = read('dist/bootstrap.js');
const worker = read('dist/sw.js');
const manifest = JSON.parse(read('dist/manifest.webmanifest'));
const hosting = JSON.parse(read('.openai/hosting.json'));

assert.equal(hosting.project_id, 'appgprj_6aa0d52f0f308191b5f325b9a8e004e4');
assert.equal(hosting.static.directory, 'dist');
assert(html.includes('<title>個人薪資管理 v4.3.0</title>'));
assert(html.includes('<span class="version">v4.3.0</span>'));
assert(!html.includes('dev.1'));
assert(app.includes("const APP_VERSION = '4.3.0'"));
assert(app.includes("const SCHEMA_VERSION = 13"));
assert(app.includes("const STORAGE_KEY = 'salarymate_v310_state'"));
assert(/getItem:\s*\(key\)\s*=>\s*localStorage\.getItem\(key\)/.test(bootstrap), 'Existing browser storage must remain accessible');
assert(!bootstrap.includes('salarymate_v431_dev1_preview:'));
assert(!bootstrap.includes('Web 開發預覽'));
assert(worker.includes('salarymate-shell-v4.3.0'));
assert(worker.includes('salarymate-shell-'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
for (const filename of ['app.js', 'bootstrap.js', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']) {
  assert(fs.statSync(new URL(`../dist/${filename}`, import.meta.url)).size > 0, `${filename} missing`);
}
console.log('PASS: v4.3.0 identity, existing browser data key, production assets and PWA update');
