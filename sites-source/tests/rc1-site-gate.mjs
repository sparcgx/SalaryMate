import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const hash = source => createHash('sha256').update(source).digest('hex');
const version = '4.3.2-RC.1';
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

// Historical v4.3.0 baseline: explicit allowlist for approved Glass and dev.1–dev.4 additions.
// RC additionally checks every runtime asset against the dev.4 freeze manifest.
const baselineApp = app.replace(`const APP_VERSION = '${version}'`, "const APP_VERSION = '4.3.0'")
  .replace(/    \/\/ ANNUAL_ANALYSIS_START[\s\S]*?    \/\/ ANNUAL_ANALYSIS_END\n/, '')
  .replace('          ${renderAnnualAnalysis()}\n', '')
  .replace('          <div class="section-title"><div><h3>全年所得與扣繳摘要</h3><p>${ui.selectedYear} 年全部月份；公司篩選相同，上方同期比較依指定截止月計算。</p></div></div>\n', '')
  .replace(/        '(?:preview-annual-report|download-annual-print|export-annual-report)': .*\n/g, '')
  .replace(/      if\(event.target.id==='annualThroughMonth'\)\{[\s\S]*?        return;\n      \}\n/, '')
  .replaceAll(' + state.compTimeCredits.length + state.compTimeSettlements.length', '')
  .replace("        + state.compTimeCredits.filter((record) => record.companyId === id).length\n        + state.compTimeSettlements.filter((record) => record.companyId === id).length\n", '')
  .replace('、${imported.compTimeCredits.length} 筆補休來源、${imported.compTimeSettlements.length} 筆補休結算', '')
  .replace("      compTimeCredits: [],\n      compTimeSettlements: [],\n", '')
  .replace("        compTimeLinked: type === 'compensatory' && window.SalaryMateCompTime.normalizeLeaveLink(record.compTimeLinked),\n", '')
  .replace("      next.compTimeCredits = Array.isArray(raw.compTimeCredits) ? raw.compTimeCredits.map(window.SalaryMateCompTime.normalizeCredit) : [];\n      next.compTimeSettlements = Array.isArray(raw.compTimeSettlements) ? raw.compTimeSettlements.map(window.SalaryMateCompTime.normalizeSettlement) : [];\n", '')
  .replace(/    const compTimeLedger = .*\n/, '')
  .replace("      const credited = state.compTimeCredits.filter(row => row.sourceId === log.id && row.companyId === log.companyId).reduce((sum,row)=>sum+numberValue(row.hours),0);\n      const hours = Math.max(0, numberValue(log.hours)-credited);", "      const hours = Math.max(0, numberValue(log.hours));")
  .replace(',state.compTimeCredits.filter(credit=>credit.sourceId===log.id).map(credit=>[credit.id,credit.hours,credit.expiresAt])', '')
  .replace(/    \/\/ COMP_TIME_START[\s\S]*?    \/\/ COMP_TIME_END\n/, '')
  .replace('        ${renderCompTimePanel()}\n', '')
  .replace('<button class="btn btn-small" type="button" data-action="credit-comp-time" data-id="${escapeAttr(log.id)}" ${state.compTimeCredits.some(row=>row.sourceId===log.id)?\'disabled\':\'\'}>轉補休</button> ', '')
  .replace("      if(log&&state.compTimeCredits.some(row=>row.sourceId===log.id))return toast('這筆加班已有補休來源，請先撤銷未使用轉入，或保留原始紀錄。','error');\n", '')
  .replace(/        \$\{draft.type==='compensatory'\?`<label class="span-2"><span class="field-label">補休來源帳本<\/span>[\s\S]*?<\/label>`:''\}\n/, '')
  .replace("        compTimeLinked: data.get('compTimeLinked')==='true',\n", '')
  .replace("      if(state.compTimeCredits.some(row=>row.sourceId===draft.id)){showValidationSummary(form,'這筆加班已轉入補休，無法編輯來源。');return}\n", '')
  .replace(/      if\(draft.type==='compensatory'&&draft.status==='confirmed'&&draft.compTimeLinked\)\{[\s\S]*?      \}\n/, '')
  .replace("      if(state.compTimeCredits.some(item=>item.sourceId===id))return toast('這筆加班已有補休來源，請先檢查來源帳本。','error');\n", '')
  .replace(/        '(?:credit-comp-time|settle-comp-time|delete-comp-credit|delete-comp-settlement)': .*\n/g, '')
  .replace(/      if \(event.target.id === 'comp(?:Credit|Settlement)Form'\) .*\n/g, '')
  .replace("        if(draft.type==='compensatory'&&!state.leaveRecords.some(row=>row.id===draft.id)) draft.compTimeLinked=true;\n", '')
  .replace(/    \/\/ COPY_MONTH_START[\s\S]*?    \/\/ COPY_MONTH_END\n/, read('tests/fixtures/duplicate-dev1.txt'))
  .replace('>複製上月薪資</button>', '>複製最近月份</button>')
  .replace("      if (event.target.id === 'copyMonthForm') applyCopyMonth();\n", '')
  .replace(/      if \(event.target.id === 'copyTargetMonth' && copyMonthDraft\) \{[\s\S]*?        return;\n      \}\n/, '')
  .replace("${window.SalaryMateGlass?.settingsHtml() || ''}", '')
  .replace(/    \/\/ RECONCILIATION_START[\s\S]*?    \/\/ RECONCILIATION_END\n/, '')
  .replace('        reconciliation: window.SalaryMateReconcile.normalize(record.reconciliation),\n', '')
  .replace('<button class="btn btn-small" type="button" data-action="reconcile-record" data-id="${escapeAttr(record.id)}">月結核對</button><span class="reconcile-status">${escapeHtml(reconciliationStatus(record))}</span>', '')
  .replace('reconciliation: null, ', '')
  .replace("        'reconcile-record': () => openReconciliation(id),\n", '')
  .replace("      if (event.target.id === 'reconciliationForm') saveReconciliation(event.submitter?.value === 'confirm');\n", '')
  .replace("      } else if (event.target.closest('#reconciliationForm')) {\n        updateReconciliationPreview();\n", '');
