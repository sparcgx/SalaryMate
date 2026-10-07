import fs from 'node:fs';

const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../.openai/hosting.json', import.meta.url), 'utf8'));
const failures = [];

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
expect(Boolean(scriptMatch), 'inline application script is missing');
if (scriptMatch) {
  try {
    new Function(scriptMatch[1]);
  } catch (error) {
    failures.push(`JavaScript syntax error: ${error.message}`);
  }
}

expect(manifest.static?.directory === 'dist', 'static.directory must be dist');
expect(typeof manifest.project_id === 'string' && manifest.project_id.length > 0, 'project_id is missing');
expect(!/[\u2060\uFFFC\uFFFD]/u.test(html), 'corrupted invisible or replacement characters remain');
expect(!/(?:src|href)="https?:\/\//i.test(html), 'external runtime dependency detected');
expect(!html.includes('company-form-actions'), 'obsolete in-scroll company action bar remains');
expect(!html.includes('個人薪資與收入管理'), 'legacy product name remains in the current application UI');
expect(/<\/header>\s*<div class="nav-shell">/.test(html), 'primary navigation must remain outside the sticky topbar');

for (const required of [
  'salarymate_v310_state',
  'my_salary_records_v2',
  '個人薪資管理',
  'v3.11.1 生理假月額度版',
  '各月薪資明細',
  '工時／出勤管理',
  'data-attendance-tab="overtime"',
  'data-attendance-tab="leave"',
  'leaveRecords',
  'normalizeLeave',
  'employmentStartDate',
  'employmentTenure',
  '到職年資',
  '請設定第一天上班日',
  'annualLeaveCycle',
  '普通病假的全勤獎金自 2026/1/1 起僅得按請假日數比例扣發',
  'data-action="add-leave"',
  'id="leaveForm"',
  '薪資成長與試算',
  'overtimeCalculator',
  'payrollPeriodType',
  '前月 16 日～本月 15 日',
  'salaryMonthForDate',
  'overtimeForSalaryMonth',
  'SCHEMA_VERSION = 13',
  'positionAllowance',
  'employmentMode',
  'dispatch_hourly',
  '派遣（時薪）',
  'baseHourlyRate',
  'defaultRegularHours',
  'regularHours',
  'recordBasePayPreview',
  '派遣薪資快照不完整',
  'fixedEarnings',
  'affectsHourly',
  'recordHourlyBase',
  'companyFixedSalary',
  'data-action="add-company-fixed"',
  'data-action="remove-company-fixed"',
  '固定加給與津貼',
  '加班時薪除數',
  '每日加班時薪',
  '日後公司加薪或減薪不會回溯修改',
  'salaryAdjustments',
  'yearEndEstimates',
  'data-salary-tab="overtime"',
  'data-salary-tab="yearend"',
  'data-salary-tab="raises"',
  '年終條件',
  '績效級距',
  '每年加薪紀錄',
  'toggle-hourly-advanced',
  'leavePolicies',
  'leaveQuotaCycle',
  'leaveQuotaSummary',
  'calendarMonthLeaveCycle',
  "mode: 'monthly_once'",
  'data-fixed-leave-policy="menstrual"',
  '每個曆月 1 天',
  'LEAVE_KPI_TYPES',
  "type: 'annual', label: '特休'",
  "type: 'personal', label: '事假'",
  "type: 'sick', label: '病假'",
  "type: 'menstrual', label: '生理假'",
  'data-leave-kpi="${escapeAttr(definition.type)}"',
  '使用數',
  '剩餘數',
  '假別額度管理',
  '假別額度總覽',
  '每月推估出勤率',
  '假別時數分布',
  'attendanceAnalysis',
  '上方分析不受表格的狀態篩選影響',
  'data-action="export-leave-csv"',
  'data-action="export-attendance-csv"',
  'data-action="data-health"',
  'exportLeaveCsv',
  'exportAttendanceCsv',
  'dataHealthReport',
  '資料完整性健檢',
  'durationMode',
  'status: [\'planned\', \'confirmed\', \'cancelled\']',
  'leaveAllocations',
  '跨計薪區間，自動拆分為',
  'data-action="sync-leave"',
  'data-action="unlink-leave"',
  'sourceType: \'leave-payroll\'',
  '不會重複累加',
  'data-calc-multiplier',
  '國定假日 1 倍',
  '星期天／國定假日 1 倍／春節',
  'data-action="save-company"',
  'data-dialog-footer="company"',
  'max-height: min(90dvh, 900px)',
  'uiPreferences',
  'spring: 2.5',
  '年度所得與扣繳對帳',
  'export-json',
  'importJson'
]) {
  expect(html.includes(required), `required feature marker missing: ${required}`);
}

for (const pwaFeature of [
  'rel="manifest" href="./manifest.webmanifest"',
  'apple-mobile-web-app-capable',
  'data-action="install-app"',
  'data-action="apply-pwa-update"',
  'beforeinstallprompt',
  "navigator.serviceWorker.register('./sw.js'",
  'SKIP_WAITING',
  'PWA 安裝版'
]) {
  expect(html.includes(pwaFeature), `PWA marker missing: ${pwaFeature}`);
}

for (const interfaceFeature of [
  'INTERFACE_MODES',
  'COLOR_THEMES',
  'data-ui-mode="standard"',
  'data-color-theme="teal"',
  'data-action="open-interface-settings"',
  'data-action="set-interface-mode"',
  'data-action="set-color-theme"',
  '清爽卡片',
  '極簡清單',
  '高效緊湊',
  '大字易讀',
  '翡翠綠',
  '海洋藍',
  '靛青紫',
  '暖陽橘',
  '莓果紅',
  '石墨灰',
  'interfaceMode: normalizeInterfaceMode',
  'colorTheme: normalizeColorTheme',
  'body[data-ui-mode="minimal"]',
  'body[data-ui-mode="compact"]',
  'body[data-ui-mode="large"]',
  'body[data-color-theme="blue"]',
  'body[data-color-theme="violet"]',
  'body[data-color-theme="amber"]',
  'body[data-color-theme="rose"]',
  'body[data-color-theme="slate"]',
  'aria-label="日常管理"',
  'aria-label="分析與規劃"',
  '備份與匯出',
  '資料維護'
]) {
  expect(html.includes(interfaceFeature), `interface architecture marker missing: ${interfaceFeature}`);
}

for (const mobileFix of [
  '#companyFilter { grid-column: 1 / -1; }',
  'bottom: calc(76px + env(safe-area-inset-bottom));',
  '#toast.toast {',
  '.metric-grid.three { grid-template-columns: 1fr; }',
  '.view > *, .page-head > *, .card { min-width: 0; }',
  '-webkit-overflow-scrolling: touch;',
  'z-index: 70;',
  'transform: translateZ(0);',
  'isolation: isolate;',
  'PRIMARY_TABS',
  "mainContent.addEventListener('touchstart'",
  "mainContent.addEventListener('touchend'",
  'swipeBlockedSelector',
  "selectPrimaryTab(PRIMARY_TABS[nextIndex], 'auto')"
]) {
  expect(html.includes(mobileFix), `mobile layout safeguard missing: ${mobileFix}`);
}

for (const mobileZoomFix of [
  '.field, .field-select, .field-textarea, .top-select, .calc-input, .calc-input.compact {',
  'font-size: 16px;',
  'dialogReturnScrollY',
  "window.matchMedia?.('(pointer: coarse)')",
  "typeof active?.blur === 'function'",
  "const returnTarget = dialogReturnFocus && dialogReturnFocus.isConnected !== false ? dialogReturnFocus : $('#mainContent');",
  "behavior: 'auto'"
]) {
  expect(html.includes(mobileZoomFix), `mobile dialog zoom safeguard missing: ${mobileZoomFix}`);
}

for (const performanceFix of [
  'wholeNumberFormatter',
  'calculationCache',
  'invalidateCalculationCache',
  'calculationCache.filteredRecords',
  'calculationCache.hourlyMetrics',
  'calculationCache.attendanceAnalysis'
]) {
  expect(html.includes(performanceFix), `performance safeguard missing: ${performanceFix}`);
}

for (const visualFix of [
  '.attendance-trend-scroll { overflow-x: auto; overflow-y: hidden; }',
  'class="table-scroll attendance-trend-scroll"'
]) {
  expect(html.includes(visualFix), `visual regression safeguard missing: ${visualFix}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('PASS: static entrypoint, syntax, portability, migration, and core feature markers');
