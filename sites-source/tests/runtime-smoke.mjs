import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Application script not found');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.innerHTML = '';
    this.hidden = false;
    this.open = false;
    this.dataset = {};
    this.listeners = {};
    this.className = '';
    this.classList = {
      toggle: () => {},
      add: () => {},
      remove: () => {}
    };
  }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  setAttribute() {}
  appendChild() {}
  remove() {}
  click() { this.clicked = true; }
  focus() {}
  select() {}
  setSelectionRange() {}
  reportValidity() { return true; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

const boot = (initialStorage = {}) => {
  const downloads = [];
  const blobUrls = new Map();
  let blobSequence = 0;
  const ids = ['toast', 'pwaUpdateBanner', 'installAppButton', 'companyFilter', 'yearFilter', 'mainContent', 'dataMenuButton', 'dataMenu', 'jsonImport', 'appDialog', 'dialogContent', 'recordForm', 'companyForm', 'overtimeForm', 'leaveForm', 'yearEndForm', 'salaryAdjustmentForm'];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const documentListeners = {};
  const document = {
    body: new FakeElement('body'),
    querySelector(selector) { return selector.startsWith('#') ? elements[selector.slice(1)] || null : null; },
    querySelectorAll() { return []; },
    addEventListener(type, handler) { (documentListeners[type] ||= []).push(handler); },
    createElement(tagName = '') {
      const element = new FakeElement();
      if (String(tagName).toLowerCase() === 'a') {
        element.click = () => {
          element.clicked = true;
          const blob = blobUrls.get(element.href);
          downloads.push({
            filename: element.download || '',
            type: blob?.type || '',
            content: blob ? blob.parts.map((part) => String(part)).join('') : ''
          });
        };
      }
      return element;
    }
  };
  const storage = new Map(Object.entries(initialStorage));
  const localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  const window = {
    innerWidth: 390,
    scrollTo() {},
    print() {},
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    location: { protocol: 'file:', search: '', pathname: '/index.html' }
  };
  const navigator = { userAgent: 'test-runtime' };
  const history = { replaceState() {} };
  class FakeBlob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || '';
    }
  }
  const FakeURL = {
    createObjectURL(blob) {
      const url = `blob:test-${++blobSequence}`;
      blobUrls.set(url, blob);
      return url;
    },
    revokeObjectURL(url) { blobUrls.delete(url); }
  };

  vm.runInNewContext(script, {
    document,
    window,
    navigator,
    history,
    localStorage,
    console,
    crypto: { randomUUID: () => 'test-id' },
    setTimeout: () => 1,
    clearTimeout() {},
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Intl,
    Blob: FakeBlob,
    URL: FakeURL,
    URLSearchParams,
    FormData: class {
      constructor(element) { this.element = element; }
      get(key) { return this.element?.formData?.[key] ?? null; }
      has(key) { return Object.prototype.hasOwnProperty.call(this.element?.formData || {}, key); }
    },
    globalThis: {}
  });
  return { elements, document, documentListeners, storage, downloads };
};

const dispatch = (runtime, type, event) => {
  for (const handler of runtime.documentListeners[type] || []) handler(event);
};

const blank = boot();
if (!blank.elements.mainContent.innerHTML.includes('收入總覽')) throw new Error('Dashboard did not render');
if (!blank.elements.mainContent.innerHTML.includes('尚未建立薪資紀錄')) throw new Error('Blank-data onboarding did not render');
if (!blank.elements.mainContent.innerHTML.includes('到職年資') || !blank.elements.mainContent.innerHTML.includes('請先建立任職公司')) throw new Error('Dashboard tenure card did not render its empty-company state');
if (blank.elements.mainContent.innerHTML.includes('副業／接案收入</span>')) throw new Error('Legacy side-income dashboard metric was not replaced');
if (!blank.elements.companyFilter.innerHTML.includes('全部公司')) throw new Error('Company filter did not render');
if (!blank.elements.yearFilter.innerHTML.includes(String(new Date().getFullYear()))) throw new Error('Year filter did not render');
if (!blank.documentListeners.click?.length || !blank.documentListeners.change?.length || !blank.documentListeners.submit?.length) throw new Error('Core event handlers were not registered');
if (!blank.elements.installAppButton.textContent.includes('安裝到手機')) throw new Error('PWA install entry did not initialize');

dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'install-app' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!blank.elements.dialogContent.innerHTML.includes('安裝個人薪資管理')) throw new Error('PWA fallback install guidance did not render');

blank.elements.dataMenu.hidden = true;
blank.elements.dataMenuButton.listeners.click({ stopPropagation() {} });
if (blank.elements.dataMenu.hidden) throw new Error('Data menu could not be opened');
blank.elements.dataMenuButton.listeners.click({ stopPropagation() {} });
if (!blank.elements.dataMenu.hidden) throw new Error('Data menu could not be closed');

dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'open-interface-settings' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!blank.elements.dialogContent.innerHTML.includes('介面與版面') || !blank.elements.dialogContent.innerHTML.includes('清爽卡片') || !blank.elements.dialogContent.innerHTML.includes('極簡清單') || !blank.elements.dialogContent.innerHTML.includes('高效緊湊') || !blank.elements.dialogContent.innerHTML.includes('大字易讀')) {
  throw new Error('Interface mode center did not render all four choices');
}
for (const themeName of ['翡翠綠', '海洋藍', '靛青紫', '暖陽橘', '莓果紅', '石墨灰']) {
  if (!blank.elements.dialogContent.innerHTML.includes(themeName)) throw new Error(`Interface color center did not render ${themeName}`);
}
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'set-interface-mode', mode: 'compact' }, closest: () => null } : null },
  stopPropagation() {}
});
const compactPreferenceState = JSON.parse(blank.storage.get('salarymate_v310_state'));
if (blank.document.body.dataset.uiMode !== 'compact' || compactPreferenceState.uiPreferences.interfaceMode !== 'compact') {
  throw new Error('Compact interface mode was not applied and persisted');
}
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'set-color-theme', theme: 'blue' }, closest: () => null } : null },
  stopPropagation() {}
});
const bluePreferenceState = JSON.parse(blank.storage.get('salarymate_v310_state'));
if (blank.document.body.dataset.colorTheme !== 'blue' || bluePreferenceState.uiPreferences.colorTheme !== 'blue' || blank.document.body.dataset.uiMode !== 'compact' || bluePreferenceState.uiPreferences.interfaceMode !== 'compact') {
  throw new Error('Color theme was not applied independently from the compact layout mode');
}
for (const mode of ['standard', 'minimal', 'large', 'compact']) {
  dispatch(blank, 'click', {
    target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'set-interface-mode', mode }, closest: () => null } : null },
    stopPropagation() {}
  });
  const combinedPreferenceState = JSON.parse(blank.storage.get('salarymate_v310_state'));
  if (blank.document.body.dataset.uiMode !== mode || blank.document.body.dataset.colorTheme !== 'blue' || combinedPreferenceState.uiPreferences.colorTheme !== 'blue') {
    throw new Error(`Blue color theme did not remain active in the ${mode} layout mode`);
  }
}
const rememberedInterface = boot({ salarymate_v310_state: blank.storage.get('salarymate_v310_state') });
if (rememberedInterface.document.body.dataset.uiMode !== 'compact' || rememberedInterface.document.body.dataset.colorTheme !== 'blue') throw new Error('Layout mode and color theme were not restored independently after reload');

const swipeTarget = { closest: () => null };
blank.elements.mainContent.listeners.touchstart({ touches: [{ clientX: 300, clientY: 260 }], target: swipeTarget });
blank.elements.mainContent.listeners.touchend({ changedTouches: [{ clientX: 190, clientY: 264 }], target: swipeTarget });
if (!blank.elements.mainContent.innerHTML.includes('各月薪資明細')) throw new Error('Mobile left swipe did not navigate to the next primary page');
const blockedSwipeTarget = { closest: () => ({}) };
blank.elements.mainContent.listeners.touchstart({ touches: [{ clientX: 300, clientY: 260 }], target: blockedSwipeTarget });
blank.elements.mainContent.listeners.touchend({ changedTouches: [{ clientX: 190, clientY: 264 }], target: blockedSwipeTarget });
if (!blank.elements.mainContent.innerHTML.includes('各月薪資明細')) throw new Error('Interactive or horizontally scrollable content did not block primary-page swipe navigation');
blank.elements.mainContent.listeners.touchstart({ touches: [{ clientX: 100, clientY: 260 }], target: swipeTarget });
blank.elements.mainContent.listeners.touchend({ changedTouches: [{ clientX: 215, clientY: 256 }], target: swipeTarget });
if (!blank.elements.mainContent.innerHTML.includes('收入總覽')) throw new Error('Mobile right swipe did not navigate to the previous primary page');

