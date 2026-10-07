import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise production preference functions with plain data objects, without a browser or DOM.
const source = readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js', import.meta.url), 'utf8');
const definition = name => {
  const prefix = `    const ${name} =`;
  const start = source.indexOf(prefix);
  assert.ok(start >= 0, `Missing production definition: ${name}`);
  const end = source.indexOf('\n    const ', start + prefix.length);
  assert.ok(end > start, `Missing definition boundary: ${name}`);
  return source.slice(start, end);
};
const definitions = ['APP_VERSION', 'SCHEMA_VERSION', 'STORAGE_KEY', 'INTERFACE_MODES', 'COLOR_THEMES', 'INTERFACE_STYLES', 'HD2D_BACKGROUNDS', 'numberValue', 'clamp', 'clone', 'normalizeInterfaceStyle', 'interfaceBaseStyle', 'normalizeSurfaceOpacity', 'normalizeMotionEffect', 'normalizeHd2dBackground', 'normalizeInterfaceMode', 'normalizeColorTheme', 'applyInterfaceMode', 'applyColorTheme', 'applyInterfaceStyle', 'applyVisualPreferences', 'restoreUiPreferences', 'saveState', 'commitStateMutation', 'surfaceMotionInfoHtml', 'surfaceOpacityChoicesHtml', 'setSurfaceOpacity'].map(definition).join('\n');
const modes = ['translucent', 'frosted', 'dynamic', 'multi-dynamic'];
const styles = ['doodle', 'cream', 'dusk', 'pencil', 'studio', 'macaron-luxe', 'pixel-luxe', 'glass', 'cards', 'dark'];

function harness(style = 'pixel-luxe', mode = 'frosted', background = 'harbor', motionEffect) {
  const state = {
    schemaVersion: 15,
    companies: [{ id: 'company-fixture', baseSalary: 30000, customAllowances: [{ id: 'custom', amount: 1200 }] }],
    records: [{ id: 'salary-fixture', overtimePay: 19665, netSalary: 42100 }],
    stockPortfolio: { assets: [{ id: 'asset-fixture', code: 'TEST' }], trades: [{ id: 'trade-fixture', quantity: 100, price: 25.1 }] },
    uiPreferences: { interfaceStyle: style, surfaceOpacity: mode, motionEffect, hd2dBackground: background, interfaceMode: 'large', colorTheme: 'pink' }
  };
  let saved;
  let rejectWrites = false;
  const focusCalls = [];
  const dialog = { scrollTop: 420 };
  const context = vm.createContext({
    initialState: structuredClone(state),
    uiElements: { '#appDialog': dialog, effectChoice: { focus: options => focusCalls.push(options) } },
    document: { body: { dataset: {} }, documentElement: { dataset: {} } },
    window: { SalaryMateStorage: { setItem: (key, value) => { if (rejectWrites) throw new Error('Quota exceeded'); saved = { key, value: JSON.parse(value) }; } } },
    console: { ...console, error: () => {} }
  });
  vm.runInContext(`let state = initialState; const ui = {}; const currentYear = 2026; const $ = selector => selector.startsWith('input[name="surfaceOpacity"]') ? uiElements.effectChoice : uiElements[selector] || null; const acquireOperationLock = () => true; const releaseOperationLock = () => {}; const renderAll = () => applyVisualPreferences(); const openInterfaceSettings = () => {}; const invalidateCalculationCache = () => {}; const syncDataStatusFromState = () => {}; const setOperationStatus = () => {}; const toast = () => {};\n${definitions}`, context);
  const run = script => vm.runInContext(script, context);
  return { run, context, original: state, saved: () => saved, rejectWrites: () => { rejectWrites = true; }, focusCalls, dialog };
}

