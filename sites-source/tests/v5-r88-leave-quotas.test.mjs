import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the production leave functions in native JavaScript only. This fixture
// has no document, browser, DOM emulator, storage, timers, or network.
const source = fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js', import.meta.url), 'utf8');
const declarations = [...source.matchAll(/^    (?:const|let) ([A-Za-z_$][\w$]*)\s*=/gm)];
const sourceByName = new Map(declarations.map((match, index) => [match[1],
  source.slice(match.index, declarations[index + 1]?.index ?? source.length)]));
const clone = value => JSON.parse(JSON.stringify(value));

function fixture() {
  const state = { companies: [], leaveRecords: [] };
  const forms = new Map();
  const context = {
    state,
    ui: { selectedYear: 2026, leaveMonth: 0, companyDraft: null, leaveSettingsDraft: null },
    currentYear: 2026,
    calculationCache: { leaveMembership: new Map(), leaveEntries: new Map() },
    todayIso: () => '2026-10-09',
    newId: prefix => `${prefix}-fixture`,
    $: selector => forms.get(selector) ?? null,
    FormData: class NativeFormValues {
      constructor(form) { this.values = form.values; }
      has(name) { return this.values.has(name); }
      get(name) { return this.values.get(name) ?? null; }
    },
    commitStateMutation: mutate => { mutate(); return true; },
    closeDialog() {}, renderAll() {}, toast() {},
    window: {
      SalaryMateCompTime: { normalizeLeaveLink: value => value === true || value === 'true' },
      SalaryMateI18n: { user: value => value }
    },
    console, Date, Intl, Map, Set
  };
  vm.createContext(context);
  const loaded = new Set(), visiting = new Set();
  function load(name) {
    if (loaded.has(name) || Object.hasOwn(context, name)) return;
    const declaration = sourceByName.get(name);
    assert.ok(declaration, `Production declaration ${name} must exist`);
    if (visiting.has(name)) return;
    visiting.add(name);
    for (const dependency of new Set(declaration.match(/[A-Za-z_$][\w$]*/g))) {
      if (dependency !== name && sourceByName.has(dependency)) load(dependency);
    }
    vm.runInContext(declaration, context, { filename: `app.js:${name}` });
    loaded.add(name);
    visiting.delete(name);
  }
  const names = ['normalizeCompany', 'normalizeLeave', 'normalizeLeavePolicies', 'leaveQuotaSummary', 'leaveQuotaCapacity',
    'readLeavePoliciesFromForm', 'collectLeaveSettingsDraft', 'collectCompanyDraft', 'persistLeave', 'leaveQuotaRows',
    'renderLeaveQuotaPanel', 'leaveMarriageFieldsHtml'];
  for (const name of names) load(name);
  vm.runInContext(`globalThis.functions = {${names.join(',')}};`, context);
  const f = context.functions;
  function clearCache() {
    context.calculationCache.leaveMembership.clear();
    context.calculationCache.leaveEntries.clear();
  }
  function company(overrides = {}) {
    const result = f.normalizeCompany({ id: 'company-a', name: 'Fixture Company', isCurrent: true,
      employmentStartDate: '2020-05-15', workHoursPerDay: 8, ...overrides });
    state.companies.push(result);
    return result;
  }
  function leave(overrides = {}, stored = true) {
    const result = f.normalizeLeave({ id: `leave-${state.leaveRecords.length + 1}`,
      companyId: 'company-a', startDate: '2026-10-09', endDate: '2026-10-09',
      type: 'personal', durationMode: 'hours', customHours: 8, status: 'confirmed',
      ...overrides });
    if (stored) { state.leaveRecords.push(result); clearCache(); }
    return result;
  }
  return { ...f, state, company, leave, clearCache, context,
    form(selector, values) { forms.set(selector, { values: new Map(Object.entries(values)) }); } };
}

const hasViolation = capacity => capacity?.configured === false ||
  (Array.isArray(capacity?.violations) ? capacity.violations.length > 0 :
    Boolean(capacity?.limited && capacity.available !== null && capacity.requested > capacity.available));

test('missing policies acquire statutory day defaults using company work hours', () => {
  const f = fixture(), company = f.company({ workHoursPerDay: 6 });
  assert.equal(f.leaveQuotaSummary(company, 'sick', '2026-10-09').entitlement, 30);
  assert.equal(f.leaveQuotaSummary(company, 'personal', '2026-10-09').entitlement, 14);
  assert.equal(f.leaveQuotaSummary(company, 'family', '2026-10-09').entitlement, 7);
  const draft = f.leave({ customHours: 6 }, false);
  assert.equal(f.leaveQuotaCapacity(draft).requested, 1);
});