const tabTarget = {
  closest(selector) {
    if (selector === '[data-tab]') return { dataset: { tab: 'hourly' } };
    return null;
  }
};
dispatch(blank, 'click', { target: tabTarget, stopPropagation() {} });
if (!blank.elements.mainContent.innerHTML.includes('加班費快速試算')) throw new Error('Overtime calculator view did not render');

const changeCalculator = (dataset, value) => dispatch(blank, 'change', {
  target: { id: '', dataset, value, closest: () => null }
});
changeCalculator({ calcSetting: 'baseSalary' }, '34000');
changeCalculator({ calcSetting: 'mealAllowance' }, '3000');
changeCalculator({ calcSetting: 'attendanceBonus' }, '3000');
changeCalculator({ calcSetting: 'positionAllowance' }, '3000');
changeCalculator({ calcMultiplier: 'regular' }, '1.25');
changeCalculator({ calcHours: 'regular' }, '8');

const calculatorState = JSON.parse(blank.storage.get('salarymate_v310_state'));
if (calculatorState.overtimeCalculator.baseSalary !== 34000) throw new Error('Editable salary setting was not persisted');
if (calculatorState.overtimeCalculator.multipliers.regular !== 1.25) throw new Error('Editable multiplier was not persisted');
if (calculatorState.overtimeCalculator.hours.regular !== 8) throw new Error('Editable overtime hours were not persisted');
if (!blank.elements.mainContent.innerHTML.includes('$1,792')) throw new Error('Editable overtime calculation did not update');

dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'manage-companies' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!blank.elements.dialogContent.innerHTML.includes('data-dialog-footer="company"')) throw new Error('Company save footer was not rendered');
if (!blank.elements.dialogContent.innerHTML.includes('</form></div><div class="dialog-footer"')) throw new Error('Company save footer was not placed outside the scrolling dialog body');
if (!blank.elements.dialogContent.innerHTML.includes('固定加給與津貼') || !blank.elements.dialogContent.innerHTML.includes('data-action="add-company-fixed"')) throw new Error('Company fixed earning controls were not rendered');
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-company-fixed' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!blank.elements.dialogContent.innerHTML.includes('fixedEarning_0_name')) throw new Error('Company custom fixed earning row could not be added');
blank.elements.companyForm.formData = {
  name: '手機儲存測試公司',
  position: '測試職位',
  isCurrent: 'true',
  baseSalary: '42000',
  mealAllowance: '3000',
  positionAllowance: '3000',
  fixedEarning_0_name: '全勤獎金',
  fixedEarning_0_amount: '2000',
  laborIns: '1200',
  healthIns: '800',
  employmentStartDate: `${new Date().getFullYear() - 1}-01-15`,
  workHoursPerDay: '8',
  leaveQuotaCycle: 'anniversary',
  leavePolicy_annual_mode: 'custom',
  leavePolicy_annual_quotaDays: '12',
  leavePolicy_sick_mode: 'custom',
  leavePolicy_sick_quotaDays: '30',
  payrollPeriodType: 'prev16',
  leaveDeductionEach: '500',
  deductionRuleNote: '每次扣款 500 元'
};
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'save-company' }, closest: () => null } : null },
  stopPropagation() {}
});
const savedCompanyState = JSON.parse(blank.storage.get('salarymate_v310_state'));
const savedCompany = savedCompanyState.companies.find((company) => company.name === '手機儲存測試公司');
if (!savedCompany) throw new Error('Explicit company save action did not persist the form');
if (savedCompany.employmentStartDate !== `${new Date().getFullYear() - 1}-01-15` || savedCompany.workHoursPerDay !== 8) {
  throw new Error('Company employment start date or daily work hours were not persisted');
}
if (savedCompany.leaveQuotaCycle !== 'anniversary' || savedCompany.leavePolicies?.annual?.mode !== 'custom' || savedCompany.leavePolicies?.annual?.quotaDays !== 12 || savedCompany.leavePolicies?.sick?.quotaDays !== 30) {
  throw new Error('Company leave quota cycle or per-type policies were not persisted');
}
if (savedCompany.positionAllowance !== 3000 || savedCompany.fixedEarnings?.length !== 1 || savedCompany.fixedEarnings[0]?.name !== '全勤獎金' || savedCompany.fixedEarnings[0]?.amount !== 2000 || savedCompany.fixedEarnings[0]?.affectsHourly !== true) {
  throw new Error('Company position allowance or custom fixed earning was not persisted');
}
if (savedCompanyState.overtimeCalculator.positionAllowance !== 3000 || savedCompanyState.overtimeCalculator.attendanceBonus !== 2000) {
  throw new Error('Company fixed earnings did not update the overtime calculator base');
}

dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-record' }, closest: () => null } : null },
  stopPropagation() {}
});
const defaultRecordHtml = blank.elements.dialogContent.innerHTML;
if (!/name="positionAllowance"[^>]*value="3000"/.test(defaultRecordHtml) || !defaultRecordHtml.includes('全勤獎金') || !defaultRecordHtml.includes('data-custom-hourly type="checkbox" checked')) {
  throw new Error('New salary record did not inherit company fixed earnings with hourly linkage');
}
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'close-dialog' }, closest: () => null } : null },
  stopPropagation() {}
});
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-overtime' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!/name="hourlyRate"[^>]*value="0\.000"/.test(blank.elements.dialogContent.innerHTML) || /name="hourlyRate"[^>]*readonly/.test(blank.elements.dialogContent.innerHTML)) {
  throw new Error('New overtime record did not start with an editable independent hourly-rate snapshot');
}
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'close-dialog' }, closest: () => null } : null },
  stopPropagation() {}
});

const year = new Date().getFullYear();
const today = new Date();
const expectedTenureDays = Math.round((Date.UTC(year, today.getMonth(), today.getDate()) - Date.UTC(year, 0, 1)) / 86400000);
const tenureDashboard = boot({
  salarymate_v310_state: JSON.stringify({
    schemaVersion: 13,
    appVersion: '3.9.0',
    companies: [{ id: 'tenure-company', name: '年資測試公司', isCurrent: true, employmentStartDate: `${year - 2}-01-01` }],
    records: [],
    overtimeLogs: [],
    uiPreferences: { companyFilter: 'ALL', selectedYear: year }
  })
});
if (!tenureDashboard.elements.mainContent.innerHTML.includes(`2 年 ${expectedTenureDays} 天`) || !tenureDashboard.elements.mainContent.innerHTML.includes(`年資測試公司｜${year - 2}/01/01 到職`)) {
  throw new Error('Dashboard tenure card did not calculate completed years and remaining days from the current company start date');
}
dispatch(blank, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!blank.elements.dialogContent.innerHTML.includes('id="leaveForm"')) throw new Error('Leave form did not open');
blank.elements.leaveForm.formData = {
  startDate: `${year}-09-01`,
  endDate: `${year}-09-01`,
  companyId: savedCompany.id,
  status: 'confirmed',
  type: 'personal',
  durationMode: 'hours',
  customHours: '2',
  startPortion: 'full',
  endPortion: 'full',
  paidRatio: '0',
  attendanceDeduction: '500',
  note: '手機新增請假測試'
};
dispatch(blank, 'submit', { target: blank.elements.leaveForm, preventDefault() {} });
const leaveSavedState = JSON.parse(blank.storage.get('salarymate_v310_state'));
const createdLeave = leaveSavedState.leaveRecords.find((record) => record.note === '手機新增請假測試');
if (!createdLeave || createdLeave.startDate !== `${year}-09-01` || createdLeave.durationMode !== 'hours' || createdLeave.customHours !== 2 || createdLeave.status !== 'confirmed' || createdLeave.paidRatio !== 0 || createdLeave.attendanceDeduction !== 500) {
  throw new Error('Leave form did not persist the normalized core leave model');
}

const legacy = boot({
  my_salary_companies_v2: JSON.stringify([{ id: 'c1', name: '舊版公司', isCurrent: true, baseSalary: 1000 }]),
  my_salary_records_v2: JSON.stringify([{ id: 'r1', companyId: 'c1', year, month: 1, baseSalary: 1000, sideIncome: 100 }]),
  my_salary_overtime_v2: '[]',
  my_salary_hourly_settings_v2: '{}'
});
if (!legacy.storage.has('salarymate_v310_state')) throw new Error('Legacy data was not migrated to current storage');
if (!legacy.elements.mainContent.innerHTML.includes('$1,100')) throw new Error('Migrated legacy record did not render');