test('four effect choices; transparent backups safely become translucent', () => {
  const h = harness();
  for (const mode of modes) assert.equal(h.run(`normalizeSurfaceOpacity(${JSON.stringify(mode)})`), mode);
  assert.equal(h.run("normalizeSurfaceOpacity('transparent')"), 'translucent');
  for (const value of [undefined, null, '', 'unknown']) {
    h.context.value = value;
    assert.equal(h.run('normalizeSurfaceOpacity(value)'), 'frosted');
  }
  h.run('restoreUiPreferences()');
  const html = h.run('surfaceOpacityChoicesHtml()');
  assert.deepEqual([...html.matchAll(/name="surfaceOpacity" value="([^"]+)"/g)].map(m => m[1]), modes);
  assert.equal((html.match(/ checked/g) || []).length, 1);
  for (const label of ['背景與效果', '半透明', '霧面', '動態', '多樣式動態效果']) assert.ok(html.includes(label));
  assert.ok(!html.includes('value="transparent"'));
});

test('every style and effect survives saving and reloading without changing financial records', () => {
  for (const style of styles) for (const mode of [...modes, 'transparent']) {
    const h = harness(style, mode);
    h.run('restoreUiPreferences()');
    const expected = mode === 'transparent' ? 'translucent' : mode;
    assert.equal(h.context.document.body.dataset.surfaceOpacity, expected);
    assert.equal(h.run('saveState()'), true);
    const saved = h.saved();
    assert.equal(saved.key, 'salarymate_v5_full_state');
    assert.equal(saved.value.schemaVersion, 15);
    for (const key of ['companies', 'records', 'stockPortfolio']) assert.deepEqual(saved.value[key], h.original[key]);
    assert.equal(saved.value.uiPreferences.interfaceStyle, style);
    assert.equal(saved.value.uiPreferences.surfaceOpacity, expected);
    h.context.reloaded = JSON.parse(JSON.stringify(saved.value));
    h.run('state = reloaded; ui.surfaceOpacity = undefined; restoreUiPreferences()');
    assert.equal(h.run('ui.surfaceOpacity'), expected);
    assert.equal(h.run('ui.hd2dBackground'), 'harbor');
    assert.equal(h.run('ui.interfaceMode'), 'large');
    assert.equal(h.run('ui.colorTheme'), 'pink');
  }
});

test('all HD-2D scenes remain available in every effect mode', () => {
  for (const scene of ['canyon', 'forest', 'harbor', 'aurora', 'sky']) for (const mode of modes) {
    const h = harness('pixel-luxe', mode, scene);
    h.run('restoreUiPreferences(); saveState()');
    assert.equal(h.context.document.body.dataset.interfaceStyle, 'pixel');
    assert.equal(h.context.document.body.dataset.styleVariant, 'ornate');
    assert.equal(h.context.document.body.dataset.hd2dBackground, scene);
    assert.equal(h.saved().value.uiPreferences.hd2dBackground, scene);
  }
});

test('new effect descriptions have English translations', () => {
  const h = harness();
  const catalog = readFileSync(new URL('../dist/dev/v5.0.0-dev.2/i18n-en.js', import.meta.url), 'utf8');
  h.run(catalog);
  for (const text of ['背景與效果', '靜態霧面，模糊背景', '動態', '霧面搭配柔和流光', '多樣式動態效果', '依風格變換光暈、光點與紋理', '動態模式會套用選單動畫；開啟減少動態效果時會停止動畫。', '背景與效果已儲存']) {
    h.context.text = text;
    assert.ok(h.run('globalThis.SalaryMateEnglish[text]'), text);
  }
});

test('R53 dynamic settings describe menu motion and have no animation chooser', () => {
  for (const mode of modes) {
    const h = harness('pixel-luxe', mode, 'harbor', 'meteors');
    h.run('restoreUiPreferences()');
    const html = h.run('surfaceOpacityChoicesHtml()');
    assert.ok(!html.includes('<select'));
    assert.ok(!html.includes('motionEffectSelect'));
    assert.ok(html.includes('選單滑入、切換與點選動畫'));
    assert.ok(html.includes('選單光感動畫與多層背景特效'));
    assert.equal(h.context.document.body.dataset.motionEffect, undefined);
    assert.equal(h.run('ui.motionEffect'), 'meteors');
  }
});

test('R53 menu-motion mode persists while preserving R52 preferences and financial data', () => {
  for (const style of styles) for (const legacyEffect of ['flow', 'aurora', 'particles', 'meteors', 'rings', 'grid']) {
    const h = harness(style, 'frosted', 'aurora', legacyEffect);
    h.run("restoreUiPreferences(); setSurfaceOpacity('dynamic')");
    assert.equal(h.context.document.body.dataset.surfaceOpacity, 'dynamic');
    assert.equal(h.saved().value.uiPreferences.surfaceOpacity, 'dynamic');
    assert.equal(h.saved().value.uiPreferences.motionEffect, legacyEffect);
    assert.equal(h.saved().value.schemaVersion, 15);
    assert.equal(h.dialog.scrollTop, 420);
    assert.equal(h.focusCalls.at(-1).preventScroll, true);
    for (const key of ['companies', 'records', 'stockPortfolio']) assert.deepEqual(h.saved().value[key], h.original[key]);
    h.run("setSurfaceOpacity('multi-dynamic')");
    h.context.reloaded = JSON.parse(JSON.stringify(h.saved().value));
    h.run('state = reloaded; restoreUiPreferences()');
    assert.equal(h.run('ui.surfaceOpacity'), 'multi-dynamic');
    assert.equal(h.run('ui.motionEffect'), legacyEffect);
    assert.equal(h.context.document.body.dataset.motionEffect, undefined);
    assert.equal(h.run('ui.hd2dBackground'), 'aurora');
  }
});

test('R53 failed writes restore the old mode and leave saved data unchanged', () => {
  const h = harness('pixel-luxe', 'frosted', 'harbor', 'rings');
  h.run('restoreUiPreferences()');
  const before = h.run('JSON.stringify(state)');
  h.rejectWrites();
  h.run("setSurfaceOpacity('dynamic')");
  assert.equal(h.saved(), undefined);
  assert.equal(h.run('ui.surfaceOpacity'), 'frosted');
  assert.equal(h.context.document.body.dataset.surfaceOpacity, 'frosted');
  assert.equal(h.run('JSON.stringify(state)'), before);
});

test('R53 menu motion guidance is translated', () => {
  const h = harness();
  h.run(readFileSync(new URL('../dist/dev/v5.0.0-dev.2/i18n-en.js', import.meta.url), 'utf8'));
  for (const text of ['選單滑入、切換與點選動畫', '選單光感動畫與多層背景特效', '主選單、分頁與展開選單會套用動態回饋。', '選單加入光感動態，背景保留流光、光環、粒子與流星層次。', '動態模式會套用選單動畫；開啟減少動態效果時會停止動畫。']) {
    h.context.text = text;
    assert.ok(h.run('globalThis.SalaryMateEnglish[text]'), text);
  }
});