test('explicit legacy custom and unlimited policies remain unchanged after normalization', () => {
  const f = fixture();
  const policies = {
    sick: { mode: 'custom', quotaDays: 45.5 },
    personal: { mode: 'unlimited', quotaDays: 0 },
    family: { mode: 'custom', quotaDays: 9 },
    marriage: { mode: 'unlimited', quotaDays: 0 }
  };
  const before = clone(policies), normalized = f.normalizeLeavePolicies(policies);
  for (const [type, policy] of Object.entries(policies)) {
    assert.equal(normalized[type].mode, policy.mode, type);
    assert.equal(normalized[type].quotaDays, policy.quotaDays, type);
  }
  assert.deepEqual(policies, before, 'normalization cannot mutate imported backup objects');
  const company = f.company({ leavePolicies: policies });
  assert.equal(f.leaveQuotaSummary(company, 'sick', '2026-10-09').entitlement, 45.5);
  assert.equal(f.leaveQuotaSummary(company, 'personal', '2026-10-09').limited, false);
});

test('personal and family use one pool, while family retains its own seven-day balance', () => {
  const f = fixture(), company = f.company();
  f.leave({ id: 'personal-used', type: 'personal', durationMode: 'full_day', quantity: 3 });
  f.leave({ id: 'family-used', type: 'family', durationMode: 'full_day', quantity: 2 });
  f.leave({ id: 'family-planned', type: 'family', status: 'planned' });
  const personal = f.leaveQuotaSummary(company, 'personal', '2026-10-09');
  const family = f.leaveQuotaSummary(company, 'family', '2026-10-09');
  assert.equal(personal.used, 5);
  assert.equal(personal.reserved, 1);
  assert.equal(personal.remaining, 8);
  assert.equal(family.used, 2);
  assert.equal(family.reserved, 1);
  assert.equal(family.remaining, 4);
});

test('a family request cannot exceed the personal/family shared pool', () => {
  const f = fixture(); f.company();
  f.leave({ id: 'personal-used', type: 'personal', durationMode: 'full_day', quantity: 13 });
  const draft = f.leave({ id: 'family-new', type: 'family', durationMode: 'full_day', quantity: 2 }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true);
});

test('a family request cannot exceed its seven-day sublimit even with shared hours left', () => {
  const f = fixture(); f.company();
  f.leave({ id: 'family-used', type: 'family', durationMode: 'full_day', quantity: 6 });
  const draft = f.leave({ id: 'family-new', type: 'family', durationMode: 'full_day', quantity: 2 }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true);
});

test('quota scopes exclude cancelled, other-company and replaced records', () => {
  const f = fixture(), company = f.company();
  f.company({ id: 'company-b' });
  f.leave({ id: 'cancelled', status: 'cancelled', durationMode: 'full_day', quantity: 14 });
  f.leave({ id: 'other-company', companyId: 'company-b', durationMode: 'full_day', quantity: 14 });
  f.leave({ id: 'edit-me', durationMode: 'full_day', quantity: 14 });
  assert.equal(f.leaveQuotaSummary(company, 'personal', '2026-10-09').used, 14);
  const replacement = f.leave({ id: 'edit-me', durationMode: 'full_day', quantity: 1 }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(replacement)), false);
  assert.equal(f.leaveQuotaCapacity(f.leave({ status: 'cancelled' }, false)), null);
});

test('statutory ordinary sick quota is thirty days and resets by calendar year', () => {
  const f = fixture(), company = f.company({ leaveQuotaCycle: 'anniversary' });
  f.leave({ id: 'sick-used', type: 'sick', startDate: '2026-01-05', durationMode: 'full_day', quantity: 29 });
  const summary = f.leaveQuotaSummary(company, 'sick', '2026-10-09');
  assert.equal(summary.start, '2026-01-01');
  assert.equal(summary.end, '2027-01-01');
  assert.equal(summary.remaining, 1);
  const draft = f.leave({ id: 'sick-new', type: 'sick', durationMode: 'full_day', quantity: 2 }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true);
  assert.equal(f.leaveQuotaSummary(company, 'sick', '2027-01-05').remaining, 30);
});

