import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto, pbkdf2Sync, createCipheriv } from 'node:crypto';

// Synthetic data and native Node cryptography; no browser, emulator or user backup.
const root = new URL('../', import.meta.url);
const source = name => fs.readFileSync(new URL(name, root), 'utf8');
const adapter = source('scripts/lib/android-legacy-backup.js');
const originalBackup = source('dist/dev/v5.0.0-dev.2/backup.js');
const plain = value => JSON.parse(JSON.stringify(value));
function context(crypto = webcrypto) {
  const value = vm.createContext({ crypto, TextEncoder, TextDecoder, Uint8Array, atob, btoa });
  value.window = value;
  return value;
}
function harness({ before = true, crypto } = {}) {
  const raw = context();
  vm.runInContext(originalBackup, raw);
  const runtime = context(crypto);
  if (before) vm.runInContext(adapter, runtime);
  runtime.SalaryMateBackup = raw.SalaryMateBackup;
  if (!before) vm.runInContext(adapter, runtime);
  return { runtime, api: runtime.SalaryMateBackup, original: raw.SalaryMateBackup };
}
function nativeBackup(value, password = 'Fixture password 123', options = {}) {
  const salt = Buffer.alloc(16, 19), iv = Buffer.alloc(12, 23);
  const iterations = options.iterations ?? 310000;
  const key = pbkdf2Sync(password.normalize('NFC'), salt, iterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(options.aad ?? 'SalaryMate|encrypted-backup|v1'));
  const encoded = options.bytes ?? Buffer.from(JSON.stringify(value), 'utf8');
  const payload = Buffer.concat([cipher.update(encoded), cipher.final(), cipher.getAuthTag()]);
  return {
    format: 'salarymate-encrypted-backup', version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: salt.toString('base64') },
    cipher: { name: 'AES-GCM', iv: iv.toString('base64'), tagLength: 128 },
    payload: payload.toString('base64')
  };
}
const fixture = () => ({
  schemaVersion: 13, appVersion: '4.3.2',
  companies: [{ id: 'fixture-company', name: 'Synthetic company', employmentMode: 'monthly',
    baseSalary: 24000, mealAllowance: 3000, positionAllowance: 0,
    fixedEarnings: [{ id: 'fixture-earning', name: 'Synthetic allowance', amount: 100, affectsHourly: true }],
    employmentStartDate: '2020-01-01', workHoursPerDay: 8,
    leavePolicies: { sick: { mode: 'custom', quotaDays: 20 } } }],
  records: [{ id: 'fixture-record', companyId: 'fixture-company', year: 2026, month: 10,
    payDate: '2026-10-05', baseSalary: 24000, mealAllowance: 3000, overtime: 134, sideIncome: 123,
    customEarnings: [], customDeductions: [], note: 'Synthetic record' }],
  overtimeLogs: [{ id: 'fixture-overtime', companyId: 'fixture-company', date: '2026-10-01',
    type: 'weekday', hours: 1, hourlyRate: 100, customRate: 1.34 }],
  leaveRecords: [{ id: 'fixture-leave', companyId: 'fixture-company', date: '2026-10-02',
    type: 'sick', durationMode: 'hours', unit: 'hour', customHours: 2, quantity: 2, paidRatio: 50 }],
  salaryAdjustments: [], yearEndEstimates: [], uiPreferences: { interfaceStyle: 'pixel' }
});

test('Android adapter preserves all existing exports and flat R99 encryption/decryption', async () => {
  for (const before of [true, false]) {
    const h = harness({ before });
    assert.equal(h.api.encrypt, h.original.encrypt);
    assert.equal(h.api.merge, h.original.merge);
    assert.equal(h.api.isEncrypted, h.original.isEncrypted);
    assert.ok(Object.isFrozen(h.api));
    const value = fixture(), encrypted = await h.api.encrypt(value, 'Fixture password 123');
    assert.equal(encrypted.iterations, 600000);
    assert.equal(encrypted.cipher, 'AES-256-GCM');
    assert.deepEqual(plain(await h.api.decrypt(encrypted, 'Fixture password 123')), value);
    assert.deepEqual(plain(await h.original.decrypt(encrypted, 'Fixture password 123')), value);
    h.runtime.SalaryMateBackup = h.api;
    assert.equal(h.runtime.SalaryMateBackup, h.api, 'reassignment does not wrap twice');
  }
});