const upgradedState = JSON.parse(legacy.storage.get('salarymate_v310_state'));
if (upgradedState.schemaVersion !== 13) throw new Error('Legacy data was not upgraded to schema version 13');
if (upgradedState.uiPreferences.interfaceMode !== 'standard') throw new Error('Legacy data did not receive the standard interface mode default');
if (upgradedState.uiPreferences.colorTheme !== 'teal' || legacy.document.body.dataset.colorTheme !== 'teal') throw new Error('Legacy data did not receive the teal color theme default');
if (!Array.isArray(upgradedState.leaveRecords)) throw new Error('Legacy data did not receive the leave records collection');
if (upgradedState.overtimeCalculator?.multipliers?.spring !== 2.5) {
  throw new Error('Overtime calculator defaults were not added during migration');
}
if (upgradedState.companies[0]?.payrollPeriodType !== 'calendar') {
  throw new Error('Legacy company did not receive the calendar-month payroll period default');
}
if (upgradedState.companies[0]?.leaveDeductionEach !== 500) {
  throw new Error('Legacy company did not receive the deduction amount default');
}
if (upgradedState.companies[0]?.employmentStartDate !== '' || upgradedState.companies[0]?.workHoursPerDay !== 8) {
  throw new Error('Legacy company did not receive attendance and annual-leave defaults');
}
if (upgradedState.companies[0]?.leaveQuotaCycle !== 'calendar' || upgradedState.companies[0]?.leavePolicies?.annual?.mode !== 'auto' || upgradedState.companies[0]?.leavePolicies?.sick?.mode !== 'unlimited') {
  throw new Error('Legacy company did not receive Phase 3 leave quota defaults');
}
if (upgradedState.companies[0]?.positionAllowance !== 0 || !Array.isArray(upgradedState.companies[0]?.fixedEarnings) || upgradedState.records[0]?.positionAllowance !== 0) {
  throw new Error('Legacy salary data did not receive v3.5.0 fixed earning defaults');
}
if (upgradedState.companies[0]?.employmentMode !== 'monthly' || upgradedState.companies[0]?.baseHourlyRate !== 0 || upgradedState.companies[0]?.defaultRegularHours !== 174 || upgradedState.records[0]?.employmentMode !== 'monthly') {
  throw new Error('Legacy salary data did not receive v3.7.0 monthly employment-mode defaults');
}

const v37Upgrade = boot({
  salarymate_v310_state: JSON.stringify({
    schemaVersion: 11,
    appVersion: '3.7.0',
    companies: [{ id: 'v37-company', name: 'v3.7 偏好保留公司', isCurrent: true }],
    records: [],
    overtimeLogs: [],
    uiPreferences: { companyFilter: 'v37-company', selectedYear: year - 1, salaryCalcTab: 'raises' }
  })
});
const v37UpgradedState = JSON.parse(v37Upgrade.storage.get('salarymate_v310_state'));
if (v37Upgrade.elements.companyFilter.value !== 'v37-company' || v37UpgradedState.uiPreferences.companyFilter !== 'v37-company' || v37UpgradedState.uiPreferences.selectedYear !== year - 1) {
  throw new Error('v3.7.0 filters were not preserved while upgrading to schema 13');
}
if (v37Upgrade.document.body.dataset.uiMode !== 'standard' || v37UpgradedState.uiPreferences.interfaceMode !== 'standard') {
  throw new Error('v3.7.0 data did not receive the safe standard interface mode');
}
if (v37Upgrade.document.body.dataset.colorTheme !== 'teal' || v37UpgradedState.uiPreferences.colorTheme !== 'teal') {
  throw new Error('v3.7.0 data did not receive the safe teal color theme');
}

const v38Upgrade = boot({
  salarymate_v310_state: JSON.stringify({
    schemaVersion: 12,
    appVersion: '3.8.0',
    companies: [],
    records: [],
    overtimeLogs: [],
    uiPreferences: { interfaceMode: 'large' }
  })
});
const v38UpgradedState = JSON.parse(v38Upgrade.storage.get('salarymate_v310_state'));
if (v38Upgrade.document.body.dataset.uiMode !== 'large' || v38UpgradedState.uiPreferences.interfaceMode !== 'large' || v38Upgrade.document.body.dataset.colorTheme !== 'teal' || v38UpgradedState.uiPreferences.colorTheme !== 'teal') {
  throw new Error('v3.8.0 layout preference was not preserved while adding the independent color theme');
}

const priorVersion = boot({
  salarymate_v310_state: JSON.stringify({
    schemaVersion: 4,
    companies: [{ id: 'old-company', name: '既有公司', isCurrent: true }],
    records: [],
    overtimeLogs: [],
    leaves: [{ id: 'old-leave', date: `${year}-06-01`, companyId: 'old-company', type: 'sick', unit: 'day', quantity: 1 }],
    overtimeCalculator: { leaveDeductionEach: 750, ruleNote: '既有扣款規則' }
  })
});
const priorUpgraded = JSON.parse(priorVersion.storage.get('salarymate_v310_state'));
if (priorUpgraded.companies[0]?.leaveDeductionEach !== 750 || priorUpgraded.companies[0]?.deductionRuleNote !== '既有扣款規則') {
  throw new Error('v3.2.1 calculator deduction settings were not migrated into company defaults');
}
if (priorUpgraded.leaveRecords[0]?.paidRatio !== 50 || priorUpgraded.leaveRecords[0]?.status !== 'confirmed' || priorUpgraded.leaveRecords[0]?.durationMode !== 'full_day') throw new Error('Legacy leave alias, workflow status, or duration mode was not migrated');
dispatch(priorVersion, 'change', { target: { id: 'companyFilter', value: 'old-company', dataset: {}, closest: () => null } });
const remembered = boot({ salarymate_v310_state: priorVersion.storage.get('salarymate_v310_state') });
if (remembered.elements.companyFilter.value !== 'old-company') throw new Error('Selected company filter was not restored');

const previousYear = year - 1;
const crossMonthState = {
  schemaVersion: 5,
  appVersion: '3.3.0',
  companies: [
    { id: 'c1', name: '跨月公司', isCurrent: true, baseSalary: 34000, employmentStartDate: `${year - 2}-01-01`, workHoursPerDay: 8, payrollPeriodType: 'prev16', leaveDeductionEach: 500, deductionRuleNote: '每次扣款 500 元' },
    { id: 'c2', name: '日曆月公司', isCurrent: false, baseSalary: 36000, employmentStartDate: `${year - 1}-03-01`, workHoursPerDay: 8, payrollPeriodType: 'calendar', leaveDeductionEach: 600 }
  ],
  records: [
    { id: 'r-aug', companyId: 'c1', year, month: 8, baseSalary: 34000, mealAllowance: 3000, positionAllowance: 3000, bonus: 5000, customEarnings: [{ id: 'attendance-fixed', name: '全勤獎金', amount: 3000, affectsHourly: true }] }
  ],
  overtimeLogs: [
    { id: 'ot-jul15', date: `${year}-07-15`, companyId: 'c1', type: 'weekday', hours: 1, hourlyRate: 100, note: '前一期最後一天' },
    { id: 'ot-jul16', date: `${year}-07-16`, companyId: 'c1', type: 'weekday', hours: 1, hourlyRate: 100, note: '八月區間起點' },
    { id: 'ot-aug15', date: `${year}-08-15`, companyId: 'c1', type: 'weekday', hours: 1, hourlyRate: 100, note: '八月區間終點' },
    { id: 'ot-aug16', date: `${year}-08-16`, companyId: 'c1', type: 'weekday', hours: 1, hourlyRate: 100, note: '九月區間起點' },
    { id: 'ot-dec15', date: `${previousYear}-12-15`, companyId: 'c1', type: 'weekday', hours: 1, hourlyRate: 100, note: '前一年十二月薪資' },
    { id: 'ot-dec16', date: `${previousYear}-12-16`, companyId: 'c1', type: 'weekday', hours: 1, hourlyRate: 100, note: '一月跨年起點' },
    { id: 'ot-jan15', date: `${year}-01-15`, companyId: 'c1', type: 'weekday', hours: 1, hourlyRate: 100, note: '一月跨年終點' },
    { id: 'ot-aug01-calendar', date: `${year}-08-01`, companyId: 'c2', type: 'weekday', hours: 1, hourlyRate: 100, note: '日曆月八月' },
    { id: 'ot-jul31-calendar', date: `${year}-07-31`, companyId: 'c2', type: 'weekday', hours: 1, hourlyRate: 100, note: '日曆月七月' }
  ],
  leaveRecords: [
    { id: 'leave-jul15', date: `${year}-07-15`, companyId: 'c1', type: 'personal', unit: 'day', quantity: 1, paidRatio: 0, attendanceDeduction: 0, note: '前一期請假' },
    { id: 'leave-jul16', date: `${year}-07-16`, companyId: 'c1', type: 'annual', unit: 'day', quantity: 1, paidRatio: 100, attendanceDeduction: 0, note: '八月特休起點' },
    { id: 'leave-aug15', date: `${year}-08-15`, companyId: 'c1', type: 'sick', unit: 'halfday', quantity: 1, paidRatio: 50, attendanceDeduction: 500, note: '八月病假終點' },
    { id: 'leave-aug16', date: `${year}-08-16`, companyId: 'c1', type: 'personal', unit: 'hour', quantity: 2, paidRatio: 0, attendanceDeduction: 0, note: '九月請假起點' },
    { id: 'leave-aug01-calendar', date: `${year}-08-01`, companyId: 'c2', type: 'public', unit: 'day', quantity: 1, paidRatio: 100, attendanceDeduction: 0, note: '日曆月八月請假' },
    { id: 'leave-jul31-calendar', date: `${year}-07-31`, companyId: 'c2', type: 'personal', unit: 'day', quantity: 1, paidRatio: 0, attendanceDeduction: 0, note: '日曆月七月請假' }
  ]
};
const linked = boot({ salarymate_v310_state: JSON.stringify(crossMonthState) });
const changeSelect = (id, value) => dispatch(linked, 'change', { target: { id, value, dataset: {}, closest: () => null } });
changeSelect('companyFilter', 'c1');
changeSelect('overtimeMonth', '8');
dispatch(linked, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'overtime' } } : null },
  stopPropagation() {}
});
let overtimeHtml = linked.elements.mainContent.innerHTML;
if (!overtimeHtml.includes(`${year}-07-16`) || !overtimeHtml.includes(`${year}-08-15`)) throw new Error('Cross-month August boundary logs were not included');
if (overtimeHtml.includes('前一期最後一天') || overtimeHtml.includes('九月區間起點')) throw new Error('Cross-month August filter included an out-of-period log');
if (!overtimeHtml.includes(`${year}/07/16～${year}/08/15`)) throw new Error('Cross-month August range label was not rendered');