test('a cross-year request is checked per year rather than charged wholly to its start year', () => {
  const f = fixture(); f.company();
  f.leave({ id: 'personal-used', startDate: '2026-12-30', durationMode: 'full_day', quantity: 13 });
  const draft = f.leave({ id: 'cross-year', startDate: '2026-12-31', endDate: '2027-01-01',
    durationMode: 'range' }, false);
  const capacity = f.leaveQuotaCapacity(draft);
  assert.equal(capacity.requested, 2);
  assert.equal(hasViolation(capacity), false, 'one day belongs to each independent calendar year');
  f.state.leaveRecords[0].quantity = 14; f.clearCache();
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true, 'the 2026 portion must still detect a full pool');
});

test('cross-year family requests still check both the shared pool and family sublimit per year', () => {
  const f = fixture(); f.company();
  f.leave({ id: 'personal-used', startDate: '2026-12-30', durationMode: 'full_day', quantity: 13 });
  const draft = f.leave({ id: 'family-cross-year', type: 'family', startDate: '2026-12-31',
    endDate: '2027-01-01', durationMode: 'range' }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), false);
  f.leave({ id: 'family-used', type: 'family', startDate: '2026-12-29', durationMode: 'full_day', quantity: 1 });
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true);
});

test('legacy company custom anniversary cycles keep their original limits across cycle boundaries', () => {
  const f = fixture(); f.company({ leaveQuotaCycle: 'anniversary',
    leavePolicies: { personal: { mode: 'custom', quotaDays: 1 } } });
  const draft = f.leave({ id: 'anniversary-boundary', startDate: '2026-05-14', endDate: '2026-05-15',
    durationMode: 'range' }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), false);
  f.leave({ id: 'old-cycle-used', startDate: '2026-05-12' });
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true);
});

test('marriage defaults distinguish old eight-day and current fourteen-day events', () => {
  const f = fixture(), company = f.company();
  const old = f.leaveQuotaSummary(company, 'marriage', '2026-10-09', '2026-09-30');
  const current = f.leaveQuotaSummary(company, 'marriage', '2026-10-09', '2026-10-01');
  assert.equal(old.entitlement, 8);
  assert.equal(current.entitlement, 14);
  const approvedOld = f.leaveQuotaSummary(company, 'marriage', '2026-10-09', '2026-09-30', 14);
  assert.equal(approvedOld.entitlement, 14, 'explicit approved event quota overrides the historical default');
});

test('split marriage requests aggregate by event, including portions in another year', () => {
  const f = fixture(); f.company();
  f.leave({ id: 'event-used', type: 'marriage', marriageEventDate: '2026-12-15',
    startDate: '2026-12-16', durationMode: 'full_day', quantity: 8 });
  const draft = f.leave({ id: 'event-new', type: 'marriage', marriageEventDate: '2026-12-15',
    startDate: '2027-01-05', durationMode: 'full_day', quantity: 7 }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true, 'same event cannot reset on January 1');
  draft.quantity = 6; f.clearCache();
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), false);
});

test('independent marriage events and explicit approved quotas remain independent', () => {
  const f = fixture(); f.company();
  f.leave({ id: 'other-event', type: 'marriage', marriageEventDate: '2026-10-02',
    durationMode: 'full_day', quantity: 14 });
  const draft = f.leave({ id: 'old-approved-event', type: 'marriage', marriageEventDate: '2026-09-01',
    marriageQuotaDays: 14, durationMode: 'full_day', quantity: 14 }, false);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), false);
  draft.marriageQuotaDays = 8;
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true);
});

test('legacy marriage custom and unlimited modes retain annual management semantics', () => {
  const f = fixture(), company = f.company({ leavePolicies: { marriage: { mode: 'custom', quotaDays: 5 } } });
  f.leave({ id: 'marriage-used', type: 'marriage', marriageEventDate: '2026-10-01',
    durationMode: 'full_day', quantity: 4 });
  const draft = f.leave({ id: 'marriage-new', type: 'marriage', marriageEventDate: '2026-10-02',
    durationMode: 'full_day', quantity: 2 }, false);
  assert.equal(f.leaveQuotaSummary(company, 'marriage', '2026-10-09').entitlement, 5);
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), true);
  company.leavePolicies.marriage = { mode: 'unlimited', quotaDays: 0 };
  assert.equal(hasViolation(f.leaveQuotaCapacity(draft)), false);
});