test('Android legacy nested envelope decodes independently generated native-compatible ciphertext', async () => {
  const h = harness(), value = fixture(), encrypted = nativeBackup(value);
  assert.equal(h.api.isEncrypted(encrypted), true);
  await assert.rejects(h.original.decrypt(encrypted, 'Fixture password 123'), /不支援/);
  assert.deepEqual(plain(await h.api.decrypt(encrypted, 'Fixture password 123')), value);
  assert.equal(encrypted.kdf.iterations, 310000);
});

test('Android legacy password uses NFC without trimming and retains the native iteration range', async () => {
  const h = harness(), value = fixture(), password = '  cafe\u0301 fixture 123  ';
  for (const iterations of [100000, 1000000]) {
    const encrypted = nativeBackup(value, password, { iterations });
    assert.deepEqual(plain(await h.api.decrypt(encrypted, password.normalize('NFC'))), value);
  }
  await assert.rejects(h.api.decrypt(nativeBackup(value, password), password.trim()), /密碼不正確/);
});

test('Android legacy wrong password, tamper, wrong AAD and invalid UTF-8 are rejected', async () => {
  const h = harness(), value = fixture(), encrypted = nativeBackup(value);
  await assert.rejects(h.api.decrypt(encrypted, 'Wrong password'), /密碼不正確/);
  const altered = plain(encrypted), bytes = Buffer.from(altered.payload, 'base64');
  bytes[0] ^= 1; altered.payload = bytes.toString('base64');
  await assert.rejects(h.api.decrypt(altered, 'Fixture password 123'), /已損毀/);
  await assert.rejects(h.api.decrypt(nativeBackup(value, undefined, { aad: 'salarymate-encrypted-backup:1' }), 'Fixture password 123'), /已損毀/);
  await assert.rejects(h.api.decrypt(nativeBackup(value, undefined, { bytes: Buffer.from([255, 254]) }), 'Fixture password 123'), /已損毀/);
});

test('Android legacy validates parameters and encoded size before any expensive derivation', async () => {
  let calls = 0;
  const crypto = { subtle: { importKey() { calls++; throw new Error('Unexpected derivation'); } } };
  const h = harness({ crypto }), baseline = nativeBackup(fixture());
  const mutations = [
    value => { value.version = 2; },
    value => { value.kdf.iterations = 99999; },
    value => { value.kdf.iterations = 1000001; },
    value => { value.kdf.iterations = '310000'; },
    value => { value.kdf.hash = 'SHA-1'; },
    value => { value.cipher.tagLength = 96; },
    value => { value.kdf.salt = Buffer.alloc(15).toString('base64'); },
    value => { value.cipher.iv = Buffer.alloc(13).toString('base64'); },
    value => { value.payload = 'bad!'; },
    value => { value.payload = ''; },
    value => { value.payload = Buffer.alloc(16).toString('base64'); },
    value => { value.payload = 'A'.repeat(4 * Math.ceil(28 * 1024 * 1024 / 3) + 4); }
  ];
  for (const mutate of mutations) {
    const value = plain(baseline); mutate(value);
    await assert.rejects(h.api.decrypt(value, 'Fixture password 123'), /格式或大小不正確/);
  }
  assert.equal(calls, 0);
});

test('Android legacy bounds decoded plaintext and rejects unsupported wrappers', async () => {
  const crypto = { subtle: {
    async importKey() { return {}; }, async deriveKey() { return {}; },
    async decrypt() { return new ArrayBuffer(20 * 1024 * 1024 + 1); }
  } };
  const h = harness({ crypto });
  await assert.rejects(h.api.decrypt(nativeBackup(fixture()), 'Fixture password 123'), /已損毀/);
  const normal = harness();
  for (const value of [
    { format: 'unknown-backup', version: 1 },
    { format: 'salarymate-simple-backup', version: 1, payload: 'e30=' },
    { format: 'salarymate-encrypted-backup', version: 2 },
    { format: 'salarymate-encrypted-backup', version: 1, kdf: [], cipher: [] }
  ]) await assert.rejects(normal.api.decrypt(value, 'Fixture password 123'), /不支援/);
});