changeSelect('overtimeMonth', '1');
overtimeHtml = linked.elements.mainContent.innerHTML;
if (!overtimeHtml.includes(`${previousYear}-12-16`) || !overtimeHtml.includes(`${year}-01-15`)) throw new Error('Cross-year January boundary logs were not included');
if (overtimeHtml.includes('前一年十二月薪資')) throw new Error('Cross-year January filter included December 15');
if (!overtimeHtml.includes(`${previousYear}/12/16～${year}/01/15`)) throw new Error('Cross-year January range label was not rendered');

changeSelect('companyFilter', 'c2');
changeSelect('overtimeMonth', '8');
overtimeHtml = linked.elements.mainContent.innerHTML;
if (!overtimeHtml.includes('日曆月八月') || overtimeHtml.includes('日曆月七月')) throw new Error('Calendar-month company filtering is incorrect');
if (!overtimeHtml.includes(`${year}/08/01～${year}/08/31`)) throw new Error('Calendar-month range label was not rendered');

changeSelect('companyFilter', 'c1');
changeSelect('leaveMonth', '8');
dispatch(linked, 'click', {
  target: {
    closest(selector) {
      if (selector === '[data-attendance-tab]') return { dataset: { attendanceTab: 'leave' } };
      return null;
    }
  },
  stopPropagation() {}
});
let leaveHtml = linked.elements.mainContent.innerHTML;
if (!leaveHtml.includes('八月特休起點') || !leaveHtml.includes('八月病假終點')) throw new Error('Cross-month August leave boundary records were not included');
if (leaveHtml.includes('前一期請假') || leaveHtml.includes('九月請假起點')) throw new Error('Cross-month August leave filter included an out-of-period record');
if (!leaveHtml.includes(`${year}/07/16～${year}/08/15`)) throw new Error('Leave panel did not render the linked payroll period');
if (!leaveHtml.includes('12 小時')) throw new Error('Leave hours did not use company daily work hours');
if (!leaveHtml.includes('$283') || !leaveHtml.includes('$500')) throw new Error('Leave wage or attendance deduction totals were not calculated');
if (!leaveHtml.includes('9 天')) throw new Error('Annual leave entitlement and usage were not calculated from employment start date');
const leavePreferenceState = JSON.parse(linked.storage.get('salarymate_v310_state'));
if (leavePreferenceState.uiPreferences.attendanceTab !== 'leave' || leavePreferenceState.uiPreferences.leaveMonth !== 8) {
  throw new Error('Attendance sub-tab or leave month preference was not persisted');
}

changeSelect('companyFilter', 'c2');
leaveHtml = linked.elements.mainContent.innerHTML;
if (!leaveHtml.includes('日曆月八月請假') || leaveHtml.includes('日曆月七月請假')) throw new Error('Calendar-month leave filtering is incorrect');

const phase2State = {
  schemaVersion: 7,
  appVersion: '3.4.0',
  companies: [{ id: 'phase2-company', name: 'Phase 2 測試公司', isCurrent: true, baseSalary: 34000, employmentStartDate: `${year - 2}-01-01`, workHoursPerDay: 8, payrollPeriodType: 'prev16' }],
  records: [
    { id: 'phase2-aug', companyId: 'phase2-company', year, month: 8, baseSalary: 34000, customDeductions: [] },
    { id: 'phase2-sep', companyId: 'phase2-company', year, month: 9, baseSalary: 34000, customDeductions: [] }
  ],
  overtimeLogs: [{ id: 'phase2-ot', date: `${year}-08-13`, companyId: 'phase2-company', type: 'weekday', hours: 1, hourlyRate: 142 }],
  leaveRecords: [
    { id: 'phase2-range', startDate: `${year}-08-14`, endDate: `${year}-08-17`, companyId: 'phase2-company', type: 'personal', durationMode: 'range', startPortion: 'full', endPortion: 'full', includeWeekends: false, status: 'confirmed', paidRatio: 0, attendanceDeduction: 500, note: '跨區間請假' },
    { id: 'phase2-planned', startDate: `${year}-08-15`, endDate: `${year}-08-15`, companyId: 'phase2-company', type: 'sick', durationMode: 'half_am', status: 'planned', paidRatio: 50, attendanceDeduction: 999, note: '預計病假' },
    { id: 'phase2-cancelled', startDate: `${year}-08-12`, endDate: `${year}-08-12`, companyId: 'phase2-company', type: 'personal', durationMode: 'full_day', status: 'cancelled', paidRatio: 0, attendanceDeduction: 888, note: '已取消事假' }
  ]
};
const phase2 = boot({ salarymate_v310_state: JSON.stringify(phase2State) });
const phase2Change = (id, value) => dispatch(phase2, 'change', { target: { id, value, dataset: {}, closest: () => null } });
phase2Change('companyFilter', 'phase2-company');
phase2Change('leaveMonth', '8');
dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'overtime' } } : null },
  stopPropagation() {}
});
dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-attendance-tab]' ? { dataset: { attendanceTab: 'leave' } } : null },
  stopPropagation() {}
});
let phase2Html = phase2.elements.mainContent.innerHTML;
if (!phase2Html.includes('跨區間請假') || !phase2Html.includes(`${year}-08-14～${year}-08-17`)) throw new Error('Phase 2 date range was not rendered');
if (!phase2Html.includes('4h 預計') || !phase2Html.includes('另有 0.5 天預計請假')) throw new Error('Planned leave was not separated from confirmed usage or remaining quota');
if (!phase2Html.includes('$1,134') || !phase2Html.includes('$250')) throw new Error('Cross-period August deduction allocation is incorrect');
if (phase2Html.includes('已取消事假')) throw new Error('Cancelled leave appeared in the active filter');
phase2Change('leaveMonth', '9');
phase2Html = phase2.elements.mainContent.innerHTML;
if (!phase2Html.includes('跨區間請假') || !phase2Html.includes('$1,133') || !phase2Html.includes('$250')) throw new Error('Cross-period September deduction allocation is incorrect');
phase2Change('leaveMonth', '8');

dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'edit-leave', id: 'phase2-range' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!phase2.elements.dialogContent.innerHTML.includes('跨計薪區間，自動拆分為')) throw new Error('Cross-payroll split preview was not shown in the leave form');

dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'close-dialog' }, closest: () => null } : null },
  stopPropagation() {}
});
dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'sync-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!phase2.elements.dialogContent.innerHTML.includes('請假扣薪 $1,134') || !phase2.elements.dialogContent.innerHTML.includes('合計 $1,384')) throw new Error('Leave deduction sync preview is incorrect');
dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'confirm-action' }, closest: () => null } : null },
  stopPropagation() {}
});
let phase2Saved = JSON.parse(phase2.storage.get('salarymate_v310_state'));
let linkedDeductions = phase2Saved.records.find((record) => record.id === 'phase2-aug').customDeductions.filter((item) => item.sourceType === 'leave-payroll');
if (linkedDeductions.length !== 1 || linkedDeductions[0].amount !== 1384 || !linkedDeductions[0].sourceKey.includes('phase2-company')) throw new Error('Leave deduction linkage was not persisted with source metadata');
if (!phase2.elements.mainContent.innerHTML.includes('已同步，金額一致')) throw new Error('Synchronized leave deduction status was not rendered');
const phase2Reloaded = boot({ salarymate_v310_state: phase2.storage.get('salarymate_v310_state') });
const reloadedLinkedItem = JSON.parse(phase2Reloaded.storage.get('salarymate_v310_state')).records.find((record) => record.id === 'phase2-aug').customDeductions[0];
if (reloadedLinkedItem.sourceType !== 'leave-payroll' || !reloadedLinkedItem.sourceKey) throw new Error('Leave linkage metadata was lost during normalization');

dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'sync-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'confirm-action' }, closest: () => null } : null },
  stopPropagation() {}
});
phase2Saved = JSON.parse(phase2.storage.get('salarymate_v310_state'));
linkedDeductions = phase2Saved.records.find((record) => record.id === 'phase2-aug').customDeductions.filter((item) => item.sourceType === 'leave-payroll');
if (linkedDeductions.length !== 1) throw new Error('Repeated leave sync created a duplicate deduction');

dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'unlink-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'confirm-action' }, closest: () => null } : null },
  stopPropagation() {}
});
phase2Saved = JSON.parse(phase2.storage.get('salarymate_v310_state'));
if (phase2Saved.records.find((record) => record.id === 'phase2-aug').customDeductions.some((item) => item.sourceType === 'leave-payroll')) throw new Error('Leave deduction linkage could not be removed');

phase2Change('leaveStatus', 'cancelled');
phase2Html = phase2.elements.mainContent.innerHTML;
if (!phase2Html.includes('已取消事假') || phase2Html.includes('跨區間請假')) throw new Error('Leave workflow status filter is incorrect');
const phase2PreferenceState = JSON.parse(phase2.storage.get('salarymate_v310_state'));
if (phase2PreferenceState.uiPreferences.leaveStatus !== 'cancelled') throw new Error('Leave status filter preference was not persisted');
phase2Change('leaveStatus', 'active');

dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
phase2.elements.leaveForm.formData = {
  startDate: `${year}-08-14`, endDate: `${year}-08-14`, companyId: 'phase2-company', status: 'confirmed', type: 'personal', durationMode: 'full_day', paidRatio: '0', attendanceDeduction: '0', note: '重疊測試'
};
const leaveCountBeforeOverlap = JSON.parse(phase2.storage.get('salarymate_v310_state')).leaveRecords.length;
dispatch(phase2, 'submit', { target: phase2.elements.leaveForm, preventDefault() {} });
if (!String(phase2.elements.toast.textContent).includes('重疊')) throw new Error('Overlapping leave did not produce a warning');
if (JSON.parse(phase2.storage.get('salarymate_v310_state')).leaveRecords.length !== leaveCountBeforeOverlap) throw new Error('Overlapping leave was saved unexpectedly');

phase2.elements.leaveForm.formData = {
  startDate: `${year}-08-13`, endDate: `${year}-08-13`, companyId: 'phase2-company', status: 'confirmed', type: 'personal', durationMode: 'full_day', paidRatio: '0', attendanceDeduction: '0', note: '同日加班確認測試'
};
dispatch(phase2, 'submit', { target: phase2.elements.leaveForm, preventDefault() {} });
if (!phase2.elements.dialogContent.innerHTML.includes('同日已有加班紀錄')) throw new Error('Same-day overtime warning was not shown');
dispatch(phase2, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'confirm-action' }, closest: () => null } : null },
  stopPropagation() {}
});
if (JSON.parse(phase2.storage.get('salarymate_v310_state')).leaveRecords.length !== leaveCountBeforeOverlap + 1) throw new Error('Confirmed same-day overtime warning did not save the leave record');

const phase3State = {
  schemaVersion: 8,
  appVersion: '3.4.0',
  companies: [{
    id: 'phase3-company', name: 'Phase 3 額度公司', isCurrent: true, baseSalary: 48000,
    employmentStartDate: `${year - 2}-01-01`, workHoursPerDay: 8, payrollPeriodType: 'calendar',
    leaveQuotaCycle: 'calendar',
    leavePolicies: {
      annual: { mode: 'auto', quotaDays: 0 },
      sick: { mode: 'custom', quotaDays: 2 },
      personal: { mode: 'custom', quotaDays: 1 }
    }
  }],
  records: [{ id: 'phase3-aug', companyId: 'phase3-company', year, month: 8, baseSalary: 48000, note: '@薪資公式測試' }],
  overtimeLogs: [{ id: 'phase3-ot', date: `${year}-08-03`, companyId: 'phase3-company', type: 'weekday', hours: 2, hourlyRate: 200 }],
  leaveRecords: [
    { id: 'phase3-sick-used', startDate: `${year}-08-04`, endDate: `${year}-08-04`, companyId: 'phase3-company', type: 'sick', durationMode: 'full_day', status: 'confirmed', paidRatio: 50, attendanceDeduction: 0, note: '=2+2' },
    { id: 'phase3-sick-planned', startDate: `${year}-08-05`, endDate: `${year}-08-05`, companyId: 'phase3-company', type: 'sick', durationMode: 'half_am', status: 'planned', paidRatio: 50, attendanceDeduction: 0, note: '預留病假' },
    { id: 'phase3-personal-over', startDate: `${year}-08-06`, endDate: `${year}-08-07`, companyId: 'phase3-company', type: 'personal', durationMode: 'range', status: 'confirmed', paidRatio: 0, attendanceDeduction: 0, note: '事假超額' },
    { id: 'phase3-cancelled', startDate: `${year}-08-10`, endDate: `${year}-08-10`, companyId: 'phase3-company', type: 'annual', durationMode: 'full_day', status: 'cancelled', paidRatio: 100, attendanceDeduction: 0, note: '取消特休' }
  ]
};
const phase3 = boot({ salarymate_v310_state: JSON.stringify(phase3State) });
const phase3Change = (id, value) => dispatch(phase3, 'change', { target: { id, value, dataset: {}, closest: () => null } });
phase3Change('companyFilter', 'phase3-company');
phase3Change('leaveMonth', '8');
dispatch(phase3, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'overtime' } } : null },
  stopPropagation() {}
});
dispatch(phase3, 'click', {
  target: { closest: (selector) => selector === '[data-attendance-tab]' ? { dataset: { attendanceTab: 'leave' } } : null },
  stopPropagation() {}
});
let phase3Html = phase3.elements.mainContent.innerHTML;
if (!phase3Html.includes('每月推估出勤率') || !phase3Html.includes('假別時數分布') || !phase3Html.includes('假別額度總覽')) throw new Error('Phase 3 analysis panels were not rendered');
if (!phase3Html.includes('已超額 1 天') || !phase3Html.includes('超額 1 天')) throw new Error('Phase 3 leave quota overage was not detected');
for (const [type, label] of [['annual', '特休'], ['personal', '事假'], ['sick', '病假'], ['menstrual', '生理假']]) {
  const card = phase3Html.match(new RegExp(`data-leave-kpi="${type}"[\\s\\S]*?</article>`))?.[0] || '';
  if (!card.includes(label) || !card.includes('使用數') || !card.includes('剩餘數')) throw new Error(`${label} KPI did not render usage and remaining values`);
}
const personalKpi = phase3Html.match(/data-leave-kpi="personal"[\s\S]*?<\/article>/)?.[0] || '';
const sickKpi = phase3Html.match(/data-leave-kpi="sick"[\s\S]*?<\/article>/)?.[0] || '';
const menstrualKpi = phase3Html.match(/data-leave-kpi="menstrual"[\s\S]*?<\/article>/)?.[0] || '';
if (!personalKpi.includes('2 天') || !personalKpi.includes('0 天') || !personalKpi.includes('已超額 1 天')) throw new Error('Personal leave KPI did not show confirmed usage and exhausted balance');
if (!sickKpi.includes('1 天') || !sickKpi.includes('0.5 天') || !sickKpi.includes('另有 0.5 天預計請假')) throw new Error('Sick leave KPI did not reserve planned leave from the remaining balance');
if (!menstrualKpi.includes('0 天') || !menstrualKpi.includes('1 天') || !menstrualKpi.includes('每月自動重置')) throw new Error('Menstrual leave KPI did not show the fixed monthly allowance');
if (!phase3Html.includes('8h ＋ 4h 預計') || !phase3Html.includes('16h')) throw new Error('Phase 3 leave type distribution did not separate confirmed and planned hours');
const augustWeekdays = Array.from({ length: new Date(Date.UTC(year, 8, 0)).getUTCDate() }, (_, index) => new Date(Date.UTC(year, 7, index + 1))).filter((date) => ![0, 6].includes(date.getUTCDay())).length;
const expectedAttendanceRate = Number((((augustWeekdays * 8 - 24) / (augustWeekdays * 8)) * 100).toFixed(1));
if (!phase3Html.includes(`${expectedAttendanceRate}%`)) throw new Error('Phase 3 estimated attendance rate is incorrect');
phase3Change('leaveStatus', 'cancelled');
phase3Html = phase3.elements.mainContent.innerHTML;
if (!phase3Html.includes('取消特休') || !phase3Html.includes('已超額 1 天') || !phase3Html.includes('data-leave-kpi="sick"')) throw new Error('Phase 3 analysis was incorrectly affected by the table status filter');
phase3Change('leaveStatus', 'active');