assert.equal(hash(baselineApp), '3ee310f159bdbfde18197863c64431aaa5b8faf0e1d95b99ef71c61f74a86989', 'Application drifted beyond the approved feature allowlist');
assert.equal(hash(read('dist/styles.css')), 'ab108c7095d6d6191cfd665c5249c545b1f0015b33aea854940d1bb3d047c8d7', 'Frozen base CSS changed');
assert.equal(hash(bootstrap.replaceAll(version, '4.3.0')), '2220e23ad87b399e076b3a4dd1f0fd3d075041f19d727a22edcd8cd60bd37f09', 'Storage/security/backup bootstrap changed beyond version metadata');
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|DeviceOrientationEvent|DeviceMotionEvent)\b/.test(glass));
assert(!/localStorage\.(?:removeItem|clear)\s*\(/.test(glass));
console.log('PASS: historical baseline allowlist; only approved feature additions and version metadata');

const shell = vm.runInNewContext(`${worker.match(/const APP_SHELL = (\[[^;]+\]);/)[1]}`);
assert(worker.includes("APP_SHELL.push('./reconcile.js?v=4.3.2-RC.1', './reconcile.css?v=4.3.2-RC.1')"));
shell.push('./reconcile.js?v=4.3.2-RC.1', './reconcile.css?v=4.3.2-RC.1');
assert(worker.includes("APP_SHELL.push('./copy-month.js?v=4.3.2-RC.1')"));
shell.push('./copy-month.js?v=4.3.2-RC.1');
assert(worker.includes("APP_SHELL.push('./comp-time.js?v=4.3.2-RC.1')"));
shell.push('./comp-time.js?v=4.3.2-RC.1');
assert(worker.includes("APP_SHELL.push('./annual-analysis.js?v=4.3.2-RC.1', './annual-analysis.css?v=4.3.2-RC.1')"));
shell.push('./annual-analysis.js?v=4.3.2-RC.1','./annual-analysis.css?v=4.3.2-RC.1');
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
console.log('NOTE: source and simulated-runtime checks only; real browser visual/performance QA remains unverified.');
