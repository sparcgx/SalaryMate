import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Production handlers, plain objects and synthetic geometry; no browser or DOM emulator.
const source = readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js', import.meta.url), 'utf8');
const definition = name => {
  const start = source.indexOf(`    const ${name} =`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n    const ', start + 1);
  assert.ok(end > start, name);
  return source.slice(start, end);
};

function densityHarness(initial = 'minimal', language = 'zh', save = true) {
  const ui = {interfaceMode: initial};
  const offsets = {standard: [1600,1900,2200], minimal: [1600,1900,2200], compact: [1280,1520,1760], large: [1920,2300,2680]};
  const body = {scrollTop: 1700, getBoundingClientRect: () => ({top: 100})};
  let translations = 0, renders = 0, writes = 0;
  const toasts = [];
  const choices = ['minimal','compact','large'].map((mode, index) => {
    const label = {textContent: ''};
    return {
      dataset: {mode}, attributes: {}, label,
      getBoundingClientRect: () => ({top: 100 + offsets[ui.interfaceMode][index] - body.scrollTop}),
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelector: selector => { assert.equal(selector, '.v5-mode-selected'); return label; }
    };
  });
  const dialog = {
    querySelector(selector) {
      if (selector === '.dialog-body') return body;
      return choices.find(choice => selector.includes(`data-mode="${choice.dataset.mode}"`));
    },
    querySelectorAll: () => choices
  };
  for (const object of [dialog, body, ...choices]) Object.defineProperty(object, 'innerHTML', {set() {throw Error('Density change replaced an existing control or scroll container');}});
  const context = vm.createContext({
    ui,
    $: selector => { assert.equal(selector, '#appDialog'); return dialog; },
    commitStateMutation: mutate => {writes++; mutate(); return save;},
    renderAll: () => {renders++;},
    openInterfaceSettings: () => {throw Error('Density change reopened the modal');},
    window: {SalaryMateI18n: {apply: () => {
      translations++;
      if (language === 'en') for (const choice of choices) choice.label.textContent = choice.label.textContent === '使用中' ? 'In use' : 'Choose';
    }}},
    toast: value => toasts.push(value)
  });
  vm.runInContext(['INTERFACE_MODES','normalizeInterfaceMode','setInterfaceMode'].map(definition).join('\n'), context);
  return {ui,body,choices,toasts,run: mode => vm.runInContext(`setInterfaceMode(${JSON.stringify(mode)})`,context),stats: () => ({translations,renders,writes})};
}

test('switching compact / large / standard preserves the touched control and its viewport position', () => {
  const h = densityHarness();
  const original = [...h.choices], body = h.body;
  for (const mode of ['compact','large','minimal','compact']) {
    const target = h.choices.find(choice => choice.dataset.mode === mode);
    const offset = target.getBoundingClientRect().top - body.getBoundingClientRect().top;
    h.run(mode);
    assert.equal(h.ui.interfaceMode, mode);
    assert.equal(h.body, body);
    assert.deepEqual(h.choices, original);
    assert.equal(target.getBoundingClientRect().top - body.getBoundingClientRect().top, offset);
    assert.equal(h.choices.filter(choice => choice.attributes['aria-checked'] === 'true').length, 1);
    assert.equal(target.label.textContent, '使用中');
  }
  const before = h.stats();
  h.run('compact');
  assert.deepEqual(h.stats(), before, 'selecting the same mode is a no-op');
});

test('a rejected save restores legacy standard selection and does not move the scroll position', () => {
  const h = densityHarness('standard', 'zh', false), before = h.body.scrollTop;
  h.run('compact');
  assert.equal(h.ui.interfaceMode, 'standard');
  assert.equal(h.choices[0].attributes['aria-checked'], 'true');
  assert.equal(h.choices[1].attributes['aria-checked'], 'false');
  assert.equal(h.body.scrollTop, before);
  assert.equal(h.toasts.length, 0);
});

test('updated density statuses remain translated while the controls keep their identity', () => {
  const h = densityHarness('minimal', 'en'), compact = h.choices[1];
  h.run('compact');
  assert.equal(h.choices[1], compact);
  assert.equal(compact.label.textContent, 'In use');
  assert.equal(h.choices[0].label.textContent, 'Choose');
  assert.equal(h.stats().translations, 1);
});

test('other appearance changes reuse the open dialog body and retain its scroll position', () => {
  let replacements = 0, opens = 0;
  const classes = new Set(['interface-settings-dialog']);
  const body = {scrollTop: 420};
  Object.defineProperty(body, 'innerHTML', {set(value) {assert.equal(value, 'updated preferences'); replacements++; this.scrollTop = 0;}});
  const dialog = {open:true, classList:{contains:key=>classes.has(key),add:key=>classes.add(key)},querySelector:()=>body};
  const context = vm.createContext({
    $: () => dialog, interfaceSettingsHtml: () => 'updated preferences',
    openDialog: () => {opens++; dialog.open = true;},
    enhanceFormAccessibility() {}, v5Clean() {}, enhanceVisualHierarchy() {},
    window:{SalaryMateI18n:{apply() {}}}
  });
  vm.runInContext(definition('openInterfaceSettings'), context);
  vm.runInContext('openInterfaceSettings()', context);
  assert.equal(opens, 0);
  assert.equal(replacements, 1);
  assert.equal(body.scrollTop, 420);
  dialog.open = false;
  classes.clear();
  vm.runInContext('openInterfaceSettings()', context);
  assert.equal(opens, 1);
  assert.ok(classes.has('interface-settings-dialog'));
});