dispatch(phase3, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
phase3.elements.leaveForm.formData = {
  startDate: `${year}-08-20`, endDate: `${year}-08-20`, companyId: 'phase3-company', status: 'planned', type: 'sick', durationMode: 'full_day', paidRatio: '50', attendanceDeduction: '0', note: '額度警示測試'
};
dispatch(phase3, 'submit', { target: phase3.elements.leaveForm, preventDefault() {} });
if (!phase3.elements.dialogContent.innerHTML.includes('超過目前可用 0.5 天')) throw new Error('Phase 3 custom leave quota warning was not shown');

const menstrualMonthlyState = {
  schemaVersion: 13,
  appVersion: '3.11.0',
  companies: [{
    id: 'menstrual-company', name: '生理假月額度公司', isCurrent: true, baseSalary: 42000,
    employmentStartDate: '', workHoursPerDay: 8, payrollPeriodType: 'calendar', leaveQuotaCycle: 'anniversary'
  }],
  records: [],
  overtimeLogs: [],
  leaveRecords: [
    { id: 'menstrual-july', startDate: `${year}-07-06`, endDate: `${year}-07-06`, companyId: 'menstrual-company', type: 'menstrual', durationMode: 'full_day', status: 'confirmed', paidRatio: 50, attendanceDeduction: 0 },
    { id: 'menstrual-aug-used', startDate: `${year}-08-04`, endDate: `${year}-08-04`, companyId: 'menstrual-company', type: 'menstrual', durationMode: 'half_am', status: 'confirmed', paidRatio: 50, attendanceDeduction: 0 },
    { id: 'menstrual-aug-planned', startDate: `${year}-08-05`, endDate: `${year}-08-05`, companyId: 'menstrual-company', type: 'menstrual', durationMode: 'half_pm', status: 'planned', paidRatio: 50, attendanceDeduction: 0 },
    { id: 'menstrual-sep-cancelled', startDate: `${year}-09-07`, endDate: `${year}-09-07`, companyId: 'menstrual-company', type: 'menstrual', durationMode: 'full_day', status: 'cancelled', paidRatio: 50, attendanceDeduction: 0 }
  ]
};
const menstrualMonthly = boot({ salarymate_v310_state: JSON.stringify(menstrualMonthlyState) });
const menstrualChange = (id, value) => dispatch(menstrualMonthly, 'change', { target: { id, value, dataset: {}, closest: () => null } });
menstrualChange('companyFilter', 'menstrual-company');
menstrualChange('leaveMonth', '8');
dispatch(menstrualMonthly, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'overtime' } } : null },
  stopPropagation() {}
});
dispatch(menstrualMonthly, 'click', {
  target: { closest: (selector) => selector === '[data-attendance-tab]' ? { dataset: { attendanceTab: 'leave' } } : null },
  stopPropagation() {}
});
let menstrualHtml = menstrualMonthly.elements.mainContent.innerHTML;
let menstrualMonthlyKpi = menstrualHtml.match(/data-leave-kpi="menstrual"[\s\S]*?<\/article>/)?.[0] || '';
if (!menstrualMonthlyKpi.includes('0.5 天') || !menstrualMonthlyKpi.includes('0 天') || !menstrualMonthlyKpi.includes(`${year} 年 8 月`) || !menstrualMonthlyKpi.includes('已先保留')) {
  throw new Error('Menstrual KPI did not combine confirmed and planned usage within the selected calendar month');
}
menstrualChange('leaveMonth', '9');
menstrualHtml = menstrualMonthly.elements.mainContent.innerHTML;
menstrualMonthlyKpi = menstrualHtml.match(/data-leave-kpi="menstrual"[\s\S]*?<\/article>/)?.[0] || '';
if (!menstrualMonthlyKpi.includes('0 天') || !menstrualMonthlyKpi.includes('1 天') || !menstrualMonthlyKpi.includes(`${year} 年 9 月`)) {
  throw new Error('Menstrual allowance did not reset in the next calendar month or incorrectly counted a cancelled record');
}
dispatch(menstrualMonthly, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'manage-companies' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!menstrualMonthly.elements.dialogContent.innerHTML.includes('data-fixed-leave-policy="menstrual"') || !menstrualMonthly.elements.dialogContent.innerHTML.includes('每個曆月 1 天') || !menstrualMonthly.elements.dialogContent.innerHTML.includes('每月自動重置')) {
  throw new Error('Company settings did not expose the fixed menstrual monthly allowance');
}
dispatch(menstrualMonthly, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'close-dialog' }, closest: () => null } : null },
  stopPropagation() {}
});
menstrualChange('leaveMonth', '8');
dispatch(menstrualMonthly, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
menstrualMonthly.elements.leaveForm.formData = {
  startDate: `${year}-08-20`, endDate: `${year}-08-20`, companyId: 'menstrual-company', status: 'planned', type: 'menstrual', durationMode: 'half_am', paidRatio: '50', attendanceDeduction: '0', note: '同月超額測試'
};
const menstrualCountBeforeWarning = JSON.parse(menstrualMonthly.storage.get('salarymate_v310_state')).leaveRecords.length;
dispatch(menstrualMonthly, 'submit', { target: menstrualMonthly.elements.leaveForm, preventDefault() {} });
if (!menstrualMonthly.elements.dialogContent.innerHTML.includes(`${year} 年 8 月生理假每月額度 1 天`) || !menstrualMonthly.elements.dialogContent.innerHTML.includes('目前可用 0 天')) {
  throw new Error('A second menstrual request in the same month did not produce the monthly allowance warning');
}
if (JSON.parse(menstrualMonthly.storage.get('salarymate_v310_state')).leaveRecords.length !== menstrualCountBeforeWarning) {
  throw new Error('Menstrual overage was saved before the user confirmed the warning');
}

const weekdayMonthBoundary = Array.from({ length: 11 }, (_, index) => {
  const end = new Date(Date.UTC(year, index + 1, 0));
  const startNext = new Date(Date.UTC(year, index + 1, 1));
  return [end, startNext];
}).find(([end, startNext]) => ![0, 6].includes(end.getUTCDay()) && ![0, 6].includes(startNext.getUTCDay()));
if (!weekdayMonthBoundary) throw new Error('Could not find a weekday calendar-month boundary for menstrual reset testing');
const [menstrualBoundaryStart, menstrualBoundaryEnd] = weekdayMonthBoundary.map((date) => date.toISOString().slice(0, 10));
const menstrualCrossMonth = boot({ salarymate_v310_state: JSON.stringify({
  schemaVersion: 13,
  appVersion: '3.11.0',
  companies: [{ id: 'menstrual-cross-company', name: '生理假跨月公司', isCurrent: true, baseSalary: 42000, workHoursPerDay: 8, payrollPeriodType: 'calendar' }],
  records: [], overtimeLogs: [], leaveRecords: []
}) });
dispatch(menstrualCrossMonth, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-leave' }, closest: () => null } : null },
  stopPropagation() {}
});
menstrualCrossMonth.elements.leaveForm.formData = {
  startDate: menstrualBoundaryStart,
  endDate: menstrualBoundaryEnd,
  companyId: 'menstrual-cross-company',
  status: 'confirmed',
  type: 'menstrual',
  durationMode: 'range',
  startPortion: 'full',
  endPortion: 'full',
  paidRatio: '50',
  attendanceDeduction: '0',
  note: '跨月各一日測試'
};
dispatch(menstrualCrossMonth, 'submit', { target: menstrualCrossMonth.elements.leaveForm, preventDefault() {} });
const menstrualCrossState = JSON.parse(menstrualCrossMonth.storage.get('salarymate_v310_state'));
if (menstrualCrossState.leaveRecords.length !== 1 || menstrualCrossState.leaveRecords[0].startDate !== menstrualBoundaryStart || menstrualCrossState.leaveRecords[0].endDate !== menstrualBoundaryEnd) {
  throw new Error('A valid one-day-per-calendar-month menstrual range was blocked or changed');
}