test('marriage event metadata and historic pay ratios survive backup-style normalization', () => {
  const f = fixture(); f.company();
  const raw = { id: 'legacy-event', companyId: 'company-a', type: 'marriage', startDate: '2026-08-01',
    endDate: '2026-08-01', durationMode: 'full_day', quantity: 3, status: 'confirmed',
    marriageEventDate: '2026-07-30', marriageQuotaDays: 8, paidRatio: 92, note: 'Fixture approval' };
  const before = clone(raw), once = f.normalizeLeave(raw), twice = f.normalizeLeave(clone(once));
  assert.equal(twice.marriageEventDate, '2026-07-30');
  assert.equal(twice.marriageQuotaDays, 8);
  assert.equal(twice.paidRatio, 92, 'saved historic payroll ratios are not overwritten by new defaults');
  assert.equal(twice.quantity, 3);
  assert.equal(twice.note, 'Fixture approval');
  assert.deepEqual(raw, before);
  const oldUnannotated = f.normalizeLeave({ ...raw, marriageEventDate: undefined, marriageQuotaDays: undefined });
  assert.equal(oldUnannotated.marriageEventDate || '', '');
  assert.equal(oldUnannotated.marriageQuotaDays ?? null, null, 'missing approval cannot become an invented fourteen-day approval');
});

test('leave pay defaults and saved paid ratios remain separate from statutory quotas', () => {
  const f = fixture(); f.company();
  for (const [type, ratio] of [['sick', 50], ['personal', 0], ['family', 0], ['marriage', 100]]) {
    assert.equal(f.leave({ type }, false).paidRatio, ratio);
    assert.equal(f.leave({ type, paidRatio: 73 }, false).paidRatio, 73);
  }
});

test('editing company salary without removed leave fields preserves all leave settings', () => {
  const f = fixture(), company = f.company({ workHoursPerDay: 6, leaveQuotaCycle: 'anniversary',
    leavePolicies: { sick: { mode: 'custom', quotaDays: 45.5 }, personal: { mode: 'unlimited', quotaDays: 0 },
      marriage: { mode: 'custom', quotaDays: 8 } } });
  const original = clone(f.state);
  f.context.ui.companyDraft = clone(company);
  f.form('#companyForm', { name: 'Renamed Fixture Company', position: '', isCurrent: 'true',
    employmentMode: 'monthly', baseSalary: '42000', mealAllowance: '0', positionAllowance: '0',
    laborIns: '0', healthIns: '0', payrollPeriodType: 'calendar', payrollCycleStartDay: '1',
    payrollCycleEndDay: '31', leaveDeductionEach: '0', deductionRuleNote: '' });
  const draft = f.collectCompanyDraft();
  assert.equal(draft.name, 'Renamed Fixture Company');
  assert.equal(draft.employmentStartDate, company.employmentStartDate);
  assert.equal(draft.workHoursPerDay, 6);
  assert.equal(draft.leaveQuotaCycle, 'anniversary');
  assert.deepEqual(clone(draft.leavePolicies), clone(company.leavePolicies));
  assert.deepEqual(clone(f.state), original, 'editing a company draft cannot mutate saved user data');
});

test('leave settings edits convert custom hours and remain draft-only until save', () => {
  const f = fixture(), company = f.company({ workHoursPerDay: 6,
    leavePolicies: { personal: { mode: 'custom', quotaDays: 20 }, marriage: { mode: 'unlimited', quotaDays: 0 } } });
  const original = clone(f.state);
  f.context.ui.leaveSettingsDraft = clone(company);
  f.form('#v5LeaveSettingsForm', { employmentStartDate: '2021-04-01', workHoursPerDay: '6',
    leaveQuotaCycle: 'calendar', leavePolicy_personal_mode: 'custom', leavePolicy_personal_quotaHours: '84',
    leavePolicy_sick_mode: 'statutory', leavePolicy_sick_quotaHours: '180' });
  const draft = f.collectLeaveSettingsDraft();
  assert.equal(draft.employmentStartDate, '2021-04-01');
  assert.equal(draft.leavePolicies.personal.quotaDays, 14);
  assert.equal(draft.leavePolicies.sick.mode, 'statutory');
  assert.equal(draft.leavePolicies.sick.quotaDays, 30);
  assert.equal(draft.leavePolicies.marriage.mode, 'unlimited', 'unrepresented fields retain their saved values');
  assert.deepEqual(clone(f.state), original, 'previewing statutory or custom settings cannot change stored company policies');
});