function importHarness(runtime) {
  const app = source('dist/dev/v5.0.0-dev.2/app.js');
  const declarations = [...app.matchAll(/^    (?:const|let) ([A-Za-z_$][\w$]*)\s*=/gm)];
  const definitions = new Map(declarations.map((match, index) => [match[1], app.slice(match.index, declarations[index + 1]?.index ?? app.length)]));
  for (const file of ['stocks.js', 'reconcile.js', 'comp-time.js']) vm.runInContext(source('dist/dev/v5.0.0-dev.2/' + file), runtime);
  let preview, status;
  Object.assign(runtime, {
    isContextGenerationCurrent: generation => generation === 'fixture-generation',
    setOperationStatus: value => { status = value; },
    showBackupPreview: value => { preview = value; }
  });
  const names = ['APP_VERSION', 'SCHEMA_VERSION', 'DEFAULT_DEDUCTION_RULE', 'LEAVE_TYPES', 'STATUTORY_LEAVE_DAYS',
    'defaultLeavePolicies', 'defaultYearEndGrades', 'INTERFACE_MODES', 'COLOR_THEMES', 'INTERFACE_STYLES',
    'HD2D_BACKGROUNDS', 'AUTUMN_BACKGROUNDS', 'currentYear', 'newId', 'defaultOvertimeCalculator', 'emptyState',
    'numberValue', 'clamp', 'normalizeInterfaceStyle', 'normalizeHd2dBackground', 'normalizeAutumnBackground',
    'normalizeSurfaceOpacity', 'normalizeMotionEffect', 'normalizeInterfaceMode', 'normalizeColorTheme',
    'pad2', 'isoDate', 'todayIso', 'parseDateParts', 'validIsoDate', 'normalizeCustomItems', 'normalizeFixedEarnings',
    'normalizeFixedDeductions', 'normalizeYearEndGrades', 'normalizeLeavePolicies', 'normalizeEmploymentMode',
    'normalizeHourlyRate', 'normalizeRegularHours', 'normalizeCompany', 'normalizeRecord', 'normalizeSalaryAdjustment',
    'normalizeYearEndEstimate', 'normalizeOvertime', 'normalizeLeave', 'normalizeState', 'ensureSupportedSchema',
    'validateBackupCollections', 'acceptBackup'];
  for (const name of names) assert.ok(definitions.has(name), 'Production declaration: ' + name);
  vm.runInContext(names.map(name => definitions.get(name)).join('\n') + '\nglobalThis.acceptImported = acceptBackup;', runtime);
  return { accept: value => runtime.acceptImported(value, 'fixture-generation'),
    preview: () => plain(preview), status: () => status };
}

test('Android native schema13 backup enters original R99 validation/preview and upgrades to schema15', async () => {
  const h = harness(), importPath = importHarness(h.runtime), value = fixture(), initial = JSON.stringify(value);
  const decoded = await h.api.decrypt(nativeBackup(value), 'Fixture password 123');
  await importPath.accept(decoded);
  const result = importPath.preview();
  assert.equal(importPath.status(), 'idle');
  assert.equal(result.schemaVersion, 15);
  assert.equal(result.records[0].baseSalary, 24000);
  assert.equal(result.records[0].overtime, 134);
  assert.equal(result.records[0].sideIncome, 0);
  assert.equal(result.companies[0].fixedEarnings[0].amount, 100);
  assert.equal(result.companies[0].leavePolicies.sick.quotaDays, 20);
  assert.equal(result.leaveRecords[0].paidRatio, 50);
  assert.equal(result.leaveRecords[0].customHours, 2);
  assert.equal(result.overtimeLogs[0].hourlyRate, 100);
  assert.equal(result.uiPreferences.interfaceStyle, 'pixel-luxe');
  assert.deepEqual(result.stockPortfolio.assets, []);
  assert.deepEqual(result.compTimeCredits, []);
  assert.deepEqual(result.compTimeSettlements, []);
  assert.equal(result.investmentRecords.length, 1);
  assert.equal(result.investmentRecords[0].sourceRecordId, 'fixture-record');
  assert.equal(result.investmentRecords[0].amount, 123);
  assert.equal(result.investmentRecords[0].date, '2026-10-01');
  assert.equal(JSON.stringify(value), initial, 'Source fixture is never mutated');
  await importPath.accept(result);
  assert.equal(importPath.preview().investmentRecords.length, 1, 'Legacy income converts only once');
});

test('Android legacy decoding does not bypass original newer-schema/duplicate-ID rejection', async () => {
  const h = harness(), importPath = importHarness(h.runtime);
  for (const [mutate, message] of [
    [value => { value.schemaVersion = 16; }, 'NEWER_SCHEMA'],
    [value => { value.records.push({ ...value.records[0] }); }, 'DUPLICATE_ID'],
    [value => { value.leaveRecords[0].date = '2026-02-30'; }, 'INVALID_DATE']
  ]) {
    const value = fixture(); mutate(value);
    const decoded = await h.api.decrypt(nativeBackup(value), 'Fixture password 123');
    await assert.rejects(importPath.accept(decoded), new RegExp(message));
  }
});