const phase4Action = (runtime, action) => dispatch(runtime, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action }, closest: () => null } : null },
  stopPropagation() {}
});
phase4Action(phase3, 'export-csv');
const salaryCsvDownload = phase3.downloads.at(-1);
if (!salaryCsvDownload?.filename.endsWith('_salary_records.csv') || !salaryCsvDownload.content.startsWith('\uFEFF')) throw new Error('Phase 4 salary CSV download was not generated correctly');
if (!salaryCsvDownload.content.includes("\"'@薪資公式測試\"")) throw new Error('Salary CSV formula injection guard did not prefix an unsafe value');

phase4Action(phase3, 'export-leave-csv');
if (!String(phase3.elements.toast.textContent).includes('筆請假紀錄')) throw new Error('Phase 4 leave CSV export action did not run');
const leaveCsvDownload = phase3.downloads.at(-1);
if (!leaveCsvDownload?.filename.endsWith('_leave_records.csv') || !leaveCsvDownload.content.startsWith('\uFEFF')) throw new Error('Phase 4 leave CSV download was not generated correctly');
if (!leaveCsvDownload.content.includes("\"'=2+2\"")) throw new Error('Leave CSV formula injection guard did not prefix an unsafe value');

phase4Action(phase3, 'export-attendance-csv');
if (!String(phase3.elements.toast.textContent).includes('12 個月出勤分析')) throw new Error('Phase 4 attendance CSV export action did not run');
const attendanceCsvDownload = phase3.downloads.at(-1);
if (!attendanceCsvDownload?.filename.endsWith('_attendance_analysis.csv') || attendanceCsvDownload.content.trim().split('\r\n').length !== 13) throw new Error('Phase 4 attendance CSV did not contain one header and 12 monthly rows');

phase4Action(phase3, 'export-json');
const jsonDownload = phase3.downloads.at(-1);
const exportedState = JSON.parse(jsonDownload?.content || 'null');
if (!jsonDownload?.filename.includes('個人薪資管理_v3.11.1_backup_') || exportedState?.exportInfo?.app !== '個人薪資管理' || exportedState?.schemaVersion !== 13 || exportedState?.leaveRecords?.length !== phase3State.leaveRecords.length) {
  throw new Error('Phase 4 JSON backup did not preserve the v3.11.1 identity, schema, and leave records');
}

const beforeHealthCheck = phase3.storage.get('salarymate_v310_state');
phase4Action(phase3, 'data-health');
if (!phase3.elements.dialogContent.innerHTML.includes('資料完整性健檢') || !phase3.elements.dialogContent.innerHTML.includes('假別額度已超出')) throw new Error('Phase 4 data health report did not surface quota warnings');
if (phase3.storage.get('salarymate_v310_state') !== beforeHealthCheck) throw new Error('Phase 4 data health report changed persisted user data');

const restoreTarget = boot();
restoreTarget.elements.jsonImport.files = [{ text: async () => jsonDownload.content }];
dispatch(restoreTarget, 'change', { target: restoreTarget.elements.jsonImport });
await new Promise((resolve) => setImmediate(resolve));
if (!restoreTarget.elements.dialogContent.innerHTML.includes('還原備份資料')) throw new Error('Phase 4 JSON import did not open the replacement confirmation');
phase4Action(restoreTarget, 'confirm-action');
const restoredState = JSON.parse(restoreTarget.storage.get('salarymate_v310_state'));
if (restoredState.schemaVersion !== 13 || restoredState.records.length !== exportedState.records.length || restoredState.leaveRecords.length !== exportedState.leaveRecords.length) {
  throw new Error('Phase 4 JSON backup could not complete a round-trip restore');
}

const unhealthy = boot({
  salarymate_v310_state: JSON.stringify({
    schemaVersion: 8,
    companies: [{ id: 'health-company', name: '健檢公司', isCurrent: true, employmentStartDate: '', leavePolicies: { annual: { mode: 'auto', quotaDays: 0 } } }],
    records: [
      { id: 'health-r1', companyId: 'health-company', year, month: 6, baseSalary: 30000, customDeductions: [{ id: 'stale-link', name: '請假扣款', amount: 999, sourceType: 'leave-payroll', sourceKey: 'wrong-key' }] },
      { id: 'health-r2', companyId: 'health-company', year, month: 6, baseSalary: 31000 },
      { id: 'health-orphan', companyId: 'missing-company', year, month: 7, baseSalary: 32000 }
    ],
    overtimeLogs: [{ id: 'health-ot', date: 'not-a-date', companyId: 'health-company', hours: 0, hourlyRate: 0 }],
    leaveRecords: [{ id: 'health-leave', startDate: 'invalid', endDate: 'invalid', companyId: 'health-company', type: 'personal', durationMode: 'full_day', status: 'confirmed' }]
  })
});
phase4Action(unhealthy, 'data-health');
const unhealthyHtml = unhealthy.elements.dialogContent.innerHTML;
if (!unhealthyHtml.includes('存在找不到公司的紀錄') || !unhealthyHtml.includes('同公司同月份有重複薪資') || !unhealthyHtml.includes('請假日期或時數無法計算') || !unhealthyHtml.includes('加班資料不完整')) throw new Error('Phase 4 data health errors were not detected');
if (!unhealthyHtml.includes('請假扣款連動需要更新') || !unhealthyHtml.includes('特休自動試算尚未啟用')) throw new Error('Phase 4 data health warnings were not detected');

changeSelect('calculatorCompany', 'c1');
changeSelect('hourlyMonth', '8');
dispatch(linked, 'click', {
  target: {
    closest(selector) {
      if (selector === '[data-action]') return { dataset: { action: 'load-calculator-record' }, closest: () => null };
      return null;
    }
  },
  stopPropagation() {}
});
const linkedState = JSON.parse(linked.storage.get('salarymate_v310_state'));
if (linkedState.overtimeCalculator.companyId !== 'c1') throw new Error('Calculator company linkage was not persisted');
if (linkedState.overtimeCalculator.hours.first !== 2) throw new Error('Calculator did not load both cross-month August overtime logs');
if (linkedState.overtimeCalculator.positionAllowance !== 3000 || linkedState.overtimeCalculator.attendanceBonus !== 3000 || linkedState.overtimeCalculator.otherFixed !== 0) throw new Error('Calculator did not load fixed salary items without counting one-time earnings');
dispatch(linked, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'hourly' } } : null },
  stopPropagation() {}
});
dispatch(linked, 'change', { target: { id: '', value: '2', dataset: { calcSetting: 'leaveCount' }, closest: () => null } });
let hourlyHtml = linked.elements.mainContent.innerHTML;
if (!hourlyHtml.includes(`${year}/07/16～${year}/08/15`)) throw new Error('Calculator did not display the linked company period');
if (!hourlyHtml.includes('−$1,000')) throw new Error('Company deduction rule did not affect the calculator result');
if (hourlyHtml.includes('時間價值診斷')) throw new Error('Optional time-value analysis was not hidden by default');
phase4Action(linked, 'toggle-hourly-advanced');
hourlyHtml = linked.elements.mainContent.innerHTML;
if (!hourlyHtml.includes('$247')) throw new Error('Time-value nominal rate did not include position and custom fixed earnings');

const growth = boot({
  salarymate_v310_state: JSON.stringify({
    schemaVersion: 10,
    appVersion: '3.6.0',
    companies: [{ id: 'growth-company', name: '薪資成長測試公司', isCurrent: true, baseSalary: 30000, mealAllowance: 3000, positionAllowance: 0, fixedEarnings: [], employmentStartDate: `${year - 2}-01-01`, workHoursPerDay: 8 }],
    records: [],
    overtimeLogs: [{ id: 'snapshot-ot', date: `${year}-08-01`, companyId: 'growth-company', type: 'weekday', hours: 1, hourlyRate: 100.111, note: '獨立快照測試' }],
    leaveRecords: [],
    salaryAdjustments: [{ id: 'raise-1', companyId: 'growth-company', effectiveDate: `${year}-02-01`, baseSalary: 60000, mealAllowance: 3000, positionAllowance: 0, fixedEarnings: [], previousFixedSalary: 33000, reason: 'annual', note: '加薪後不得改動舊加班' }],
    yearEndEstimates: []
  })
});
dispatch(growth, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'overtime' } } : null },
  stopPropagation() {}
});
const snapshotHtml = growth.elements.mainContent.innerHTML;
if (!snapshotHtml.includes('$100.111') || !snapshotHtml.includes('$134')) throw new Error('Daily overtime hourly rate was not rendered/calculated from its stored three-decimal snapshot');