test('saving approved marriage quota synchronizes only matching event metadata, preserving historic payroll', () => {
  const f = fixture(); f.company(); f.company({ id: 'company-b' });
  const historic = f.leave({ id: 'same-event', type: 'marriage', marriageEventDate: '2026-09-01',
    marriageQuotaDays: 8, paidRatio: 92, attendanceDeduction: 123, note: 'Fixture historic payroll' });
  const differentEvent = f.leave({ id: 'other-event', type: 'marriage', marriageEventDate: '2026-10-01',
    marriageQuotaDays: 8, paidRatio: 85 });
  const differentCompany = f.leave({ id: 'other-company-event', companyId: 'company-b', type: 'marriage',
    marriageEventDate: '2026-09-01', marriageQuotaDays: 8, paidRatio: 77 });
  const historicalBefore = clone(historic), differentBefore = clone(differentEvent), companyBefore = clone(differentCompany);
  const draft = f.leave({ id: 'new-event-request', type: 'marriage', marriageEventDate: '2026-09-01',
    marriageQuotaDays: 14, startDate: '2026-10-10' }, false);
  assert.equal(f.persistLeave(draft), true);
  assert.equal(historic.marriageQuotaDays, 14);
  assert.deepEqual({ ...clone(historic), marriageQuotaDays: 8 }, historicalBefore);
  assert.deepEqual(clone(differentEvent), differentBefore);
  assert.deepEqual(clone(differentCompany), companyBefore);
  assert.equal(f.state.leaveRecords.find(record => record.id === draft.id).marriageQuotaDays, 14);
});

test('marriage quota overview deduplicates split requests by company and marriage event', () => {
  const f = fixture(), company = f.company(); f.company({ id: 'company-b' });
  f.leave({ id: 'first', type: 'marriage', marriageEventDate: '2026-10-01', customHours: 4 });
  f.leave({ id: 'second', type: 'marriage', marriageEventDate: '2026-10-01', customHours: 4 });
  f.leave({ id: 'other-event', type: 'marriage', marriageEventDate: '2026-10-02' });
  f.leave({ id: 'other-company', companyId: 'company-b', type: 'marriage', marriageEventDate: '2026-10-03' });
  const marriageRows = f.leaveQuotaRows([company]).filter(row => row.type === 'marriage');
  assert.equal(marriageRows.length, 2);
  assert.equal(marriageRows.find(row => row.summary.eventDate === '2026-10-01').summary.used, 1);
  assert.equal(marriageRows.find(row => row.summary.eventDate === '2026-10-02').summary.used, 1);
  assert.ok(marriageRows.every(row => row.company.id === 'company-a'));
});

test('quota overview preserves visibility of unassigned legacy marriage records beside assigned events', () => {
  const f = fixture(), company = f.company(); f.company({ id: 'company-b' });
  f.leave({ id: 'assigned-event', type: 'marriage', marriageEventDate: '2026-10-01' });
  f.leave({ id: 'legacy-unassigned', type: 'marriage', startDate: '2026-08-03', paidRatio: 92,
    note: 'Fixture legacy record without marriage registration date' });
  f.leave({ id: 'other-company-unassigned', companyId: 'company-b', type: 'marriage' });
  const before = clone(f.state);
  const html = f.renderLeaveQuotaPanel([company]);
  assert.match(html, /結婚登記 2026-10-01/, 'the assigned event remains present in the quota overview');
  assert.match(html, /另有 1 筆婚假尚未填結婚登記日/,
    'the unassigned historical record remains visible without counting records from another company');
  assert.match(html, /請編輯紀錄核對事件與核定額度/);
  assert.match(html, /原紀錄仍保留/);
  assert.deepEqual(clone(f.state), before, 'rendering this reminder cannot invent dates or alter historical payroll data');
});

test('marriage form inherits the approved event quota when missing, preserving an explicit draft override', () => {
  const f = fixture(); f.company();
  f.leave({ id: 'approved-event', type: 'marriage', marriageEventDate: '2026-09-01',
    marriageQuotaDays: 14, startDate: '2026-09-02' });
  const draft = f.leave({ id: 'imported-event-without-quota', type: 'marriage',
    marriageEventDate: '2026-09-01', marriageQuotaDays: null, startDate: '2026-09-03' }, false);
  const before = clone(f.state);
  assert.match(f.leaveMarriageFieldsHtml(draft), /name="marriageQuotaDays"[^>]*value="14"/,
    'opening an imported event record cannot replace a fourteen-day approval with its old eight-day default');
  draft.marriageQuotaDays = 8;
  assert.match(f.leaveMarriageFieldsHtml(draft), /name="marriageQuotaDays"[^>]*value="8"/,
    'an explicit draft approval remains under user control');
  assert.deepEqual(clone(f.state), before, 'form rendering cannot modify the approved event or historic records');
});
