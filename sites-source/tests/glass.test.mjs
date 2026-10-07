import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../dist/glass.js', import.meta.url), 'utf8');
const KEY = 'salarymate.visualEffects.v1';
const PAYROLL_KEY = 'salarymate_v310_state';
const payroll = JSON.stringify({ schemaVersion: 13, companies: [{ id: 'fixture-company', isCurrent: true }], records: [{ id: 'fixture-record', companyId: 'fixture-company', year: 2026, month: 9, baseSalary: 47000 }], overtimeLogs:[{id:'fixture-ot',companyId:'fixture-company',date:'2026-09-15',type:'weekday',hours:2,hourlyRate:200}] });

const eventTarget = () => {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatch(type, event = {}) { for (const callback of listeners.get(type) || []) callback(event); },
    count(type) { return listeners.get(type)?.size || 0; }
  };
};

function boot({ saved, blockedRead = false, blockedWrite = false, motion = false, transparency = false, pointer = false, readyState = 'loading', dialog = true } = {}) {
  const storage = new Map([[PAYROLL_KEY, payroll]]);
  if (saved !== undefined) storage.set(KEY, saved);
  const reads = [];
  const writes = [];
  const controls = ['normal', 'fine', 'dynamic'].map(value => ({ value, checked: false }));
  const notice = { textContent: '' };
  const content = {};
  const document = Object.assign(eventTarget(), {
    documentElement: { dataset: {} }, hidden: false, readyState,
    querySelectorAll(selector) {
      return selector === 'input[name="salarymate-glass"]' ? controls : selector === '[data-glass-notice]' ? [notice] : [];
    },
    querySelector(selector) { return dialog && selector === '#dialogContent' ? content : null; }
  });
  const media = Object.fromEntries([
    ['(prefers-reduced-motion: reduce)', motion],
    ['(prefers-reduced-transparency: reduce)', transparency],
    ['(hover: hover) and (pointer: fine)', pointer]
  ].map(([query, matches]) => [query, Object.assign(eventTarget(), { matches })]));
  const window = Object.assign(eventTarget(), { matchMedia: query => media[query] });
  const frames = new Map();
  let frameId = 0;
  const observers = [];
  const localStorage = {
    getItem(key) { reads.push(key); if (blockedRead) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blockedWrite) throw new Error('Quota reached'); writes.push([key, value]); storage.set(key, String(value)); },
    removeItem() { throw new Error('Appearance must never remove any data'); },
    clear() { throw new Error('Appearance must never clear data'); }
  };
  const context = vm.createContext({
    window, document, localStorage,
    console, URLSearchParams, history: {}, setTimeout: () => 1, clearTimeout() {},
    FormData: class { constructor(form) { this.form=form; } get(key) { return this.form._data?.[key] ?? null; } },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(element, options) { observers.push({ element, options, callback: this.callback }); }
    }
  });
  vm.runInContext(source, context, { filename: 'glass.js' });
  vm.runInContext(fs.readFileSync(new URL('../dist/reconcile.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../dist/copy-month.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../dist/comp-time.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../dist/annual-analysis.js', import.meta.url), 'utf8'), context);
  return {
    window, document, storage, reads, writes, controls, notice, frames, observers, content, localStorage,
    loadApplication() { vm.runInContext(fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8'), context, { filename: 'app.js' }); },
    root: document.documentElement.dataset,
    html: () => window.SalaryMateGlass.settingsHtml(),
    select(value) { document.dispatch('change', { target: { value, matches: selector => selector === 'input[name="salarymate-glass"]' } }); },
    media(query, matches) { media[query].matches = matches; media[query].dispatch('change'); },
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
    unchangedPayroll() { assert.equal(storage.get(PAYROLL_KEY), payroll); assert(reads.every(key => key === KEY)); assert(writes.every(([key]) => key === KEY)); }
  };
}

test('default is fine; all three native radio choices are labelled', () => {
  const runtime = boot();
  assert.equal(runtime.root.glassMode, 'fine');
  assert.equal(runtime.writes.length, 0);
  assert.equal((runtime.html().match(/type="radio"/g) || []).length, 3);
  for (const label of ['一般', '精細', '高動態']) assert(runtime.html().includes(label));
  assert(runtime.html().includes('aria-describedby="glassNotice"'));
  assert.deepEqual(runtime.controls.map(input => input.checked), [false, true, false]);
  runtime.unchangedPayroll();
});

test('each mode switches immediately and survives a new page session', () => {
  const runtime = boot();
  for (const mode of ['normal', 'dynamic', 'fine']) {
    runtime.select(mode);
    assert.equal(runtime.root.glassMode, mode);
    assert.equal(runtime.root.glassChoice, mode);
    assert.equal(runtime.storage.get(KEY), mode);
    assert.equal(boot({ saved: runtime.storage.get(KEY) }).root.glassMode, mode);
  }
  assert.equal(runtime.writes.length, 3);
  runtime.unchangedPayroll();
});

test('untrusted or obsolete stored values fall back without rewriting data', () => {
  for (const saved of ['', 'unknown', '__proto__', 'constructor', '<script>alert(1)</script>']) {
    const runtime = boot({ saved });
    assert.equal(runtime.root.glassMode, 'fine');
    assert.equal(runtime.writes.length, 0);
    assert(!runtime.html().includes(saved === '' ? 'undefined' : saved));
    runtime.unchangedPayroll();
  }
});

test('invalid values and unrelated form changes are ignored', () => {
  const runtime = boot();
  runtime.select('unexpected');
  runtime.document.dispatch('change', { target: { value: 'dynamic', matches: () => false } });
  assert.equal(runtime.root.glassMode, 'fine');
  assert.equal(runtime.writes.length, 0);
});

test('unavailable storage and failed writes do not crash or imply persistence', () => {
  const runtime = boot({ blockedRead: true, blockedWrite: true });
  assert.equal(runtime.root.glassMode, 'fine');
  runtime.select('dynamic');
  assert.equal(runtime.root.glassMode, 'dynamic');
  assert(runtime.notice.textContent.includes('無法儲存偏好'));
  assert.equal(runtime.storage.has(KEY), false);
  runtime.unchangedPayroll();
});

test('reduced motion overrides effects but preserves the chosen preference', () => {
  const runtime = boot({ saved: 'dynamic', motion: true, pointer: true });
  assert.equal(runtime.root.glassMode, 'normal');
  assert.equal(runtime.root.glassChoice, 'dynamic');
  assert.equal(runtime.document.count('pointermove'), 0);
  assert(runtime.notice.textContent.includes('減少動態效果'));
  runtime.select('dynamic');
  assert.equal(runtime.storage.get(KEY), 'dynamic');
  assert.equal(runtime.root.glassMode, 'normal');
  runtime.media('(prefers-reduced-motion: reduce)', false);
  assert.equal(runtime.root.glassMode, 'dynamic');
  assert.equal(runtime.document.count('pointermove'), 1);
  runtime.media('(prefers-reduced-motion: reduce)', true);
  assert.equal(runtime.document.count('pointermove'), 0);
  runtime.unchangedPayroll();
});

test('reduced transparency disables pointer glints and is explained', () => {
  const runtime = boot({ saved: 'dynamic', transparency: true, pointer: true });
  assert.equal(runtime.root.glassOpaque, 'true');
  assert.equal(runtime.document.count('pointermove'), 0);
  assert(runtime.notice.textContent.includes('減少透明度'));
  runtime.media('(prefers-reduced-transparency: reduce)', false);
  assert.equal(runtime.root.glassOpaque, 'false');
  assert.equal(runtime.document.count('pointermove'), 1);
});

test('pointer listener exists only for active high motion on a fine pointer', () => {
  const runtime = boot({ saved: 'dynamic' });
  assert.equal(runtime.document.count('pointermove'), 0);
  runtime.media('(hover: hover) and (pointer: fine)', true);
  assert.equal(runtime.document.count('pointermove'), 1);
  runtime.document.hidden = true;
  runtime.document.dispatch('visibilitychange');
  assert.equal(runtime.root.glassPaused, 'true');
  assert.equal(runtime.document.count('pointermove'), 0);
  runtime.document.hidden = false;
  runtime.document.dispatch('visibilitychange');
  assert.equal(runtime.document.count('pointermove'), 1);
  runtime.select('fine');
  assert.equal(runtime.document.count('pointermove'), 0);
});

const fakeCard = () => {
  const properties = new Map();
  return {
    isConnected: true, properties,
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) }
  };
};
const move = (runtime, card, x = 70, pointerType = 'mouse') => runtime.document.dispatch('pointermove', {
  target: { closest: () => card }, clientX: x, clientY: 80, pointerType
});