dispatch(growth, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'hourly' } } : null },
  stopPropagation() {}
});
dispatch(growth, 'click', {
  target: { closest: (selector) => selector === '[data-salary-tab]' ? { dataset: { salaryTab: 'raises' } } : null },
  stopPropagation() {}
});
if (!growth.elements.mainContent.innerHTML.includes('每年加薪紀錄') || !growth.elements.mainContent.innerHTML.includes('$63,000')) throw new Error('Salary adjustment history did not render the effective salary profile');
dispatch(growth, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'add-record' }, closest: () => null } : null },
  stopPropagation() {}
});
if (!/name="baseSalary"[^>]*value="60000"/.test(growth.elements.dialogContent.innerHTML)) throw new Error('New salary record did not use the effective salary adjustment snapshot');
phase4Action(growth, 'close-dialog');

dispatch(growth, 'click', {
  target: { closest: (selector) => selector === '[data-salary-tab]' ? { dataset: { salaryTab: 'yearend' } } : null },
  stopPropagation() {}
});
const yearEndHtml = growth.elements.mainContent.innerHTML;
if (!yearEndHtml.includes('年終條件') || !yearEndHtml.includes('績效級距') || !yearEndHtml.includes('$153,900')) throw new Error('Year-end calculator did not use the effective salary and default grade rules');
if (JSON.parse(growth.storage.get('salarymate_v310_state')).overtimeLogs[0].hourlyRate !== 100.111) throw new Error('Salary growth interactions mutated the stored daily overtime hourly rate');

const dispatchHourly = boot();
phase4Action(dispatchHourly, 'manage-companies');
dispatchHourly.elements.companyForm.formData = {
  name: '派遣時薪測試公司',
  position: '派遣技術員',
  isCurrent: 'true',
  employmentMode: 'dispatch_hourly',
  baseHourlyRate: '200.111',
  defaultRegularHours: '160',
  mealAllowance: '0',
  positionAllowance: '0',
  laborIns: '0',
  healthIns: '0',
  employmentStartDate: `${year - 1}-01-01`,
  workHoursPerDay: '8',
  leaveQuotaCycle: 'calendar',
  payrollPeriodType: 'calendar',
  leaveDeductionEach: '0',
  deductionRuleNote: '派遣時薪測試'
};
dispatch(dispatchHourly, 'change', {
  target: {
    id: '',
    name: 'employmentMode',
    value: 'dispatch_hourly',
    dataset: {},
    closest: (selector) => selector === '#companyForm' ? dispatchHourly.elements.companyForm : null
  }
});
if (!dispatchHourly.elements.dialogContent.innerHTML.includes('預設基本時薪') || !dispatchHourly.elements.dialogContent.innerHTML.includes('每月預設正常工時') || !dispatchHourly.elements.dialogContent.innerHTML.includes('$32,018')) {
  throw new Error('Dispatch-hourly company mode did not render its rate, hours, and projected base pay');
}
phase4Action(dispatchHourly, 'save-company');
let dispatchState = JSON.parse(dispatchHourly.storage.get('salarymate_v310_state'));
const dispatchCompany = dispatchState.companies.find((company) => company.name === '派遣時薪測試公司');
if (!dispatchCompany || dispatchCompany.employmentMode !== 'dispatch_hourly' || dispatchCompany.baseHourlyRate !== 200.111 || dispatchCompany.defaultRegularHours !== 160) {
  throw new Error('Dispatch-hourly company defaults were not persisted with three-decimal precision');
}
phase4Action(dispatchHourly, 'close-dialog');
phase4Action(dispatchHourly, 'add-record');
if (!/name="baseHourlyRate"[^>]*value="200\.111"/.test(dispatchHourly.elements.dialogContent.innerHTML) || !/name="regularHours"[^>]*value="160"/.test(dispatchHourly.elements.dialogContent.innerHTML) || !dispatchHourly.elements.dialogContent.innerHTML.includes('id="recordBasePayPreview"') || !dispatchHourly.elements.dialogContent.innerHTML.includes('$32,018')) {
  throw new Error('New dispatch salary did not inherit the company rate/hours snapshot or calculate base pay');
}
dispatchHourly.elements.recordForm.formData = {
  companyId: dispatchCompany.id,
  year: String(year),
  month: '6',
  payDate: `${year}-07-05`,
  employmentMode: 'dispatch_hourly',
  baseHourlyRate: '200.111',
  regularHours: '160',
  mealAllowance: '0',
  positionAllowance: '0',
  overtime: '0',
  bonus: '0',
  laborIns: '0',
  healthIns: '0',
  taxWithheld: '0',
  otherDeduction: '0',
  pensionSelf: '0',
  sideIncome: '0',
  note: '派遣快照測試'
};
dispatch(dispatchHourly, 'submit', { target: dispatchHourly.elements.recordForm, preventDefault() {} });
dispatchState = JSON.parse(dispatchHourly.storage.get('salarymate_v310_state'));
const dispatchRecord = dispatchState.records.find((record) => record.note === '派遣快照測試');
if (!dispatchRecord || dispatchRecord.employmentMode !== 'dispatch_hourly' || dispatchRecord.baseHourlyRate !== 200.111 || dispatchRecord.regularHours !== 160 || dispatchRecord.baseSalary !== 32018) {
  throw new Error('Dispatch salary snapshot or hourly-to-base-pay conversion was not persisted');
}
phase4Action(dispatchHourly, 'manage-companies');
dispatch(dispatchHourly, 'click', {
  target: { closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'edit-company', id: dispatchCompany.id }, closest: () => null } : null },
  stopPropagation() {}
});
dispatchHourly.elements.companyForm.formData = {
  ...dispatchHourly.elements.companyForm.formData,
  baseHourlyRate: '250.222'
};
phase4Action(dispatchHourly, 'save-company');
dispatchState = JSON.parse(dispatchHourly.storage.get('salarymate_v310_state'));
const unchangedDispatchRecord = dispatchState.records.find((record) => record.note === '派遣快照測試');
if (dispatchState.companies[0].baseHourlyRate !== 250.222 || unchangedDispatchRecord.baseHourlyRate !== 200.111 || unchangedDispatchRecord.baseSalary !== 32018) {
  throw new Error('Editing a dispatch company incorrectly rewrote an existing salary snapshot');
}
phase4Action(dispatchHourly, 'close-dialog');
phase4Action(dispatchHourly, 'add-overtime');
if (!/name="hourlyRate"[^>]*value="250\.222"/.test(dispatchHourly.elements.dialogContent.innerHTML)) {
  throw new Error('New dispatch overtime did not receive an editable company-rate suggestion');
}
phase4Action(dispatchHourly, 'close-dialog');
dispatch(dispatchHourly, 'click', {
  target: { closest: (selector) => selector === '[data-tab]' ? { dataset: { tab: 'hourly' } } : null },
  stopPropagation() {}
});
phase4Action(dispatchHourly, 'toggle-hourly-advanced');
if (!/名義合約時薪[\s\S]{0,220}\$200/.test(dispatchHourly.elements.mainContent.innerHTML)) {
  throw new Error('Time-value analysis did not use the stored dispatch salary rate/hours snapshot');
}
dispatch(dispatchHourly, 'click', {
  target: { closest: (selector) => selector === '[data-salary-tab]' ? { dataset: { salaryTab: 'yearend' } } : null },
  stopPropagation() {}
});
if (!dispatchHourly.elements.mainContent.innerHTML.includes('派遣時薪制以「$250.222 × 160 小時」換算月基數') || !dispatchHourly.elements.mainContent.innerHTML.includes('$40,036')) {
  throw new Error('Year-end estimate did not use the active dispatch-hourly company profile');
}
dispatch(dispatchHourly, 'click', {
  target: { closest: (selector) => selector === '[data-salary-tab]' ? { dataset: { salaryTab: 'raises' } } : null },
  stopPropagation() {}
});
phase4Action(dispatchHourly, 'add-salary-adjustment');
if (!/name="baseHourlyRate"[^>]*value="250\.222"/.test(dispatchHourly.elements.dialogContent.innerHTML) || !/name="regularHours"[^>]*value="160"/.test(dispatchHourly.elements.dialogContent.innerHTML)) {
  throw new Error('Dispatch-hourly salary adjustment did not inherit the active hourly profile');
}

console.log('PASS: application boot, employment tenure years/days, schema 13 migration, independent layout and color themes, mobile swipe navigation, dispatch-hourly snapshots, independent overtime-rate snapshots, company fixed earnings, salary growth, year-end estimates, monthly menstrual leave allowance, Phase 3 analytics, Phase 4 backup/restore, export safety, health checks, and payroll calculations');
