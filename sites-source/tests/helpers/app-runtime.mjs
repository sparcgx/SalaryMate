import fs from 'node:fs';
import vm from 'node:vm';
export const PAYROLL_KEY = 'salarymate_v310_state';
const events = () => {
  const handlers = new Map();
  return {
    addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(handler); },
    removeEventListener() {},
    dispatch(type, event) { for (const handler of handlers.get(type) || []) handler(event); }
  };
};
export const element = (id = '') => Object.assign(events(), {
  id, value: '', innerHTML: '', textContent: '', dataset: {}, hidden: false, open: false,
  style: { setProperty() {}, removeProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
  setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
  querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, matches() { return false; },
  showModal() { this.open = true; }, close() { this.open = false; }, reportValidity() { return true; },
  focus() {}, appendChild() {}, remove() {}, click() {}, getBoundingClientRect() { return {height: 72}; }
});
export function boot(payload) {
  const storage = new Map(payload === undefined ? [] : [[PAYROLL_KEY, typeof payload === 'string' ? payload : JSON.stringify(payload)]]);
  const controls = { failWrites: false };
  const logs = [], downloads = [], blobs = new Map(); let sequence = 0;
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { if (controls.failWrites) throw new Error('Injected quota failure'); storage.set(key, String(value)); },
    removeItem: key => storage.delete(key)
  };
  const elements = new Map(['toast','companyFilter','yearFilter','mainContent','dataMenuButton','dataMenu','jsonImport','appDialog','dialogContent'].map(id => [id, element(id)]));
  const queries = new Map();
  const document = Object.assign(events(), {
    body: element('body'), documentElement: element('html'), readyState: 'loading', hidden: false,
    querySelector: selector => /^#[\w-]+$/.test(selector) ? elements.get(selector.slice(1)) || null : null,
    querySelectorAll: selector => queries.get(selector) || [],
    getElementById: id => elements.get(id) || null,
    createElement(tag) { const el = element(); if (tag === 'a') el.click = () => downloads.push({filename: el.download, blob: blobs.get(el.href)}); return el; }
  });
  const window = Object.assign(events(), {
    SalaryMateStorage: localStorage, innerWidth: 390, scrollTo() {}, print() {}, confirm: () => true,
    location: {search:'', pathname:'/',hash:''}, matchMedia: () => Object.assign(events(), {matches:false})
  });
  const context = vm.createContext({
    window, document, localStorage, Blob, URL: { createObjectURL(blob) { const id = `blob:${++sequence}`; blobs.set(id, blob); return id; }, revokeObjectURL: id => blobs.delete(id) },
    URLSearchParams, history: {replaceState() {}}, console: {log() {}, warn: (...args) => logs.push(args), error: (...args) => logs.push(args)},
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    MutationObserver: class { observe() {} },
    FormData: class { constructor(form) { this.form = form; } get(key) { return this.form?._data?.[key] ?? null; } }
  });
  for (const name of ['glass.js','reconcile.js','copy-month.js','comp-time.js','annual-analysis.js','app.js']) vm.runInContext(fs.readFileSync(new URL(`../../dist/${name}`, import.meta.url), 'utf8'), context, {filename:name});
  const action = (action, id) => document.dispatch('click', {target:{closest: selector => selector === '[data-action]' ? Object.assign(element(), {dataset:{action,id}}) : null}, stopPropagation() {}});
  const change = (id,value) => document.dispatch('change',{target:Object.assign(element(id),{value})});
  return {window, document, elements, queries, storage, controls, logs, downloads, action, change,
    state: () => JSON.parse(window.SalaryMateData.exportPayload()),
    submit(id, decision) { document.dispatch('submit',{target:elements.get(id),submitter:{value:decision},preventDefault() {}}); },
    tab(tab) { document.dispatch('click',{target:{closest:selector => selector === '[data-tab]' ? {dataset:{tab}} : null},stopPropagation() {}}); }
  };
}
