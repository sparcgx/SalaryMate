export const VERSION = '5.0.0-dev.1';
export const KEY = 'salarymate_v5_worklog';
export const FORMAT = 'salarymate-v5-worklog';
export const LEAVES = ['特休', '事假', '病假', '家庭照顧假', '其他'];
export const STATUSES = ['confirmed', 'planned', 'cancelled'];
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const uid = () => globalThis.crypto.randomUUID();
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '1900-01-01' || v > '2199-12-31') return false;
  return dateKey(new Date(v + 'T12:00:00')) === v;
}
export const initialState = () => ({ schema: 1, companies: [{ id: uid(), name: '我的工作', hourlyRate: null, multiplier: 1.34, quotas: {} }], entries: [] });
function number(v, min, max, label, nullable = false) {
  if (nullable && (v === null || v === '')) return null;
  if (v === '' || v === null || typeof v === 'boolean' || !['number', 'string'].includes(typeof v)) throw new Error(`請填寫${label}。`);
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || Math.abs(round(n) - n) > 1e-8) throw new Error(`${label}須介於 ${min}～${max}，最多兩位小數。`);
  return n;
}
function text(v, max, label) {
  if (typeof v !== 'string' || v.length > max) throw new Error(`${label}格式不正確。`);
  return v.trim();
}
function id(v) {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) throw new Error('資料識別碼不正確。');
  return v;
}
export function normalizeCompany(c) {
  if (!c || typeof c !== 'object') throw new Error('公司資料不正確。');
  const name = text(c.name, 50, '公司名稱');
  if (!name) throw new Error('請填寫公司名稱。');
  if (!c.quotas || typeof c.quotas !== 'object' || Array.isArray(c.quotas)) throw new Error('特休額度資料不正確。');
  const quotas = {};
  for (const [year, hours] of Object.entries(c.quotas)) {
    if (!/^(19|20|21)\d{2}$/.test(year)) throw new Error('特休年度不正確。');
    if (hours !== null && hours !== '') quotas[year] = number(hours, 0, 3000, '特休額度');
  }
  return { id: id(c.id), name, hourlyRate: number(c.hourlyRate, 0, 100000, '試算時薪', true), multiplier: number(c.multiplier, 0, 10, '加班倍率'), quotas };
}
export function normalizeEntry(e) {
  if (!e || typeof e !== 'object' || !['overtime', 'leave'].includes(e.kind) || !STATUSES.includes(e.status) || !validDate(e.date)) throw new Error('紀錄日期、類別或狀態不正確。');
  const result = { id: id(e.id), companyId: id(e.companyId), kind: e.kind, date: e.date, hours: number(e.hours, .01, 24, '時數'), status: e.status, note: text(e.note ?? '', 300, '備註') };
  if (e.kind === 'leave') {
    if (!LEAVES.includes(e.leaveType)) throw new Error('請選擇有效假別。');
    result.leaveType = e.leaveType;
  } else {
    result.hourlyRate = number(e.hourlyRate, 0, 100000, '試算時薪', true);
    result.multiplier = number(e.multiplier, 0, 10, '加班倍率');
  }
  return result;
}
export function validateState(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.companies) || !value.companies.length || value.companies.length > 100 || !Array.isArray(value.entries) || value.entries.length > 30000) throw new Error('這不是可讀取的 v5 備份。v4 備份請保留於原版本。');
  const state = { schema: 1, companies: value.companies.map(normalizeCompany), entries: value.entries.map(normalizeEntry) };
  const companies = new Set(state.companies.map(c => c.id));
  if (companies.size !== state.companies.length) throw new Error('公司識別碼重複。');
  const entries = new Set();
  for (const e of state.entries) {
    if (!companies.has(e.companyId) || entries.has(e.id)) throw new Error('備份包含失去公司關聯或重複的紀錄。');
    entries.add(e.id);
  }
  const daily = new Map();
  for (const e of state.entries.filter(e => e.status !== 'cancelled')) {
    const k = e.companyId + ':' + e.date;
    daily.set(k, round((daily.get(k) || 0) + e.hours));
    if (daily.get(k) > 24) throw new Error(`${e.date} 的加班與請假合計超過 24 小時。`);
  }
  for (const c of state.companies) {
    for (const y of Object.keys(c.quotas)) {
      if (leaveBalance(state, c.id, y).available < -0.001) throw new Error(`${c.name} ${y} 年的特休紀錄超過設定額度。`);
    }
  }
  return state;
}
export function leaveBalance(state, companyId, year, today = dateKey()) {
  const company = state.companies.find(c => c.id === companyId);
  const quota = company?.quotas[String(year)] ?? null;
  let used = 0, booked = 0;
  for (const e of state.entries) {
    if (e.companyId !== companyId || e.kind !== 'leave' || e.leaveType !== '特休' || e.date.slice(0, 4) !== String(year) || e.status === 'cancelled') continue;
    if (e.status === 'confirmed' && e.date <= today) used += e.hours;
    else booked += e.hours;
  }
  return { quota, used: round(used), booked: round(booked), available: quota === null ? null : round(quota - used - booked) };
}
export function monthSummary(state, companyId, month) {
  const entries = state.entries.filter(e => e.companyId === companyId && e.date.startsWith(month) && e.status !== 'cancelled');
  const overtime = entries.filter(e => e.kind === 'overtime' && e.status === 'confirmed');
  return { hours: round(overtime.reduce((sum, e) => sum + e.hours, 0)), amount: round(overtime.reduce((sum, e) => sum + (e.hourlyRate === null ? 0 : round(e.hours * e.hourlyRate * e.multiplier)), 0)), unpriced: overtime.filter(e => e.hourlyRate === null).length, leaveHours: round(entries.filter(e => e.kind === 'leave' && e.status === 'confirmed').reduce((sum, e) => sum + e.hours, 0)), plannedHours: round(entries.filter(e => e.kind === 'overtime' && e.status === 'planned').reduce((sum, e) => sum + e.hours, 0)) };
}
export function putEntry(state, entry) {
  const e = normalizeEntry(entry);
  const index = state.entries.findIndex(x => x.id === e.id);
  if (index >= 0 && state.entries[index].companyId !== e.companyId) throw new Error('不能將紀錄移到其他公司。');
  const next = structuredClone(state);
  if (index < 0) next.entries.push(e); else next.entries[index] = e;
  return validateState(next);
}
export function putCompany(state, company) {
  const c = normalizeCompany(company), next = structuredClone(state);
  const index = next.companies.findIndex(x => x.id === c.id);
  if (index < 0) next.companies.push(c); else next.companies[index] = c;
  return validateState(next);
}
export function calendarDates(month) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(month + '-01')) throw new Error('月份不正確。');
  const first = new Date(month + '-01T12:00:00');
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => dateKey(new Date(first.getFullYear(), first.getMonth(), i - offset + 1, 12)));
}
export function parseBackup(raw) {
  if (typeof raw !== 'string' || raw.length > 10 * 1024 * 1024) throw new Error('備份檔過大或格式不正確。');
  let body; try { body = JSON.parse(raw); } catch { throw new Error('檔案不是有效的 JSON 備份。'); }
  if (body.format !== FORMAT) throw new Error('請選擇 SalaryMate v5 匯出的備份；此版本不直接匯入 v4 資料。');
  return validateState(body.data);
}
export function backup(state) {
  return JSON.stringify({ format: FORMAT, appVersion: VERSION, exportedAt: new Date().toISOString(), data: validateState(state) }, null, 2);
}
export class LocalStore {
  constructor(storage) { this.storage = storage; this.raw = null; this.blocked = false; }
  load() {
    try {
      this.raw = this.storage.getItem(KEY);
      if (this.raw === null) return initialState();
      return validateState(JSON.parse(this.raw));
    } catch (error) { this.blocked = true; throw new Error('無法讀取本機資料，已停止寫入。請先下載原始資料，勿清除瀏覽器資料。'); }
  }
  save(value) {
    if (this.blocked) throw new Error('本機資料尚未恢復，無法儲存。');
    const next = validateState(value), raw = JSON.stringify(next);
    if (this.storage.getItem(KEY) !== this.raw) throw new Error('另一分頁已更新資料。請先保留目前輸入，重新整理後再修改。');
    try { this.storage.setItem(KEY, raw); } catch { throw new Error('儲存失敗，請先匯出備份並確認瀏覽器儲存空間；目前輸入仍保留。'); }
    this.raw = raw;
    return next;
  }
}