test('pointer work is frame-throttled and cleared when leaving or changing modes', () => {
  const runtime = boot({ saved: 'dynamic', pointer: true });
  const card = fakeCard();
  move(runtime, card, 70, 'touch');
  assert.equal(runtime.frames.size, 0);
  move(runtime, card);
  move(runtime, card, 90);
  assert.equal(runtime.frames.size, 1);
  runtime.flush();
  assert.equal(card.properties.get('--glass-x'), '80px');
  assert.equal(card.properties.get('--glass-y'), '60px');
  move(runtime, null);
  assert.equal(card.properties.size, 0);
  move(runtime, card);
  runtime.flush();
  runtime.window.dispatch('blur');
  assert.equal(card.properties.size, 0);
  move(runtime, card);
  runtime.select('normal');
  assert.equal(runtime.frames.size, 0);
  assert.equal(card.properties.size, 0);
});

test('switching spotlight cards removes stale highlights', () => {
  const runtime = boot({ saved: 'dynamic', pointer: true });
  const first = fakeCard();
  const second = fakeCard();
  move(runtime, first); runtime.flush();
  move(runtime, second); runtime.flush();
  assert.equal(first.properties.size, 0);
  assert.equal(second.properties.size, 2);
  runtime.document.hidden = true;
  runtime.document.dispatch('visibilitychange');
  assert.equal(second.properties.size, 0);
});

test('touch creates one local wave; rapid taps and mode changes clean it up', () => {
  const runtime = boot({ saved: 'dynamic', pointer: false });
  const children = new Set();
  const target = {
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    closest: () => null,
    appendChild: wave => children.add(wave)
  };
  runtime.document.createElement = () => ({
    style: {}, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    remove() { children.delete(this); }
  });
  const event = { button: 0, pointerType: 'touch', clientX: 40, clientY: 65, target: { closest: () => target } };
  assert.equal(runtime.document.count('pointermove'), 0);
  assert.equal(runtime.document.count('pointerdown'), 1);
  runtime.document.dispatch('pointerdown', event);
  assert.equal(children.size, 1);
  const wave = [...children][0];
  assert.equal(wave.style.left, '30px');
  assert.equal(wave.style.top, '45px');
  assert.equal(wave.attributes['aria-hidden'], 'true');
  runtime.document.dispatch('pointerdown', event);
  assert.equal(children.size, 1);
  assert(!children.has(wave));
  runtime.select('fine');
  assert.equal(children.size, 0);
  assert.equal(runtime.document.count('pointerdown'), 0);
  runtime.unchangedPayroll();
});

test('tap feedback respects system preferences, visibility and protected controls', () => {
  for (const options of [{ motion: true }, { transparency: true }]) {
    const runtime = boot({ saved: 'dynamic', ...options });
    assert.equal(runtime.document.count('pointerdown'), 0);
  }
  const runtime = boot({ saved: 'dynamic' });
  runtime.document.createElement = () => { throw new Error('No wave should be created'); };
  for (const target of [{ disabled: true }, { closest: () => ({ id: 'securityCover' }) }]) {
    runtime.document.dispatch('pointerdown', { button: 0, target: { closest: () => target } });
  }
  runtime.document.hidden = true;
  runtime.document.dispatch('visibilitychange');
  assert.equal(runtime.document.count('pointerdown'), 0);
  runtime.unchangedPayroll();
});

test('cross-tab updates sync only the appearance key; clear returns to default', () => {
  const runtime = boot();
  runtime.window.dispatch('storage', { key: KEY, newValue: 'dynamic' });
  assert.equal(runtime.root.glassMode, 'dynamic');
  assert.deepEqual(runtime.controls.map(input => input.checked), [false, false, true]);
  runtime.window.dispatch('storage', { key: PAYROLL_KEY, newValue: 'normal' });
  assert.equal(runtime.root.glassMode, 'dynamic');
  runtime.window.dispatch('storage', { key: null, newValue: null });
  assert.equal(runtime.root.glassMode, 'fine');
  assert.equal(runtime.writes.length, 0);
  runtime.unchangedPayroll();
});

test('settings sync when the existing dialog renders; observer scope is local', () => {
  const runtime = boot({ saved: 'normal' });
  assert.equal(runtime.observers.length, 0);
  runtime.document.dispatch('DOMContentLoaded');
  assert.equal(runtime.observers.length, 1);
  assert.equal(runtime.observers[0].element, runtime.content);
  assert.equal(runtime.observers[0].options.childList, true);
  runtime.controls.forEach(input => { input.checked = false; });
  runtime.notice.textContent = '';
  runtime.observers[0].callback();
  assert.deepEqual(runtime.controls.map(input => input.checked), [true, false, false]);
  assert(runtime.notice.textContent.includes('不影響薪資資料'));
  const loaded = boot({ readyState: 'complete' });
  assert.equal(loaded.observers.length, 1);
  const missing = boot({ readyState: 'complete', dialog: false });
  assert.equal(missing.observers.length, 0);
});

test('actual app settings include glass controls; switching leaves loaded payroll untouched', () => {
  const runtime = boot();
  const element = id => Object.assign(eventTarget(), {
    id, value: '', innerHTML: '', hidden: false, open: false, dataset: {}, style: { setProperty() {} },
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    showModal() { this.open = true; }, close() { this.open = false; }, focus() {},
    getBoundingClientRect: () => ({ height: 72 }), appendChild() {}
  });
  const elements = new Map(['toast', 'companyFilter', 'yearFilter', 'mainContent', 'dataMenuButton', 'dataMenu', 'jsonImport', 'appDialog', 'dialogContent'].map(id => [id, element(id)]));
  runtime.document.body = element('body');
  runtime.document.querySelector = selector => /^#[\w-]+$/.test(selector) ? elements.get(selector.slice(1)) || null : null;
  runtime.document.getElementById = id => elements.get(id) || null;
  runtime.document.createElement = () => element('');
  runtime.window.SalaryMateStorage = runtime.localStorage;
  runtime.window.location = { search: '', pathname: '/' };
  runtime.window.innerWidth = 390;
  runtime.window.scrollTo = () => {};
  runtime.loadApplication();
  const before = JSON.parse(runtime.window.SalaryMateData.exportPayload());
  assert.equal(before.records.length, 1);
  assert.equal(before.records[0].baseSalary, 47000);
  const originalStored = runtime.storage.get(PAYROLL_KEY);
  const action = Object.assign(element(''), { dataset: { action: 'open-interface-settings' } });
  runtime.document.dispatch('click', { target: { closest: selector => selector === '[data-action]' ? action : null }, stopPropagation() {} });
  assert.equal(elements.get('appDialog').open, true);
  const settings = elements.get('dialogContent').innerHTML;
  for (const text of ['動態玻璃', '一般', '精細', '高動態', '清爽卡片', '高效緊湊', '介面配色']) assert(settings.includes(text));
  for (const mode of ['dynamic', 'normal', 'fine']) {
    const radio = Object.assign(element('glass-test'), { name: 'salarymate-glass', value: mode, matches: selector => selector === 'input[name="salarymate-glass"]' });
    runtime.document.dispatch('change', { target: radio });
    assert.equal(runtime.root.glassMode, mode);
    assert.equal(runtime.storage.get(PAYROLL_KEY), originalStored);
  }
  const after = JSON.parse(runtime.window.SalaryMateData.exportPayload());
  delete before.exportInfo;
  delete after.exportInfo;
  assert.deepEqual(after, before);
  const reconcileAction = Object.assign(element(''), {dataset:{action:'reconcile-record',id:before.records[0].id}});
  runtime.document.dispatch('click', {target:{closest:selector=>selector==='[data-action]'?reconcileAction:null},stopPropagation(){}});
  const reconciliation = elements.get('dialogContent').innerHTML;
  for (const text of ['月結核對','reconciliationForm','公司金額','確認核對完成','薪資實領（不含副業）']) assert(reconciliation.includes(text));
  assert.equal(runtime.storage.get(PAYROLL_KEY),originalStored,'opening reconciliation must not write payroll');
  const copyAction = Object.assign(element(''), {dataset:{action:'duplicate-record'}});
  runtime.document.dispatch('click', {target:{closest:selector=>selector==='[data-action]'?copyAction:null},stopPropagation(){}});
  const preview=elements.get('dialogContent').innerHTML;
  assert(preview.includes('copyMonthForm'));
  assert(preview.includes('套用到新增表單'));
  assert(preview.includes('上月'));
  assert.equal(runtime.storage.get(PAYROLL_KEY),originalStored,'preview must not persist');
  elements.set('copyMonthForm',Object.assign(element('copyMonthForm'),{reportValidity:()=>true}));
  runtime.document.dispatch('submit',{target:{id:'copyMonthForm'},preventDefault(){}});
  const copyForm=elements.get('dialogContent').innerHTML;
  assert(copyForm.includes('data-payroll-step="2"'),'copy must enter new-record workflow');
  assert(copyForm.includes('47000'));
  assert.equal(runtime.storage.get(PAYROLL_KEY),originalStored,'apply must not persist before final save');
  const creditAction=Object.assign(element(''),{dataset:{action:'credit-comp-time',id:'fixture-ot'}});
  runtime.document.dispatch('click',{target:{closest:selector=>selector==='[data-action]'?creditAction:null},stopPropagation(){}});
  assert(elements.get('dialogContent').innerHTML.includes('compCreditForm'));
  assert.equal(runtime.storage.get(PAYROLL_KEY),originalStored,'opening credit must not write');
  elements.set('compCreditForm',Object.assign(element('compCreditForm'),{reportValidity:()=>true,_data:{hours:'1',expiresAt:'2027-09-15',note:'測試'}}));
  runtime.document.dispatch('submit',{target:{id:'compCreditForm'},preventDefault(){}});
  const updated=JSON.parse(runtime.storage.get(PAYROLL_KEY));
  assert.equal(updated.compTimeCredits.length,1);
  assert.equal(updated.compTimeCredits[0].sourceId,'fixture-ot');
  assert.equal(updated.records[0].baseSalary,47000,'converting leave must not rewrite salary');
  assert.equal(JSON.parse(runtime.window.SalaryMateData.exportPayload()).compTimeCredits.length,1,'backup includes credit');
  const settlementAction=Object.assign(element(''),{dataset:{action:'settle-comp-time',id:updated.compTimeCredits[0].id}});
  runtime.document.dispatch('click',{target:{closest:selector=>selector==='[data-action]'?settlementAction:null},stopPropagation(){}});
  assert(elements.get('dialogContent').innerHTML.includes('compSettlementForm'));
  const prior=runtime.storage.get(PAYROLL_KEY);
  elements.set('compSettlementForm',Object.assign(element('compSettlementForm'),{reportValidity:()=>true,_data:{date:'2026-09-20',hours:'1',amount:'300',note:'已核對'}}));
  runtime.document.dispatch('submit',{target:{id:'compSettlementForm'},preventDefault(){}});
  const settled=JSON.parse(runtime.storage.get(PAYROLL_KEY));
  assert.notEqual(runtime.storage.get(PAYROLL_KEY),prior);
  assert.equal(settled.compTimeSettlements[0].creditId,updated.compTimeCredits[0].id);
  assert.equal(settled.compTimeSettlements[0].amount,300);
  assert.equal(JSON.parse(runtime.window.SalaryMateData.exportPayload()).compTimeSettlements.length,1);
  const savedState=runtime.storage.get(PAYROLL_KEY);
  runtime.document.dispatch('change',{target:{id:'annualThroughMonth',value:'9',closest:()=>null}});
  const annualAction=Object.assign(element(''),{dataset:{action:'preview-annual-report'}});
  runtime.document.dispatch('click',{target:{closest:selector=>selector==='[data-action]'?annualAction:null},stopPropagation(){}});
  const report=elements.get('dialogContent').innerHTML;
  for(const label of ['整合報表','1～9 月','共同月份','主業實領','補休結算金額','47,000'])assert(report.includes(label));
  assert.equal(runtime.storage.get(PAYROLL_KEY),savedState,'annual analysis and report preview must not persist or mutate data');
});
