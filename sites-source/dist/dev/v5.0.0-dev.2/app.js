
  (() => {
    'use strict';

    const APP_VERSION = '5.0.0-dev.2-R83';
    const SCHEMA_VERSION = 15;
    const STORAGE_KEY = 'salarymate_v5_full_state';
    const LEGACY_KEYS = {
      records: 'v5_full_unused_my_salary_records_v2',
      companies: 'v5_full_unused_my_salary_companies_v2',
      overtime: 'v5_full_unused_my_salary_overtime_v2',
      hourly: 'v5_full_unused_my_salary_hourly_settings_v2'
    };
    const DEFAULT_DEDUCTION_RULE = '事假、病假、曠職或遲到達門檻時，每次依設定金額扣款。';
    const LEAVE_TYPES = {
      annual: { label: '特休', paidRatio: 100 },
      sick: { label: '普通病假', paidRatio: 50 },
      personal: { label: '事假', paidRatio: 0 },
      family: { label: '家庭照顧假', paidRatio: 0 },
      compensatory: { label: '補休', paidRatio: 100 },
      marriage: { label: '婚假', paidRatio: 100 },
      funeral: { label: '喪假', paidRatio: 100 },
      menstrual: { label: '生理假', paidRatio: 50 },
      occupational: { label: '公傷病假', paidRatio: 100 },
      public: { label: '公假', paidRatio: 100 },
      other: { label: '其他假別', paidRatio: 0 }
    };
    const LEAVE_KPI_TYPES = Object.freeze([
      { type: 'annual', label: '特休', icon: '特', tone: 'green' },
      { type: 'personal', label: '事假', icon: '事', tone: 'amber' },
      { type: 'sick', label: '病假', icon: '病', tone: 'blue' },
      { type: 'menstrual', label: '生理假', icon: '生', tone: 'rose' }
    ]);
    const defaultLeavePolicies = () => Object.fromEntries(Object.keys(LEAVE_TYPES).map((type) => [type, {
      mode: type === 'annual' ? 'auto' : 'unlimited',
      quotaDays: 0
    }]));
    const defaultYearEndGrades = () => [
      { id: 'grade_aplus', name: 'A+', multiplier: 2 },
      { id: 'grade_a', name: 'A', multiplier: 1.7 },
      { id: 'grade_aminus', name: 'A-', multiplier: 1.3 },
      { id: 'grade_b', name: 'B', multiplier: 1.1 },
      { id: 'grade_c', name: 'C', multiplier: 0 },
      { id: 'grade_d', name: 'D', multiplier: 0 }
    ];
    const INTERFACE_MODES = Object.freeze({
      standard: {
        name: '標準',
        description: '保留完整說明與圖表，以清楚卡片層級呈現。',
        previewClass: ''
      },
      minimal: {
        name: '標準',
        description: '降低陰影與裝飾，讓文字、金額與資料成為焦點。',
        previewClass: 'minimal'
      },
      compact: {
        name: '緊湊',
        description: '縮短間距並提高資訊密度，適合經常查帳與輸入。',
        previewClass: 'compact'
      },
      large: {
        name: '大字',
        description: '放大文字、欄位與操作按鈕，長時間使用更清楚。',
        previewClass: 'large'
      }
    });
    const COLOR_THEMES = Object.freeze({
      teal: { name: '翡翠綠', color: '#0f766e', accent: '#14b8a6', themeColor: '#0f766e' },
      blue: { name: '海洋藍', color: '#1d4ed8', accent: '#3b82f6', themeColor: '#1d4ed8' },
      pink: { name: '粉色', color: '#ab3867', accent: '#efb1cd', themeColor: '#ab3867' },
      violet: { name: '靛青紫', color: '#7047a8', accent: '#bfa8e9', themeColor: '#7047a8' },
      amber: { name: '暖陽橘', color: '#95600d', accent: '#f2c46d', themeColor: '#95600d' },
      rose: { name: '莓果紅', color: '#ad3c53', accent: '#ea9bac', themeColor: '#ad3c53' },
      slate: { name: '石墨灰', color: '#475569', accent: '#64748b', themeColor: '#475569' }
    });
    const INTERFACE_STYLES = Object.freeze({
      doodle: { name: '繽紛手繪', note: '手繪粗框、貼紙按鈕與印章標籤', reference: true },
      cream: { name: '奶油暖陽', note: '香檳浮雕、陶瓷欄位與圓潤按鈕', reference: true },
      dusk: { name: '晚霧星紫', note: '銀紫晶框、星霧表頭與微光欄位', reference: true },
      pencil: { name: '彩鉛日常', note: '紙頁對話框、虛線欄位與彩鉛索引', reference: true },
      studio: { name: '清爽工作室', note: '藍圖表頭、刻度邊線與俐落折角', reference: true },
      'macaron-luxe': { name: '馬卡龍糖果・華麗版', note: '粉彩緞邊、糖霜欄位與夾心按鈕', baseStyle: 'macaron', ornate: true },
      'pixel-luxe': { name: '奇幻 HD-2D・華麗版', note: '晶羽夥伴、藍金對話框與嵌金欄位', baseStyle: 'pixel', ornate: true },
      glass: { name: '動態霧面玻璃', note: '透亮邊線、磨砂卡片與內凹欄位' },
      cards: { name: '經典卡片', note: '文件卡片、整齊表頭與清晰層次' },
      dark: { name: '深色', note: '石墨面板、霧銀邊線與深色內凹欄位' }
    });
    const HD2D_BACKGROUNDS = Object.freeze({
      canyon: { name: '奇幻峽谷', note: '群山、瀑布與古老城鎮' },
      forest: { name: '秘境森林', note: '翠綠林海與發光溪流' },
      harbor: { name: '夕陽港灣', note: '琥珀晚霞與寧靜海港' },
      aurora: { name: '極光雪城', note: '靛藍雪夜與青綠極光' },
      sky: { name: '天空浮島', note: '雲海、浮島與金色遺跡' }
    });
    const PRIMARY_TABS = Object.freeze(['dashboard', 'records', 'calendar', 'investment', 'tax', 'settings']);
    const ROUTE_TABS = Object.freeze([...PRIMARY_TABS, 'hourly', 'overtime', 'companies']);

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let accessibilityIdSeed = 0;
    const ensureAccessibilityId = (element, prefix = 'salarymate-a11y') => {
      if (!element) return '';
      if (!element.id) element.id = `${prefix}-${++accessibilityIdSeed}`;
      return element.id;
    };
    const enhanceFormAccessibility = (root = document) => {
      $$('label', root).forEach((label) => {
        const control = label.querySelector('input:not([type=hidden]), select, textarea');
        if (!control) return;
        ensureAccessibilityId(control, 'salarymate-field');
        if (control.required) control.setAttribute('aria-required', 'true');
        const hint = label.querySelector('.hint');
        if (hint) {
          const hintId = ensureAccessibilityId(hint, 'salarymate-hint');
          const ids = new Set(String(control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
          ids.add(hintId);
          control.setAttribute('aria-describedby', Array.from(ids).join(' '));
        }
      });
    };
    const focusPageHeading = () => afterPaint(() => {
      const heading = $('#mainContent h2, #mainContent h1');
      if (!heading) return $('#mainContent')?.focus?.({ preventScroll: true });
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    });
    const currentYear = new Date().getFullYear();

    const newId = (prefix) => {
      const value = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return `${prefix}_${value}`;
    };

    const defaultOvertimeCalculator = () => ({
      companyId: '',
      baseSalary: 0,
      mealAllowance: 0,
      attendanceBonus: 0,
      positionAllowance: 0,
      otherFixed: 0,
      overtimeDivisor: 240,
      periodStartDay: 16,
      periodEndDay: 15,
      leaveCount: 0,
      leaveDeductionEach: 500,
      variableAdjustment: 0,
      ruleNote: DEFAULT_DEDUCTION_RULE,
      multipliers: {
        regular: 1,
        first: 1.34,
        second: 1.67,
        holiday: 2,
        restExtra: 2.67,
        spring: 2.5
      },
      hours: {
        regular: 0,
        first: 0,
        second: 0,
        holiday: 0,
        restExtra: 0,
        spring: 0
      }
    });

    const emptyState = () => ({
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      updatedAt: new Date().toISOString(),
      companies: [],
      records: [],
      investmentRecords: [],
      stockPortfolio: window.SalaryMateStocks.empty(),
      overtimeLogs: [],
      leaveRecords: [],
      compTimeCredits: [],
      compTimeSettlements: [],
      yearEndEstimates: [],
      salaryAdjustments: [],
      overtimeCalculator: defaultOvertimeCalculator(),
      uiPreferences: {
        companyFilter: 'ALL',
        selectedYear: currentYear,
        attendanceTab: 'overtime',
        overtimeMonth: 0,
        leaveMonth: 0,
        leaveStatus: 'active',
        hourlyMonth: 0,
        salaryCalcTab: 'overtime',
        hourlyAdvancedOpen: false,
        yearEndCompanyId: '',
        raiseCompanyId: '',
        interfaceStyle: 'glass',
        hd2dBackground: 'canyon',
        surfaceOpacity: 'frosted',
        motionEffect: 'flow',
        interfaceMode: 'minimal',
        colorTheme: 'slate'
      },
      hourlySettings: {
        standardHours: 174,
        workDays: 22,
        commuteMinsDay: 60,
        commuteCostMonth: 1200,
        prepMinsDay: 30,
        sideHoursMonth: 10
      }
    });

    let state = emptyState();
    const ui = {
      tab: 'dashboard',
      selectedYear: currentYear,
      companyFilter: 'ALL',
      attendanceTab: 'overtime',
      overtimeMonth: 0,
      leaveMonth: 0,
      leaveStatus: 'active',
      hourlyMonth: 0,
      salaryCalcTab: 'overtime',
      hourlyAdvancedOpen: false,
      yearEndCompanyId: '',
      raiseCompanyId: '',
      interfaceStyle: 'glass',
      hd2dBackground: 'canyon',
        surfaceOpacity: 'frosted',
        motionEffect: 'flow',
      interfaceMode: 'minimal',
      colorTheme: 'slate',
      search: '',
      expandedRecords: new Set(),
      recordDraft: null,
      payrollStep: 1,
      dialogBaseline: '',
      companyDraft: null,
      companyDetailId: '',
      companyDetailSection: 'overview',
      salaryRulesDraft: null,
      payrollCycleDraft: null,
      overtimeDraft: null,
      leaveDraft: null,
      yearEndDraft: null,
      salaryAdjustmentDraft: null,
      confirmAction: null,
      draftScope: null,
      selectedEntityScope: null,
      migratedLegacy: false
    };

    const APP_DATA_STATES = Object.freeze(['idle', 'loading', 'ready', 'empty', 'invalid', 'failure']);
    const OPERATION_STATES = Object.freeze(['idle', 'loading', 'submitting', 'failure']);
    const runtimeState = {
      dataStatus: 'idle',
      dataMessage: '',
      operationStatus: 'idle',
      operationName: '',
      operationMessage: '',
      generation: 0
    };
    const activeOperationLocks = new Set();
    const recentOperationLocks = new Map();
    const OPERATION_DEDUP_MS = 900;
    const acquireOperationLock = (key) => {
      const normalized = String(key || 'operation');
      const last = recentOperationLocks.get(normalized) || 0;
      if (activeOperationLocks.has(normalized) || Date.now() - last < OPERATION_DEDUP_MS) return false;
      activeOperationLocks.add(normalized);
      return true;
    };
    const releaseOperationLock = (key, succeeded = false) => {
      const normalized = String(key || 'operation');
      activeOperationLocks.delete(normalized);
      if (succeeded) recentOperationLocks.set(normalized, Date.now());
    };
    const bumpContextGeneration = () => { runtimeState.generation += 1; return runtimeState.generation; };
    const contextGeneration = () => runtimeState.generation;
    const isContextGenerationCurrent = (value) => Number(value) === runtimeState.generation;
    const setDataStatus = (status, message = '') => {
      runtimeState.dataStatus = APP_DATA_STATES.includes(status) ? status : 'failure';
      runtimeState.dataMessage = String(message || '');
      return runtimeState.dataStatus;
    };
    const setOperationStatus = (status = 'idle', name = '', message = '') => {
      runtimeState.operationStatus = OPERATION_STATES.includes(status) ? status : 'failure';
      runtimeState.operationName = String(name || '');
      runtimeState.operationMessage = String(message || '');
      return runtimeState.operationStatus;
    };
    const domainRecordCount = () => state.companies.length + state.records.length + state.overtimeLogs.length + state.leaveRecords.length + state.compTimeCredits.length + state.compTimeSettlements.length + state.salaryAdjustments.length + state.yearEndEstimates.length;
    const classifyDataStatus = () => {
      if (!domainRecordCount()) return 'empty';
      if (!state.companies.length) return 'invalid';
      const currentCount = state.companies.filter((company) => company.isCurrent).length;
      if (currentCount !== 1) return 'invalid';
      return 'ready';
    };
    const syncDataStatusFromState = () => setDataStatus(classifyDataStatus(), classifyDataStatus() === 'invalid' ? '目前公司設定資料需要確認。請前往公司管理選擇唯一的目前公司。' : '');

    const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const wholeNumberFormatter = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
    const rateNumberFormatter = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    const hourlyRateNumberFormatter = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const money = (value) => wholeNumberFormatter.format(Math.round(numberValue(value)));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, numberValue(value)));
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
    const escapeAttr = escapeHtml;
    const userHtml = value => window.SalaryMateI18n.user(escapeHtml(value));
    const normalizeInterfaceStyle = value => {
      const key = value === 'white' ? 'cards' : value === 'macaron' ? 'macaron-luxe' : value === 'pixel' ? 'pixel-luxe' : value;
      return Object.prototype.hasOwnProperty.call(INTERFACE_STYLES, key) ? key : 'glass';
    };
    const interfaceBaseStyle = value => { const style = normalizeInterfaceStyle(value); return INTERFACE_STYLES[style].baseStyle || style; };
    const HD2D_COMPANION_SRC = './art/jingyu-hd2d-r74.png';
    const HD2D_FLIGHT_SOURCES = Object.freeze(["./art/jingyu-flight-r73-a.png","./art/jingyu-flight-r73-b.png","./art/jingyu-flight-r73-c.png","./art/jingyu-flight-r73-d.png"]);
    window.SalaryMateFlightSheets = HD2D_FLIGHT_SOURCES;
    const HD2D_WIND_SOURCES = Object.freeze(["./art/jingyu-wind-blade-r75.png","./art/jingyu-wind-tornado-r75.png"]);
    window.SalaryMateWindArt = HD2D_WIND_SOURCES;
    const HD2D_WIND_EXTRAS = Object.freeze(["./art/jingyu-wind-bullet-r78.png","./art/jingyu-wind-spear-r78.png","./art/jingyu-wind-vortex-r78.png"]);
    window.SalaryMateWindExtras = HD2D_WIND_EXTRAS;
    const HD2D_CAST_SRC = './art/jingyu-cast-r76.png';
    window.SalaryMateCastArt = HD2D_CAST_SRC;
    const hd2dCompanion = (variant = 'heading') => {
      const kind = ['home','heading','quiet','toast','preview','interactive'].includes(variant) ? variant : 'heading';
      if (kind !== 'preview' && interfaceBaseStyle(ui.interfaceStyle) !== 'pixel') return '';
      if (kind === 'interactive') return `<button type="button" class="v5-companion v5-companion--interactive" data-action="jingyu-fly" aria-label="晶羽：點一下飛行，再點停止" aria-pressed="false" title="點一下，晶羽陪你飛一圈"><img class="v5-companion-art" src="${HD2D_COMPANION_SRC}" width="128" height="128" alt="" decoding="async" draggable="false"></button>`;
      return `<span class="v5-companion v5-companion--${kind}" aria-hidden="true"><img class="v5-companion-art" src="${HD2D_COMPANION_SRC}" width="128" height="128" alt="" decoding="async" draggable="false">${kind === 'home' ? '<span class="v5-companion-name">晶羽</span>' : ''}</span>`;
    };
    const normalizeSurfaceOpacity = value => value === 'transparent' ? 'translucent' : ['translucent','frosted','dynamic','multi-dynamic'].includes(value) ? value : 'frosted';
    // Retain R52's saved background choice only for backup compatibility.
    const normalizeMotionEffect = value => ['flow','aurora','particles','meteors','rings','grid'].includes(value) ? value : 'flow';
    const normalizeHd2dBackground = value => Object.prototype.hasOwnProperty.call(HD2D_BACKGROUNDS, value) ? value : 'canyon';
    const normalizeInterfaceMode = (value) => Object.prototype.hasOwnProperty.call(INTERFACE_MODES, value) ? value : 'standard';
    const normalizeColorTheme = (value) => Object.prototype.hasOwnProperty.call(COLOR_THEMES, value) ? value : 'teal';
    const applyInterfaceMode = (value = ui.interfaceMode) => {
      const mode = normalizeInterfaceMode(value);
      ui.interfaceMode = mode;
      document.body.dataset.uiMode = mode;
      document.documentElement.dataset.uiMode = mode;
      return mode;
    };
    const applyColorTheme = (value = ui.colorTheme) => {
      const theme = normalizeColorTheme(value);
      ui.colorTheme = theme;
      document.body.dataset.colorTheme = theme;
      const themeMeta = $('meta[name="theme-color"]');
      themeMeta?.setAttribute('content', COLOR_THEMES[theme].themeColor);
      return theme;
    };
    const applyInterfaceStyle = (value = ui.interfaceStyle) => {
      window.SalaryMateCompanion?.stop();
      const style = normalizeInterfaceStyle(value);
      ui.interfaceStyle = style;
      const baseStyle = interfaceBaseStyle(style);
      for (const element of [document.body, document.documentElement]) {
        element.dataset.interfaceStyle = baseStyle;
        if (INTERFACE_STYLES[style].ornate) element.dataset.styleVariant = 'ornate';
        else delete element.dataset.styleVariant;
      }
      document.body.dataset.visualFamily = INTERFACE_STYLES[style].reference ? 'reference' : 'classic';
      $('meta[name="theme-color"]')?.setAttribute('content', ({ doodle: '#fffdf8', cream: '#fff8ed', dusk: '#19152c', pencil: '#fcf9f2', studio: '#f2f7fc', dark: '#151a21', cards: '#eef1f5', macaron: '#fffefa', pixel: '#102635' })[baseStyle] || COLOR_THEMES[normalizeColorTheme(ui.colorTheme)].themeColor);
      return style;
    };
    const applyVisualPreferences = () => {
      applyInterfaceMode(ui.interfaceMode);
      applyColorTheme(ui.colorTheme);
      applyInterfaceStyle(ui.interfaceStyle);
      ui.hd2dBackground = normalizeHd2dBackground(ui.hd2dBackground);
      document.documentElement.dataset.hd2dBackground = ui.hd2dBackground;
      document.body.dataset.hd2dBackground = ui.hd2dBackground;
      ui.surfaceOpacity = normalizeSurfaceOpacity(ui.surfaceOpacity);
      document.body.dataset.surfaceOpacity = ui.surfaceOpacity;
      ui.motionEffect = normalizeMotionEffect(ui.motionEffect);
      delete document.body.dataset.motionEffect;
    };
    const monthLabel = (month) => `${Number(month)} 月`;

    const calculationCache = {
      filteredRecords: new Map(),
      hourlyMetrics: new Map(),
      attendanceAnalysis: new Map(),
      annualAnalysis: new Map(),
      overtimePeriods: new Map(),
      leaveAllocations: new Map(),
      leaveEntries: new Map(),
      leaveMembership: new Map(),
      stockModels: new Map(),
      creditHours: new Map()
    };
    const invalidateCalculationCache = () => Object.values(calculationCache).forEach((cache) => cache.clear());

    const downloadBlob = (content, type, filename) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    let toastTimer = 0;
    const toast = async (message, type = 'success') => {
      if (type === 'success' && window.SalaryMateStorage.flush) {
        try { await window.SalaryMateStorage.flush(); }
        catch { message = '資料尚未成功保存。資料尚未變更，請先匯出備份後再試一次。'; type = 'error'; }
      }
      const tone = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
      const el = $('#toast');
      el.textContent = message;
      const companion = hd2dCompanion('toast');
      if (companion) el.insertAdjacentHTML('afterbegin', companion);
      el.className = `toast show ${tone}${companion ? ' v5-companion-notice' : ''}`;
      el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
      el.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.className = 'toast'; }, tone === 'error' ? 5200 : 3600);
    };

    const validationLabel = (control) => {
      const label = control?.closest?.('label');
      const text = label?.querySelector?.('.field-label')?.textContent || control?.getAttribute?.('aria-label') || control?.name || '此欄位';
      return String(text).replace(/\s*\*\s*$/, '').trim() || '此欄位';
    };
    const validationMessageId = (control) => `${ensureAccessibilityId(control, 'salarymate-field')}-validation`;
    const clearFieldValidation = (control) => {
      if (!control?.matches?.('input, select, textarea')) return;
      const id = validationMessageId(control);
      const message = document.getElementById(id);
      message?.remove();
      const ids = String(control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).filter((item) => item !== id);
      if (ids.length) control.setAttribute('aria-describedby', ids.join(' ')); else control.removeAttribute('aria-describedby');
      control.removeAttribute('aria-invalid');
      control.removeAttribute('data-validation-severity');
    };
    const clearFormValidation = (form) => {
      if (!form) return;
      $$('.field-message[data-validation-message]', form).forEach((message) => message.remove());
      $$('input, select, textarea', form).forEach((control) => {
        const ids = String(control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).filter((id) => !id.endsWith('-validation'));
        if (ids.length) control.setAttribute('aria-describedby', ids.join(' ')); else control.removeAttribute('aria-describedby');
        control.removeAttribute('aria-invalid');
        control.removeAttribute('data-validation-severity');
      });
      $('.validation-summary', form)?.remove();
    };
    const setFieldValidation = (control, message, severity = 'error') => {
      if (!control || !message) return null;
      clearFieldValidation(control);
      const tone = ['error', 'warning', 'info'].includes(severity) ? severity : 'error';
      const id = validationMessageId(control);
      const note = document.createElement('span');
      note.id = id;
      note.className = `field-message ${tone}`;
      note.dataset.validationMessage = 'true';
      note.dataset.severity = tone;
      note.textContent = message;
      const container = control.closest('label') || control.parentElement;
      container?.appendChild(note);
      const ids = new Set(String(control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      ids.add(id);
      control.setAttribute('aria-describedby', Array.from(ids).join(' '));
      control.dataset.validationSeverity = tone;
      if (tone === 'error') control.setAttribute('aria-invalid', 'true');
      return note;
    };
    const nativeConstraintMessage = (control) => {
      const label = validationLabel(control);
      const validity = control?.validity;
      if (!validity) return `${label}資料需要確認。`;
      if (validity.valueMissing) return `請輸入${label}。`;
      if (validity.badInput || validity.typeMismatch) return `${label}格式不正確，請重新輸入。`;
      if (validity.rangeUnderflow) return `${label}不可小於 ${control.min}。`;
      if (validity.rangeOverflow) return `${label}不可大於 ${control.max}。`;
      if (validity.stepMismatch) return `${label}的數值間隔不正確，請重新輸入。`;
      if (validity.tooLong) return `${label}內容過長，請縮短後再試。`;
      if (validity.patternMismatch) return `${label}格式不正確，請重新輸入。`;
      return `${label}資料需要確認。`;
    };
    const focusFirstValidationError = (form) => {
      const first = form?.querySelector?.('[aria-invalid="true"], [data-validation-severity="error"]');
      if (!first) return;
      first.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      afterPaint(() => first.focus?.({ preventScroll: true }));
    };
    const validateNativeForm = (form) => {
      if (!form) return false;
      clearFormValidation(form);
      const invalid = $$('input, select, textarea', form).filter((control) => !control.disabled && typeof control.checkValidity === 'function' && !control.checkValidity());
      invalid.forEach((control) => setFieldValidation(control, nativeConstraintMessage(control), 'error'));
      if (invalid.length) {
        focusFirstValidationError(form);
        toast(`有 ${invalid.length} 個欄位需要確認。`, 'error');
        return false;
      }
      return true;
    };
    const validateField = (form, name, message, severity = 'error') => {
      const control = form?.elements?.namedItem?.(name) || form?.querySelector?.(`[name="${name}"]`);
      if (!control) return false;
      setFieldValidation(control, message, severity);
      if (severity === 'error') focusFirstValidationError(form);
      return severity !== 'error';
    };
    const showValidationSummary = (form, message, severity = 'error') => {
      if (!form || !message) return;
      let summary = $('.validation-summary', form);
      if (!summary) {
        summary = document.createElement('div');
        const first = form.firstElementChild;
        if (typeof form.insertBefore === 'function') form.insertBefore(summary, first || null);
        else if (typeof form.prepend === 'function') form.prepend(summary);
        else form.appendChild?.(summary);
      }
      summary.className = `validation-summary ${severity}`;
      summary.setAttribute('role', severity === 'error' ? 'alert' : 'status');
      summary.textContent = message;
      if (severity === 'error') toast(message, 'error');
    };

    const normalizeCustomItems = (items) => Array.isArray(items)
      ? items.map((item) => {
          const name = String(item.name || '');
          const hasHourlyChoice = Object.prototype.hasOwnProperty.call(item, 'affectsHourly');
          return {
            id: item.id || newId('item'),
            name,
            amount: numberValue(item.amount),
            affectsHourly: hasHourlyChoice ? item.affectsHourly === true || item.affectsHourly === 'true' : /全勤|職務|加級|職位/.test(name),
            ...(item.sourceType ? { sourceType: String(item.sourceType) } : {}),
            ...(item.sourceKey ? { sourceKey: String(item.sourceKey) } : {})
          };
        })
      : [];

    const normalizeFixedEarnings = (items) => normalizeCustomItems(items).map((item) => ({
      ...item,
      affectsHourly: true
    }));

    const normalizeFixedDeductions = (items) => normalizeCustomItems(items).map((item) => ({
      ...item,
      amount: Math.max(0, numberValue(item.amount)),
      affectsHourly: false
    }));

    const normalizeYearEndGrades = (items) => {
      const source = Array.isArray(items) && items.length ? items : defaultYearEndGrades();
      return source.map((item, index) => ({
        id: String(item.id || `grade_${index}_${String(item.name || '').toLowerCase()}` || newId('grade')),
        name: String(item.name || `等級 ${index + 1}`).slice(0, 20),
        multiplier: clamp(item.multiplier, 0, 20)
      }));
    };

    const normalizeLeavePolicies = (policies = {}) => {
      const defaults = defaultLeavePolicies();
      return Object.fromEntries(Object.keys(LEAVE_TYPES).map((type) => {
        const policy = policies?.[type] || {};
        const allowedModes = type === 'annual' ? ['auto', 'custom'] : ['unlimited', 'custom'];
        return [type, {
          mode: allowedModes.includes(policy.mode) ? policy.mode : defaults[type].mode,
          quotaDays: Math.max(0, numberValue(policy.quotaDays))
        }];
      }));
    };

    const normalizeEmploymentMode = (value) => value === 'dispatch_hourly' ? 'dispatch_hourly' : 'monthly';
    const normalizeHourlyRate = (value) => Math.round(Math.max(0, numberValue(value)) * 1000) / 1000;
    const normalizeRegularHours = (value, fallback = 174) => Math.round(clamp(value ?? fallback, 0, 744) * 100) / 100;

    const normalizeCompany = (company) => {
      const employmentMode = normalizeEmploymentMode(company.employmentMode);
      return {
        id: company.id === '' ? '' : String(company.id || newId('company')),
        name: String(company.name || '未命名公司'),
        position: String(company.position || ''),
        isCurrent: company.isCurrent === true || company.isCurrent === 'true',
        employmentMode,
        baseSalary: numberValue(company.baseSalary),
        baseHourlyRate: normalizeHourlyRate(company.baseHourlyRate),
        defaultRegularHours: normalizeRegularHours(company.defaultRegularHours, 174),
        mealAllowance: numberValue(company.mealAllowance),
        positionAllowance: numberValue(company.positionAllowance),
        fixedEarnings: normalizeFixedEarnings(company.fixedEarnings),
        fixedDeductions: normalizeFixedDeductions(company.fixedDeductions),
        laborIns: numberValue(company.laborIns),
        healthIns: numberValue(company.healthIns),
        taxWithheld: numberValue(company.taxWithheld),
        employmentStartDate: String(company.employmentStartDate || ''),
        workHoursPerDay: clamp(company.workHoursPerDay ?? 8, 1, 24),
        leaveQuotaCycle: ['calendar', 'anniversary'].includes(company.leaveQuotaCycle) ? company.leaveQuotaCycle : 'calendar',
        leavePolicies: normalizeLeavePolicies(company.leavePolicies),
        payrollPeriodType: ['calendar', 'prev16', 'custom'].includes(company.payrollPeriodType) ? company.payrollPeriodType : 'calendar',
        payrollCycleStartDay: company.payrollPeriodType === 'prev16' ? 16 : clamp(company.payrollCycleStartDay ?? 1, 1, 31),
        payrollCycleEndDay: company.payrollPeriodType === 'prev16' ? 15 : clamp(company.payrollCycleEndDay ?? 31, 1, 31),
        leaveDeductionEach: Math.max(0, numberValue(company.leaveDeductionEach ?? 500)),
        deductionRuleNote: String(company.deductionRuleNote ?? DEFAULT_DEDUCTION_RULE)
      };
    };

    const normalizeRecord = (record) => {
      const employmentMode = normalizeEmploymentMode(record.employmentMode);
      const baseHourlyRate = normalizeHourlyRate(record.baseHourlyRate);
      const regularHours = normalizeRegularHours(record.regularHours, employmentMode === 'dispatch_hourly' ? 174 : 0);
      const baseSalary = employmentMode === 'dispatch_hourly'
        ? Math.round(baseHourlyRate * regularHours)
        : numberValue(record.baseSalary);
      return {
        id: String(record.id || newId('record')),
        companyId: String(record.companyId || ''),
        year: Math.round(numberValue(record.year)) || currentYear,
        month: clamp(record.month || 1, 1, 12),
        payDate: String(record.payDate || ''),
        employmentMode,
        baseHourlyRate,
        regularHours,
        baseSalary,
        mealAllowance: numberValue(record.mealAllowance),
        positionAllowance: numberValue(record.positionAllowance),
        overtime: numberValue(record.overtime),
        bonus: numberValue(record.bonus),
        customEarnings: normalizeCustomItems(record.customEarnings),
        laborIns: numberValue(record.laborIns),
        healthIns: numberValue(record.healthIns),
        taxWithheld: numberValue(record.taxWithheld),
        otherDeduction: numberValue(record.otherDeduction),
        customDeductions: normalizeCustomItems(record.customDeductions),
        pensionSelf: numberValue(record.pensionSelf),
        sideIncome: numberValue(record.sideIncome),
        reconciliation: window.SalaryMateReconcile.normalize(record.reconciliation),
        note: String(record.note || '')
      };
    };

    const normalizeSalaryAdjustment = (record) => {
      const employmentMode = normalizeEmploymentMode(record.employmentMode);
      return {
        id: String(record.id || newId('raise')),
        companyId: String(record.companyId || ''),
        effectiveDate: String(record.effectiveDate || todayIso()),
        employmentMode,
        baseSalary: Math.max(0, numberValue(record.baseSalary)),
        baseHourlyRate: normalizeHourlyRate(record.baseHourlyRate),
        regularHours: normalizeRegularHours(record.regularHours, employmentMode === 'dispatch_hourly' ? 174 : 0),
        mealAllowance: Math.max(0, numberValue(record.mealAllowance)),
        positionAllowance: Math.max(0, numberValue(record.positionAllowance)),
        fixedEarnings: normalizeFixedEarnings(record.fixedEarnings),
        previousFixedSalary: Math.max(0, numberValue(record.previousFixedSalary)),
        reason: ['annual', 'promotion', 'performance', 'new_hire', 'custom'].includes(record.reason) ? record.reason : 'annual',
        note: String(record.note || '')
      };
    };

    const normalizeYearEndEstimate = (record) => {
      const grades = normalizeYearEndGrades(record.gradeRules);
      const selectedGradeId = grades.some((item) => item.id === record.selectedGradeId) ? record.selectedGradeId : grades[0]?.id || '';
      return {
        id: String(record.id || newId('yearend')),
        companyId: String(record.companyId || ''),
        year: Math.round(numberValue(record.year)) || currentYear,
        baseMode: ['base', 'fixed', 'custom'].includes(record.baseMode) ? record.baseMode : 'base',
        customBase: Math.max(0, numberValue(record.customBase)),
        fixedMonths: clamp(record.fixedMonths ?? 1, 0, 20),
        selectedGradeId,
        gradeRules: grades,
        prorateByEmployment: record.prorateByEmployment !== false && record.prorateByEmployment !== 'false',
        extraAdjustment: numberValue(record.extraAdjustment),
        withholdingThreshold: Math.max(0, numberValue(record.withholdingThreshold ?? 86001)),
        withholdingRate: clamp(record.withholdingRate ?? 5, 0, 100),
        note: String(record.note || '')
      };
    };

    const normalizeOvertime = (log) => ({
      id: String(log.id || newId('ot')),
      date: String(log.date || ''),
      companyId: String(log.companyId || ''),
      type: ['weekday', 'restday', 'weekend', 'holiday', 'spring', 'custom'].includes(log.type) ? (log.type === 'weekend' ? 'restday' : log.type) : 'weekday',
      hours: numberValue(log.hours),
      hourlyRate: Math.round(Math.max(0, numberValue(log.hourlyRate)) * 1000) / 1000,
      customRate: numberValue(log.customRate) || 1.34,
      note: String(log.note || '')
    });

    const normalizeLeave = (record) => {
      const type = Object.prototype.hasOwnProperty.call(LEAVE_TYPES, record.type) ? record.type : 'annual';
      const unit = ['day', 'halfday', 'hour'].includes(record.unit) ? record.unit : 'day';
      const legacyDate = String(record.startDate || record.date || '');
      const durationMode = ['full_day', 'half_am', 'half_pm', 'hours', 'range'].includes(record.durationMode)
        ? record.durationMode
        : unit === 'hour' ? 'hours' : unit === 'halfday' ? 'half_am' : 'full_day';
      const legacyQuantity = Math.max(0, numberValue(record.quantity ?? 1));
      const customHours = Math.max(0, numberValue(record.customHours ?? (unit === 'hour' ? legacyQuantity : 0)));
      return {
        id: String(record.id || newId('leave')),
        startDate: legacyDate,
        endDate: String(record.endDate || legacyDate),
        date: legacyDate,
        companyId: String(record.companyId || ''),
        type,
        durationMode,
        startPortion: ['full', 'pm'].includes(record.startPortion) ? record.startPortion : 'full',
        endPortion: ['full', 'am'].includes(record.endPortion) ? record.endPortion : 'full',
        customHours,
        includeWeekends: record.includeWeekends === true || record.includeWeekends === 'true',
        status: ['planned', 'confirmed', 'cancelled'].includes(record.status) ? record.status : 'confirmed',
        compTimeLinked: type === 'compensatory' && window.SalaryMateCompTime.normalizeLeaveLink(record.compTimeLinked),
        unit: durationMode === 'hours' ? 'hour' : durationMode === 'half_am' || durationMode === 'half_pm' ? 'halfday' : 'day',
        quantity: durationMode === 'hours' ? customHours : legacyQuantity || 1,
        paidRatio: clamp(record.paidRatio ?? LEAVE_TYPES[type].paidRatio, 0, 100),
        attendanceDeduction: Math.max(0, numberValue(record.attendanceDeduction)),
        note: String(record.note || '')
      };
    };

    const normalizeState = (raw) => {
      const next = emptyState();
      if (!raw || typeof raw !== 'object') return next;
      next.companies = Array.isArray(raw.companies) ? raw.companies.map(normalizeCompany) : [];
      next.records = Array.isArray(raw.records) ? raw.records.map(normalizeRecord) : [];
      next.stockPortfolio = window.SalaryMateStocks.normalize(raw.stockPortfolio);
      next.investmentRecords = Array.isArray(raw.investmentRecords) ? raw.investmentRecords.map(r=>({id:String(r.id||newId('investment')),date:String(r.date||''),name:String(r.name||''),kind:String(r.kind||'其他'),amount:numberValue(r.amount),note:String(r.note||''),sourceRecordId:String(r.sourceRecordId||'')})) : [];
      for(const r of next.records){
        if(!r.sideIncome)continue;
        const id='legacy-investment-'+r.id;
        if(!next.investmentRecords.some(x=>x.id===id||x.sourceRecordId===r.id))next.investmentRecords.push({id,sourceRecordId:r.id,date:`${r.year}-${String(r.month).padStart(2,'0')}-01`,name:'原副業收入',kind:'舊副業收入',amount:r.sideIncome,note:`由 ${r.year} 年 ${r.month} 月薪資移入；日期暫記原薪資月份 1 日，可編輯實際入帳日。`});
        r.sideIncome=0;
      }
      const logs = raw.overtimeLogs || raw.overtime || [];
      next.overtimeLogs = Array.isArray(logs) ? logs.map(normalizeOvertime) : [];
      const leaves = raw.leaveRecords || raw.leaves || [];
      next.leaveRecords = Array.isArray(leaves) ? leaves.map(normalizeLeave) : [];
      next.compTimeCredits = Array.isArray(raw.compTimeCredits) ? raw.compTimeCredits.map(window.SalaryMateCompTime.normalizeCredit) : [];
      next.compTimeSettlements = Array.isArray(raw.compTimeSettlements) ? raw.compTimeSettlements.map(window.SalaryMateCompTime.normalizeSettlement) : [];
      next.salaryAdjustments = Array.isArray(raw.salaryAdjustments) ? raw.salaryAdjustments.map(normalizeSalaryAdjustment) : [];
      next.yearEndEstimates = Array.isArray(raw.yearEndEstimates) ? raw.yearEndEstimates.map(normalizeYearEndEstimate) : [];
      const defaultCalc = defaultOvertimeCalculator();
      const calc = raw.overtimeCalculator || {};
      next.overtimeCalculator = {
        companyId: String(calc.companyId || ''),
        baseSalary: Math.max(0, numberValue(calc.baseSalary)),
        mealAllowance: Math.max(0, numberValue(calc.mealAllowance)),
        attendanceBonus: Math.max(0, numberValue(calc.attendanceBonus)),
        positionAllowance: Math.max(0, numberValue(calc.positionAllowance)),
        otherFixed: Math.max(0, numberValue(calc.otherFixed)),
        overtimeDivisor: clamp(calc.overtimeDivisor || defaultCalc.overtimeDivisor, 1, 744),
        periodStartDay: clamp(calc.periodStartDay || defaultCalc.periodStartDay, 1, 31),
        periodEndDay: clamp(calc.periodEndDay || defaultCalc.periodEndDay, 1, 31),
        leaveCount: Math.max(0, numberValue(calc.leaveCount)),
        leaveDeductionEach: Math.max(0, numberValue(calc.leaveDeductionEach ?? defaultCalc.leaveDeductionEach)),
        variableAdjustment: numberValue(calc.variableAdjustment),
        ruleNote: String(calc.ruleNote ?? defaultCalc.ruleNote),
        multipliers: Object.fromEntries(Object.keys(defaultCalc.multipliers).map((key) => [key, clamp(calc.multipliers?.[key] ?? defaultCalc.multipliers[key], 0, 10)])),
        hours: Object.fromEntries(Object.keys(defaultCalc.hours).map((key) => [key, clamp(calc.hours?.[key] ?? defaultCalc.hours[key], 0, 744)]))
      };
      const preferences = raw.uiPreferences || {};
      next.uiPreferences = {
        companyFilter: String(preferences.companyFilter || 'ALL'),
        selectedYear: Math.round(numberValue(preferences.selectedYear)) || currentYear,
        attendanceTab: ['overtime', 'leave'].includes(preferences.attendanceTab) ? preferences.attendanceTab : 'overtime',
        overtimeMonth: clamp(preferences.overtimeMonth || 0, 0, 12),
        leaveMonth: clamp(preferences.leaveMonth || 0, 0, 12),
        leaveStatus: ['active', 'confirmed', 'planned', 'cancelled', 'all'].includes(preferences.leaveStatus) ? preferences.leaveStatus : 'active',
        hourlyMonth: clamp(preferences.hourlyMonth || 0, 0, 12),
        salaryCalcTab: ['overtime', 'yearend', 'raises'].includes(preferences.salaryCalcTab) ? preferences.salaryCalcTab : 'overtime',
        hourlyAdvancedOpen: preferences.hourlyAdvancedOpen === true || preferences.hourlyAdvancedOpen === 'true',
        yearEndCompanyId: String(preferences.yearEndCompanyId || ''),
        raiseCompanyId: String(preferences.raiseCompanyId || ''),
        interfaceStyle: normalizeInterfaceStyle(preferences.interfaceStyle),
        hd2dBackground: normalizeHd2dBackground(preferences.hd2dBackground),
        surfaceOpacity: normalizeSurfaceOpacity(preferences.surfaceOpacity),
        motionEffect: normalizeMotionEffect(preferences.motionEffect),
        interfaceMode: normalizeInterfaceMode(preferences.interfaceMode),
        colorTheme: normalizeColorTheme(preferences.colorTheme)
      };
      next.companies.forEach((company, index) => {
        const source = raw.companies?.[index] || {};
        if (source.leaveDeductionEach == null) company.leaveDeductionEach = next.overtimeCalculator.leaveDeductionEach;
        if (source.deductionRuleNote == null) company.deductionRuleNote = next.overtimeCalculator.ruleNote;
      });
      const settings = raw.hourlySettings || {};
      next.hourlySettings = {
        standardHours: clamp(settings.standardHours || 174, 1, 744),
        workDays: clamp(settings.workDays || 22, 1, 31),
        commuteMinsDay: clamp(settings.commuteMinsDay || 0, 0, 1440),
        commuteCostMonth: Math.max(0, numberValue(settings.commuteCostMonth)),
        prepMinsDay: clamp(settings.prepMinsDay || 0, 0, 1440),
        sideHoursMonth: Math.max(0, numberValue(settings.sideHoursMonth))
      };
      next.updatedAt = new Date().toISOString();
      return next;
    };

    const ensureSupportedSchema = raw => {
      for(const value of [raw?.schemaVersion,raw?.exportInfo?.schemaVersion]){
        if(value == null)continue;
        const version=Number(value);
        if(!Number.isInteger(version)||version<1)throw new Error('INVALID_SCHEMA');
        if(version>SCHEMA_VERSION)throw new Error('NEWER_SCHEMA');
      }
    };
    const validateBackupCollections = raw => {
      if(raw.stockPortfolio!==undefined)window.SalaryMateStocks.validate(raw.stockPortfolio);
      const names=['investmentRecords','companies','records','overtimeLogs','overtime','leaveRecords','leaves','compTimeCredits','compTimeSettlements','salaryAdjustments','yearEndEstimates'];
      const dateFields={companies:['employmentStartDate'],records:['payDate'],investmentRecords:['date'],overtimeLogs:['date'],overtime:['date'],leaveRecords:['date','startDate','endDate'],leaves:['date','startDate','endDate'],compTimeCredits:['earnedAt','expiresAt'],compTimeSettlements:['date'],salaryAdjustments:['effectiveDate']};
      for(const name of names){
        if(raw[name]===undefined)continue;
        if(!Array.isArray(raw[name]))throw new Error('INVALID_COLLECTION');
        const ids=new Set();
        for(const row of raw[name]){
          if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('INVALID_COLLECTION');
          // Missing optional dates remain compatible with older backups. Present
          // dates must be complete calendar dates, never a prefix plus markup.
          for(const key of dateFields[name]||[])if(row[key]!=null&&row[key]!==''&&!validIsoDate(row[key]))throw new Error('INVALID_DATE');
          if(name==='investmentRecords'&&(!validIsoDate(row.date)||!String(row.name||'').trim()||typeof row.amount!=='number'||!Number.isFinite(row.amount)))throw new Error('INVALID_INVESTMENT');
          const id=String(row.id||'');
          if(id&&ids.has(id))throw new Error('DUPLICATE_ID');
          if(id)ids.add(id);
        }
      }
    };

    const loadState = () => {
      setDataStatus('loading', '正在安全讀取本機薪資資料…');
      const generation = ++runtimeState.generation;
      try {
        const saved = window.SalaryMateStorage.getItem(STORAGE_KEY);
        if (generation !== runtimeState.generation) return false;
        if (saved) {
          const parsed = JSON.parse(saved);
          ensureSupportedSchema(parsed);
          state = normalizeState(parsed);
          if (Number(parsed.schemaVersion) !== SCHEMA_VERSION) {
            state.schemaVersion = SCHEMA_VERSION;
            state.appVersion = APP_VERSION;
            window.SalaryMateStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          }
          syncDataStatusFromState();
          return true;
        }
        const hasLegacy = Object.values(LEGACY_KEYS).some((key) => window.SalaryMateStorage.getItem(key));
        if (hasLegacy) {
          state = normalizeState({
            records: JSON.parse(window.SalaryMateStorage.getItem(LEGACY_KEYS.records) || '[]'),
            companies: JSON.parse(window.SalaryMateStorage.getItem(LEGACY_KEYS.companies) || '[]'),
            overtimeLogs: JSON.parse(window.SalaryMateStorage.getItem(LEGACY_KEYS.overtime) || '[]'),
            hourlySettings: JSON.parse(window.SalaryMateStorage.getItem(LEGACY_KEYS.hourly) || '{}')
          });
          ui.migratedLegacy = true;
          if (!saveState()) {
            setDataStatus('failure', '舊資料已讀取，但無法安全完成轉換保存。原始舊資料未刪除，請先匯出備份或重新嘗試。');
            return false;
          }
          syncDataStatusFromState();
          return true;
        }
        state = emptyState();
        setDataStatus('empty', '目前裝置尚未建立 SalaryMate 資料。');
        return true;
      } catch (error) {
        console.error('資料讀取失敗', error);
        setDataStatus('failure', error?.message==='NEWER_SCHEMA'?'本機資料來自較新版本，請更新程式後再開啟。現有資料未變更。':'無法安全讀取本機薪資資料。系統沒有把讀取失敗當成空白資料，也不會自動覆寫現有儲存內容。');
        setOperationStatus('failure', 'startup-load', '資料讀取失敗。現有儲存內容尚未變更。');
        return false;
      }
    };

    const saveState = (resetSnapshots = false) => {
      try {
        invalidateCalculationCache();
        state.schemaVersion = SCHEMA_VERSION;
        state.appVersion = APP_VERSION;
        state.uiPreferences = {
          companyFilter: ui.companyFilter,
          selectedYear: ui.selectedYear,
          attendanceTab: ui.attendanceTab,
          overtimeMonth: ui.overtimeMonth,
          leaveMonth: ui.leaveMonth,
          leaveStatus: ui.leaveStatus,
          hourlyMonth: ui.hourlyMonth,
          salaryCalcTab: ui.salaryCalcTab,
          hourlyAdvancedOpen: ui.hourlyAdvancedOpen,
          yearEndCompanyId: ui.yearEndCompanyId,
          raiseCompanyId: ui.raiseCompanyId,
          interfaceStyle: normalizeInterfaceStyle(ui.interfaceStyle),
          hd2dBackground: normalizeHd2dBackground(ui.hd2dBackground),
          surfaceOpacity: normalizeSurfaceOpacity(ui.surfaceOpacity),
          motionEffect: normalizeMotionEffect(ui.motionEffect),
          interfaceMode: normalizeInterfaceMode(ui.interfaceMode),
          colorTheme: normalizeColorTheme(ui.colorTheme)
        };
        state.updatedAt = new Date().toISOString();
        window.SalaryMateStorage.setItem(STORAGE_KEY, JSON.stringify(state), resetSnapshots);
        syncDataStatusFromState();
        window.SalaryMateCloud?.changed();
        return true;
      } catch (error) {
        console.error('資料儲存失敗', error);
        setOperationStatus('failure', 'save', '儲存失敗。原本資料保持不變，請重新嘗試。');
        toast('儲存失敗。原本資料保持不變，請重新嘗試。', 'error');
        return false;
      }
    };

    const commitStateMutation = (mutation, failureMessage = '儲存失敗。原本資料保持不變，請重新嘗試。', operationKey = '', rememberSuccessfulSubmit = true) => {
      const scope = ui.draftScope;
      const key = operationKey || (scope
        ? `commit:${scope.operationId || scope.entityType}:${scope.companyId || 'none'}:${scope.entityId || 'new'}:${scope.payrollMonth || ''}`
        : 'commit:global');
      if (!acquireOperationLock(key)) {
        console.warn('DUPLICATE_SUBMIT_BLOCKED', key);
        toast('操作正在處理或剛完成，已阻止重複送出。', 'info');
        return false;
      }
      const before = clone(state);
      let succeeded = false;
      const rememberSuccess = rememberSuccessfulSubmit && Boolean(operationKey || scope?.operationId);
      setOperationStatus('submitting', 'commit', '正在安全儲存…');
      try {
        mutation();
        if (saveState()) {
          succeeded = true;
          setOperationStatus('idle');
          return true;
        }
      } catch (error) {
        console.error('資料寫入失敗', error);
      } finally {
        releaseOperationLock(key, succeeded && rememberSuccess);
      }
      state = before;
      invalidateCalculationCache();
      syncDataStatusFromState();
      setOperationStatus('failure', 'commit', failureMessage);
      toast(failureMessage, 'error');
      return false;
    };

    const restoreUiPreferences = () => {
      const preferences = state.uiPreferences || {};
      ui.companyFilter = String(preferences.companyFilter || 'ALL');
      ui.selectedYear = Math.round(numberValue(preferences.selectedYear)) || currentYear;
      ui.attendanceTab = ['overtime', 'leave'].includes(preferences.attendanceTab) ? preferences.attendanceTab : 'overtime';
      ui.overtimeMonth = clamp(preferences.overtimeMonth || 0, 0, 12);
      ui.leaveMonth = clamp(preferences.leaveMonth || 0, 0, 12);
      ui.leaveStatus = ['active', 'confirmed', 'planned', 'cancelled', 'all'].includes(preferences.leaveStatus) ? preferences.leaveStatus : 'active';
      ui.hourlyMonth = clamp(preferences.hourlyMonth || 0, 0, 12);
      ui.salaryCalcTab = ['overtime', 'yearend', 'raises'].includes(preferences.salaryCalcTab) ? preferences.salaryCalcTab : 'overtime';
      ui.hourlyAdvancedOpen = preferences.hourlyAdvancedOpen === true || preferences.hourlyAdvancedOpen === 'true';
      ui.yearEndCompanyId = String(preferences.yearEndCompanyId || '');
      ui.raiseCompanyId = String(preferences.raiseCompanyId || '');
      ui.interfaceStyle = normalizeInterfaceStyle(preferences.interfaceStyle);
      ui.hd2dBackground = normalizeHd2dBackground(preferences.hd2dBackground);
      ui.surfaceOpacity = normalizeSurfaceOpacity(preferences.surfaceOpacity);
      ui.motionEffect = normalizeMotionEffect(preferences.motionEffect);
      ui.interfaceMode = normalizeInterfaceMode(preferences.interfaceMode);
      ui.colorTheme = normalizeColorTheme(preferences.colorTheme);
      applyVisualPreferences();
    };

    const getCompany = (id) => state.companies.find((company) => company.id === id);
    const currentCompany = () => state.companies.find((company) => company.isCurrent) || null;
    const payrollMonthKey = (year, month) => Number(year) && Number(month) ? `${Number(year)}-${String(Number(month)).padStart(2, '0')}` : '';
    const beginDraftScope = ({ entityType, companyId = '', entityId = '', payrollMonth = '', operational = true, baselineFingerprint = '' }) => {
      ui.draftScope = { entityType: String(entityType || ''), companyId: String(companyId || ''), entityId: String(entityId || ''), payrollMonth: String(payrollMonth || ''), operational: Boolean(operational), contextGeneration: contextGeneration(), operationId: newId('operation'), baselineFingerprint: String(baselineFingerprint || ''), dirty: false };
      return ui.draftScope;
    };
    const clearDraftScope = () => { ui.draftScope = null; };
    const stableDraftFingerprint = (value) => JSON.stringify(value ?? null);
    const markDraftDirty = () => {
      const scope = ui.draftScope;
      if (!scope) return;
      if (scope.entityType === 'year-end' && scope.baselineFingerprint) { scope.dirty = stableDraftFingerprint(ui.yearEndDraft) !== scope.baselineFingerprint; return; }
      if (ui.dialogBaseline) { scope.dirty = dialogHasUnsavedChanges(); return; }
      scope.dirty = true;
    };
    const hasDirtyDraft = () => Boolean(dialogHasUnsavedChanges?.() || ui.draftScope?.dirty);
    const markSelectedEntity = (entityType, entityId, companyId) => { ui.selectedEntityScope = entityId ? { entityType: String(entityType || ''), entityId: String(entityId), companyId: String(companyId || '') } : null; };
    const clearOperationalSelection = () => { ui.selectedEntityScope = null; ui.expandedRecords.clear(); };
    const assertDraftScope = ({ entityType, companyId = '', entityId = '', payrollMonth = '', operational = true, allowNewCompany = false }) => {
      const scope = ui.draftScope;
      const expectedCompany = String(companyId || '');
      const expectedEntity = String(entityId || '');
      const expectedMonth = String(payrollMonth || '');
      const mismatch = !scope || scope.entityType !== String(entityType || '') || scope.companyId !== expectedCompany || (expectedEntity && scope.entityId !== expectedEntity) || (expectedMonth && scope.payrollMonth !== expectedMonth);
      if (mismatch) { console.error('DRAFT_SCOPE_MISMATCH', { scope, entityType, companyId: expectedCompany, entityId: expectedEntity, payrollMonth: expectedMonth }); toast('操作範圍已變更，為避免寫入錯誤公司，請重新開啟表單。', 'error'); return false; }
      if (scope.contextGeneration !== contextGeneration()) { console.error('STALE_CONTEXT_RESULT', { scopeGeneration: scope.contextGeneration, generation: contextGeneration() }); toast('目前公司內容已更新，這份舊草稿不會被儲存。請重新開啟表單。', 'error'); return false; }
      if (!allowNewCompany && expectedCompany && !getCompany(expectedCompany)) { toast('目標公司不存在，資料尚未變更。', 'error'); return false; }
      if (operational && currentCompany()?.id !== expectedCompany) { console.error('DRAFT_SCOPE_MISMATCH', { currentCompanyId: currentCompany()?.id || '', draftCompanyId: expectedCompany }); toast('目前公司已變更，為避免寫入錯誤公司，請取消草稿後重新開始。', 'error'); return false; }
      return true;
    };
    const selectedEntityIsInCurrentScope = () => !ui.selectedEntityScope || !ui.selectedEntityScope.companyId || ui.selectedEntityScope.companyId === currentCompany()?.id;
    const companyName = (id) => getCompany(id)?.name || '未指定公司';
    const companyStatus = (id) => getCompany(id)?.isCurrent ? 'current' : 'former';
    const payrollPeriodTypeName = (type, startDay = 16, endDay = 15) => type === 'prev16'
      ? '16 日～次月 15 日'
      : type === 'custom'
        ? `${clamp(startDay, 1, 31)} 日～${clamp(startDay, 1, 31) > clamp(endDay, 1, 31) ? '次月 ' : ''}${clamp(endDay, 1, 31)} 日`
        : '1 日～月底';
    const companyPayrollPeriodType = (companyId) => getCompany(companyId)?.payrollPeriodType || 'calendar';
    const companyPayrollCycle = (companyId) => {
      const company = getCompany(companyId);
      const type = company?.payrollPeriodType || 'calendar';
      return {
        type,
        startDay: type === 'prev16' ? 16 : type === 'custom' ? clamp(company?.payrollCycleStartDay ?? 1, 1, 31) : 1,
        endDay: type === 'prev16' ? 15 : type === 'custom' ? clamp(company?.payrollCycleEndDay ?? 31, 1, 31) : 31
      };
    };
    const companyPayrollPeriodName = (companyId) => {
      const cycle = companyPayrollCycle(companyId);
      return payrollPeriodTypeName(cycle.type, cycle.startDay, cycle.endDay);
    };
    const pad2 = (value) => String(value).padStart(2, '0');
    const isoDate = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;
    const todayIso = () => {
      const today = new Date();
      return isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    };
    const parseDateParts = (date) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
      return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
    };
    const shiftYearMonth = (year, month, offset) => {
      const date = new Date(Date.UTC(Number(year), Number(month) - 1 + Number(offset), 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    };
    const daysInMonth = (year, month) => new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    const clampedIsoDate = (year, month, day) => isoDate(year, month, Math.min(clamp(day, 1, 31), daysInMonth(year, month)));
    const salaryPeriodBounds = (year, month, companyId) => {
      const cycle = companyPayrollCycle(companyId);
      if (cycle.type === 'prev16' || (cycle.type === 'custom' && cycle.startDay > cycle.endDay)) {
        const previous = shiftYearMonth(year, month, -1);
        return {
          start: clampedIsoDate(previous.year, previous.month, cycle.startDay),
          end: clampedIsoDate(year, month, cycle.endDay)
        };
      }
      if (cycle.type === 'custom') {
        return {
          start: clampedIsoDate(year, month, cycle.startDay),
          end: clampedIsoDate(year, month, cycle.endDay)
        };
      }
      return { start: isoDate(year, month, 1), end: clampedIsoDate(year, month, 31) };
    };
    const salaryMonthForDate = (date, companyId) => {
      const parts = parseDateParts(date);
      if (!parts || !validIsoDate(date)) return null;
      const cycle = companyPayrollCycle(companyId);
      if (cycle.type === 'calendar') return { year: parts.year, month: parts.month };
      if (cycle.type === 'prev16') return parts.day >= 16 ? shiftYearMonth(parts.year, parts.month, 1) : { year: parts.year, month: parts.month };
      const current = { year: parts.year, month: parts.month };
      const candidates = [current, shiftYearMonth(parts.year, parts.month, 1), shiftYearMonth(parts.year, parts.month, -1)];
      return candidates.find((candidate) => {
        const bounds = salaryPeriodBounds(candidate.year, candidate.month, companyId);
        return date >= bounds.start && date <= bounds.end;
      }) || null;
    };
    const salaryMonthForLog = (log) => {
      if (!calculationCache.overtimePeriods.has(log)) calculationCache.overtimePeriods.set(log, salaryMonthForDate(log?.date, log?.companyId));
      return calculationCache.overtimePeriods.get(log);
    };
    const salaryPeriodLabel = (year, month, companyId) => {
      const bounds = salaryPeriodBounds(year, month, companyId);
      return `${bounds.start.replace(/-/g, '/')}～${bounds.end.replace(/-/g, '/')}`;
    };
    const overtimeForSalaryMonth = (year, month, companyFilter = 'ALL') => state.overtimeLogs.filter((log) => {
      const attributed = salaryMonthForLog(log);
      return attributed && attributed.year === Number(year) && attributed.month === Number(month) &&
        (companyFilter === 'ALL' || log.companyId === companyFilter);
    });
    const validIsoDate = (value) => {
      if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parts = parseDateParts(value);
      if (!parts) return false;
      const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
      return date.getUTCFullYear() === parts.year && date.getUTCMonth() + 1 === parts.month && date.getUTCDate() === parts.day;
    };
    const addIsoDays = (value, amount) => {
      const parts = parseDateParts(value);
      if (!parts || !validIsoDate(value)) return '';
      const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Number(amount)));
      return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    };
    const isWeekend = (value) => {
      const parts = parseDateParts(value);
      if (!parts || !validIsoDate(value)) return false;
      const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
      return day === 0 || day === 6;
    };
    const enumerateIsoDates = (startDate, endDate, limit = 366) => {
      if (!validIsoDate(startDate) || !validIsoDate(endDate) || String(endDate) < String(startDate)) return [];
      const dates = [];
      for (let date = startDate; date && date <= endDate && dates.length <= limit; date = addIsoDays(date, 1)) dates.push(date);
      return dates.length > limit ? [] : dates;
    };
    const leaveTypeName = (type) => LEAVE_TYPES[type]?.label || '其他假別';
    const leavePaidTone = (record) => numberValue(record.paidRatio) >= 100 ? 'leave-paid' : numberValue(record.paidRatio) > 0 ? 'leave-partial' : 'leave-unpaid';
    const leaveStatusName = (status) => ({ planned: '預計', confirmed: '已確認', cancelled: '已取消' })[status] || '已確認';
    const leaveStatusTone = (status) => ({ planned: 'leave-planned', confirmed: 'leave-confirmed', cancelled: 'leave-cancelled' })[status] || 'leave-confirmed';
    const computeLeaveDateEntries = (record) => {
      const startDate = String(record?.startDate || record?.date || '');
      const workHours = numberValue(getCompany(record?.companyId)?.workHoursPerDay) || 8;
      if (!validIsoDate(startDate)) return [];
      if (record?.durationMode === 'range') {
        const endDate = String(record.endDate || startDate);
        const dates = enumerateIsoDates(startDate, endDate).filter((date) => record.includeWeekends || !isWeekend(date));
        return dates.map((date) => {
          let factor = 1;
          if (dates.length === 1 && (record.startPortion === 'pm' || record.endPortion === 'am')) factor = .5;
          else if (date === startDate && record.startPortion === 'pm') factor = .5;
          else if (date === endDate && record.endPortion === 'am') factor = .5;
          return { date, hours: workHours * factor, days: factor };
        });
      }
      if (record?.durationMode === 'hours') {
        const hours = Math.max(0, numberValue(record.customHours ?? record.quantity));
        return hours ? [{ date: startDate, hours, days: hours / workHours }] : [];
      }
      if (record?.durationMode === 'half_am' || record?.durationMode === 'half_pm') {
        const legacyMultiplier = Math.max(0, numberValue(record.quantity) || 1);
        return [{ date: startDate, hours: workHours * .5 * legacyMultiplier, days: .5 * legacyMultiplier }];
      }
      const legacyMultiplier = Math.max(0, numberValue(record?.quantity) || 1);
      return [{ date: startDate, hours: workHours * legacyMultiplier, days: legacyMultiplier }];
    };
    const isStoredLeave = (record) => {
      if (!calculationCache.leaveMembership.has('all')) calculationCache.leaveMembership.set('all', new Set(state.leaveRecords));
      return calculationCache.leaveMembership.get('all').has(record);
    };
    const leaveDateEntries = (record) => {
      if (!isStoredLeave(record)) return computeLeaveDateEntries(record);
      if (!calculationCache.leaveEntries.has(record)) calculationCache.leaveEntries.set(record, computeLeaveDateEntries(record));
      return calculationCache.leaveEntries.get(record);
    };
    const leaveHours = (record) => leaveDateEntries(record).reduce((sum, entry) => sum + entry.hours, 0);
    const compTimeLedger = (credits = state.compTimeCredits, settlements = state.compTimeSettlements, leaves = state.leaveRecords, companyId = 'ALL') => {
      const match = row => companyId === 'ALL' || row.companyId === companyId;
      return window.SalaryMateCompTime.ledger({credits:credits.filter(match),settlements:settlements.filter(match),leaves:leaves.filter(match).map(row=>({...row,compTimeEntries:leaveDateEntries(row)})),logs:state.overtimeLogs.filter(match),today:todayIso()});
    };
    const leaveDays = (record) => leaveDateEntries(record).reduce((sum, entry) => sum + entry.days, 0);
    const leaveDateText = (record) => {
      const startDate = String(record?.startDate || record?.date || '');
      const endDate = String(record?.endDate || startDate);
      if (record?.durationMode === 'range' && endDate !== startDate) return `${startDate}～${endDate}`;
      if (record?.durationMode === 'half_am') return `${startDate} 上午`;
      if (record?.durationMode === 'half_pm') return `${startDate} 下午`;
      return startDate;
    };
    const leaveQuantityText = (record) => record?.durationMode === 'hours'
      ? `${rateNumber(leaveHours(record))} 小時`
      : record?.durationMode === 'range'
        ? `${rateNumber(leaveDays(record))} 個工作日`
        : record?.durationMode === 'half_am' ? '上午半天'
          : record?.durationMode === 'half_pm' ? '下午半天'
            : `${rateNumber(leaveDays(record))} 天`;
    const leaveWageDeduction = (record) => {
      const company = getCompany(record?.companyId);
      const workHours = numberValue(company?.workHoursPerDay) || 8;
      const profile = salaryProfileAt(company, record?.startDate || record?.date);
      const hourlyWage = profile?.employmentMode === 'dispatch_hourly'
        ? salaryProfileTotal(profile) / Math.max(1, numberValue(profile.regularHours))
        : salaryProfileTotal(profile) / 30 / workHours;
      return Math.round(hourlyWage * leaveHours(record) * (1 - clamp(record?.paidRatio, 0, 100) / 100));
    };
    const leaveAllocations = (record) => {
      const stored = isStoredLeave(record);
      if (stored && calculationCache.leaveAllocations.has(record)) return calculationCache.leaveAllocations.get(record);
      const entries = leaveDateEntries(record);
      const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
      if (!totalHours) return [];
      const groups = new Map();
      entries.forEach((entry) => {
        const attributed = salaryMonthForDate(entry.date, record.companyId);
        if (!attributed) return;
        const key = `${attributed.year}-${pad2(attributed.month)}`;
        if (!groups.has(key)) groups.set(key, { year: attributed.year, month: attributed.month, hours: 0, days: 0, dates: [] });
        const group = groups.get(key);
        group.hours += entry.hours;
        group.days += entry.days;
        group.dates.push(entry.date);
      });
      const allocations = [...groups.values()].sort((a, b) => a.year - b.year || a.month - b.month);
      const wageTotal = leaveWageDeduction(record);
      const attendanceTotal = Math.max(0, numberValue(record.attendanceDeduction));
      let assignedWage = 0;
      let assignedAttendance = 0;
      allocations.forEach((allocation, index) => {
        const isLast = index === allocations.length - 1;
        allocation.wageDeduction = isLast ? wageTotal - assignedWage : Math.round(wageTotal * allocation.hours / totalHours);
        allocation.attendanceDeduction = isLast ? attendanceTotal - assignedAttendance : Math.round(attendanceTotal * allocation.hours / totalHours);
        allocation.totalDeduction = allocation.wageDeduction + allocation.attendanceDeduction;
        assignedWage += allocation.wageDeduction;
        assignedAttendance += allocation.attendanceDeduction;
      });
      if (stored) calculationCache.leaveAllocations.set(record, allocations);
      return allocations;
    };
    const salaryMonthForLeave = (record) => leaveAllocations(record)[0] || salaryMonthForDate(record?.startDate || record?.date, record?.companyId);
    const leaveForSalaryMonth = (year, month, companyFilter = 'ALL', statuses = null) => state.leaveRecords.filter((record) =>
      (companyFilter === 'ALL' || record.companyId === companyFilter) &&
      (!statuses || statuses.includes(record.status)) &&
      leaveAllocations(record).some((allocation) => allocation.year === Number(year) && allocation.month === Number(month))
    );
    const leaveAllocationForMonth = (record, year, month) => leaveAllocations(record).find((allocation) => allocation.year === Number(year) && allocation.month === Number(month));
    const leaveTotalDeduction = (record) => leaveWageDeduction(record) + numberValue(record?.attendanceDeduction);

    const shiftIsoMonths = (date, offset) => {
      const parts = parseDateParts(date);
      if (!parts) return '';
      const first = new Date(Date.UTC(parts.year, parts.month - 1 + Number(offset), 1));
      const year = first.getUTCFullYear();
      const month = first.getUTCMonth() + 1;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return isoDate(year, month, Math.min(parts.day, lastDay));
    };
    const completedMonthsBetween = (startDate, endDate) => {
      const start = parseDateParts(startDate);
      const end = parseDateParts(endDate);
      if (!start || !end || String(endDate) < String(startDate)) return -1;
      let months = (end.year - start.year) * 12 + end.month - start.month;
      if (end.day < start.day) months -= 1;
      return months;
    };
    const employmentTenure = (company, asOfDate = todayIso()) => {
      const startDate = String(company?.employmentStartDate || '');
      const start = parseDateParts(startDate);
      const end = parseDateParts(asOfDate);
      if (!start || !end || !validIsoDate(startDate) || !validIsoDate(asOfDate)) {
        return { configured: false, future: false, years: 0, days: 0, startDate };
      }
      if (startDate > asOfDate) return { configured: true, future: true, years: 0, days: 0, startDate };
      let years = end.year - start.year;
      const anniversaryDate = (targetYear) => {
        const lastDay = new Date(Date.UTC(targetYear, start.month, 0)).getUTCDate();
        return isoDate(targetYear, start.month, Math.min(start.day, lastDay));
      };
      if (anniversaryDate(start.year + years) > asOfDate) years -= 1;
      const anniversary = parseDateParts(anniversaryDate(start.year + years));
      const anniversaryMs = Date.UTC(anniversary.year, anniversary.month - 1, anniversary.day);
      const asOfMs = Date.UTC(end.year, end.month - 1, end.day);
      const days = Math.max(0, Math.round((asOfMs - anniversaryMs) / 86400000));
      return { configured: true, future: false, years, days, startDate };
    };
    const annualLeaveDaysForYears = (years) => {
      if (years < 1) return 0;
      if (years === 1) return 7;
      if (years === 2) return 10;
      if (years < 5) return 14;
      if (years < 10) return 15;
      return Math.min(30, 15 + years - 9);
    };
    const annualLeaveCycle = (company, asOfDate = todayIso()) => {
      const start = String(company?.employmentStartDate || '');
      const completedMonths = completedMonthsBetween(start, asOfDate);
      if (!parseDateParts(start)) return { configured: false, entitlement: 0, start: '', end: '', nextGrantDate: '', tenureMonths: 0 };
      if (completedMonths < 0) return { configured: true, entitlement: 0, start, end: shiftIsoMonths(start, 6), nextGrantDate: shiftIsoMonths(start, 6), tenureMonths: 0 };
      if (completedMonths < 6) return { configured: true, entitlement: 0, start, end: shiftIsoMonths(start, 6), nextGrantDate: shiftIsoMonths(start, 6), tenureMonths: completedMonths };
      if (completedMonths < 12) return { configured: true, entitlement: 3, start: shiftIsoMonths(start, 6), end: shiftIsoMonths(start, 12), nextGrantDate: shiftIsoMonths(start, 12), tenureMonths: completedMonths };
      const years = Math.floor(completedMonths / 12);
      return {
        configured: true,
        entitlement: annualLeaveDaysForYears(years),
        start: shiftIsoMonths(start, years * 12),
        end: shiftIsoMonths(start, (years + 1) * 12),
        nextGrantDate: shiftIsoMonths(start, (years + 1) * 12),
        tenureMonths: completedMonths
      };
    };
    const calendarLeaveCycle = (asOfDate = todayIso()) => {
      const parts = parseDateParts(asOfDate) || parseDateParts(todayIso());
      return {
        configured: true,
        start: isoDate(parts.year, 1, 1),
        end: isoDate(parts.year + 1, 1, 1),
        nextGrantDate: isoDate(parts.year + 1, 1, 1)
      };
    };
    const calendarMonthLeaveCycle = (asOfDate = todayIso()) => {
      const parts = parseDateParts(asOfDate) || parseDateParts(todayIso());
      const start = isoDate(parts.year, parts.month, 1);
      const end = shiftIsoMonths(start, 1);
      return { configured: true, start, end, nextGrantDate: end };
    };
    const companyLeaveCycle = (company, asOfDate = todayIso()) => {
      if (company?.leaveQuotaCycle !== 'anniversary') return calendarLeaveCycle(asOfDate);
      const start = String(company?.employmentStartDate || '');
      if (!validIsoDate(start)) return { configured: false, start: '', end: '', nextGrantDate: '' };
      if (asOfDate < start) return { configured: true, start, end: shiftIsoMonths(start, 12), nextGrantDate: shiftIsoMonths(start, 12) };
      const completedMonths = Math.max(0, completedMonthsBetween(start, asOfDate));
      const years = Math.floor(completedMonths / 12);
      return {
        configured: true,
        start: shiftIsoMonths(start, years * 12),
        end: shiftIsoMonths(start, (years + 1) * 12),
        nextGrantDate: shiftIsoMonths(start, (years + 1) * 12)
      };
    };
    const leaveQuotaSummary = (company, type, asOfDate = todayIso()) => {
      const storedPolicy = normalizeLeavePolicies(company?.leavePolicies)[type] || { mode: 'unlimited', quotaDays: 0 };
      const fixedMonthlyMenstrual = type === 'menstrual';
      const policy = fixedMonthlyMenstrual ? { mode: 'monthly_once', quotaDays: 1 } : storedPolicy;
      const automaticAnnual = type === 'annual' && policy.mode === 'auto';
      const cycle = fixedMonthlyMenstrual
        ? calendarMonthLeaveCycle(asOfDate)
        : automaticAnnual
          ? annualLeaveCycle(company, asOfDate)
          : companyLeaveCycle(company, asOfDate);
      const limited = fixedMonthlyMenstrual || automaticAnnual || policy.mode === 'custom';
      const entitlement = fixedMonthlyMenstrual ? 1 : automaticAnnual ? numberValue(cycle.entitlement) : limited ? numberValue(policy.quotaDays) : null;
      if (!cycle.configured) return { ...cycle, type, policy, limited, entitlement, used: 0, reserved: 0, remaining: entitlement, exceeded: 0, usagePercent: 0 };
      const daysByStatus = state.leaveRecords
        .filter((record) => record.companyId === company.id && record.type === type && record.status !== 'cancelled')
        .reduce((totals, record) => {
          const days = leaveDateEntries(record)
            .filter((entry) => entry.date >= cycle.start && entry.date < cycle.end)
            .reduce((sum, entry) => sum + entry.days, 0);
          if (record.status === 'planned') totals.reserved += days;
          else totals.used += days;
          return totals;
        }, { used: 0, reserved: 0 });
      const consumed = daysByStatus.used + daysByStatus.reserved;
      const remaining = limited ? Math.max(0, entitlement - consumed) : null;
      const exceeded = limited ? Math.max(0, consumed - entitlement) : 0;
      const usagePercent = limited && entitlement > 0 ? Math.round(consumed / entitlement * 100) : limited && consumed > 0 ? 100 : 0;
      return { ...cycle, type, policy, limited, entitlement, ...daysByStatus, remaining, exceeded, usagePercent };
    };
    const annualLeaveSummary = (company, asOfDate = todayIso()) => leaveQuotaSummary(company, 'annual', asOfDate);

    const customTotal = (items) => (items || []).reduce((sum, item) => sum + numberValue(item.amount), 0);
    const hourlyCustomTotal = (items) => (items || []).filter((item) => item.affectsHourly === true).reduce((sum, item) => sum + numberValue(item.amount), 0);
    const roundHourlyRate = (value) => Math.round(numberValue(value) * 1000) / 1000;
    const companyBaseSalaryProfile = (company) => ({
      employmentMode: normalizeEmploymentMode(company?.employmentMode),
      baseSalary: numberValue(company?.baseSalary),
      baseHourlyRate: normalizeHourlyRate(company?.baseHourlyRate),
      regularHours: normalizeRegularHours(company?.defaultRegularHours, 174),
      mealAllowance: numberValue(company?.mealAllowance),
      positionAllowance: numberValue(company?.positionAllowance),
      fixedEarnings: normalizeFixedEarnings(company?.fixedEarnings),
      source: 'company',
      effectiveDate: String(company?.employmentStartDate || '')
    });
    const salaryProfileBasePay = (profile) => normalizeEmploymentMode(profile?.employmentMode) === 'dispatch_hourly'
      ? Math.round(normalizeHourlyRate(profile?.baseHourlyRate) * normalizeRegularHours(profile?.regularHours, 174))
      : numberValue(profile?.baseSalary);
    const salaryProfileTotal = (profile) => salaryProfileBasePay(profile) + numberValue(profile?.mealAllowance) + numberValue(profile?.positionAllowance) + customTotal(profile?.fixedEarnings);
    const salaryAdjustmentsForCompany = (companyId, excludeId = '') => state.salaryAdjustments
      .filter((record) => record.companyId === companyId && record.id !== excludeId && validIsoDate(record.effectiveDate))
      .sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || String(a.id).localeCompare(String(b.id)));
    const salaryProfileAt = (company, date = todayIso(), excludeId = '') => {
      if (!company) return companyBaseSalaryProfile(null);
      const targetDate = validIsoDate(date) ? date : todayIso();
      const adjustment = salaryAdjustmentsForCompany(company.id, excludeId).filter((record) => record.effectiveDate <= targetDate).at(-1);
      return adjustment ? { ...clone(adjustment), source: 'adjustment' } : companyBaseSalaryProfile(company);
    };
    const companyFixedSalary = (company, date = todayIso()) => salaryProfileTotal(salaryProfileAt(company, date));
    // Company defaults use the monthly 30 × 8 basis; individual logs keep their own rate.
    const salaryProfileOvertimeBasis = (profile) => {
      const divisor = profile?.employmentMode === 'dispatch_hourly'
        ? Math.max(1, numberValue(profile.regularHours)) : 240;
      const total = salaryProfileTotal(profile);
      return { total, divisor, hourlyRate: roundHourlyRate(total / divisor) };
    };
    const overtimeHourlyRate = (log) => roundHourlyRate(log?.hourlyRate);
    const recordHourlyBase = (record) => numberValue(record?.baseSalary) + numberValue(record?.mealAllowance) + numberValue(record?.positionAllowance) + hourlyCustomTotal(record?.customEarnings);
    const recordRegularHours = (record, fallback = state.hourlySettings.standardHours) => normalizeEmploymentMode(record?.employmentMode) === 'dispatch_hourly'
      ? Math.max(1, normalizeRegularHours(record?.regularHours, 174))
      : Math.max(1, numberValue(fallback));
    const employmentModeName = (value) => normalizeEmploymentMode(value) === 'dispatch_hourly' ? '派遣（時薪）' : '月薪制';
    const salaryBasisText = (profile) => normalizeEmploymentMode(profile?.employmentMode) === 'dispatch_hourly'
      ? `$${hourlyRateNumber(profile?.baseHourlyRate)}／時 × ${rateNumber(profile?.regularHours)} 小時`
      : `$${money(profile?.baseSalary)}`;
    const calculatorProfileDate = (company) => Number(ui.hourlyMonth) > 0
      ? salaryPeriodBounds(ui.selectedYear, ui.hourlyMonth, company.id).end
      : todayIso();
    const applyCompanyDefaultsToCalculator = (company) => {
      if (!company) return state.overtimeCalculator;
      const profile = salaryProfileAt(company, calculatorProfileDate(company));
      const fixedItems = normalizeFixedEarnings(profile.fixedEarnings);
      const attendance = fixedItems.find((item) => /全勤/.test(item.name || ''));
      Object.assign(state.overtimeCalculator, {
        companyId: company.id,
        baseSalary: salaryProfileBasePay(profile),
        mealAllowance: numberValue(profile.mealAllowance),
        positionAllowance: numberValue(profile.positionAllowance),
        attendanceBonus: numberValue(attendance?.amount),
        otherFixed: customTotal(fixedItems.filter((item) => item !== attendance)),
        overtimeDivisor: profile.employmentMode === 'dispatch_hourly' ? Math.max(1, numberValue(profile.regularHours)) : state.overtimeCalculator.overtimeDivisor,
        leaveDeductionEach: numberValue(company.leaveDeductionEach),
        ruleNote: String(company.deductionRuleNote || DEFAULT_DEDUCTION_RULE)
      });
      return state.overtimeCalculator;
    };
    const companyFixedEarningsForRecord = (profile) => normalizeFixedEarnings(profile?.fixedEarnings)
      .filter((item) => item.name.trim() || numberValue(item.amount))
      .map((item) => ({
        id: newId('earn'),
        name: item.name,
        amount: item.amount,
        affectsHourly: true,
        sourceType: 'company-fixed',
        sourceKey: item.id
      }));
    const companyFixedDeductionsForRecord = (company) => normalizeFixedDeductions(company?.fixedDeductions)
      .filter((item) => item.name.trim() || item.amount)
      .map((item) => ({
        id: newId('deduct'), name: item.name, amount: item.amount, affectsHourly: false,
        sourceType: 'company-fixed-deduction', sourceKey: item.id
      }));
    const applyCompanyDefaultsToRecord = (draft, company) => {
      if (!draft || !company) return draft;
      const profileDate = salaryPeriodBounds(draft.year, draft.month, company.id).end;
      const profile = salaryProfileAt(company, profileDate);
      const manualEarnings = normalizeCustomItems(draft.customEarnings).filter((item) => item.sourceType !== 'company-fixed');
      const manualDeductions = normalizeCustomItems(draft.customDeductions).filter((item) => item.sourceType !== 'company-fixed-deduction');
      Object.assign(draft, {
        employmentMode: normalizeEmploymentMode(profile.employmentMode),
        baseHourlyRate: normalizeHourlyRate(profile.baseHourlyRate),
        regularHours: normalizeRegularHours(profile.regularHours, profile.employmentMode === 'dispatch_hourly' ? 174 : 0),
        baseSalary: salaryProfileBasePay(profile),
        mealAllowance: numberValue(profile.mealAllowance),
        positionAllowance: numberValue(profile.positionAllowance),
        laborIns: numberValue(company.laborIns),
        healthIns: numberValue(company.healthIns),
        taxWithheld: numberValue(company.taxWithheld),
        customEarnings: [...companyFixedEarningsForRecord(profile), ...manualEarnings],
        customDeductions: [...companyFixedDeductionsForRecord(company), ...manualDeductions]
      });
      return draft;
    };
    const gross = (record) => numberValue(record.baseSalary) + numberValue(record.mealAllowance) + numberValue(record.positionAllowance) + numberValue(record.overtime) + numberValue(record.bonus) + customTotal(record.customEarnings);
    const deductions = (record) => numberValue(record.laborIns) + numberValue(record.healthIns) + numberValue(record.taxWithheld) + numberValue(record.otherDeduction) + customTotal(record.customDeductions);
    const pension = (record) => numberValue(record.pensionSelf);
    const mainNet = (record) => gross(record) - deductions(record) - pension(record);
    const combinedNet = (record) => mainNet(record) + numberValue(record.sideIncome);
    const taxableSalary = (record) => Math.max(0, gross(record) - Math.min(numberValue(record.mealAllowance), 3000) - pension(record));

    const overtimeAmount = (log) => {
      if (!calculationCache.creditHours.has('index')) {
        const index = new Map();
        const checked = window.SalaryMateCompTime.ledger({credits:state.compTimeCredits,logs:state.overtimeLogs,today:todayIso()});
        for (const row of checked.rows) if (!row.issues.length) index.set(JSON.stringify([row.credit.companyId,row.credit.sourceId]), row.credit.hours);
        calculationCache.creditHours.set('index',index);
      }
      const credited = calculationCache.creditHours.get('index').get(JSON.stringify([log.companyId,log.id])) || 0;
      const hours = Math.max(0, numberValue(log.hours)-credited);
      const rate = Math.max(0, overtimeHourlyRate(log));
      if (!hours || !rate) return 0;
      if (log.type === 'weekday') {
        const first = Math.min(hours, 2);
        const later = Math.max(0, hours - 2);
        return rate * (first * 1.34 + later * 1.67);
      }
      if (log.type === 'restday' || log.type === 'weekend') {
        const first = Math.min(hours, 2);
        const middle = Math.min(Math.max(hours - 2, 0), 6);
        const later = Math.max(hours - 8, 0);
        return rate * (first * 1.34 + middle * 1.67 + later * 2.67);
      }
      if (log.type === 'holiday') return hours * rate * 2;
      if (log.type === 'spring') return hours * rate * 2.5;
      return hours * rate * Math.max(0, numberValue(log.customRate) || 1);
    };

    // Round only once per company/payroll month, including multi-company/year views.
    const roundOvertimeTotal = value => Math.round(Number(numberValue(value).toFixed(8)));
    const overtimeTotal = logs => {
      const groups = new Map();
      for (const log of logs) {
        const period = salaryMonthForLog(log);
        const key = JSON.stringify([log.companyId, period?.year ?? '', period?.month ?? '']);
        groups.set(key, (groups.get(key) || 0) + overtimeAmount(log));
      }
      return [...groups.values()].reduce((sum, value) => sum + roundOvertimeTotal(value), 0);
    };

    const overtimeTypeName = (type) => ({
      weekday: '平日', restday: '休息日', weekend: '休息日', holiday: '例假日／約定假日', spring: '春節約定', custom: '自訂倍率'
    })[type] || '加班';

    const filteredRecords = () => {
      const key = `${ui.selectedYear}:${ui.companyFilter}`;
      if (!calculationCache.filteredRecords.has(key)) {
        calculationCache.filteredRecords.set(key, state.records.filter((record) =>
          Number(record.year) === Number(ui.selectedYear) &&
          (ui.companyFilter === 'ALL' || record.companyId === ui.companyFilter)
        ));
      }
      return calculationCache.filteredRecords.get(key);
    };

    const filteredOvertime = () => state.overtimeLogs.filter((log) => {
      const attributed = salaryMonthForLog(log);
      return attributed && attributed.year === Number(ui.selectedYear) &&
        (ui.companyFilter === 'ALL' || log.companyId === ui.companyFilter) &&
        (Number(ui.overtimeMonth) === 0 || attributed.month === Number(ui.overtimeMonth));
    });

    const filteredLeave = () => state.leaveRecords.filter((record) => {
      const statusMatches = ui.leaveStatus === 'all' ||
        (ui.leaveStatus === 'active' ? record.status !== 'cancelled' : record.status === ui.leaveStatus);
      return statusMatches &&
        (ui.companyFilter === 'ALL' || record.companyId === ui.companyFilter) &&
        leaveAllocations(record).some((allocation) => allocation.year === Number(ui.selectedYear) &&
          (Number(ui.leaveMonth) === 0 || allocation.month === Number(ui.leaveMonth)));
    });

    const leaveRecordsInScope = (year = ui.selectedYear, month = ui.leaveMonth, companyFilter = ui.companyFilter) => state.leaveRecords.filter((record) =>
      (companyFilter === 'ALL' || record.companyId === companyFilter) &&
      leaveAllocations(record).some((allocation) => allocation.year === Number(year) && (Number(month) === 0 || allocation.month === Number(month)))
    );

    const attendanceAnalysis = (year = ui.selectedYear, month = ui.leaveMonth, companyFilter = ui.companyFilter) => {
      const cacheKey = `${Number(year)}:${Number(month)}:${companyFilter}`;
      if (calculationCache.attendanceAnalysis.has(cacheKey)) return calculationCache.attendanceAnalysis.get(cacheKey);
      const pairs = new Map();
      const addPair = (companyId, targetYear, targetMonth) => {
        if (!getCompany(companyId) || Number(targetYear) !== Number(year) || (Number(month) && Number(targetMonth) !== Number(month))) return;
        if (companyFilter !== 'ALL' && companyId !== companyFilter) return;
        pairs.set(`${companyId}:${targetYear}-${pad2(targetMonth)}`, { companyId, year: Number(targetYear), month: Number(targetMonth) });
      };
      state.records.forEach((record) => addPair(record.companyId, record.year, record.month));
      state.overtimeLogs.forEach((log) => {
        const attributed = salaryMonthForLog(log);
        if (attributed) addPair(log.companyId, attributed.year, attributed.month);
      });
      state.leaveRecords.filter((record) => record.status !== 'cancelled').forEach((record) => leaveAllocations(record).forEach((allocation) => addPair(record.companyId, allocation.year, allocation.month)));

      let expectedHours = 0;
      let scheduledDays = 0;
      pairs.forEach((pair) => {
        const company = getCompany(pair.companyId);
        const bounds = salaryPeriodBounds(pair.year, pair.month, pair.companyId);
        const workdays = enumerateIsoDates(bounds.start, bounds.end, 45).filter((date) => !isWeekend(date)).length;
        scheduledDays += workdays;
        expectedHours += workdays * (numberValue(company?.workHoursPerDay) || 8);
      });

      const typeBreakdown = Object.fromEntries(Object.keys(LEAVE_TYPES).map((type) => [type, { confirmed: 0, planned: 0 }]));
      let confirmedHours = 0;
      let plannedHours = 0;
      let wageDeduction = 0;
      let attendanceDeduction = 0;
      leaveRecordsInScope(year, month, companyFilter).filter((record) => record.status !== 'cancelled').forEach((record) => {
        const allocations = leaveAllocations(record).filter((allocation) => allocation.year === Number(year) && (!Number(month) || allocation.month === Number(month)));
        const hours = allocations.reduce((sum, allocation) => sum + allocation.hours, 0);
        if (record.status === 'confirmed') {
          confirmedHours += hours;
          wageDeduction += allocations.reduce((sum, allocation) => sum + allocation.wageDeduction, 0);
          attendanceDeduction += allocations.reduce((sum, allocation) => sum + allocation.attendanceDeduction, 0);
          typeBreakdown[record.type].confirmed += hours;
        } else if (record.status === 'planned') {
          plannedHours += hours;
          typeBreakdown[record.type].planned += hours;
        }
      });
      const overtimeHours = state.overtimeLogs.reduce((sum, log) => {
        const attributed = salaryMonthForLog(log);
        if (!attributed || attributed.year !== Number(year) || (Number(month) && attributed.month !== Number(month))) return sum;
        if (companyFilter !== 'ALL' && log.companyId !== companyFilter) return sum;
        return sum + numberValue(log.hours);
      }, 0);
      const attendedHours = Math.max(0, expectedHours - confirmedHours);
      const attendanceRate = expectedHours > 0 ? Number((attendedHours / expectedHours * 100).toFixed(1)) : null;
      const result = {
        expectedHours,
        scheduledDays,
        confirmedHours,
        plannedHours,
        overtimeHours,
        attendedHours,
        attendanceRate,
        wageDeduction,
        attendanceDeduction,
        totalDeduction: wageDeduction + attendanceDeduction,
        coverageMonths: pairs.size,
        typeBreakdown
      };
      calculationCache.attendanceAnalysis.set(cacheKey, result);
      return result;
    };

    const sortedRecords = (records = filteredRecords()) => [...records].sort((a, b) => b.year - a.year || b.month - a.month || String(b.payDate).localeCompare(String(a.payDate)));

    const annualStats = () => filteredRecords().reduce((totals, record) => {
      totals.gross += gross(record);
      totals.deductions += deductions(record) + pension(record);
      totals.side += numberValue(record.sideIncome);
      totals.mainNet += mainNet(record);
      totals.combinedNet += combinedNet(record);
      return totals;
    }, { gross: 0, deductions: 0, side: 0, mainNet: 0, combinedNet: 0 });

    const monthlyTotals = () => {
      const totals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, gross: 0, net: 0 }));
      filteredRecords().forEach((record) => {
        const monthIndex = Number(record.month) - 1;
        if (monthIndex < 0 || monthIndex >= totals.length) return;
        totals[monthIndex].gross += gross(record);
        totals[monthIndex].net += combinedNet(record);
      });
      return totals;
    };

    const deductionStats = () => filteredRecords().reduce((totals, record) => {
      totals.labor += numberValue(record.laborIns);
      totals.health += numberValue(record.healthIns);
      totals.tax += numberValue(record.taxWithheld);
      totals.pension += pension(record);
      totals.other += numberValue(record.otherDeduction) + customTotal(record.customDeductions);
      return totals;
    }, { labor: 0, health: 0, tax: 0, pension: 0, other: 0 });

    const taxStats = () => {
      const companyMap = new Map();
      filteredRecords().forEach((record) => {
        const id = record.companyId || 'unknown';
        if (!companyMap.has(id)) {
          companyMap.set(id, {
            id,
            name: companyName(id),
            isCurrent: getCompany(id)?.isCurrent || false,
            monthCount: 0,
            taxable: 0,
            tax: 0,
            pension: 0
          });
        }
        const row = companyMap.get(id);
        row.monthCount += 1;
        row.taxable += taxableSalary(record);
        row.tax += numberValue(record.taxWithheld);
        row.pension += pension(record);
      });
      const rows = [...companyMap.values()];
      return {
        taxable: rows.reduce((sum, row) => sum + row.taxable, 0),
        tax: rows.reduce((sum, row) => sum + row.tax, 0),
        pension: rows.reduce((sum, row) => sum + row.pension, 0),
        rows
      };
    };

    const overtimeForScope = (month, companyFilter = ui.companyFilter) => overtimeForSalaryMonth(ui.selectedYear, month, companyFilter);

    const hourlyMetrics = (month = ui.hourlyMonth) => {
      const cacheKey = `${ui.selectedYear}:${ui.companyFilter}:${Number(month)}`;
      if (calculationCache.hourlyMetrics.has(cacheKey)) return calculationCache.hourlyMetrics.get(cacheKey);
      const records = filteredRecords().filter((record) => Number(month) === 0 || Number(record.month) === Number(month));
      if (!records.length) {
        const empty = { hasData: false, nominalRate: 0, netRate: 0, trueRate: 0, sideRate: 0, gapPercent: 0, rateDiff: 0, workHours: 0, overtimeHours: 0, commuteHours: 0, prepHours: 0, totalTime: 0 };
        calculationCache.hourlyMetrics.set(cacheKey, empty);
        return empty;
      }
      const months = Number(month) > 0 ? [Number(month)] : [...new Set(records.map((record) => Number(record.month)))];
      const monthCount = Math.max(months.length, 1);
      const avgFixedSalary = records.reduce((sum, record) => sum + recordHourlyBase(record), 0) / monthCount;
      const avgRegularHours = records.reduce((sum, record) => sum + recordRegularHours(record), 0) / monthCount;
      const avgMainNet = records.reduce((sum, record) => sum + mainNet(record), 0) / monthCount;
      const avgSide = records.reduce((sum, record) => sum + numberValue(record.sideIncome), 0) / monthCount;
      const overtimeLogs = state.overtimeLogs.filter((log) => {
        const attributed = salaryMonthForLog(log);
        return attributed && attributed.year === Number(ui.selectedYear) && months.includes(attributed.month) &&
          (ui.companyFilter === 'ALL' || log.companyId === ui.companyFilter);
      });
      const avgOtHours = overtimeLogs.reduce((sum, log) => sum + numberValue(log.hours), 0) / monthCount;
      const settings = state.hourlySettings;
      const standard = Math.max(1, avgRegularHours);
      const workHours = standard + avgOtHours;
      const commuteHours = numberValue(settings.commuteMinsDay) * numberValue(settings.workDays) / 60;
      const prepHours = numberValue(settings.prepMinsDay) * numberValue(settings.workDays) / 60;
      const totalTime = workHours + commuteHours + prepHours;
      const nominalRate = avgFixedSalary / standard;
      const netRate = workHours > 0 ? avgMainNet / workHours : 0;
      const trueRate = totalTime > 0 ? Math.max(0, avgMainNet - numberValue(settings.commuteCostMonth)) / totalTime : 0;
      const sideRate = numberValue(settings.sideHoursMonth) > 0 ? avgSide / numberValue(settings.sideHoursMonth) : 0;
      const gapPercent = nominalRate > 0 ? ((trueRate - nominalRate) / nominalRate) * 100 : 0;
      const result = {
        hasData: true,
        nominalRate: Math.round(nominalRate),
        netRate: Math.round(netRate),
        trueRate: Math.round(trueRate),
        sideRate: Math.round(sideRate),
        gapPercent: Number(gapPercent.toFixed(1)),
        rateDiff: Math.abs(nominalRate - trueRate),
        regularHours: Math.round(standard * 10) / 10,
        workHours: Math.round(workHours * 10) / 10,
        overtimeHours: Math.round(avgOtHours * 10) / 10,
        commuteHours: Math.round(commuteHours * 10) / 10,
        prepHours: Math.round(prepHours * 10) / 10,
        totalTime: Math.round(totalTime * 10) / 10
      };
      calculationCache.hourlyMetrics.set(cacheKey, result);
      return result;
    };

    const multiplierRows = [
      { key: 'regular', label: '國定假日 1 倍', tone: '#c2410c' },
      { key: 'first', label: '前段加班', tone: '#0f766e' },
      { key: 'second', label: '後段加班', tone: '#2563eb' },
      { key: 'holiday', label: '星期天', tone: '#2563eb' },
      { key: 'restExtra', label: '休息日第 9 小時起', tone: '#7c3aed' },
      { key: 'spring', label: '春節加班', tone: '#a21caf' }
    ];

    const activeCalculatorCompany = () => (ui.companyFilter !== 'ALL' ? getCompany(ui.companyFilter) : null) ||
      getCompany(state.overtimeCalculator.companyId) ||
      state.companies.find((company) => company.isCurrent) || state.companies[0] || null;

    const overtimeWorkbench = () => {
      const calc = state.overtimeCalculator;
      const company = activeCalculatorCompany();
      const leaveDeductionEach = company ? numberValue(company.leaveDeductionEach) : numberValue(calc.leaveDeductionEach);
      const ruleNote = company ? company.deductionRuleNote : calc.ruleNote;
      const fixedSalary = numberValue(calc.baseSalary) + numberValue(calc.mealAllowance) + numberValue(calc.attendanceBonus) + numberValue(calc.positionAllowance) + numberValue(calc.otherFixed);
      const hourlyRate = fixedSalary / Math.max(1, numberValue(calc.overtimeDivisor));
      const amount = (key, hours = calc.hours[key]) => hourlyRate * numberValue(calc.multipliers[key]) * numberValue(hours);
      const amounts = Object.fromEntries(multiplierRows.map((row) => [row.key, amount(row.key)]));
      const overtimePay = roundOvertimeTotal(Object.values(amounts).reduce((sum, value) => sum + value, 0));
      const leaveDeduction = Math.round(numberValue(calc.leaveCount) * leaveDeductionEach);
      const estimatedPay = Math.round(fixedSalary + overtimePay + numberValue(calc.variableAdjustment) - leaveDeduction);
      const first2 = amount('first', 2);
      const second1 = amount('second', 1);
      const second6 = amount('second', 6);
      const extra2 = amount('restExtra', 2);
      const regular8 = amount('regular', 8);
      const weekday10 = regular8 + first2;
      const rest8 = first2 + second6;
      const rest10 = rest8 + extra2;
      const holiday8 = amount('holiday', 8);
      const holiday10 = amount('holiday', 10);
      const national8 = amount('regular', 8);
      const national10 = amount('regular', 10);
      const spring8 = amount('spring', 8);
      const spring10 = amount('spring', 10);
      return {
        company,
        leaveDeductionEach,
        ruleNote,
        fixedSalary,
        hourlyRate,
        amounts,
        overtimePay,
        leaveDeduction,
        estimatedPay,
        totalHours: Object.values(calc.hours).reduce((sum, value) => sum + numberValue(value), 0),
        weekday: [
          ['前 2 小時', first2],
          ['後 1 小時', second1],
          ['一般 8 小時', regular8],
          ['10 小時（8＋2）', weekday10],
          ['11 小時（8＋2＋1）', weekday10 + second1]
        ],
        restday: [
          ['前 2 小時', first2],
          ['後 6 小時', second6],
          ['第 9～10 小時', extra2],
          ['合計 8 小時', rest8],
          ['合計 10 小時', rest10]
        ],
        holiday: [
          ['星期天 8 小時', holiday8],
          ['星期天 10 小時', holiday10],
          ['國定假日 1 倍／8 小時', national8],
          ['國定假日 1 倍／10 小時', national10],
          ['春節 8 小時', spring8],
          ['春節 10 小時', spring10]
        ],
        differences: {
          weekday8: regular8,
          weekday10,
          rest8,
          rest10,
          holiday8,
          holiday10,
          national8,
          national10,
          spring8,
          spring10
        }
      };
    };

    const rateNumber = (value) => rateNumberFormatter.format(numberValue(value));
    const hourlyRateNumber = (value) => hourlyRateNumberFormatter.format(numberValue(value));

    const closeCompanyPicker = (restoreFocus = false) => {
      $('#companyPickerPanel').hidden = true;
      $('#companyPickerButton').setAttribute('aria-expanded', 'false');
      if (restoreFocus) $('#companyPickerButton').focus({preventScroll:true});
    };
    const renderCompanyPicker = () => {
      const select = $('#companyFilter');
      const trigger = $('#companyPickerButton');
      closeCompanyPicker();
      trigger.disabled = select.disabled;
      const company = getCompany(select.value);
      $('#companyPickerLabel').innerHTML = company
        ? `${company.isCurrent ? '目前｜' : ''}${userHtml(company.name)}`
        : escapeHtml(select.selectedOptions[0]?.textContent || '尚未建立公司');
      $('#companyPickerList').innerHTML = state.companies.map(company => `<li class="company-picker-row"><button class="company-picker-select" type="button" data-action="pick-company" data-id="${escapeAttr(company.id)}" aria-current="${company.isCurrent ? 'true' : 'false'}"><span class="company-picker-check" aria-hidden="true">${company.isCurrent ? '✓' : ''}</span><span>${userHtml(company.name)}</span></button><div class="company-picker-actions" role="group" aria-label="${escapeAttr(window.SalaryMateI18n.user(company.name))}"><button type="button" data-action="picker-edit-company" data-id="${escapeAttr(company.id)}">編輯</button><button class="company-picker-delete" type="button" data-action="picker-delete-company" data-id="${escapeAttr(company.id)}">刪除</button></div></li>`).join('');
    };

    const renderFilters = () => {
      const companySelect = $('#companyFilter');
      const yearSelect = $('#yearFilter');
      const selectedCompany = currentCompany();
      const globallyBlocked = ['loading', 'failure'].includes(runtimeState.dataStatus);
      if (globallyBlocked) {
        companySelect.innerHTML = `<option value="">${runtimeState.dataStatus === 'loading' ? '資料載入中' : '資料讀取失敗'}</option>`;
        companySelect.value = '';
        companySelect.disabled = true;
        yearSelect.innerHTML = `<option value="${currentYear}">${currentYear} 年</option>`;
        yearSelect.value = String(currentYear);
        yearSelect.disabled = true;
        renderCompanyPicker();
        return;
      }
      yearSelect.disabled = runtimeState.operationStatus === 'submitting';
      if (!state.companies.length) {
        companySelect.innerHTML = '<option value="">尚未建立公司</option>';
        companySelect.value = '';
        companySelect.disabled = true;
        ui.companyFilter = 'ALL';
      } else if (!selectedCompany) {
        companySelect.disabled = runtimeState.operationStatus === 'submitting';
        companySelect.innerHTML = `<option value="">需要選擇目前公司</option>${state.companies.map((company) => `<option value="${escapeAttr(company.id)}">${userHtml(company.name)}</option>`).join('')}`;
        ui.companyFilter = '';
        companySelect.value = '';
      } else {
        companySelect.disabled = runtimeState.operationStatus === 'submitting';
        companySelect.innerHTML = state.companies.map((company) =>
          `<option value="${escapeAttr(company.id)}">${company.isCurrent ? '目前｜' : ''}${userHtml(company.name)}</option>`
        ).join('');
        ui.companyFilter = selectedCompany.id;
        companySelect.value = ui.companyFilter;
      }

      const years = [...new Set([
        currentYear,
        ui.selectedYear,
        ...state.records.map((record) => Number(record.year)),
        ...state.investmentRecords.map(record=>Number(record.date.slice(0,4))).filter(Boolean),
        ...state.stockPortfolio.transactions.map(record=>Number(record.date.slice(0,4))).filter(Boolean),
        ...state.overtimeLogs.map((log) => salaryMonthForLog(log)?.year).filter(Boolean),
        ...state.leaveRecords.flatMap((record) => leaveAllocations(record).map((allocation) => allocation.year)).filter(Boolean),
        ...state.yearEndEstimates.map((record) => Number(record.year)).filter(Boolean),
        ...state.salaryAdjustments.map((record) => parseDateParts(record.effectiveDate)?.year).filter(Boolean)
      ])].sort((a, b) => b - a);
      yearSelect.innerHTML = years.map((year) => `<option value="${year}">${year} 年</option>`).join('');
      yearSelect.value = String(ui.selectedYear);
      renderCompanyPicker();
    };

    const renderBarChart = () => {
      const data = monthlyTotals();
      const max = Math.max(1, ...data.flatMap((item) => [item.gross, item.net]));
      return `
        <div class="bar-chart" role="img" aria-label="每月應發薪資與實際入帳比較圖">
          ${data.map((item) => `
            <div class="bar-month">
              <div class="bar-stack">
                <div class="bar gross" style="height:${item.gross ? Math.max(3, item.gross / max * 100) : 0}%" title="${item.month} 月應發：$${money(item.gross)}"></div>
                <div class="bar net" style="height:${item.net ? Math.max(3, item.net / max * 100) : 0}%" title="${item.month} 月實際入帳：$${money(item.net)}"></div>
              </div>
              <div class="bar-label">${item.month}月</div>
            </div>`).join('')}
        </div>
        <div class="legend"><span><i style="background:#aebdba"></i>主業應發</span><span><i style="background:var(--brand-2)"></i>主業實領＋副業</span></div>`;
    };

    const renderDonut = (items, centerLabel = '扣除總額', prefix = '$', suffix = '') => {
      const total = items.reduce((sum, item) => sum + item.value, 0);
      let cursor = 0;
      const segments = total > 0 ? items.map((item) => {
        const start = cursor;
        cursor += item.value / total * 360;
        return `${item.color} ${start}deg ${cursor}deg`;
      }).join(',') : '#e6eeec 0deg 360deg';
      return `
        <div class="donut-wrap">
          <div class="donut" style="background:conic-gradient(${segments})" role="img" aria-label="${escapeAttr(centerLabel)} ${escapeAttr(prefix)}${money(total)}${escapeAttr(suffix)}">
            <div class="donut-center"><strong>${escapeHtml(prefix)}${money(total)}${escapeHtml(suffix)}</strong><span>${escapeHtml(centerLabel)}</span></div>
          </div>
          <div class="legend-list">
            ${items.map((item) => `<div class="legend-row"><span><i class="dot" style="background:${item.color}"></i>${escapeHtml(item.label)}</span><b>${escapeHtml(prefix)}${money(item.value)}${escapeHtml(suffix)}</b></div>`).join('')}
          </div>
        </div>`;
    };

    const renderAppStatePanel = () => {
      const status = runtimeState.dataStatus;
      if (status === 'loading') return `<section class="view state-view" aria-labelledby="appStateTitle" aria-busy="true"><article class="card app-state-card loading" role="status" aria-live="polite"><div class="state-spinner" aria-hidden="true"></div><h2 id="appStateTitle">正在讀取薪資資料</h2><p>${escapeHtml(runtimeState.dataMessage || '正在安全讀取目前裝置資料…')}</p></article></section>`;
      if (status === 'failure') return `<section class="view state-view" aria-labelledby="appStateTitle"><article class="card app-state-card failure" role="alert"><div class="empty-icon" aria-hidden="true">!</div><h2 id="appStateTitle">資料讀取失敗</h2><p>${escapeHtml(runtimeState.dataMessage || '目前無法安全讀取資料。現有儲存內容尚未變更。')}</p><div class="form-actions"><button class="btn" type="button" data-action="restore-backup-file">選擇備份還原</button><button class="btn btn-primary" type="button" data-action="retry-load">重新讀取</button></div></article></section>`;
      if (status === 'invalid') return `<section class="view state-view" aria-labelledby="appStateTitle"><article class="card app-state-card invalid" role="alert"><div class="empty-icon" aria-hidden="true">公</div><h2 id="appStateTitle">目前公司設定需要確認</h2><p>${escapeHtml(runtimeState.dataMessage || '請先在公司管理設定唯一的目前公司。系統不會自動改用第一家公司。')}</p><div class="form-actions"><button class="btn" type="button" data-action="data-health">資料完整性健檢</button><button class="btn btn-primary" type="button" data-action="manage-companies">前往公司管理</button></div></article></section>`;
      return '';
    };

    const renderOperationNotice = () => {
      if (runtimeState.operationStatus === 'submitting') return `<div class="operation-state submitting" role="status" aria-live="polite"><span class="state-spinner small" aria-hidden="true"></span><span>${escapeHtml(runtimeState.operationMessage || '正在安全處理…')}</span></div>`;
      if (runtimeState.operationStatus === 'failure' && runtimeState.operationName !== 'startup-load') return `<div class="operation-state failure" role="alert"><span>${escapeHtml(runtimeState.operationMessage || '作業失敗。原本資料保持不變。')}</span><button class="btn btn-small" type="button" data-action="dismiss-operation-failure">關閉</button></div>`;
      return '';
    };

    const retryAppLoad = () => {
      setOperationStatus('idle');
      setDataStatus('loading', '正在重新讀取本機薪資資料…');
      renderAll();
      setTimeout(() => {
        loadState();
        if (runtimeState.dataStatus !== 'failure') restoreUiPreferences();
        renderAll();
        focusPageHeading();
      }, 0);
    };

    const emptyPanel = (icon, title, message, action = '') => `
      <div class="card empty">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        ${action}
      </div>`;

    const renderDashboard = () => {
      const stats = annualStats();
      const deductionsData = deductionStats();
      const records = sortedRecords().slice(0, 6);
      const tenureCompany = ui.companyFilter !== 'ALL'
        ? getCompany(ui.companyFilter)
        : state.companies.find((company) => company.isCurrent) || state.companies[0];
      const tenure = employmentTenure(tenureCompany);
      const tenureValue = !tenureCompany || !tenure.configured
        ? '尚未設定'
        : tenure.future
          ? '尚未到職'
          : `${tenure.years} 年 ${tenure.days} 天`;
      const tenureNote = !tenureCompany
        ? '請先建立任職公司'
        : !tenure.configured
          ? `${tenureCompany.name}｜請設定第一天上班日`
          : `${tenureCompany.name}｜${tenure.startDate.replace(/-/g, '/')} ${tenure.future ? '預計到職' : '到職'}`;
      return `
        <section class="view" aria-labelledby="dashboardTitle">
          <div class="page-head">
            <div><h2 id="dashboardTitle">${ui.selectedYear} 年收入總覽</h2><p>從應發薪資到實際入帳，同步掌握目前任職年資。</p></div>
            <div class="page-actions">
              <button class="btn" type="button" data-action="manage-companies">公司管理</button>
              <button class="btn btn-primary" type="button" data-action="add-record">＋ 新增薪資</button>
            </div>
          </div>
          <div class="metric-grid">
            <article class="card metric green"><div class="metric-label"><span>年度可支配淨入帳</span><span class="metric-icon">$</span></div><div class="metric-value">$${money(stats.combinedNet)}</div><div class="metric-note">主業實領 $${money(stats.mainNet)} ＋ 投資收入（舊欄位）</div></article>
            <article class="card metric"><div class="metric-label"><span>主業應發總額</span><span class="metric-icon">◎</span></div><div class="metric-value">$${money(stats.gross)}</div><div class="metric-note">本薪、津貼、加班、獎金及自訂加項</div></article>
            <article class="card metric rose"><div class="metric-label"><span>薪資扣除總額</span><span class="metric-icon">−</span></div><div class="metric-value">−$${money(stats.deductions)}</div><div class="metric-note">含勞健保、稅額、其他扣項及勞退自提</div></article>
            <article class="card metric amber"><div class="metric-label"><span>到職年資</span><span class="metric-icon">年</span></div><div class="metric-value">${escapeHtml(tenureValue)}</div><div class="metric-note">${escapeHtml(tenureNote)}</div></article>
          </div>
          ${filteredRecords().length ? `
            <div class="chart-grid">
              <article class="card card-pad"><div class="section-title"><div><h3>月度收入趨勢</h3><p>同月份有多家公司時會自動合併加總</p></div><span class="soft-badge">${ui.selectedYear}</span></div>${renderBarChart()}</article>
              <article class="card card-pad"><div class="section-title"><div><h3>年度扣除結構</h3><p>拆分薪資單中的各類扣除</p></div></div>${renderDonut([
                { label: '勞保', value: deductionsData.labor, color: '#f59e0b' },
                { label: '健保', value: deductionsData.health, color: '#3b82f6' },
                { label: '預扣稅', value: deductionsData.tax, color: '#6d28d9' },
                { label: '勞退自提', value: deductionsData.pension, color: '#14b8a6' },
                { label: '其他', value: deductionsData.other, color: '#e11d48' }
              ])}</article>
            </div>` : emptyPanel('薪', '尚未建立薪資紀錄', '先新增任職公司，再建立第一筆月度薪資；系統不會自動放入示範資料。', `<button class="btn btn-primary" type="button" data-action="${state.companies.length ? 'add-record' : 'manage-companies'}">${state.companies.length ? '新增第一筆薪資' : '先建立公司'}</button>`)}
          ${records.length ? renderRecentTable(records) : ''}
        </section>`;
    };

    const renderRecentTable = (records) => `
      <article class="card table-shell">
        <div class="card-pad section-title"><div><h3>最近薪資紀錄</h3><p>顯示目前年度與公司篩選下的最近 6 筆</p></div><button class="btn btn-small" type="button" data-tab="records">查看全部</button></div>
        <div class="table-scroll"><table><thead><tr><th>月份</th><th>公司</th><th>應發</th><th>薪資扣除</th><th>副業</th><th>實際入帳</th><th>操作</th></tr></thead>
        <tbody>${records.map((record) => `<tr class="data-row"><td><span class="month-title">${record.month} 月<small>${escapeHtml(record.payDate || '未填入帳日')}</small></span></td><td><span class="status ${companyStatus(record.companyId)}">${companyStatus(record.companyId) === 'current' ? '現任' : '歷任'}</span> ${userHtml(companyName(record.companyId))}</td><td class="money">$${money(gross(record))}</td><td class="money text-rose">−$${money(deductions(record) + pension(record))}</td><td class="money text-amber">+$${money(record.sideIncome)}</td><td class="money text-green">$${money(combinedNet(record))}</td><td class="actions"><button class="btn btn-small" type="button" data-action="edit-record" data-id="${escapeAttr(record.id)}">編輯</button></td></tr>`).join('')}</tbody></table></div>
      </article>`;

    // RECONCILIATION_START
    const reconciliationSource = record => {
      const logs = overtimeForSalaryMonth(record.year,record.month,record.companyId);
      const overtime = overtimeTotal(logs);
      const leave = leaveSyncInfo(record.year,record.month,record.companyId);
      const warnings=[];
      if (logs.length && Math.round(overtime*100)!==Math.round(record.overtime*100)) warnings.push(`加班紀錄合計 $${money(overtime)}，薪資列入 $${money(record.overtime)}，請先核對或同步。`);
      if (!logs.length && record.overtime) warnings.push('本月薪資有加班費，但沒有對應加班紀錄，請確認來源。');
      if ((leave.total || leave.linkedItem) && leave.status!=='synced') warnings.push('請假扣款尚未同步或來源已變更，請到工時／請假確認。');
      const bounds=salaryPeriodBounds(record.year,record.month,record.companyId);
      const leaves=state.leaveRecords.filter(row=>row.companyId===record.companyId && leaveDateEntries(row).some(entry=>entry.date>=bounds.start && entry.date<=bounds.end));
      return {warnings,logs:logs.map(log=>[log.id,log.date,log.hours,log.hourlyRate,log.type,log.customRate,state.compTimeCredits.filter(credit=>credit.sourceId===log.id).map(credit=>[credit.id,credit.hours,credit.expiresAt])]),leave:[leave.total,leave.hours,leave.records,leave.status],leaves};
    };
    const reconciliationStatus = record => window.SalaryMateReconcile.evaluate(record,reconciliationSource(record)).status;
    let reconciliationDraft = null;
    const openReconciliation = id => {
      const record = state.records.find(row=>row.id===id);
      if (!record) return toast('薪資紀錄不存在，請重新選擇。','error');
      const source=reconciliationSource(record);
      const saved=window.SalaryMateReconcile.normalize(record.reconciliation);
      reconciliationDraft={id,companyId:record.companyId,year:record.year,month:record.month,fingerprint:window.SalaryMateReconcile.fingerprint(record,source)};
      beginDraftScope({entityType:'reconciliation',companyId:record.companyId,entityId:id,payrollMonth:payrollMonthKey(record.year,record.month),operational:true});
      const rows=window.SalaryMateReconcile.rows(record);
      openDialog('月結核對',`<form id="reconciliationForm"><div class="reconcile-summary"><h3>${userHtml(companyName(record.companyId))}｜${record.year} 年 ${record.month} 月</h3><p>輸入公司薪資單金額；差額＝公司金額－系統金額。投資收入不列入薪資實領。</p><p>無此項目請填 0；空白代表尚未核對。核對不會修改薪資或工時。</p><p>狀態：${escapeHtml(reconciliationStatus(record))}</p></div>${source.warnings.map(text=>`<div class="notice warning">${escapeHtml(text)}</div>`).join('')}<div class="reconcile-quick"><p>已看過薪資單，所有金額都相同？可直接完成，不必逐格輸入。</p><button class="btn btn-primary" type="button" data-action="reconcile-match">金額皆相同，核對完成</button></div><div class="reconcile-list">${rows.map((row,i)=>`<div class="reconcile-row"><strong>${escapeHtml(row.label)}</strong><div><small>系統金額</small>$${row.expected.toLocaleString('zh-TW',{maximumFractionDigits:2})}</div><label for="reconcile-${i}"><small>公司金額</small><input class="field" id="reconcile-${i}" data-reconcile-key="${escapeAttr(row.key)}" type="number" step="0.01" min="-10000000000" max="10000000000" inputmode="decimal" value="${saved?.actual[row.key]??''}"></label><output data-reconcile-delta="${i}">未填</output></div>`).join('')}</div><label for="reconcileReason">差異原因／核對備註</label><textarea class="field reconcile-reason" id="reconcileReason" maxlength="500">${escapeHtml(saved?.reason||'')}</textarea><p id="reconcileFeedback" role="status" aria-live="polite"></p><div class="form-actions reconcile-footer"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn" type="submit" name="decision" value="draft">儲存核對草稿</button><button class="btn btn-primary" type="submit" name="decision" value="confirm">確認核對完成</button></div></form>`,true);
      updateReconciliationPreview();
    };
    const collectReconciliation = () => {
      const actual=Object.create(null);
      for (const input of $$('[data-reconcile-key]')) {
        if (input.value.trim()!=='') actual[input.dataset.reconcileKey]=Number(input.value);
      }
      return {actual,reason:$('#reconcileReason')?.value||'',fingerprint:reconciliationDraft?.fingerprint||'',reviewed:false,savedAt:new Date().toISOString()};
    };
    const updateReconciliationPreview = () => {
      const record=state.records.find(row=>row.id===reconciliationDraft?.id);
      if (!record || !$('#reconciliationForm')) return;
      const result=window.SalaryMateReconcile.evaluate(record,reconciliationSource(record),collectReconciliation());
      result.rows.forEach((row,i)=>{const output=$(`[data-reconcile-delta="${i}"]`);if(output) output.textContent=row.delta===null?'未填':`差額 ${row.delta>0?'+':''}${row.delta.toLocaleString('zh-TW',{maximumFractionDigits:2})}`;});
      const quick=$('[data-action="reconcile-match"]');if(quick)quick.disabled=result.stale||result.different||result.blocked;
      const confirmButton=$('#reconciliationForm button[value="confirm"]');if(confirmButton)confirmButton.disabled=result.stale||!result.canConfirm;
      $('#reconcileFeedback').textContent=result.stale?'來源已改變，請取消後重新開啟。':!result.complete?'尚有未填項目，可先儲存草稿。':result.different?'有金額差異，請填入原因並儲存草稿。':result.blocked?'金額一致，仍需確認加班／請假來源。':'所有項目一致，可確認核對完成。';
    };
    const completeMatchingReconciliation = () => {
      const form=$('#reconciliationForm'),record=state.records.find(row=>row.id===reconciliationDraft?.id);
      if(!form||!record||!form.reportValidity())return;
      const result=window.SalaryMateReconcile.evaluate(record,reconciliationSource(record),collectReconciliation());
      if(result.stale||result.different||result.blocked){updateReconciliationPreview();return;}
      result.rows.forEach(row=>{const input=[...form.querySelectorAll('[data-reconcile-key]')].find(input=>input.dataset.reconcileKey===row.key);if(input)input.value=String(row.expected);});
      saveReconciliation(true);
    };
    const saveReconciliation = confirmed => {
      const draft=reconciliationDraft, form=$('#reconciliationForm');
      if (!draft || !form?.reportValidity()) return;
      const record=state.records.find(row=>row.id===draft.id && row.companyId===draft.companyId);
      if (!record || !assertDraftScope({entityType:'reconciliation',companyId:draft.companyId,entityId:draft.id,payrollMonth:payrollMonthKey(draft.year,draft.month),operational:true})) return;
      const source=reconciliationSource(record);
      if (draft.fingerprint!==window.SalaryMateReconcile.fingerprint(record,source)) return toast('來源已改變，請重新開啟核對。','error');
      const value=collectReconciliation();
      const result=window.SalaryMateReconcile.evaluate(record,source,value);
      if (confirmed && !result.canConfirm) {updateReconciliationPreview();return;}
      value.reviewed=confirmed;
      if (!commitStateMutation(()=>{record.reconciliation=value;},'核對資料儲存失敗，原資料保持不變。')) return;
      closeDialog();renderAll();toast(confirmed?'已完成月結核對':'已儲存核對草稿');
    };
    // RECONCILIATION_END
    const renderRecords = () => {
      const query = ui.search.trim().toLowerCase();
      const records = sortedRecords().filter((record) => {
        if (!query) return true;
        return companyName(record.companyId).toLowerCase().includes(query) ||
          String(record.note || '').toLowerCase().includes(query) ||
          String(record.month) === query || String(combinedNet(record)).includes(query);
      });
      return `
        <section class="view" aria-labelledby="recordsTitle">
          <div class="page-head"><div><h2 id="recordsTitle">各月薪資明細</h2><p>每家公司、每個月份保留一份完整薪資拆解。</p></div></div>
          <div class="card toolbar record-toolbar">
            <div class="search-wrap"><span class="search-mark">⌕</span><label class="sr-only" for="recordSearch">搜尋薪資紀錄</label><input id="recordSearch" class="field" type="search" value="${escapeAttr(ui.search)}" placeholder="搜尋公司、備註、月份或實領金額"></div>
            <div class="page-actions"><button class="btn" type="button" data-action="duplicate-record" ${state.records.length ? '' : 'disabled'}>複製上月薪資</button><button class="btn btn-primary" type="button" data-action="add-record">＋ 新增薪資</button></div>
          </div>
          ${records.length ? `<article class="card table-shell"><div class="table-scroll"><table><thead><tr><th>月份／入帳日</th><th>發薪公司</th><th>應發</th><th>代扣</th><th>勞退自提</th><th>副業</th><th>實際入帳</th><th>操作</th></tr></thead><tbody>${records.map(renderRecordRows).join('')}</tbody></table></div></article>` : emptyPanel('▦', '查無薪資紀錄', query ? '目前搜尋條件沒有相符結果。' : '請新增薪資紀錄，或調整上方年度與公司篩選。', `<button class="btn btn-primary" type="button" data-action="add-record">新增薪資</button>`) }
        </section>`;
    };

    const renderRecordRows = (record) => {
      const expanded = ui.expandedRecords.has(record.id);
      const earnings = [
        [record.employmentMode === 'dispatch_hourly' ? `派遣底薪（$${hourlyRateNumber(record.baseHourlyRate)} × ${rateNumber(record.regularHours)}h）` : '本薪／底薪', record.baseSalary], ['伙食津貼', record.mealAllowance], ['職務加給', record.positionAllowance], ['加班費', record.overtime], ['獎金／紅利', record.bonus],
        ...(record.customEarnings || []).map((item) => [`${item.name ? window.SalaryMateI18n.user(item.name) : '自訂加項'}${item.affectsHourly ? '（計入時薪）' : ''}`, item.amount])
      ];
      const deducts = [
        ['勞保自負額', record.laborIns], ['健保自負額', record.healthIns], ['預扣所得稅', record.taxWithheld], ['其他預設扣除', record.otherDeduction], ['勞退個人自提', record.pensionSelf],
        ...(record.customDeductions || []).map((item) => [item.name ? window.SalaryMateI18n.user(item.name) : '自訂扣項', item.amount])
      ];
      return `
        <tr class="data-row" data-action="toggle-record" data-id="${escapeAttr(record.id)}" style="cursor:pointer"><td><span class="month-title"><button class="btn btn-ghost btn-small" type="button" aria-label="${expanded ? '收合' : '展開'} ${record.year} 年 ${record.month} 月明細" aria-expanded="${expanded}" aria-controls="record-details-${escapeAttr(record.id)}">${expanded ? '⌄' : '›'}</button><span>${record.year} 年 ${record.month} 月<small>${escapeHtml(record.payDate || '未填入帳日')}</small></span></span></td><td><span class="status ${companyStatus(record.companyId)}">${companyStatus(record.companyId) === 'current' ? '現任' : '歷任'}</span> ${userHtml(companyName(record.companyId))}${record.employmentMode === 'dispatch_hourly' ? '<small style="display:block;color:var(--brand)">派遣（時薪）快照</small>' : ''}</td><td class="money">$${money(gross(record))}</td><td class="money text-rose">−$${money(deductions(record))}</td><td class="money text-blue">−$${money(pension(record))}</td><td class="money text-amber">+$${money(record.sideIncome)}</td><td class="money text-green">$${money(combinedNet(record))}</td><td class="actions record-actions" data-stop-row><div class="record-action-buttons"><button class="btn btn-small" type="button" data-action="reconcile-record" data-id="${escapeAttr(record.id)}">月結核對</button><button class="btn btn-small" type="button" data-action="edit-record" data-id="${escapeAttr(record.id)}">編輯</button> <button class="btn btn-small btn-danger" type="button" data-action="delete-record" data-id="${escapeAttr(record.id)}">刪除</button></div><span class="reconcile-status">${escapeHtml(reconciliationStatus(record))}</span></td></tr>
        ${expanded ? `<tr class="details-row" id="record-details-${escapeAttr(record.id)}"><td colspan="8"><div class="details-grid"><div class="breakdown"><h4 class="text-green">應發項目</h4>${earnings.filter(([, value]) => numberValue(value) !== 0).map(([name, value]) => `<div class="break-row"><span>${escapeHtml(name)}</span><b>+$${money(value)}</b></div>`).join('') || '<div class="break-row"><span>無項目</span><b>$0</b></div>'}</div><div class="breakdown"><h4 class="text-rose">扣除項目</h4>${deducts.filter(([, value]) => numberValue(value) !== 0).map(([name, value]) => `<div class="break-row"><span>${escapeHtml(name)}</span><b>−$${money(value)}</b></div>`).join('') || '<div class="break-row"><span>無項目</span><b>$0</b></div>'}${record.note ? `<div class="notice" style="margin-top:10px">備註：${userHtml(record.note)}</div>` : ''}</div></div></td></tr>` : ''}`;
    };

    const attendanceTabsHtml = () => `<div class="attendance-tabs" role="tablist" aria-label="工時與請假分類"><button class="attendance-tab ${ui.attendanceTab === 'overtime' ? 'active' : ''}" type="button" role="tab" aria-selected="${ui.attendanceTab === 'overtime'}" data-attendance-tab="overtime">加班紀錄</button><button class="attendance-tab ${ui.attendanceTab === 'leave' ? 'active' : ''}" type="button" role="tab" aria-selected="${ui.attendanceTab === 'leave'}" data-attendance-tab="leave">請假紀錄</button></div>`;
    // COMP_TIME_START
    const renderCompTimePanel = () => {
      const companyId=ui.companyFilter, ledger=compTimeLedger(undefined,undefined,undefined,companyId);
      const rows=ledger.rows.filter(row=>companyId==='ALL'||row.credit.companyId===companyId);
      const sum=key=>rateNumber(rows.reduce((n,row)=>n+numberValue(row[key]),0));
      const available=rows.filter(row=>!row.issues.length&&row.credit.earnedAt<=todayIso()&&row.credit.expiresAt>=todayIso()).reduce((n,row)=>n+row.remaining,0);
      const expired=rows.filter(row=>!row.issues.length&&row.credit.expiresAt<todayIso()).reduce((n,row)=>n+row.remaining,0);
      const settlementRows=state.compTimeSettlements.filter(row=>companyId==='ALL'||row.companyId===companyId).sort((a,b)=>b.date.localeCompare(a.date));
      return `<article class="card card-pad"><div class="section-title"><div><h3>補休來源與結餘</h3><p>從加班紀錄轉入；已確認且勾選使用補休帳本的請假，依到期日優先扣除。</p></div></div><div class="summary-row"><span>可用 ${rateNumber(available)} 小時｜已用 ${sum('used')} 小時｜已結算 ${sum('settled')} 小時</span><b>到期未結算 ${rateNumber(expired)} 小時</b></div><p class="hint">到期日由你依公司約定輸入；逾期餘額不會自動刪除。結算金額是實際核對紀錄，薪資明細仍需個別確認。</p>${ledger.violations.length?`<div class="notice warning" role="alert">補休帳本有 ${ledger.violations.length} 筆來源或餘額異常；請先核對備份與紀錄。</div>`:''}${rows.length?`<div class="table-scroll"><table><thead><tr><th>來源加班</th><th>公司</th><th>到期</th><th>取得</th><th>使用</th><th>結算</th><th>餘額</th><th>操作</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.source?.date||row.credit.earnedAt)}</td><td>${userHtml(companyName(row.credit.companyId))}</td><td>${escapeHtml(row.credit.expiresAt)}${row.credit.expiresAt<todayIso()&&row.remaining?'（已到期）':''}</td><td>${rateNumber(row.credit.hours)}h</td><td>${rateNumber(row.used)}h</td><td>${rateNumber(row.settled)}h</td><td>${row.issues.length?'待核對（'+rateNumber(row.remaining)+'h）':rateNumber(row.remaining)+'h'}</td><td class="actions"><button class="btn btn-small" type="button" data-action="settle-comp-time" data-id="${escapeAttr(row.credit.id)}" ${row.remaining&&!row.issues.length?'':'disabled'}>記錄結算</button><button class="btn btn-small" type="button" data-action="edit-comp-credit" data-id="${escapeAttr(row.credit.id)}">編輯</button><button class="btn btn-small btn-danger" type="button" data-action="delete-comp-credit" data-id="${escapeAttr(row.credit.id)}" ${row.used||row.settled?'disabled':''}>撤銷轉入</button></td></tr>`).join('')}</tbody></table></div>`:'<p>尚無補休來源。到加班紀錄點「轉補休」建立。</p>'}${settlementRows.length?`<h4>結算紀錄</h4><div class="table-scroll"><table><thead><tr><th>日期</th><th>來源</th><th>時數</th><th>金額</th><th>備註</th><th>操作</th></tr></thead><tbody>${settlementRows.map(row=>`<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(ledger.rows.find(item=>item.credit.id===row.creditId)?.credit.earnedAt||'來源待確認')}</td><td>${rateNumber(row.hours)}h</td><td>$${money(row.amount)}</td><td>${userHtml(row.note || '—')}</td><td class="actions"><button class="btn btn-small" type="button" data-action="edit-comp-settlement" data-id="${escapeAttr(row.id)}">編輯</button><button class="btn btn-small btn-danger" type="button" data-action="delete-comp-settlement" data-id="${escapeAttr(row.id)}">撤銷</button></td></tr>`).join('')}</tbody></table></div>`:''}</article>`;
    };
    const openCompCredit = (id, editing = false) => {
      const existing=editing?state.compTimeCredits.find(item=>item.id===id):null;
      const log=state.overtimeLogs.find(item=>item.id===(editing?existing?.sourceId:id));
      if(!log || (!editing && state.compTimeCredits.some(row=>row.sourceId===id))) return toast('來源已不存在或已轉入補休。','error');
      beginDraftScope({entityType:'comp-time-credit',companyId:log.companyId,entityId:log.id,operational:true});
      const period=salaryMonthForLog(log);
      const pay=period&&state.records.find(row=>row.companyId===log.companyId&&row.year===period.year&&row.month===period.month);
      openDialog(editing?'編輯補休來源':'加班轉補休',`<form id="compCreditForm" data-credit-id="${escapeAttr(existing?.id||'')}"><p>${userHtml(companyName(log.companyId))}｜${escapeHtml(log.date)}｜加班 ${rateNumber(log.hours)} 小時</p><p>轉入時數將從此筆預估加班費排除；已有薪資紀錄請先核對是否給付。</p>${pay&&numberValue(pay.overtime)>0?'<div class="notice warning">此薪資月已有加班金額，為避免同筆加班重複給付，先核對薪資明細後再轉入。</div>':''}<div class="form-grid"><label>轉入補休時數<input class="field" name="hours" type="number" min="0.5" max="${escapeAttr(log.hours)}" step="0.5" required value="${escapeAttr(existing?.hours??log.hours)}"></label><label>到期日（依公司約定）<input class="field" name="expiresAt" type="date" min="${escapeAttr(log.date)}" required value="${escapeAttr(existing?.expiresAt||'')}"></label><label class="span-2">備註<input class="field" name="note" maxlength="160" value="${escapeAttr(existing?.note||'')}"></label></div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit" ${!editing&&pay&&numberValue(pay.overtime)>0?'disabled':''}>${editing?'儲存修改':'確認轉入'}</button></div></form>`);
    };
    const saveCompCredit = () => {
      const form=$('#compCreditForm');if(!form?.reportValidity())return;
      const scope=ui.draftScope,log=state.overtimeLogs.find(item=>item.id===scope?.entityId);
      if(!log || !assertDraftScope({entityType:'comp-time-credit',companyId:log.companyId,entityId:log.id,operational:true}))return;
      const existing=form.dataset.creditId?state.compTimeCredits.find(item=>item.id===form.dataset.creditId):null;
      if(form.dataset.creditId&&!existing)return showValidationSummary(form,'此紀錄已不存在，請重新開啟。');
      const data=new FormData(form),credit=window.SalaryMateCompTime.normalizeCredit({id:existing?.id||newId('comp'),sourceId:log.id,companyId:log.companyId,hours:data.get('hours'),earnedAt:log.date,expiresAt:data.get('expiresAt'),note:data.get('note')});
      const issue=window.SalaryMateCompTime.assertCredit(credit,state.overtimeLogs,state.compTimeCredits);
      const period=salaryMonthForLog(log),pay=period&&state.records.find(row=>row.companyId===log.companyId&&row.year===period.year&&row.month===period.month);
      if(issue||credit.earnedAt>todayIso()||pay&&numberValue(pay.overtime)>0&&(!existing||existing.hours!==credit.hours)){showValidationSummary(form,issue||(credit.earnedAt>todayIso()?'尚未發生的加班不能轉入補休。':'該月薪資已有加班金額，請先核對，避免重複給付。'));return}
      const credits=existing?state.compTimeCredits.map(item=>item.id===existing.id?credit:item):[...state.compTimeCredits,credit];
      if(compTimeLedger(credits).violations.length)return showValidationSummary(form,'修改後不足以支應已使用或已結算的補休，請調整時數或到期日。');
      const ok=commitStateMutation(()=>{state.compTimeCredits=credits;},'補休儲存失敗；原紀錄保持不變。');
      if(!ok)return;closeDialog();renderAll();toast(existing?'補休來源已更新，請核對新的加班費估算。':'補休來源已建立，請核對新的加班費估算。');
    };
    const openCompSettlement = (id, editing = false) => {
      const existing=editing?state.compTimeSettlements.find(item=>item.id===id):null;
      const row=compTimeLedger(undefined,existing?state.compTimeSettlements.filter(item=>item.id!==id):undefined).rows.find(item=>item.credit.id===(editing?existing?.creditId:id));
      if(!row||!row.remaining||row.issues.length)return toast('沒有可結算的來源餘額。','error');
      beginDraftScope({entityType:'comp-time-settlement',companyId:row.credit.companyId,entityId:row.credit.id,operational:true});
      openDialog(editing?'編輯補休結算':'記錄補休結算',`<form id="compSettlementForm" data-settlement-id="${escapeAttr(existing?.id||'')}"><p>加班來源：${escapeHtml(row.credit.earnedAt)}｜剩餘 ${rateNumber(row.remaining)} 小時｜到期 ${escapeHtml(row.credit.expiresAt)}</p><p>請填實際核對的結算金額。此紀錄不會自動增加薪資明細。</p><div class="form-grid"><label>結算日期<input class="field" name="date" type="date" min="${escapeAttr(row.credit.earnedAt)}" required value="${escapeAttr(existing?.date||todayIso())}"></label><label>結算時數<input class="field" name="hours" type="number" min="0.5" max="${escapeAttr(row.remaining)}" step="0.5" required value="${escapeAttr(existing?.hours??row.remaining)}"></label><label>實際結算金額<input class="field" name="amount" type="number" min="0" step="0.01" required value="${escapeAttr(existing?.amount??'')}"></label><label>核對備註<input class="field" name="note" maxlength="160" value="${escapeAttr(existing?.note||'')}"></label></div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">保存結算</button></div></form>`);
    };
    const saveCompSettlement = () => {
      const form=$('#compSettlementForm');if(!form?.reportValidity())return;
      const scope=ui.draftScope,credit=state.compTimeCredits.find(item=>item.id===scope?.entityId);
      if(!credit||!assertDraftScope({entityType:'comp-time-settlement',companyId:credit.companyId,entityId:credit.id,operational:true}))return;
      const existing=form.dataset.settlementId?state.compTimeSettlements.find(item=>item.id===form.dataset.settlementId):null;
      if(form.dataset.settlementId&&!existing)return showValidationSummary(form,'此紀錄已不存在，請重新開啟。');
      const data=new FormData(form),settlement=window.SalaryMateCompTime.normalizeSettlement({id:existing?.id||newId('settle'),creditId:credit.id,companyId:credit.companyId,date:data.get('date'),hours:data.get('hours'),amount:data.get('amount'),note:data.get('note')});
      if(!window.SalaryMateCompTime.validDate(settlement.date)||settlement.date<credit.earnedAt||settlement.date>todayIso()||Number(data.get('hours'))!==settlement.hours||Number(data.get('amount'))!==settlement.amount){showValidationSummary(form,'日期、時數或金額無效；結算日期不得晚於今天。');return}
      const settlements=existing?state.compTimeSettlements.map(item=>item.id===existing.id?settlement:item):[...state.compTimeSettlements,settlement];
      const check=compTimeLedger(state.compTimeCredits,settlements,state.leaveRecords,credit.companyId);
      if(check.violations.length){showValidationSummary(form,'結算超過可用補休時數，或來源帳本異常；資料未儲存。');return}
      const ok=commitStateMutation(()=>{state.compTimeSettlements=settlements;},'結算儲存失敗；原資料保持不變。');
      if(!ok)return;closeDialog();renderAll();toast('補休結算已記錄。');
    };
    const deleteCompCredit = id => {
      const row=compTimeLedger().rows.find(item=>item.credit.id===id);
      if(!row||row.used||row.settled)return toast('此來源已使用或結算，無法撤銷。','error');
      confirm('撤銷補休轉入',`撤銷 ${row.credit.earnedAt} 的 ${rateNumber(row.credit.hours)} 小時？該筆預估加班費將重新計入。`,()=>{if(commitStateMutation(()=>state.compTimeCredits=state.compTimeCredits.filter(item=>item.id!==id),'撤銷失敗，原資料保持不變。')){closeDialog();renderAll();toast('已撤銷轉入。')}});
    };
    const deleteCompSettlement = id => {
      const row=state.compTimeSettlements.find(item=>item.id===id);if(!row)return;
      confirm('撤銷補休結算',`撤銷 ${row.date} 的 ${rateNumber(row.hours)} 小時結算紀錄？`,()=>{if(commitStateMutation(()=>state.compTimeSettlements=state.compTimeSettlements.filter(item=>item.id!==id),'撤銷失敗，原資料保持不變。')){closeDialog();renderAll();toast('已撤銷結算。')}});
    };
    // COMP_TIME_END

    const leaveAllocationsInScope = (record) => leaveAllocations(record).filter((allocation) =>
      allocation.year === Number(ui.selectedYear) && (Number(ui.leaveMonth) === 0 || allocation.month === Number(ui.leaveMonth))
    );
    const leaveDeductionSummary = (year, month, companyId) => state.leaveRecords
      .filter((record) => record.companyId === companyId && record.status === 'confirmed')
      .reduce((summary, record) => {
        const allocation = leaveAllocationForMonth(record, year, month);
        if (!allocation) return summary;
        summary.records += 1;
        summary.hours += allocation.hours;
        summary.wage += allocation.wageDeduction;
        summary.attendance += allocation.attendanceDeduction;
        summary.total += allocation.totalDeduction;
        return summary;
      }, { records: 0, hours: 0, wage: 0, attendance: 0, total: 0 });
    const leaveSyncKey = (companyId, year, month) => `leave:${companyId}:${year}-${pad2(month)}`;
    const leaveSyncInfo = (year, month, companyId) => {
      const summary = leaveDeductionSummary(year, month, companyId);
      const sourceKey = leaveSyncKey(companyId, year, month);
      const record = state.records.find((item) => item.companyId === companyId && Number(item.year) === Number(year) && Number(item.month) === Number(month));
      const linkedItem = record?.customDeductions?.find((item) => item.sourceType === 'leave-payroll' && item.sourceKey === sourceKey) || null;
      const status = !linkedItem ? 'unsynced' : numberValue(linkedItem.amount) === summary.total ? 'synced' : 'stale';
      return { ...summary, sourceKey, record, linkedItem, status };
    };

    const leaveQuotaAsOf = (company) => Number(ui.leaveMonth) > 0
      ? salaryPeriodBounds(ui.selectedYear, ui.leaveMonth, company.id).end
      : Number(ui.selectedYear) === currentYear ? todayIso() : `${ui.selectedYear}-12-31`;

    const leaveQuotaRows = (companies) => companies.flatMap((company) => Object.keys(LEAVE_TYPES).map((type) => {
      const summary = leaveQuotaSummary(company, type, leaveQuotaAsOf(company));
      return { company, type, summary };
    }).filter(({ type, summary }) => type === 'annual' || summary.limited || summary.used > 0 || summary.reserved > 0));

    const leaveKpiSummary = (companies, type) => {
      const summaries = companies.map((company) => leaveQuotaSummary(company, type, leaveQuotaAsOf(company)));
      const used = summaries.reduce((sum, summary) => sum + numberValue(summary.used), 0);
      const reserved = summaries.reduce((sum, summary) => sum + numberValue(summary.reserved), 0);
      const exceeded = summaries.reduce((sum, summary) => sum + numberValue(summary.exceeded), 0);
      const hasUnconfiguredLimit = summaries.some((summary) => summary.limited && !summary.configured);
      const allLimited = summaries.length > 0 && summaries.every((summary) => summary.limited && summary.configured);
      const allUnlimited = summaries.length > 0 && summaries.every((summary) => !summary.limited);
      const remaining = allLimited
        ? summaries.reduce((sum, summary) => sum + numberValue(summary.remaining), 0)
        : null;
      const remainingText = !summaries.length
        ? '—'
        : hasUnconfiguredLimit
          ? '待設定'
          : allLimited
            ? `${rateNumber(remaining)} 天`
            : allUnlimited
              ? '未設上限'
              : '依公司';
      const cycleParts = parseDateParts(summaries[0]?.start);
      const menstrualCycleLabel = cycleParts
        ? `${cycleParts.year} 年 ${cycleParts.month} 月${summaries.length > 1 ? '，每家公司' : ''}`
        : '每個曆月';
      const note = !summaries.length
        ? '請先建立或選擇公司'
        : hasUnconfiguredLimit
          ? '請設定到職日或公司額度'
          : exceeded > 0
            ? `${type === 'menstrual' ? `${menstrualCycleLabel} ` : ''}已超額 ${rateNumber(exceeded)} 天`
            : reserved > 0
              ? `${type === 'menstrual' ? `${menstrualCycleLabel} ` : ''}另有 ${rateNumber(reserved)} 天預計請假，已先保留`
              : allUnlimited
                ? '可至公司設定建立管理額度'
                : allLimited
                  ? type === 'menstrual'
                    ? `${menstrualCycleLabel}固定 1 天，每月自動重置`
                    : '剩餘數會隨已確認與預計紀錄更新'
                  : '各公司額度規則不同，請分公司查看';
      return { used, reserved, exceeded, remaining, remainingText, note, remainingIsText: !allLimited };
    };

    const renderLeaveKpiCard = (definition, companies) => {
      const summary = leaveKpiSummary(companies, definition.type);
      return `<article class="card metric ${definition.tone} leave-kpi-card" data-leave-kpi="${escapeAttr(definition.type)}"><div class="metric-label"><span>${escapeHtml(definition.label)}</span><span class="metric-icon">${escapeHtml(definition.icon)}</span></div><div class="leave-kpi-values" aria-label="${escapeAttr(`${definition.label}使用 ${rateNumber(summary.used)} 天，剩餘 ${summary.remainingText}`)}"><div class="leave-kpi-stat"><span>使用數</span><strong>${rateNumber(summary.used)} 天</strong></div><div class="leave-kpi-stat remaining"><span>剩餘數</span><strong class="${summary.remainingIsText ? 'status-text' : ''}">${escapeHtml(summary.remainingText)}</strong></div></div><div class="metric-note">${escapeHtml(summary.note)}</div></article>`;
    };

    const leaveQuotaCycleText = (summary) => {
      if (!summary.configured) return '需設定到職日';
      if (!summary.start || !summary.end) return '—';
      return `${summary.start}～${addIsoDays(summary.end, -1)}`;
    };

    const leaveQuotaStatusHtml = (summary) => {
      if (!summary.configured) return '<span class="status leave-planned">待設定</span>';
      if (!summary.limited) return '<span class="status former">持續追蹤</span>';
      if (summary.exceeded > 0) return `<span class="status leave-cancelled">超額 ${rateNumber(summary.exceeded)} 天</span>`;
      if (summary.entitlement > 0 && summary.remaining / summary.entitlement <= .2) return '<span class="status leave-planned">額度偏低</span>';
      return '<span class="status leave-confirmed">額度正常</span>';
    };

    const renderLeaveQuotaPanel = (companies) => {
      const rows = leaveQuotaRows(companies);
      return `<article class="card table-shell quota-table"><div class="card-pad section-title"><div><h3>假別額度總覽</h3><p>預計先保留、確認列為已用；自訂額度可在公司設定調整</p></div><button class="btn btn-small" type="button" data-action="manage-companies">調整假別額度</button></div>${rows.length ? `<div class="table-scroll"><table><thead><tr><th>公司／假別</th><th>額度週期</th><th>總額度</th><th>已確認</th><th>已預留</th><th>可用</th><th>使用狀態</th></tr></thead><tbody>${rows.map(({ company, type, summary }) => {
        const consumed = summary.used + summary.reserved;
        const progress = summary.limited && summary.entitlement > 0 ? Math.min(100, consumed / summary.entitlement * 100) : 0;
        const modeText = type === 'menstrual' ? '每月固定' : type === 'annual' && summary.policy.mode === 'auto' ? '到職日自動' : summary.limited ? '公司自訂' : '未設上限';
        return `<tr class="data-row"><td><b>${escapeHtml(leaveTypeName(type))}</b><small style="display:block;color:var(--muted)">${userHtml(company.name)}｜${escapeHtml(modeText)}</small></td><td class="money">${escapeHtml(leaveQuotaCycleText(summary))}</td><td class="money">${summary.limited && summary.configured ? `${rateNumber(summary.entitlement)} 天` : summary.limited ? '—' : '未設上限'}</td><td class="money">${rateNumber(summary.used)} 天</td><td class="money text-blue">${rateNumber(summary.reserved)} 天</td><td class="money ${summary.exceeded > 0 ? 'text-rose' : 'text-green'}">${summary.limited && summary.configured ? `${rateNumber(summary.remaining)} 天` : '—'}</td><td><div class="quota-usage">${leaveQuotaStatusHtml(summary)}${summary.limited && summary.configured ? `<div class="progress-track" style="margin-top:7px"><div class="progress-fill" style="width:${progress.toFixed(1)}%;${summary.exceeded > 0 ? 'background:var(--rose)' : ''}"></div></div>` : ''}</div></td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="card-pad"><div class="notice">目前沒有可顯示的假別額度；可至公司設定建立管理規則。</div></div>'}</article>`;
    };

    const renderAttendanceTrend = () => {
      const months = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return { month, analysis: attendanceAnalysis(ui.selectedYear, month, ui.companyFilter) };
      });
      return `<div class="table-scroll attendance-trend-scroll" aria-label="每月推估出勤率"><div class="attendance-trend">${months.map(({ month, analysis }) => {
        const hasData = analysis.expectedHours > 0;
        const height = hasData ? Math.max(4, analysis.attendanceRate * 1.72) : 3;
        return `<div class="attendance-month ${hasData ? '' : 'missing'} ${Number(ui.leaveMonth) === month ? 'active' : ''}" title="${month} 月：${hasData ? `${rateNumber(analysis.attendanceRate)}%` : '無資料'}"><span>${hasData ? `${rateNumber(analysis.attendanceRate)}%` : '—'}</span><div class="attendance-month-bar" style="height:${height}px"></div><b>${month}月</b></div>`;
      }).join('')}</div></div>`;
    };

    const renderLeaveDistribution = (analysis) => {
      const rows = Object.entries(analysis.typeBreakdown)
        .map(([type, values]) => ({ type, ...values, total: values.confirmed + values.planned }))
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total);
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      if (!rows.length) return '<div class="notice">目前範圍尚無請假時數可分析。</div>';
      return `<div class="leave-distribution">${rows.map((row) => `<div class="distribution-row"><span>${escapeHtml(leaveTypeName(row.type))}</span><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, row.total / total * 100).toFixed(1)}%"></div></div><b>${rateNumber(row.confirmed)}h${row.planned ? ` ＋ ${rateNumber(row.planned)}h 預計` : ''}</b></div>`).join('')}</div>`;
    };

    const attendancePageActions = () => {
      const isLeave = ui.attendanceTab === 'leave';
      const month = isLeave ? ui.leaveMonth : ui.overtimeMonth;
      const selectId = isLeave ? 'leaveMonth' : 'overtimeMonth';
      const options = `<option value="0">全年薪資區間</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${Number(month) === index + 1 ? 'selected' : ''}>${index + 1} 月薪資</option>`).join('')}`;
      const statusSelect = isLeave ? `<label class="sr-only" for="leaveStatus">請假狀態</label><select id="leaveStatus" class="field-select" style="width:170px"><option value="active" ${ui.leaveStatus === 'active' ? 'selected' : ''}>進行中（預計＋確認）</option><option value="confirmed" ${ui.leaveStatus === 'confirmed' ? 'selected' : ''}>僅已確認</option><option value="planned" ${ui.leaveStatus === 'planned' ? 'selected' : ''}>僅預計</option><option value="cancelled" ${ui.leaveStatus === 'cancelled' ? 'selected' : ''}>僅已取消</option><option value="all" ${ui.leaveStatus === 'all' ? 'selected' : ''}>全部狀態</option></select>` : '';
      return `<div class="page-actions"><label class="sr-only" for="${selectId}">薪資月份</label><select id="${selectId}" class="field-select" style="width:150px">${options}</select>${statusSelect}<button class="btn btn-primary" type="button" data-action="${isLeave ? 'add-leave' : 'add-overtime'}">＋ ${isLeave ? '新增請假' : '新增加班'}</button></div>`;
    };

    const renderOvertimePanel = () => {
      const logs = [...filteredOvertime()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const totalHours = logs.reduce((sum, log) => sum + numberValue(log.hours), 0);
      const totalPay = overtimeTotal(logs);
      const selectedCompany = ui.companyFilter === 'ALL' ? null : getCompany(ui.companyFilter);
      const periodSummary = Number(ui.overtimeMonth) > 0
        ? selectedCompany
          ? `${selectedCompany.name}｜${salaryPeriodLabel(ui.selectedYear, ui.overtimeMonth, selectedCompany.id)}`
          : `各公司依各自預設區間歸入 ${ui.selectedYear} 年 ${ui.overtimeMonth} 月薪資`
        : `${ui.selectedYear} 全年依各公司預設區間歸屬`;
      return `
        <div class="notice"><b>目前計算區間：</b>${escapeHtml(periodSummary)}</div>
        <div class="metric-grid three">
          <article class="card metric amber"><div class="metric-label"><span>薪資區間加班時數</span><span class="metric-icon">時</span></div><div class="metric-value">${rateNumber(totalHours)} 小時</div><div class="metric-note">${ui.overtimeMonth ? `${ui.overtimeMonth} 月薪資` : `${ui.selectedYear} 全年`}歸屬結果</div></article>
          <article class="card metric green"><div class="metric-label"><span>預估加班費</span><span class="metric-icon">$</span></div><div class="metric-value">$${money(totalPay)}</div><div class="metric-note">每筆保留小數，依公司與薪資月加總後四捨五入</div></article>
          <article class="card metric blue"><div class="metric-label"><span>同步薪資表</span><span class="metric-icon">↻</span></div><div class="metric-value" style="font-size:18px;margin-top:14px">${ui.overtimeMonth ? `同步至 ${ui.overtimeMonth} 月薪資` : '請先選薪資月份'}</div><div class="metric-note"><button class="btn btn-small" type="button" data-action="sync-overtime" ${ui.overtimeMonth && totalPay ? '' : 'disabled'}>帶入薪資明細</button></div></article>
        </div>
        <p class="hint">單筆顯示金額僅供參考；總額使用未取整金額計算。</p><div class="notice warning">加班金額為個人估算值；實際給付仍以薪資單、勞動契約與適用法規為準。休息日最多接受 12 小時輸入。</div>
        ${renderCompTimePanel()}
        ${logs.length ? `<article class="card table-shell"><div class="table-scroll"><table><thead><tr><th>加班日期</th><th>歸屬薪資月</th><th>公司</th><th>類型</th><th>時數</th><th>每日加班時薪</th><th>預估加班費</th><th>備註</th><th>操作</th></tr></thead><tbody>${logs.map((log) => { const attributed = salaryMonthForLog(log); return `<tr class="data-row"><td class="money">${escapeHtml(log.date)}</td><td><b>${attributed ? `${attributed.year} 年 ${attributed.month} 月` : '—'}</b><small style="display:block;color:var(--muted)">${escapeHtml(companyPayrollPeriodName(log.companyId))}</small></td><td>${userHtml(companyName(log.companyId))}</td><td><span class="status ${log.type === 'spring' || log.type === 'holiday' ? 'former' : 'current'}">${escapeHtml(overtimeTypeName(log.type))}</span></td><td class="money">${numberValue(log.hours)} 小時</td><td class="money">$${hourlyRateNumber(log.hourlyRate)}</td><td class="money text-green">$${money(overtimeAmount(log))}</td><td>${userHtml(log.note || '—')}</td><td class="actions"><button class="btn btn-small" type="button" data-action="credit-comp-time" data-id="${escapeAttr(log.id)}" ${state.compTimeCredits.some(row=>row.sourceId===log.id)?'disabled':''}>轉補休</button> <button class="btn btn-small" type="button" data-action="edit-overtime" data-id="${escapeAttr(log.id)}">編輯</button> <button class="btn btn-small btn-danger" type="button" data-action="delete-overtime" data-id="${escapeAttr(log.id)}">刪除</button></td></tr>`; }).join('')}</tbody></table></div></article>` : emptyPanel('時', '尚無加班紀錄', '新增每日加班後，系統會依公司計薪區間自動歸入薪資月份。', '<button class="btn btn-primary" type="button" data-action="add-overtime">新增加班</button>')}`;
    };

    const renderLeavePanel = () => {
      const records = [...filteredLeave()].sort((a, b) => String(b.startDate || b.date).localeCompare(String(a.startDate || a.date)));
      const analysis = attendanceAnalysis();
      const selectedCompany = ui.companyFilter === 'ALL' ? null : getCompany(ui.companyFilter);
      const periodSummary = Number(ui.leaveMonth) > 0
        ? selectedCompany
          ? `${selectedCompany.name}｜${salaryPeriodLabel(ui.selectedYear, ui.leaveMonth, selectedCompany.id)}`
          : `各公司依各自預設區間歸入 ${ui.selectedYear} 年 ${ui.leaveMonth} 月薪資`
        : `${ui.selectedYear} 全年依各公司預設區間歸屬`;
      const scopeCompanies = ui.companyFilter === 'ALL' ? state.companies : selectedCompany ? [selectedCompany] : [];
      const canSync = Boolean(selectedCompany && Number(ui.leaveMonth));
      const sync = canSync ? leaveSyncInfo(ui.selectedYear, ui.leaveMonth, selectedCompany.id) : null;
      const syncStatusText = sync?.status === 'synced' ? '已同步，金額一致' : sync?.status === 'stale' ? '請假資料已變更，請重新同步' : sync?.record ? '薪資明細存在，尚未同步' : '尚未建立該月薪資明細';
      const syncStatusTone = sync?.status === 'synced' ? 'leave-confirmed' : sync?.status === 'stale' ? 'leave-planned' : 'former';
      const syncPanel = canSync ? `<article class="card card-pad sync-panel"><div class="section-title"><div><h3>請假扣款連動</h3><p>${userHtml(selectedCompany.name)}｜${ui.selectedYear} 年 ${ui.leaveMonth} 月薪資｜${escapeHtml(salaryPeriodLabel(ui.selectedYear, ui.leaveMonth, selectedCompany.id))}</p></div><span class="status ${syncStatusTone}">${escapeHtml(syncStatusText)}</span></div><div class="summary-row"><span>已確認請假 ${sync.records} 筆／${rateNumber(sync.hours)} 小時</span><b>請假扣薪 $${money(sync.wage)} ＋ 出勤扣款 $${money(sync.attendance)}</b></div><div class="live-total"><span>預計寫入薪資自訂扣項</span><strong>$${money(sync.total)}</strong></div><div class="form-actions"><button class="btn" type="button" data-action="unlink-leave" ${sync.linkedItem ? '' : 'disabled'}>解除薪資連動</button><button class="btn btn-primary" type="button" data-action="sync-leave" ${sync.total ? '' : 'disabled'}>${sync.status === 'synced' ? '重新同步' : '預覽並同步扣款'}</button></div></article>` : `<div class="notice"><b>薪資扣款連動：</b>請在上方先選擇單一公司與薪資月份，即可預覽已確認請假的扣薪、出勤扣款，並安全同步至薪資自訂扣項。</div>`;
      return `
        <div class="notice"><b>目前計算區間：</b>${escapeHtml(periodSummary)}</div>
        <div class="metric-grid leave-kpi-grid">
          ${LEAVE_KPI_TYPES.map((definition) => renderLeaveKpiCard(definition, scopeCompanies)).join('')}
        </div>
        <div class="attendance-analysis-grid">
          <article class="card card-pad"><div class="section-title"><div><h3>每月推估出勤率</h3><p>依公司薪資區間內的週一至週五、每日標準工時與已確認請假估算</p></div><span class="soft-badge">${ui.selectedYear} 年</span></div>${renderAttendanceTrend()}</article>
          <article class="card card-pad"><div class="section-title"><div><h3>假別時數分布</h3><p>${ui.leaveMonth ? `${ui.leaveMonth} 月薪資區間` : `${ui.selectedYear} 全年`}；已確認與預計分開呈現</p></div></div>${renderLeaveDistribution(analysis)}</article>
        </div>
        ${renderLeaveQuotaPanel(scopeCompanies)}
        ${syncPanel}
        <div class="notice warning"><b>出勤分析說明：</b>上方分析不受表格的狀態篩選影響；出勤率只扣除「已確認」請假，「預計」只保留額度，「已取消」不列入。預定工時以計薪區間內週一至週五及公司每日標準工時推估，尚未排除國定假日、排班差異或其他未登錄出勤事件。跨日請假與薪資扣款仍沿用 公司的計薪區間拆分；普通病假的全勤獎金自 2026/1/1 起僅得按請假日數比例扣發，實際結果仍以公司薪資單及適用規定為準。</div>
        ${records.length ? `<article class="card table-shell"><div class="table-scroll"><table><thead><tr><th>請假日期／狀態</th><th>歸屬薪資月</th><th>公司</th><th>假別</th><th>請假量</th><th>給薪比例</th><th>預估扣薪</th><th>全勤／出勤扣款</th><th>備註</th><th>操作</th></tr></thead><tbody>${records.map((record) => { const allocations = leaveAllocationsInScope(record); const rowWage = allocations.reduce((sum, item) => sum + item.wageDeduction, 0); const rowAttendance = allocations.reduce((sum, item) => sum + item.attendanceDeduction, 0); const periodHtml = `<div class="allocation-list">${allocations.map((item) => `<span class="allocation-chip">${item.year} 年 ${item.month} 月<small>${rateNumber(item.hours)} 小時</small></span>`).join('')}</div>`; return `<tr class="data-row"><td class="money">${escapeHtml(leaveDateText(record))}<small style="display:block;margin-top:4px"><span class="status ${leaveStatusTone(record.status)}">${escapeHtml(leaveStatusName(record.status))}</span></small></td><td>${periodHtml || '—'}<small style="display:block;color:var(--muted)">${escapeHtml(companyPayrollPeriodName(record.companyId))}</small></td><td>${userHtml(companyName(record.companyId))}</td><td><span class="status ${leavePaidTone(record)}">${escapeHtml(leaveTypeName(record.type))}</span></td><td class="money">${escapeHtml(leaveQuantityText(record))}<small style="display:block;color:var(--muted)">${rateNumber(allocations.reduce((sum, item) => sum + item.hours, 0))} 小時（本篩選）</small></td><td class="money">${rateNumber(record.paidRatio)}%</td><td class="money text-rose">−$${money(rowWage)}</td><td class="money text-amber">−$${money(rowAttendance)}</td><td>${userHtml(record.note || '—')}</td><td class="actions"><button class="btn btn-small" type="button" data-action="edit-leave" data-id="${escapeAttr(record.id)}">編輯</button> <button class="btn btn-small btn-danger" type="button" data-action="delete-leave" data-id="${escapeAttr(record.id)}">刪除</button></td></tr>`; }).join('')}</tbody></table></div></article>` : emptyPanel('假', '尚無相符請假紀錄', '新增請假或調整月份、狀態與公司篩選條件。', '<button class="btn btn-primary" type="button" data-action="add-leave">新增請假</button>')}`;
    };

    const renderOvertime = () => `
      <section class="view" aria-labelledby="attendanceTitle">
        <div class="page-head"><div><h2 id="attendanceTitle">工時／出勤管理</h2><p>加班與請假分開記錄，共用公司計薪區間與薪資月份。</p></div>${attendancePageActions()}</div>
        ${attendanceTabsHtml()}
        ${ui.attendanceTab === 'leave' ? renderLeavePanel() : renderOvertimePanel()}
      </section>`;

    const renderLineChart = () => {
      const points = Array.from({ length: 12 }, (_, index) => {
        const m = index + 1;
        const metrics = hourlyMetrics(m);
        return { month: m, nominal: metrics.nominalRate, real: metrics.trueRate };
      });
      const max = Math.max(1, ...points.flatMap((point) => [point.nominal, point.real]));
      const x = (index) => 42 + index * 52;
      const y = (value) => 190 - value / max * 150;
      const nominalPath = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.nominal)}`).join(' ');
      const realPath = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.real)}`).join(' ');
      return `
        <svg class="line-chart" viewBox="0 0 660 230" role="img" aria-label="名義時薪與真實時薪月度趨勢">
          ${[40, 90, 140, 190].map((lineY) => `<line x1="42" y1="${lineY}" x2="620" y2="${lineY}" stroke="#dce6e4" stroke-width="1"/>`).join('')}
          <path d="${nominalPath}" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="6 6"/>
          <path d="${realPath}" fill="none" stroke="#0f9f8f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          ${points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point.real)}" r="4" fill="#fff" stroke="#0f9f8f" stroke-width="3"><title>${point.month} 月真實時薪 $${money(point.real)}</title></circle><text x="${x(index)}" y="215" text-anchor="middle">${point.month}月</text>`).join('')}
        </svg>
        <div class="legend"><span><i style="background:#94a3b8"></i>名義時薪</span><span><i style="background:#0f9f8f"></i>真實代價時薪</span></div>`;
    };

    const renderScenarioCard = (title, rows, classes = [], extraClass = '') => `
      <div class="scenario-card ${extraClass}"><h4>${escapeHtml(title)}</h4><table><tbody>${rows.map(([label, value], index) => `<tr class="${classes[index] || ''}"><th>${escapeHtml(label)}</th><td>$${money(value)}</td></tr>`).join('')}</tbody></table></div>`;

    const calcSettingField = (key, label, value, { min = 0, max = '', step = 1, className = '' } = {}) => `
      <label class="calc-field ${className}"><span>${escapeHtml(label)}</span><input class="calc-input" type="number" data-calc-setting="${escapeAttr(key)}" value="${escapeAttr(value)}" min="${escapeAttr(min)}" ${max === '' ? '' : `max="${escapeAttr(max)}"`} step="${escapeAttr(step)}"></label>`;

    const renderOvertimeCalculatorPanel = () => {
      const metrics = hourlyMetrics();
      const s = state.hourlySettings;
      const calc = state.overtimeCalculator;
      const workbench = overtimeWorkbench();
      const calculatorCompany = workbench.company;
      const timeItems = [
        { label: '標準工時', value: metrics.hasData ? numberValue(metrics.regularHours) : 0, color: '#3b82f6' },
        { label: '平均加班', value: metrics.overtimeHours, color: '#f59e0b' },
        { label: '來回通勤', value: metrics.commuteHours, color: '#e11d48' },
        { label: '準備／備勤', value: metrics.prepHours, color: '#7c3aed' }
      ];
      const monthOptions = `<option value="0">${ui.selectedYear} 全年度平均</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${Number(ui.hourlyMonth) === index + 1 ? 'selected' : ''}>${index + 1} 月</option>`).join('')}`;
      const calculatorCompanyOptions = state.companies.length
        ? state.companies.map((company) => `<option value="${escapeAttr(company.id)}" ${company.id === calculatorCompany?.id ? 'selected' : ''}>${company.isCurrent ? '現任｜' : '歷任｜'}${userHtml(company.name)}</option>`).join('')
        : '<option value="">尚未建立公司</option>';
      const calculatorPeriodLabel = calculatorCompany
        ? Number(ui.hourlyMonth) > 0
          ? salaryPeriodLabel(ui.selectedYear, ui.hourlyMonth, calculatorCompany.id)
          : companyPayrollPeriodName(calculatorCompany.id)
        : '尚未指定公司';
      const diff = workbench.differences;
      return `
        <div class="salary-tab-panel">
          <article class="card toolbar"><div><b>加班費試算</b><div class="profile-source">此試算工作台可帶入公司固定薪資；不會改動每日加班紀錄的獨立時薪</div></div><div class="page-actions"><select id="calculatorCompany" class="field-select" aria-label="選擇試算公司">${calculatorCompanyOptions}</select><select id="hourlyMonth" class="field-select" aria-label="選擇帶入薪資月份">${monthOptions}</select><button class="btn" type="button" data-action="load-calculator-record">帶入薪資紀錄</button><button class="btn" type="button" data-action="reset-calculator">重設試算</button></div></article>

          <div class="calc-workbench">
            <div class="calc-board">
              <article class="card calc-panel">
                <div class="calc-panel-title"><div><h3>固定薪資基礎</h3><p>所有金額皆可自行輸入</p></div><span class="soft-badge">自動保存</span></div>
                <div class="salary-editor">
                  ${calcSettingField('baseSalary', '本薪', calc.baseSalary)}
                  ${calcSettingField('mealAllowance', '伙食津貼', calc.mealAllowance)}
                  ${calcSettingField('attendanceBonus', '全勤獎金', calc.attendanceBonus)}
                  ${calcSettingField('positionAllowance', '職務加給', calc.positionAllowance)}
                  ${calcSettingField('otherFixed', '其他固定薪資', calc.otherFixed)}
                  ${calcSettingField('overtimeDivisor', '加班時薪除數', calc.overtimeDivisor, { min: 1, max: 744 })}
                </div>
                <div class="calc-total-box"><span>固定薪資總額</span><strong>$${money(workbench.fixedSalary)}</strong><em>加班基準時薪 $${rateNumber(workbench.hourlyRate)}／小時</em></div>
              </article>

              <article class="card calc-panel">
                <div class="calc-panel-title"><div><h3>加班費快速試算</h3><p>以下金額會跟著薪資與倍率即時更新</p></div><span class="soft-badge">時薪 $${rateNumber(workbench.hourlyRate)}</span></div>
                <div class="scenario-grid">
                  ${renderScenarioCard('平日', workbench.weekday, ['', '', 'total-row', 'highlight-row', ''])}
                  ${renderScenarioCard('星期六／休息日', workbench.restday, ['', '', '', 'total-row', 'highlight-row'])}
                  ${renderScenarioCard('星期天／國定假日 1 倍／春節', workbench.holiday, ['total-row', 'highlight-row', 'national-row', 'national-row', 'spring-row', 'spring-row'], 'spring')}
                </div>
              </article>
            </div>

            <article class="card calc-panel">
              <div class="calc-panel-title"><div><h3>每月倍率與時數試算</h3><p>倍率與累積時數皆可修改；右側自動彙總本期試算薪資</p></div><span class="soft-badge">${escapeHtml(calculatorPeriodLabel)}</span></div>
              <div class="calc-sheet-layout">
                <div class="multiplier-wrap"><table class="multiplier-table"><thead><tr><th>項目</th><th>倍率</th><th>累積時數</th><th>試算金額</th></tr></thead><tbody>
                  ${multiplierRows.map((row) => `<tr><td style="color:${row.tone}">${escapeHtml(row.label)}</td><td><input class="calc-input compact" type="number" min="0" max="10" step="0.01" data-calc-multiplier="${row.key}" value="${escapeAttr(calc.multipliers[row.key])}" aria-label="${escapeAttr(row.label)}倍率"></td><td><input class="calc-input compact hours" type="number" min="0" max="744" step="0.5" data-calc-hours="${row.key}" value="${escapeAttr(calc.hours[row.key])}" aria-label="${escapeAttr(row.label)}時數"></td><td class="amount">$${money(workbench.amounts[row.key])}</td></tr>`).join('')}
                </tbody></table></div>
                <div class="pay-summary">
                  <div class="summary-row"><span>固定薪資</span><b>$${money(workbench.fixedSalary)}</b></div>
                  <div class="summary-row"><span>倍率加班費</span><b class="text-green">+$${money(workbench.overtimePay)}</b></div>
                  <div class="summary-row"><span>請假／全勤扣款</span><b class="text-rose">−$${money(workbench.leaveDeduction)}</b></div>
                  <div class="summary-row"><span>變動薪資調整</span><b class="${calc.variableAdjustment >= 0 ? 'text-green' : 'text-rose'}">${calc.variableAdjustment >= 0 ? '+' : '−'}$${money(Math.abs(calc.variableAdjustment))}</b></div>
                  <div class="summary-row"><span>加班累積時數</span><b>${rateNumber(workbench.totalHours)} h</b></div>
                  <div class="summary-grand"><span>本月試算薪資總額</span><strong>$${money(workbench.estimatedPay)}</strong></div>
                </div>
              </div>
            </article>

            <article class="card calc-panel">
              <div class="calc-panel-title"><div><h3>公司計薪區間與扣款規則</h3><p>區間與每次扣款金額由任職公司預設；本期次數與變動調整仍可在此修改</p></div>${calculatorCompany ? `<button class="btn btn-small" type="button" data-action="edit-calculator-company">編輯公司預設</button>` : ''}</div>
              <div class="rule-editor">
                <div class="calc-field"><span>套用公司</span><strong>${(calculatorCompany?.name ? userHtml(calculatorCompany?.name) : escapeHtml('尚未指定公司'))}</strong></div>
                <div class="calc-field"><span>計薪區間</span><strong>${escapeHtml(calculatorCompany ? companyPayrollPeriodName(calculatorCompany.id) : '尚未設定')}</strong></div>
                <div class="calc-field"><span>${ui.hourlyMonth ? `${ui.hourlyMonth} 月薪資實際區間` : '區間說明'}</span><strong>${escapeHtml(calculatorPeriodLabel)}</strong></div>
                <div class="calc-field"><span>每次扣款金額</span><strong>$${money(workbench.leaveDeductionEach)}</strong></div>
                ${calcSettingField('leaveCount', '本期扣款次數', calc.leaveCount, { min: 0, step: .5 })}
                ${calcSettingField('variableAdjustment', '變動薪資調整', calc.variableAdjustment, { min: -9999999 })}
                <div class="calc-field rule-note"><span>扣款規則備註</span><p style="margin:0;color:var(--ink);line-height:1.6">${escapeHtml(workbench.ruleNote || '未設定')}</p></div>
              </div>
            </article>

            <article class="card calc-panel table-shell">
              <div class="calc-panel-title"><div><h3>8／10 小時加班差額比較</h3><p>用相同時薪比較平日、休息日、星期天、國定假日與春節</p></div></div>
              <div class="table-scroll"><table><thead><tr><th>試算情境</th><th>平日</th><th>星期六／休息日</th><th>星期天</th><th>國定假日 1 倍</th><th>春節</th></tr></thead><tbody>
                <tr><td><b>8 小時合計</b></td><td class="money">$${money(diff.weekday8)}</td><td class="money text-green">$${money(diff.rest8)}</td><td class="money text-blue">$${money(diff.holiday8)}</td><td class="money text-amber">$${money(diff.national8)}</td><td class="money text-rose">$${money(diff.spring8)}</td></tr>
                <tr><td><b>10 小時合計</b></td><td class="money">$${money(diff.weekday10)}</td><td class="money text-green">$${money(diff.rest10)}</td><td class="money text-blue">$${money(diff.holiday10)}</td><td class="money text-amber">$${money(diff.national10)}</td><td class="money text-rose">$${money(diff.spring10)}</td></tr>
                <tr><td><b>相較平日差額（8h）</b></td><td class="money">$0</td><td class="money">$${money(diff.rest8 - diff.weekday8)}</td><td class="money">$${money(diff.holiday8 - diff.weekday8)}</td><td class="money">$${money(diff.national8 - diff.weekday8)}</td><td class="money">$${money(diff.spring8 - diff.weekday8)}</td></tr>
                <tr><td><b>相較平日差額（10h）</b></td><td class="money">$0</td><td class="money">$${money(diff.rest10 - diff.weekday10)}</td><td class="money">$${money(diff.holiday10 - diff.weekday10)}</td><td class="money">$${money(diff.national10 - diff.weekday10)}</td><td class="money">$${money(diff.spring10 - diff.weekday10)}</td></tr>
              </tbody></table></div>
            </article>
          </div>

          <div class="notice warning"><b>試算提醒：</b>倍率、時數及薪資基數皆可自訂。本頁提供個人核對與情境比較，實際加班費仍以薪資單、勞動契約與適用規定為準。</div>

          <div class="advanced-disclosure">
            <button class="advanced-summary" type="button" data-action="toggle-hourly-advanced" aria-expanded="${ui.hourlyAdvancedOpen}">
              <span>延伸時間價值分析（選用）<small>預設隱藏；展開後可分析通勤與備勤時間成本</small></span>
              <span aria-hidden="true">${ui.hourlyAdvancedOpen ? '收合 −' : '展開 ＋'}</span>
            </button>
            ${ui.hourlyAdvancedOpen ? `<div class="advanced-content">
              <article class="card card-pad"><div class="section-title"><div><h3>時間與生活成本參數</h3><p>修改後會保存，並以目前選取月份的薪資紀錄重新計算</p></div></div><div class="settings-grid">
                ${settingField('standardHours', '月標準工時', s.standardHours, '小時')}
                ${settingField('workDays', '每月工作天數', s.workDays, '天')}
                ${settingField('commuteMinsDay', '每日來回通勤', s.commuteMinsDay, '分鐘')}
                ${settingField('commuteCostMonth', '每月通勤開銷', s.commuteCostMonth, '元')}
                ${settingField('prepMinsDay', '每日準備／備勤', s.prepMinsDay, '分鐘')}
              </div></article>
              <div class="metric-grid">
                <article class="card metric"><div class="metric-label"><span>名義合約時薪</span><span class="metric-icon">約</span></div><div class="metric-value">$${money(metrics.nominalRate)} <small>/hr</small></div><div class="metric-note">固定薪資基礎 ÷ 月標準工時</div></article>
                <article class="card metric blue"><div class="metric-label"><span>主業實領工作時薪</span><span class="metric-icon">淨</span></div><div class="metric-value">$${money(metrics.netRate)} <small>/hr</small></div><div class="metric-note">主業實領 ÷（標準工時＋加班）</div></article>
                <article class="card metric green core-metric"><span class="core-tag">核心指標</span><div class="metric-label"><span>真實代價時薪</span><span class="metric-icon">真</span></div><div class="metric-value">$${money(metrics.trueRate)} <small>/hr</small></div><div class="metric-note">較名義時薪 ${metrics.gapPercent > 0 ? '+' : ''}${metrics.gapPercent}%</div></article>
              </div>
              ${metrics.hasData ? `<div class="chart-grid"><article class="card card-pad"><div class="section-title"><div><h3>月度時薪趨勢</h3><p>空白月份以 0 顯示</p></div><span class="soft-badge">${ui.selectedYear}</span></div>${renderLineChart()}</article><article class="card card-pad"><div class="section-title"><div><h3>每月時間代價</h3><p>目前選取範圍的平均結構</p></div></div>${renderDonut(timeItems, '投入時間', '', 'h')}</article></div>
              <article class="card card-pad"><div class="section-title"><div><h3>時間價值診斷</h3><p>以目前參數推估，適合做趨勢與方案比較</p></div></div><div class="insight-grid"><div class="insight"><strong>通勤與備勤</strong>每月約增加 <b>${money(metrics.commuteHours + metrics.prepHours)} 小時</b>的工作相關時間。</div><div class="insight"><strong>隱形成本</strong>通勤費與額外時間使名義與真實時薪相差約 <b>$${money(metrics.rateDiff)}/hr</b>。</div></div></article>` : emptyPanel('時', '尚無時間價值分析資料', '上方加班費試算仍可獨立使用；若要分析真實時薪，請先新增目前年度的薪資紀錄。', '<button class="btn btn-primary" type="button" data-action="add-record">新增薪資</button>')}
            </div>` : ''}
          </div>
        </div>`;
    };

    const settingField = (key, label, value, unit) => `<label><span class="field-label">${escapeHtml(label)}</span><input class="field" type="number" min="0" step="1" value="${escapeAttr(value)}" data-setting="${escapeAttr(key)}"><span class="hint">${escapeHtml(unit)}</span></label>`;

    const preferredCompany = (preferredId = '') => getCompany(preferredId)
      || (ui.companyFilter !== 'ALL' ? getCompany(ui.companyFilter) : null)
      || state.companies.find((company) => company.isCurrent)
      || state.companies[0]
      || null;

    const yearEndEstimateFor = (company) => {
      if (!company) return null;
      if (!ui.yearEndDraft || ui.yearEndDraft.companyId !== company.id || Number(ui.yearEndDraft.year) !== Number(ui.selectedYear)) {
        const saved = state.yearEndEstimates.find((item) => item.companyId === company.id && Number(item.year) === Number(ui.selectedYear));
        ui.yearEndDraft = clone(saved || normalizeYearEndEstimate({
          id: newId('yearend'),
          companyId: company.id,
          year: ui.selectedYear,
          baseMode: 'base',
          fixedMonths: 1,
          gradeRules: defaultYearEndGrades(),
          selectedGradeId: 'grade_a',
          prorateByEmployment: true
        }));
      }
      return ui.yearEndDraft;
    };

    const employedYearRatio = (company, year) => {
      const yearStart = isoDate(year, 1, 1);
      const yearEnd = isoDate(year, 12, 31);
      const startDate = validIsoDate(company?.employmentStartDate) ? company.employmentStartDate : yearStart;
      if (startDate > yearEnd) return { ratio: 0, employedDays: 0, yearDays: 365 + (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 1 : 0) };
      const effectiveStart = startDate > yearStart ? startDate : yearStart;
      const start = parseDateParts(effectiveStart);
      const end = parseDateParts(yearEnd);
      const startMs = Date.UTC(start.year, start.month - 1, start.day);
      const endMs = Date.UTC(end.year, end.month - 1, end.day);
      const employedDays = Math.max(0, Math.round((endMs - startMs) / 86400000) + 1);
      const yearDays = 365 + (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 1 : 0);
      return { ratio: Math.min(1, employedDays / yearDays), employedDays, yearDays };
    };

    const yearEndMetrics = (draft, company) => {
      const profileDate = isoDate(Number(draft?.year) || ui.selectedYear, 12, 31);
      const profile = salaryProfileAt(company, profileDate);
      const baseAmount = draft?.baseMode === 'fixed'
        ? salaryProfileTotal(profile)
        : draft?.baseMode === 'custom'
          ? Math.max(0, numberValue(draft.customBase))
          : Math.max(0, salaryProfileBasePay(profile));
      const grades = normalizeYearEndGrades(draft?.gradeRules);
      const selectedGrade = grades.find((item) => item.id === draft?.selectedGradeId) || grades[0] || { name: '未設定', multiplier: 0 };
      const fixedBonus = baseAmount * Math.max(0, numberValue(draft?.fixedMonths));
      const performanceBonus = baseAmount * Math.max(0, numberValue(selectedGrade.multiplier));
      const preProrate = Math.max(0, fixedBonus + performanceBonus + numberValue(draft?.extraAdjustment));
      const service = employedYearRatio(company, Number(draft?.year) || ui.selectedYear);
      const prorateRatio = draft?.prorateByEmployment ? service.ratio : 1;
      const grossBonus = Math.round(preProrate * prorateRatio);
      const threshold = Math.max(0, numberValue(draft?.withholdingThreshold));
      const withholding = grossBonus >= threshold ? Math.round(grossBonus * clamp(draft?.withholdingRate, 0, 100) / 100) : 0;
      return {
        profile,
        baseAmount,
        selectedGrade,
        fixedBonus: Math.round(fixedBonus),
        performanceBonus: Math.round(performanceBonus),
        preProrate: Math.round(preProrate),
        prorateRatio,
        employedDays: service.employedDays,
        yearDays: service.yearDays,
        grossBonus,
        withholding,
        netBonus: grossBonus - withholding
      };
    };

    const yearEndResultsHtml = (draft, company) => {
      const result = yearEndMetrics(draft, company);
      return `
        <article class="card metric green"><div class="metric-label"><span>預估實領年終</span><span class="metric-icon">終</span></div><div class="metric-value">$${money(result.netBonus)}</div><div class="metric-note">預估總額扣除預扣稅</div></article>
        <article class="card card-pad"><div class="section-title"><div><h3>試算明細</h3><p>${userHtml(result.selectedGrade.name)}｜績效 ${rateNumber(result.selectedGrade.multiplier)} 個月</p></div></div>
          <div class="summary-row"><span>計算基數</span><b>$${money(result.baseAmount)}</b></div>
          <div class="summary-row"><span>固定年終</span><b>$${money(result.fixedBonus)}</b></div>
          <div class="summary-row"><span>績效獎金</span><b>$${money(result.performanceBonus)}</b></div>
          <div class="summary-row"><span>年資比例</span><b>${(result.prorateRatio * 100).toFixed(1)}%</b></div>
          <div class="summary-row"><span>預估發放總額</span><b>$${money(result.grossBonus)}</b></div>
          <div class="summary-row"><span>預扣稅</span><b class="text-rose">−$${money(result.withholding)}</b></div>
          <div class="summary-grand"><span>預估實領</span><strong>$${money(result.netBonus)}</strong></div>
        </article>
        <div class="notice"><b>公式：</b>（計算基數 × 固定月數＋計算基數 × 績效月數＋額外調整）× 年資比例。門檻與預扣率可自行調整。此為既有公司規則試算，非通用法定扣繳門檻。實際扣繳須依所得年度、居住者身分、給付類型、扣繳方式與適用表格確認；預扣不等於年度應納稅額。請按薪資單填入實際預扣稅。</div>`;
    };

    const yearEndGradeRowsHtml = (grades) => normalizeYearEndGrades(grades).map((grade, index) => `
      <div class="grade-rule-row" data-yearend-grade data-index="${index}">
        <label><span class="field-label">等級名稱</span><input class="field" data-grade-name maxlength="20" value="${escapeAttr(grade.name)}"></label>
        <label><span class="field-label">績效月數</span><input class="field" data-grade-multiplier type="number" min="0" max="20" step="0.1" value="${escapeAttr(grade.multiplier)}"></label>
        <button class="btn btn-small btn-danger" type="button" data-action="remove-yearend-grade" data-index="${index}" aria-label="移除績效等級">×</button>
      </div>`).join('');

    const renderYearEndPanel = () => {
      const company = preferredCompany(ui.yearEndCompanyId);
      if (!company) return `<div class="salary-tab-panel">${emptyPanel('終', '尚未建立任職公司', '請先建立公司，才能依薪資基礎進行年終試算。', '<button class="btn btn-primary" type="button" data-action="manage-companies">新增公司</button>')}</div>`;
      ui.yearEndCompanyId = company.id;
      const draft = yearEndEstimateFor(company);
      const profile = salaryProfileAt(company, isoDate(ui.selectedYear, 12, 31));
      const companyOptions = state.companies.map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === company.id ? 'selected' : ''}>${item.isCurrent ? '現任｜' : '歷任｜'}${userHtml(item.name)}</option>`).join('');
      const gradeOptions = normalizeYearEndGrades(draft.gradeRules).map((grade) => `<option value="${escapeAttr(grade.id)}" ${grade.id === draft.selectedGradeId ? 'selected' : ''}>${userHtml(grade.name)}｜${rateNumber(grade.multiplier)} 個月</option>`).join('');
      return `<div class="salary-tab-panel">
        <article class="card toolbar"><div><b>年終試算</b><div class="profile-source">${ui.selectedYear} 年｜${profile.source === 'adjustment' ? `套用 ${escapeHtml(profile.effectiveDate)} 調薪後薪資` : '套用公司起始薪資'}</div></div><div class="page-actions"><select id="yearEndCompany" class="field-select" aria-label="選擇年終試算公司">${companyOptions}</select></div></article>
        <div class="year-end-layout">
          <form id="yearEndForm" class="card card-pad">
            <div class="section-title"><div><h3>年終條件</h3><p>固定年終與績效級距可分開設定</p></div><span class="soft-badge">自訂試算</span></div>
            <div class="form-grid">
              <label><span class="field-label">計算基數</span><select class="field-select" name="baseMode"><option value="base" ${draft.baseMode === 'base' ? 'selected' : ''}>${profile.employmentMode === 'dispatch_hourly' ? '時薪底薪換算' : '本薪'} $${money(salaryProfileBasePay(profile))}</option><option value="fixed" ${draft.baseMode === 'fixed' ? 'selected' : ''}>全部固定薪資 $${money(salaryProfileTotal(profile))}</option><option value="custom" ${draft.baseMode === 'custom' ? 'selected' : ''}>自訂金額</option></select></label>
              <label id="yearEndCustomBase" ${draft.baseMode === 'custom' ? '' : 'hidden'}><span class="field-label">自訂計算基數</span><input class="field" name="customBase" type="number" min="0" step="1" value="${escapeAttr(draft.customBase)}"></label>
              <label><span class="field-label">固定年終月數</span><input class="field" name="fixedMonths" type="number" min="0" max="20" step="0.1" value="${escapeAttr(draft.fixedMonths)}"></label>
              <label><span class="field-label">本次績效等級</span><select class="field-select" name="selectedGradeId">${gradeOptions}</select></label>
              <label><span class="field-label">額外加減金額</span><input class="field" name="extraAdjustment" type="number" step="1" value="${escapeAttr(draft.extraAdjustment)}"></label>
              <label><span class="field-label">年資比例</span><span class="hourly-check"><input name="prorateByEmployment" type="checkbox" ${draft.prorateByEmployment ? 'checked' : ''}> 未滿一年依到職日比例計算</span></label>
              <label><span class="field-label">自訂預扣稅門檻</span><input class="field" name="withholdingThreshold" type="number" min="0" step="1" value="${escapeAttr(draft.withholdingThreshold)}"></label>
              <label><span class="field-label">自訂預扣稅率</span><input class="field" name="withholdingRate" type="number" min="0" max="100" step="0.1" value="${escapeAttr(draft.withholdingRate)}"><span class="hint">%</span></label>
            </div>
            <div class="form-group" style="margin-top:14px"><div class="group-head"><strong>績效級距</strong><span class="soft-badge">可自行變更</span></div><div class="grade-rule-list">${yearEndGradeRowsHtml(draft.gradeRules)}</div><div class="form-actions"><button class="btn btn-small" type="button" data-action="add-yearend-grade">＋ 新增級距</button></div></div>
            <label style="display:block;margin-top:14px"><span class="field-label">備註</span><textarea class="field-textarea" name="note" maxlength="240">${userHtml(draft.note)}</textarea></label>
            <div class="form-actions">${state.yearEndEstimates.some(item=>item.id===draft.id)?`<button class="btn btn-danger" type="button" data-action="delete-year-end" data-id="${escapeAttr(draft.id)}">刪除本年度試算</button>`:''}<button class="btn btn-primary" type="submit">${state.yearEndEstimates.some(item=>item.id===draft.id)?'儲存修改':'儲存本年度試算'}</button></div>
          </form>
          <div id="yearEndResults" class="year-end-results">${yearEndResultsHtml(draft, company)}</div>
        </div>
        <div class="notice warning"><b>試算提醒：</b>本功能用於個人預估；${profile.employmentMode === 'dispatch_hourly' ? `派遣時薪制以「$${hourlyRateNumber(profile.baseHourlyRate)} × ${rateNumber(profile.regularHours)} 小時」換算月基數。` : ''}實際年終、績效與扣繳方式仍以公司制度、薪資單及適用規定為準。</div>
      </div>`;
    };

    const salaryAdjustmentReasonName = (reason) => ({ annual: '年度調薪', promotion: '晉升調薪', performance: '績效調薪', new_hire: '新進起薪', custom: '其他調整' })[reason] || '其他調整';
    const salaryProfileBefore = (company, effectiveDate, excludeId = '') => {
      const previousDate = addIsoDays(effectiveDate, -1) || effectiveDate;
      return salaryProfileAt(company, previousDate, excludeId);
    };
    const salaryAdjustmentTotal = (record) => salaryProfileTotal(record);
    const selectedRaiseCompany = () => preferredCompany(ui.raiseCompanyId);

    const renderSalaryAdjustmentsPanel = () => {
      const company = selectedRaiseCompany();
      if (!company) return `<div class="salary-tab-panel">${emptyPanel('升', '尚未建立任職公司', '請先建立公司，才能記錄年度加薪。', '<button class="btn btn-primary" type="button" data-action="manage-companies">新增公司</button>')}</div>`;
      ui.raiseCompanyId = company.id;
      const companyOptions = state.companies.map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === company.id ? 'selected' : ''}>${item.isCurrent ? '現任｜' : '歷任｜'}${userHtml(item.name)}</option>`).join('');
      const history = salaryAdjustmentsForCompany(company.id).slice().reverse();
      const baseProfile = companyBaseSalaryProfile(company);
      const currentProfile = salaryProfileAt(company, todayIso());
      const baseTotal = salaryProfileTotal(baseProfile);
      const currentTotal = salaryProfileTotal(currentProfile);
      const growth = currentTotal - baseTotal;
      const growthPercent = baseTotal ? growth / baseTotal * 100 : 0;
      return `<div class="salary-tab-panel">
        <article class="card toolbar"><div><b>每年加薪紀錄</b><div class="profile-source">調薪只影響之後新增的薪資預設，不改寫既有薪資或每日加班時薪</div></div><div class="page-actions"><select id="raiseCompany" class="field-select" aria-label="選擇加薪紀錄公司">${companyOptions}</select><button class="btn btn-primary" type="button" data-action="add-salary-adjustment">＋ 新增調薪</button></div></article>
        <div class="metric-grid three">
          <article class="card metric"><div class="metric-label"><span>起始固定薪資</span><span class="metric-icon">起</span></div><div class="metric-value">$${money(baseTotal)}</div><div class="metric-note">公司最初預設薪資組合</div></article>
          <article class="card metric green"><div class="metric-label"><span>目前生效固定薪資</span><span class="metric-icon">現</span></div><div class="metric-value">$${money(currentTotal)}</div><div class="metric-note">${currentProfile.source === 'adjustment' ? `${escapeHtml(currentProfile.effectiveDate)} 起生效` : '尚無已生效調薪'}</div></article>
          <article class="card metric ${growth >= 0 ? 'blue' : 'rose'}"><div class="metric-label"><span>累積調整</span><span class="metric-icon">差</span></div><div class="metric-value ${growth >= 0 ? 'change-positive' : 'change-negative'}">${growth >= 0 ? '+' : '−'}$${money(Math.abs(growth))}</div><div class="metric-note">${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%</div></article>
        </div>
        ${history.length ? `<article class="card table-shell"><div class="card-pad section-title"><div><h3>調薪歷程</h3><p>每筆都是生效日起的新薪資快照</p></div><span class="soft-badge">${history.length} 筆</span></div><div class="table-scroll"><table class="salary-history-table"><thead><tr><th>生效日</th><th>原因</th><th>薪資基礎</th><th>伙食</th><th>職務加給</th><th>其他固定加項</th><th>固定薪資合計</th><th>較前次</th><th>狀態</th><th>操作</th></tr></thead><tbody>${history.map((record) => { const total = salaryAdjustmentTotal(record); const previous = salaryProfileTotal(salaryProfileBefore(company, record.effectiveDate, record.id)); const difference = total - previous; const percent = previous ? difference / previous * 100 : 0; const future = record.effectiveDate > todayIso(); return `<tr class="data-row"><td class="money"><b>${escapeHtml(record.effectiveDate)}</b><small style="display:block;color:var(--muted)">${userHtml(record.note || '—')}</small></td><td>${escapeHtml(salaryAdjustmentReasonName(record.reason))}</td><td class="money">${escapeHtml(salaryBasisText(record))}</td><td class="money">$${money(record.mealAllowance)}</td><td class="money">$${money(record.positionAllowance)}</td><td>${escapeHtml((record.fixedEarnings || []).map((item) => `${item.name} $${money(item.amount)}`).join('、') || '—')}</td><td class="money"><b>$${money(total)}</b></td><td class="money ${difference >= 0 ? 'change-positive' : 'change-negative'}">${difference >= 0 ? '+' : '−'}$${money(Math.abs(difference))}<small style="display:block">${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%</small></td><td><span class="status ${future ? 'leave-planned' : 'current'}">${future ? '預定' : '已生效'}</span></td><td class="actions"><button class="btn btn-small" type="button" data-action="edit-salary-adjustment" data-id="${escapeAttr(record.id)}">編輯</button> <button class="btn btn-small btn-danger" type="button" data-action="delete-salary-adjustment" data-id="${escapeAttr(record.id)}">刪除</button></td></tr>`; }).join('')}</tbody></table></div></article>` : emptyPanel('升', '尚無調薪紀錄', '新增第一筆後，系統會依生效日建立薪資成長歷程。', '<button class="btn btn-primary" type="button" data-action="add-salary-adjustment">新增調薪</button>')}
        <div class="notice"><b>連動原則：</b>調薪紀錄只會成為生效日之後「新增薪資明細」與年終試算的預設值；請假扣薪依請假日套用當時薪資。既有薪資與每筆每日加班時薪都保留原始快照。</div>
      </div>`;
    };

    const renderHourly = () => {
      const activePanel = ui.salaryCalcTab === 'yearend'
        ? renderYearEndPanel()
        : ui.salaryCalcTab === 'raises'
          ? renderSalaryAdjustmentsPanel()
          : renderOvertimeCalculatorPanel();
      return `<section class="view" aria-labelledby="salaryCalcTitle">
        <div class="hero-panel"><div class="page-head"><div><h2 id="salaryCalcTitle">薪資成長與試算</h2><p>整合加班費、年終與每年加薪紀錄；每日加班時薪採每筆獨立快照，不會因調薪回溯變動。</p></div></div></div>
        <div class="salary-tabs" role="tablist" aria-label="薪資試算功能">
          <button class="salary-tab ${ui.salaryCalcTab === 'overtime' ? 'active' : ''}" type="button" role="tab" aria-selected="${ui.salaryCalcTab === 'overtime'}" data-salary-tab="overtime">加班費試算</button>
          <button class="salary-tab ${ui.salaryCalcTab === 'yearend' ? 'active' : ''}" type="button" role="tab" aria-selected="${ui.salaryCalcTab === 'yearend'}" data-salary-tab="yearend">年終試算</button>
          <button class="salary-tab ${ui.salaryCalcTab === 'raises' ? 'active' : ''}" type="button" role="tab" aria-selected="${ui.salaryCalcTab === 'raises'}" data-salary-tab="raises">加薪紀錄</button>
        </div>
        ${activePanel}
      </section>`;
    };

    // ANNUAL_ANALYSIS_START
    const annualMonthChoices = new Map();
    const annualAnalysisData = () => {
      const year=Number(ui.selectedYear), month=annualMonthChoices.get(year)||(year===new Date().getFullYear()?new Date().getMonth()+1:12);
      const key=JSON.stringify([year,month,ui.companyFilter]);
      if(calculationCache.annualAnalysis.has(key))return calculationCache.annualAnalysis.get(key);
      const data=window.SalaryMateAnnual.analyze(state.records,{year,throughMonth:month,companyId:ui.companyFilter});
      const companyMatch=id=>ui.companyFilter==='ALL'||id===ui.companyFilter;
      data.scopeName=ui.companyFilter==='ALL'?'全部公司':companyName(ui.companyFilter);
      const creditsBySource=new Map();
      for(const row of window.SalaryMateCompTime.ledger({credits:state.compTimeCredits,logs:state.overtimeLogs,today:todayIso()}).rows){
        if(row.issues.length)continue;const item=row.credit,key=JSON.stringify([item.companyId,item.sourceId]);creditsBySource.set(key,(creditsBySource.get(key)||0)+numberValue(item.hours));
      }
      data.monthly=data.current.map((row,index)=>({...row,previous:data.previous[index],overtimeHours:0,overtimeEstimate:0,creditHours:0,leaveConfirmed:0,leavePlanned:0,settlementHours:0,settlementAmount:0}));
      const monthlyOvertimeLogs = Array.from({length:12},()=>[]);
      for(const log of state.overtimeLogs){
        if(!companyMatch(log.companyId))continue;
        const period=salaryMonthForLog(log),row=period?.year===year?data.monthly[period.month-1]:null;
        if(row){row.overtimeHours+=numberValue(log.hours);monthlyOvertimeLogs[period.month-1].push(log);row.creditHours+=creditsBySource.get(JSON.stringify([log.companyId,log.id]))||0;}
      }
      data.monthly.forEach((row,index)=>{row.overtimeEstimate=overtimeTotal(monthlyOvertimeLogs[index]);});
      for(const leave of state.leaveRecords){
        if(!companyMatch(leave.companyId)||!['confirmed','planned'].includes(leave.status))continue;
        for(const allocation of leaveAllocations(leave)){
          const row=allocation.year===year?data.monthly[allocation.month-1]:null;
          if(row)row[leave.status==='confirmed'?'leaveConfirmed':'leavePlanned']+=allocation.hours;
        }
      }
      for(const item of state.compTimeSettlements){
        if(!companyMatch(item.companyId)||Number(item.date.slice(0,4))!==year)continue;
        const row=data.monthly[Number(item.date.slice(5,7))-1];if(row){row.settlementHours+=numberValue(item.hours);row.settlementAmount+=numberValue(item.amount);}
      }
      calculationCache.annualAnalysis.set(key,data);
      return data;
    };
    const annualMoney = value => '$'+Number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});
    const annualPercent = value => value===null?'無適用占比':value.toFixed(1)+'%';
    const annualCoverageText = data => `未登錄月份：${data.year} 年 ${data.missingCurrent.join('、')||'無'}；${data.year-1} 年 ${data.missingPrevious.join('、')||'無'}。共同有紀錄月份：${data.common.join('、')||'無'}。`;
    const annualMonthlyTable = data => `<div class="table-scroll annual-table-scroll" role="region" aria-label="月度同期與工時摘要，可左右捲動" tabindex="0"><table><caption>月度同期與工時摘要</caption><thead><tr><th>薪資月</th><th>${data.year} 應發</th><th>${data.year} 淨入帳</th><th>${data.year-1} 淨入帳</th><th>同期差額</th><th>加班／轉補休 h</th><th>確認／預計請假 h</th><th>補休結算金額</th></tr></thead><tbody>${data.monthly.map(row=>`<tr><td>${row.month} 月</td><td>${row.count?annualMoney(row.gross):'未登錄'}</td><td>${row.count?annualMoney(row.combined):'未登錄'}</td><td>${row.previous.count?annualMoney(row.previous.combined):'未登錄'}</td><td>${row.count&&row.previous.count?annualMoney(window.SalaryMateAnnual.amount(row.combined-row.previous.combined)):'—'}</td><td>${rateNumber(row.overtimeHours)}／${rateNumber(row.creditHours)}</td><td>${rateNumber(row.leaveConfirmed)}／${rateNumber(row.leavePlanned)}</td><td>${annualMoney(row.settlementAmount)}</td></tr>`).join('')}</tbody></table></div>`;
    const annualStructureHtml = data => `<div class="annual-structure"><article class="card"><h4>薪資實領</h4><div class="summary-row"><span>扣除勞健保、扣款與自提後</span><b>${annualMoney(data.totals.mainNet)}</b></div><p class="hint">個人投資收入請至投資頁查看與匯出。</p></article><article class="card"><h4>薪資應發：固定／變動收入</h4><div class="summary-row"><span>本薪、津貼與固定加項</span><b>${annualMoney(data.totals.fixed)}｜${annualPercent(data.grossShares[0])}</b></div><div class="summary-row"><span>加班、獎金與其他加項</span><b>${annualMoney(data.totals.variable)}｜${annualPercent(data.grossShares[1])}</b></div></article></div>`;
    const annualReportHtml = data => `<section class="annual-report"><h2>${data.year} 年整合報表</h2><p>${(ui.companyFilter==='ALL'?escapeHtml(data.scopeName):userHtml(data.scopeName))}｜1～${data.throughMonth} 月｜薪資歸屬年度｜產生 ${escapeHtml(todayIso())}</p><p>${escapeHtml(annualCoverageText(data))}</p><table><caption>已登錄收入摘要</caption><tbody><tr><th>主業應發</th><td>${annualMoney(data.totals.gross)}</td><th>扣除（含勞退自提）</th><td>${annualMoney(data.totals.deductions)}</td></tr><tr><th>主業實領</th><td>${annualMoney(data.totals.mainNet)}</td><th>投資收入</th><td>另見投資頁</td></tr><tr><th>淨入帳合計</th><td>${annualMoney(data.totals.combined)}</td><th>前一年已登錄同期</th><td>${annualMoney(data.prior.combined)}</td></tr><tr><th>共同月份差額</th><td>${data.delta===null?'無可比較資料':annualMoney(data.delta)}</td><th>共同月份增幅</th><td>${data.growth===null?'無適用增幅':data.growth.toFixed(1)+'%'}</td></tr></tbody></table>${annualStructureHtml(data)}${annualMonthlyTable(data)}<p>缺少薪資紀錄不等於零收入。加班與請假依公司計薪區間歸屬；補休結算依實際結算日期月份列示，屬核對備註金額，未額外加入收入合計。工時資料尚未同步薪資時，兩者金額可能不同。</p></section>`;
    const renderAnnualAnalysis = () => {
      const data=annualAnalysisData();
      return `<article class="card card-pad annual-analysis"><div class="annual-scope"><div><h3>年度同期比較與收入結構</h3><p>${data.year} 對 ${data.year-1}｜${(ui.companyFilter==='ALL'?escapeHtml(data.scopeName):userHtml(data.scopeName))}</p></div><div class="annual-tools"><label for="annualThroughMonth">比較到<select class="field-select" id="annualThroughMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${data.throughMonth===i+1?'selected':''}>${i+1} 月</option>`).join('')}</select></label><button class="btn" type="button" data-action="preview-annual-report">預覽報表</button><button class="btn btn-primary" type="button" data-action="export-annual-report">下載 CSV</button></div></div>
        <div class="annual-kpis"><div><span>本期淨入帳</span><strong>${annualMoney(data.totals.combined)}</strong><small>${data.year} 年 1～${data.throughMonth} 月已登錄</small></div><div><span>前期已登錄</span><strong>${annualMoney(data.prior.combined)}</strong><small>${data.year-1} 年相同月份範圍</small></div><div><span>共同月份差額</span><strong>${data.delta===null?'尚無可比資料':annualMoney(data.delta)}</strong><small>${data.growth===null?'前期非正值或無共同紀錄時不計增幅':`${data.growth>=0?'+':''}${data.growth.toFixed(1)}%`}｜${data.common.length} 個共同月份</small></div></div>
        <details class="annual-coverage"><summary>資料範圍：${data.common.length} 個可比較月份；本年 ${data.missingCurrent.length} 個月未登錄</summary><p>${escapeHtml(annualCoverageText(data))}缺少紀錄不當作零收入；增幅僅比較兩年共同有紀錄的月份。</p></details>
        ${!data.totals.count?'<p class="notice">此範圍尚無薪資紀錄。可切換年度或截止月，或到「薪資」新增紀錄。</p>':''}
        ${annualStructureHtml(data)}
        <details class="annual-month-detail"><summary>查看月度明細與工時摘要 <span>1～${data.throughMonth} 月</span></summary>${annualMonthlyTable(data)}</details>
      </article>`;
    };
    const previewAnnualReport = () => openDialog('年度整合報表',annualReportHtml(annualAnalysisData())+`<div class="form-actions"><button class="btn" type="button" data-action="close-dialog">關閉</button><button class="btn btn-primary" type="button" data-action="download-annual-print">下載列印版／PDF 用</button></div>`,true);
    const downloadAnnualPrint = () => {
      const data=annualAnalysisData();
      const html=`<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SalaryMate ${data.year} 年整合報表</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#172d29;font-size:14px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;text-align:right;border-bottom:1px solid #cbd8d4}th:first-child,td:first-child{text-align:left}caption{text-align:left;font-weight:bold;font-size:16px}.annual-structure{display:grid;grid-template-columns:1fr 1fr;gap:24px}.summary-row{display:flex;justify-content:space-between;gap:12px;margin:12px 0}.hint{color:#49605b}button{padding:10px 18px;font-size:16px}@media print{button{display:none}body{margin:0}table{font-size:10px}tr{break-inside:avoid}thead{display:table-header-group}}@page{size:A4 landscape;margin:12mm}</style></head><body><button onclick="window.print()">列印／另存 PDF</button>${annualReportHtml(data)}</body></html>`;
      downloadBlob(window.SalaryMateI18n.html(html),'text/html;charset=utf-8',`SalaryMate_${data.year}_01-${pad2(data.throughMonth)}_report.html`);
      toast('已下載列印版；開啟後可列印或另存 PDF。');
    };
    const exportAnnualReport = () => {
      const data=annualAnalysisData();
      const rows=[['SalaryMate 年度整合月報',APP_VERSION],['公司範圍',data.scopeName],['薪資年度',data.year],['月份範圍',`1～${data.throughMonth}`],['缺漏／共同月份',annualCoverageText(data)],['共同月份淨入帳差額',data.delta],['共同月份增幅百分比',data.growth],[],['薪資年份','薪資月份','薪資筆數','主業應發','薪資扣除含自提','主業實領','投資收入（舊欄位）','淨入帳合計','固定應發','變動應發','前一年薪資筆數','前一年淨入帳','同期差額','加班紀錄時數','其中轉入補休時數','預估加班費','已確認請假時數','預計請假時數','補休結算時數（日期月份）','補休結算金額（未另加收入）']];
      data.monthly.forEach(row=>rows.push([data.year,row.month,row.count,row.count?row.gross:null,row.count?row.deductions:null,row.count?row.mainNet:null,row.count?row.side:null,row.count?row.combined:null,row.count?row.fixed:null,row.count?row.variable:null,row.previous.count,row.previous.count?row.previous.combined:null,row.count&&row.previous.count?window.SalaryMateAnnual.amount(row.combined-row.previous.combined):null,row.overtimeHours,row.creditHours,row.overtimeEstimate,row.leaveConfirmed,row.leavePlanned,row.settlementHours,row.settlementAmount]));
      downloadBlob(window.SalaryMateAnnual.csv(rows),'text/csv;charset=utf-8',`SalaryMate_${data.year}_01-${pad2(data.throughMonth)}_integrated.csv`);
      toast('已匯出目前範圍的年度整合報表。');
    };
    // ANNUAL_ANALYSIS_END
    const renderTax = () => {
      const stats = taxStats();
      return `
        <section class="view" aria-labelledby="taxTitle">
          <div class="page-head"><div><h2 id="taxTitle">年度所得與扣繳對帳</h2><p>彙整各發薪公司薪資所得、預扣稅與勞退自提，供申報前核對。</p></div><button class="btn" type="button" data-action="print-page">列印此頁</button></div>
          ${renderAnnualAnalysis()}
          <div class="section-title"><div><h3>全年所得與扣繳摘要</h3><p>${ui.selectedYear} 年全部月份；公司篩選相同，上方同期比較依指定截止月計算。</p></div></div>
          <div class="metric-grid three">
            <article class="card metric"><div class="metric-label"><span>估算薪資所得</span><span class="metric-icon">50</span></div><div class="metric-value">$${money(stats.taxable)}</div><div class="metric-note">已扣伙食免稅額與勞退自提</div></article>
            <article class="card metric blue"><div class="metric-label"><span>已預扣所得稅</span><span class="metric-icon">稅</span></div><div class="metric-value">$${money(stats.tax)}</div><div class="metric-note">申報時可供核對的扣繳金額</div></article>
            <article class="card metric green"><div class="metric-label"><span>勞退個人自提</span><span class="metric-icon">退</span></div><div class="metric-value">$${money(stats.pension)}</div><div class="metric-note">此處僅依輸入金額彙整</div></article>
          </div>
          ${stats.rows.length ? `<article class="card table-shell"><div class="card-pad section-title"><div><h3>各發薪公司核對表</h3><p>${ui.selectedYear} 年度、目前公司篩選結果</p></div></div><div class="table-scroll"><table><thead><tr><th>公司</th><th>任職狀態</th><th>紀錄筆數</th><th>估算薪資所得</th><th>預扣稅額</th><th>勞退自提</th></tr></thead><tbody>${stats.rows.map((row) => `<tr class="data-row"><td><b>${userHtml(row.name)}</b></td><td><span class="status ${row.isCurrent ? 'current' : 'former'}">${row.isCurrent ? '現任' : '歷任'}</span></td><td>${row.monthCount} 筆</td><td class="money">$${money(row.taxable)}</td><td class="money text-blue">$${money(row.tax)}</td><td class="money text-green">$${money(row.pension)}</td></tr>`).join('')}</tbody></table></div></article>` : emptyPanel('稅', '尚無年度對帳資料', '新增薪資紀錄後，這裡會依公司自動彙整。')}
          <div class="notice warning"><b>使用提醒：</b>這是個人記帳與核對工具，不是正式報稅試算。伙食津貼、勞退自提、副業所得與各類獎金的實際課稅認定，請以公司扣繳憑單與申報年度規定為準。</div>
        </section>`;
    };

    const companyReferenceCount = (companyId) => state.records.filter((record) => record.companyId === companyId).length
      + state.overtimeLogs.filter((log) => log.companyId === companyId).length
      + state.leaveRecords.filter((record) => record.companyId === companyId).length
      + state.salaryAdjustments.filter((record) => record.companyId === companyId).length
      + state.yearEndEstimates.filter((record) => record.companyId === companyId).length;

    const companySummaryRow = (label, value) => `<div class="summary-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;

    const currentCompanySalaryProfile = (company) => salaryProfileAt(company, todayIso());
    const fixedIncomeItems = (profile) => normalizeFixedEarnings(profile?.fixedEarnings).filter((item) => item.name.trim() || numberValue(item.amount));
    const fixedIncomeTotal = (profile) => numberValue(profile?.mealAllowance) + numberValue(profile?.positionAllowance) + customTotal(fixedIncomeItems(profile));
    const salaryProfileSourceText = (profile) => profile?.source === 'adjustment'
      ? `${profile.effectiveDate} 起生效的薪資快照`
      : '公司起始薪資設定';

    const salaryRuleRow = (title, summary, detail, action = '') => `<div class="salary-rule-row"><div class="salary-rule-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(summary)}</span><small>${escapeHtml(detail)}</small></div>${action}</div>`;

    const renderCompanySalaryRules = (company) => {
      const profile = currentCompanySalaryProfile(company);
      const fixedTotal = fixedIncomeTotal(profile);
      const deductionsTotal = numberValue(company.laborIns) + numberValue(company.healthIns) + customTotal(company.fixedDeductions);
      return `<section class="view" aria-labelledby="companySalaryRulesTitle">
        <div class="page-head"><div><button class="btn btn-small" type="button" data-action="salary-rules-back">← 公司詳細資料</button><h2 id="companySalaryRulesTitle" class="detail-title">薪資規則</h2><p>${userHtml(company.name)}｜規則定義與每月交易分離；既有薪資快照不回溯修改。</p></div></div>
        <article class="card card-pad salary-rules-card">
          <div class="section-title"><div><h3>目前設定</h3><p>本薪、津貼與自定義固定項目集中在薪資計算；特殊薪資週期、年度加薪與年終規則在進階設定。</p></div></div>
          <div class="salary-rule-list">
            ${salaryRuleRow('薪資計算', `$${money(salaryProfileTotal(profile))}（${salaryBasisText(profile)}＋津貼 $${money(fixedTotal)}）`, '基本月薪、伙食津貼、職務津貼、夜班津貼與自定義固定項目。', `<button class="btn btn-small" type="button" data-action="edit-company-basic" data-id="${escapeAttr(company.id)}">編輯</button>`)}
            ${salaryRuleRow('加班規則', '1 / 1.34 / 1.67 / 2 / 2.67；春節 2.5', '倍率為既有／公司約定試算。星期幾不等於法定日別；請依班表確認平日、休息日、例假或國定假日。1.34／1.67 為現有近似倍率；2.0／春節 2.5 為自訂約定，非通用法定標準。請核對工資基礎、出勤條件及公司給付方式。')}
            ${salaryRuleRow('獎金', '一般獎金＝每月薪資交易', '年終規則不放在一般獎金；Year-End 保持獨立並移至進階設定。')}
            ${salaryRuleRow('加項／扣項', `固定加項 $${money(customTotal(profile.fixedEarnings))}／預設扣項 $${money(deductionsTotal)}`, '可自訂名稱與金額，帶入之後新建的薪資明細；每月仍可個別調整。', `<button class="btn btn-small" type="button" data-action="edit-default-deduction-rule" data-id="${escapeAttr(company.id)}">自訂加項／扣項</button>`)}
            ${salaryRuleRow('稅務', '既有試算：總金額 > 86,001 時估列 5%', '此為既有公司規則試算，非通用法定扣繳門檻。實際扣繳須依所得年度、居住者身分、給付類型、扣繳方式與適用表格確認；預扣不等於年度應納稅額。請按薪資單填入實際預扣稅。')}
          </div>
        </article>
        <div class="notice"><b>歷史保護：</b>薪資變更自今天起生效；既有薪資單與已儲存的加班時薪保持不變。</div>
        <div class="notice"><b>進階規則：</b>特殊薪資週期、年度加薪、年終規則與其他特殊公司制度已集中至「進階設定」。</div>
      </section>`;
    };

    const annualRaiseHistoryForCompany = (companyId) => salaryAdjustmentsForCompany(companyId)
      .filter((record) => record.reason === 'annual')
      .sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)));

    const yearEndRulesForCompany = (companyId) => state.yearEndEstimates
      .filter((record) => record.companyId === companyId)
      .sort((a, b) => Number(a.year) - Number(b.year));

    const companySpecialRuleSummary = (company) => {
      const items = [];
      if (company.leaveQuotaCycle === 'anniversary') items.push('到職週年額度');
      if (numberValue(company.workHoursPerDay) !== 8) items.push(`每日 ${rateNumber(company.workHoursPerDay)}H`);
      if (numberValue(company.leaveDeductionEach) !== 500) items.push(`扣款 $${money(company.leaveDeductionEach)}`);
      if (String(company.deductionRuleNote || '') && String(company.deductionRuleNote) !== DEFAULT_DEDUCTION_RULE) items.push('自訂扣款備註');
      return items;
    };

    const renderCompanyAdvancedRules = (company) => {
      const annual = annualRaiseHistoryForCompany(company.id);
      const latestAnnual = annual.at(-1);
      const yearEnds = yearEndRulesForCompany(company.id);
      const latestYearEnd = yearEnds.at(-1);
      const specials = companySpecialRuleSummary(company);
      return `<section class="view" aria-labelledby="companyAdvancedRulesTitle">
        <div class="page-head"><div><button class="btn btn-small" type="button" data-action="advanced-rules-back">← 公司詳細資料</button><h2 id="companyAdvancedRulesTitle" class="detail-title">進階設定</h2><p>${userHtml(company.name)}｜只有公司特殊制度放在這裡；一般薪資規則維持 CM-03 六個入口。</p></div><span class="soft-badge">Schema 13</span></div>
        <article class="card card-pad"><div class="section-title"><div><h3>目前設定</h3><p>以摘要先確認是否有特殊制度，再進入個別編輯。</p></div></div>
          ${salaryRuleRow('特殊薪資週期', companyPayrollPeriodName(company.id), company.payrollPeriodType === 'calendar' ? '標準週期；1 日～月底。' : '公司自訂週期；既有歷史薪資單不回算。', `<button class="btn btn-small" type="button" data-action="edit-payroll-cycle" data-id="${escapeAttr(company.id)}">編輯</button>`)}
          ${salaryRuleRow('年度加薪', annual.length ? '已設定' : '尚未設定', latestAnnual ? `最近生效 ${latestAnnual.effectiveDate}｜${salaryAdjustmentReasonName(latestAnnual.reason)}` : '沿用既有 salaryAdjustments；不建立第二套年度加薪資料。', `<button class="btn btn-small" type="button" data-action="add-annual-raise" data-id="${escapeAttr(company.id)}">${annual.length ? '新增／查看' : '設定'}</button>`)}
          ${salaryRuleRow('年終規則', yearEnds.length ? '已設定' : '尚未設定', latestYearEnd ? `最近 ${latestYearEnd.year} 年｜固定 ${rateNumber(latestYearEnd.fixedMonths)} 個月＋績效級距` : '沿用既有 Year-End 設定與試算核心。', `<button class="btn btn-small" type="button" data-action="open-year-end-rule" data-id="${escapeAttr(company.id)}">${yearEnds.length ? '查看／編輯' : '設定'}</button>`)}
          ${salaryRuleRow('其他特殊規則', specials.length ? `${specials.length} 項` : '尚未設定', specials.length ? specials.join('、') : '只整理既有公司可支援設定；不提供任意公式或 Rule Engine。', `<button class="btn btn-small" type="button" data-action="company-special-rules" data-id="${escapeAttr(company.id)}">相容設定</button>`)}
        </article>
        <div class="notice"><b>歷史保護：</b>修改進階規則只影響後續歸屬／新建薪資；已存在的薪資單、年終紀錄、Snapshot / Lock 不重新計算。</div>
        <div class="notice warning"><b>限制：</b>其他特殊規則只顯示目前資料模型已支援項目，不建立「新增任意規則」、公式編輯器或 Schema 14。</div>
      </section>`;
    };

    const payrollCycleFormHtml = (company) => {
      const draft = ui.payrollCycleDraft || clone(company);
      const type = draft.payrollPeriodType || 'calendar';
      const startDay = type === 'prev16' ? 16 : clamp(draft.payrollCycleStartDay ?? 1, 1, 31);
      const endDay = type === 'prev16' ? 15 : clamp(draft.payrollCycleEndDay ?? 31, 1, 31);
      return `<form id="payrollCycleForm"><div class="notice"><b>公司：</b>${userHtml(company.name)}。變更只套用之後的工時／請假歸屬與新建薪資預覽；既有薪資單不重算。</div><div class="form-grid" style="margin-top:14px">
        <label class="span-2"><span class="field-label">薪資週期</span><select class="field-select" name="payrollPeriodType"><option value="calendar" ${type === 'calendar' ? 'selected' : ''}>標準週期｜1 日～月底</option><option value="prev16" ${type === 'prev16' ? 'selected' : ''}>公司自訂｜16 日～次月 15 日</option><option value="custom" ${type === 'custom' ? 'selected' : ''}>公司自訂｜指定開始／結束日</option></select></label>
        <label><span class="field-label">開始日</span><input class="field" name="payrollCycleStartDay" type="number" min="1" max="31" step="1" value="${escapeAttr(startDay)}" ${type === 'custom' ? '' : 'disabled'}></label>
        <label><span class="field-label">結束日</span><input class="field" name="payrollCycleEndDay" type="number" min="1" max="31" step="1" value="${escapeAttr(endDay)}" ${type === 'custom' ? '' : 'disabled'}></label>
        <div class="notice span-2"><b>預覽：</b>${escapeHtml(payrollPeriodTypeName(type, startDay, endDay))}。月份沒有該日期時自動使用月底；若自訂區間未涵蓋某一天，該筆工時會保持未歸屬，不會偷偷套用標準週期。</div>
      </div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">儲存薪資週期</button></div></form>`;
    };

    const openPayrollCycleRule = (company) => {
      if (!company) return;
      ui.payrollCycleDraft = clone(company);
      beginDraftScope({ entityType: 'payroll-cycle', companyId: company.id, entityId: company.id, operational: false });
      openDialog('特殊薪資週期', payrollCycleFormHtml(company), true);
    };

    const collectPayrollCycleDraft = () => {
      const form = $('#payrollCycleForm');
      if (!form || !ui.payrollCycleDraft) return ui.payrollCycleDraft;
      const data = new FormData(form);
      const type = ['calendar', 'prev16', 'custom'].includes(data.get('payrollPeriodType')) ? data.get('payrollPeriodType') : 'calendar';
      ui.payrollCycleDraft = normalizeCompany({
        ...ui.payrollCycleDraft,
        payrollPeriodType: type,
        payrollCycleStartDay: type === 'prev16' ? 16 : type === 'calendar' ? 1 : data.get('payrollCycleStartDay'),
        payrollCycleEndDay: type === 'prev16' ? 15 : type === 'calendar' ? 31 : data.get('payrollCycleEndDay')
      });
      return ui.payrollCycleDraft;
    };

    const savePayrollCycleRule = () => {
      const form = $('#payrollCycleForm');
      const draft = collectPayrollCycleDraft();
      if (!form || !draft || !validateNativeForm(form)) return;
      const company = getCompany(draft.id);
      if (!company) { showValidationSummary(form, '薪資週期資料需要確認。公司資料不存在，請返回公司管理重新開啟設定。'); return; }
      if (!assertDraftScope({ entityType: 'payroll-cycle', companyId: draft.id, entityId: draft.id, operational: false })) return;
      if (draft.payrollPeriodType === 'custom') {
        const start = Number(draft.payrollCycleStartDay);
        const end = Number(draft.payrollCycleEndDay);
        if (!Number.isInteger(start) || start < 1 || start > 31) { validateField(form, 'payrollCycleStartDay', '開始日必須是 1～31。'); return; }
        if (!Number.isInteger(end) || end < 1 || end > 31) { validateField(form, 'payrollCycleEndDay', '結束日必須是 1～31。'); return; }
      }
      const ok = commitStateMutation(() => {
        company.payrollPeriodType = draft.payrollPeriodType;
        company.payrollCycleStartDay = draft.payrollPeriodType === 'prev16' ? 16 : draft.payrollPeriodType === 'calendar' ? 1 : clamp(draft.payrollCycleStartDay, 1, 31);
        company.payrollCycleEndDay = draft.payrollPeriodType === 'prev16' ? 15 : draft.payrollPeriodType === 'calendar' ? 31 : clamp(draft.payrollCycleEndDay, 1, 31);
      });
      if (!ok) return;
      closeDialog();
      renderAll();
      toast('特殊薪資週期已儲存');
    };

    const renderCompanyDetail = (company) => {
      if (ui.companyDetailSection === 'salary-rules') return renderCompanySalaryRules(company);
      if (ui.companyDetailSection === 'advanced-rules') return renderCompanyAdvancedRules(company);
      const profile = currentCompanySalaryProfile(company);
      const fixedTotal = fixedIncomeTotal(profile);
      const fixedCount = fixedIncomeItems(profile).length;
      return `<section class="view" aria-labelledby="companyDetailTitle">
        <div class="page-head"><div><button class="btn btn-small" type="button" data-action="company-back">← 公司管理</button><h2 id="companyDetailTitle" class="detail-title">${userHtml(company.name)}</h2><p>${company.isCurrent ? '目前使用中的公司' : '非目前公司；查看不會切換操作中的公司。'}</p></div><div class="page-actions">${company.isCurrent ? '<span class="status current">使用中</span>' : `<button class="btn" type="button" data-action="set-current-company" data-id="${escapeAttr(company.id)}">設為目前公司</button>`}<button class="btn btn-primary" type="button" data-action="edit-company-basic" data-id="${escapeAttr(company.id)}">編輯基本資料</button></div></div>
        <div class="company-management-grid">
          <article class="card card-pad"><div class="section-title"><div><h3>基本資料</h3><p>公司識別、目前生效基本薪資與到職日。</p></div></div>
            ${companySummaryRow('公司名稱', company.name)}
            ${companySummaryRow('基本薪資', salaryBasisText(profile))}
            ${companySummaryRow('固定薪資合計', `$${money(salaryProfileTotal(profile))}`)}
            ${companySummaryRow('到職日', company.employmentStartDate || '尚未設定')}
            ${companySummaryRow('資料引用', `${companyReferenceCount(company.id)} 筆`)}
          </article>
          <article class="card card-pad"><div class="section-title"><div><h3>薪資規則</h3><p>本薪、津貼、扣項與假別規則。</p></div><span class="soft-badge">CM-03</span></div>
            ${companySummaryRow('目前薪資來源', salaryProfileSourceText(profile))}
            ${companySummaryRow('固定收入', `${fixedCount} 個其他項目／$${money(fixedTotal)}`)}
            ${companySummaryRow('每日標準工時', `${rateNumber(company.workHoursPerDay)} 小時`)}
            <div class="form-actions"><button class="btn btn-primary" type="button" data-action="company-salary-rules" data-id="${escapeAttr(company.id)}">開啟薪資規則</button></div>
          </article>
          <article class="card card-pad"><div class="section-title"><div><h3>進階設定</h3><p>特殊週期、年度加薪、年終規則及既有特殊制度。</p></div><span class="soft-badge">CM-04</span></div>
            ${companySummaryRow('薪資週期', companyPayrollPeriodName(company.id))}
            ${companySummaryRow('年度加薪', annualRaiseHistoryForCompany(company.id).length ? '已設定' : '尚未設定')}
            ${companySummaryRow('年終規則', yearEndRulesForCompany(company.id).length ? '已設定' : '尚未設定')}
            <div class="form-actions"><button class="btn btn-primary" type="button" data-action="company-advanced-rules" data-id="${escapeAttr(company.id)}">開啟進階設定</button></div>
          </article>
        </div>
        <div class="company-danger-zone"><button class="btn btn-danger" type="button" data-action="delete-company" data-id="${escapeAttr(company.id)}">刪除公司</button><span>只有完全沒有薪資、加班、請假、調薪與年終引用的公司才能刪除。</span></div>
      </section>`;
    };

    const renderCompanies = () => {
      const detail = getCompany(ui.companyDetailId);
      if (detail) return renderCompanyDetail(detail);
      const current = currentCompany();
      const others = state.companies.filter((company) => company.id !== current?.id);
      return `<section class="view" aria-labelledby="companiesTitle">
        <div class="page-head"><div><h2 id="companiesTitle">公司管理</h2><p>切換目前公司、查看公司資料，或用最少欄位建立新公司。</p></div><div class="page-actions">${current ? `<button class="btn" type="button" data-action="company-full-settings" data-id="${escapeAttr(current.id)}">完整公司設定</button>` : ''}<button class="btn btn-primary" type="button" data-action="add-company-basic">＋ 新增公司</button></div></div>
        ${current ? `<article class="card card-pad current-company-card"><div class="section-title"><div><h3>目前公司</h3><p>目前使用這家公司的薪資與工作紀錄。</p></div><span class="status current">使用中</span></div><div class="company-shell-row"><div><strong>${userHtml(current.name)}</strong><p>${escapeHtml(companySalarySummary(current))}｜到職 ${escapeHtml(current.employmentStartDate || '尚未設定')}</p></div><div class="company-item-actions"><button class="btn btn-small" type="button" data-action="view-company" data-id="${escapeAttr(current.id)}">查看</button><button class="btn btn-small" type="button" data-action="company-salary-rules" data-id="${escapeAttr(current.id)}">薪資規則</button><button class="btn btn-small" type="button" data-action="company-advanced-rules" data-id="${escapeAttr(current.id)}">進階設定</button></div></div></article>` : state.companies.length ? `<article class="card card-pad app-state-inline invalid" role="alert"><div class="section-title"><div><h3>目前公司尚未設定</h3><p>資料仍保留，但快速登記與新建薪資會保持鎖定，直到你明確選擇目前公司。</p></div><span class="status leave-planned">需要確認</span></div><div class="notice warning">系統不會自動使用第一家公司。請從下方公司清單選擇「設為目前公司」。</div></article>` : emptyPanel('公', '尚未建立公司', '建立第一家公司後會自動設為目前公司。', '<button class="btn btn-primary" type="button" data-action="add-company-basic">建立第一家公司</button>')}
        <article class="card card-pad"><div class="section-title"><div><h3>其他公司</h3><p>新增第二家公司後不會自動切換目前公司。</p></div><span class="soft-badge">${others.length} 家</span></div>
          ${others.length ? `<div class="company-shell-list">${others.map((company) => `<div class="company-shell-row"><div><strong>${userHtml(company.name)}</strong><p>${escapeHtml(companySalarySummary(company))}｜到職 ${escapeHtml(company.employmentStartDate || '尚未設定')}</p></div><div class="company-item-actions"><button class="btn btn-small" type="button" data-action="view-company" data-id="${escapeAttr(company.id)}">查看</button><button class="btn btn-small" type="button" data-action="set-current-company" data-id="${escapeAttr(company.id)}">設為目前公司</button></div></div>`).join('')}</div>` : '<div class="notice">目前沒有其他公司。</div>'}
        </article>
      </section>`;
    };

    const v5 = { month: new Date().getMonth() + 1, date: todayIso(), salaryMonth: 0, annualTab: 'overview', attendanceTab: 'overtime', settingsTab: 'general' };
    const VISUAL_ICONS = Object.freeze({
      dashboard:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      wallet:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8h18m-5 5h5m-5 3h1M6 5V3h12"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h2m4 0h2m-8 3h2"/>',
      investment:'<path d="M4 3v17h17M7 15l5-5 4 3 5-8m-5 0h5v5"/>',
      tax:'<path d="M5 20V10h3v10m4 0V4h3v16m4 0v-6h3v6M3 21h20"/>',
      settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
      overtime:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
      leave:'<path d="M12 21V10m-7 2c-4-9 10-13 15-8 0 10-5 14-12 10m4-4 6-4"/>',
      check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>'
    });
    const visualIcon = key => `<svg class="v5-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${VISUAL_ICONS[key] || VISUAL_ICONS.wallet}</svg>`;
    const enhanceVisualHierarchy = root => {
      const add = (node,key) => { if(node && !node.querySelector('.v5-ui-icon')) node.insertAdjacentHTML('afterbegin',visualIcon(key)); };
      $$('.nav-inner [data-tab]').forEach(node=>add(node,node.dataset.tab==='records'?'wallet':node.dataset.tab));
      $$('.page-head h2',root).forEach(node=>add(node,ui.tab==='records'?'wallet':ui.tab));
      $$('.v5-quick-actions .btn',root).forEach(node=>add(node,({'add-overtime':'overtime','add-leave':'leave'})[node.dataset.action]||node.dataset.tab));
      $$('.v5-current-pay>span',root).forEach(node=>add(node,'wallet'));
      $$('.v5-home-numbers>div>span',root).forEach((node,i)=>add(node,['overtime','leave','tax'][i]));
      $$('.v5-stats>div>span,.stock-stat>span',root).forEach((node,i)=>add(node,['wallet','investment','tax','check'][i%4]));
      if (root?.id === 'mainContent') {
        const brand = $('#topbarCompanion');
        if (brand && !brand.firstChild && interfaceBaseStyle(ui.interfaceStyle) === 'pixel') brand.innerHTML = hd2dCompanion('interactive');
      }
      if (root?.id === 'mainContent' && interfaceBaseStyle(ui.interfaceStyle) === 'pixel') {
        const empty = ui.tab !== 'dashboard' ? $('.stock-empty,.card.empty,.v5-quiet-empty',root) : null;
        if (empty && !empty.querySelector('.v5-companion')) {
          empty.classList.add('v5-companion-empty');
          empty.insertAdjacentHTML('afterbegin',hd2dCompanion('quiet'));
        }
      }
    };
    const v5Button = (label, action, extra = '', primary = false) => `<button class="btn${primary ? ' btn-primary' : ''}" type="button" data-action="${action}" ${extra}>${label}</button>`;
    const v5Title = (title, actions = '', subtitle = '') => `<div class="page-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
    const v5Stats = rows => `<div class="v5-stats">${rows.map(([label, value, note = '']) => `<div><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`).join('')}</div>`;
    const v5Tabs = (items, active, name) => `<div class="v5-tabs" aria-label="頁面分類">${items.map(([id, label]) => `<button type="button" data-v5="${name}" data-value="${id}" aria-pressed="${id === active}" class="${id === active ? 'active' : ''}">${label}</button>`).join('')}</div>`;
    const v5AnnualMenu = active => v5Tabs([['overview', '收入總覽'], ['tax', '所得對帳'], ['tools', '試算與調薪']], active, 'annual-tab');
    const v5CompanyReady = () => currentCompany() ? '' : `<div class="v5-start"><div><h3>先建立你的公司</h3><p>填公司名稱、到職日與基本薪資，就能開始登記。</p></div>${v5Button('建立公司', 'add-company-basic', '', true)}</div>`;
    const v5WorkDate = () => ui.tab === 'calendar' && validIsoDate(v5.date) ? v5.date : todayIso();
    const v5Scope = item => item.companyId === currentCompany()?.id;
    const v5DayRows = date => {
      const rows = state.overtimeLogs.filter(item => v5Scope(item) && item.date === date).map(item => ({kind:'overtime', item, hours:item.hours}));
      for (const item of state.leaveRecords.filter(item => v5Scope(item))) {
        const day = leaveDateEntries(item).find(day => day.date === date);
        if (day) rows.push({kind:'leave', item, hours:day.hours});
      }
      return rows;
    };
    const v5DayRow = row => `<button class="v5-day-row ${row.kind} ${row.item.status === 'cancelled' ? 'cancelled' : ''}" type="button" data-action="edit-${row.kind}" data-id="${escapeAttr(row.item.id)}"><span><b>${row.kind === 'leave' ? escapeHtml(leaveTypeName(row.item.type)) : '加班'}</b><strong>${rateNumber(row.hours)} 小時</strong></span><small>${row.kind === 'leave' ? leaveStatusName(row.item.status) : `${escapeHtml(overtimeTypeName(row.item.type))} · 試算 $${money(overtimeAmount(row.item))}`}</small>${row.item.note ? `<p>${userHtml(row.item.note)}</p>` : ''}</button>`;

    const renderV5Home = () => {
      const c = currentCompany(), stats = annualStats(), recent = sortedRecords().slice(0, 3), latest = recent[0];
      const annual = c ? annualLeaveSummary(c) : null, workHours = c?.workHoursPerDay || 8;
      const date = todayIso(), rows = v5DayRows(date), month = Number(date.slice(5,7));
      const currentLogs = state.overtimeLogs.filter(item => v5Scope(item) && item.date.startsWith(date.slice(0,7)));
      const currentHours = currentLogs.reduce((sum, item) => sum + numberValue(item.hours), 0);
      const yearRecords = filteredRecords(), max = Math.max(1,...Array.from({length:12},(_,i)=>yearRecords.filter(r=>r.month===i+1).reduce((sum,r)=>sum+combinedNet(r),0)));
      return `<section class="view">${v5Title('首頁',v5Button('新增薪資','add-record','',true),`${(c?.name ? userHtml(c?.name) : escapeHtml('你的薪資與工作紀錄'))} · ${date.replaceAll('-',' / ')}`)}${v5CompanyReady()}
      <div class="v5-home-summary${latest ? '' : ' is-empty'}"><div class="v5-current-pay"><span>${latest ? `${latest.year} 年 ${latest.month} 月 · 最近一筆淨入帳` : '最近一筆淨入帳'}</span><strong>${latest ? '$' + money(combinedNet(latest)) : '尚未登記'}</strong><small>${latest ? `${escapeHtml(latest.payDate || '入帳日未填')} · ${escapeHtml(reconciliationStatus(latest))}` : '完成薪資登記後顯示'}</small>${latest ? v5Button('查看明細','v5-open-pay',`data-id="${escapeAttr(latest.id)}"`) : ''}</div><div class="v5-home-numbers"><div><span>${month} 月加班</span><strong>${rateNumber(currentHours)} <small>小時</small></strong></div><div><span>可用特休</span><strong>${annual?.configured && annual.limited ? rateNumber(annual.remaining * workHours) + ' <small>小時</small>' : '待設定'}</strong></div><div><span>${ui.selectedYear} 年薪資淨入帳</span><strong>$${money(stats.combinedNet)}</strong></div></div></div>
      <div class="v5-quick-actions">${v5Button('記加班','add-overtime')}${v5Button('記請假','add-leave')}<button type="button" class="btn" data-tab="investment">投資收入</button><button type="button" class="btn" data-tab="calendar">打開日曆</button></div>
      <div class="v5-home-grid"><section><div class="section-title"><h3>今天的紀錄</h3><button type="button" class="btn btn-small" data-tab="calendar">查看日曆</button></div>${rows.length ? rows.map(v5DayRow).join('') : '<div class="v5-quiet-empty">今天還沒有加班或請假紀錄。</div>'}</section><section><div class="section-title"><h3>${ui.selectedYear} 每月淨入帳</h3><button type="button" class="btn btn-small" data-tab="tax">年度總覽</button></div><div class="v5-income-bars" role="img" aria-label="${ui.selectedYear} 年每月淨入帳">${Array.from({length:12},(_,i)=>{const records=yearRecords.filter(r=>r.month===i+1),total=records.reduce((sum,r)=>sum+combinedNet(r),0);return `<div title="${i+1} 月 ${records.length ? '$'+money(total) : '未登記'}"><span style="--bar:${records.length ? Math.max(3,total/max*100) : 0}%" aria-label="${i+1} 月 ${records.length ? '$'+money(total) : '未登記'}"></span><small>${i+1}</small></div>`;}).join('')}</div></section></div>
      <section class="v5-recent"><div class="section-title"><h3>最近薪資</h3><button type="button" class="btn btn-small" data-tab="records">全部紀錄</button></div>${recent.length ? recent.map(r=>`<button type="button" class="v5-recent-row" data-action="v5-open-pay" data-id="${escapeAttr(r.id)}"><span><b>${r.month} 月薪資</b><small>${escapeHtml(r.payDate || '未填入帳日')}</small></span><span><strong>$${money(combinedNet(r))}</strong><small>${escapeHtml(reconciliationStatus(r))}</small></span></button>`).join('') : '<div class="v5-quiet-empty">尚未建立薪資紀錄。</div>'}</section></section>`;
    };

    const renderV5Salary = () => {
      const q = ui.search.trim().toLowerCase(), records = sortedRecords().filter(r => (!v5.salaryMonth || Number(r.month) === v5.salaryMonth) && (!q || `${r.year} ${r.month} ${r.note} ${companyName(r.companyId)} ${combinedNet(r)}`.toLowerCase().includes(q)));
      const total = records.reduce((sum,r)=>sum+combinedNet(r),0), grossTotal = records.reduce((sum,r)=>sum+gross(r),0), deduct = records.reduce((sum,r)=>sum+deductions(r)+pension(r),0);
      return `<section class="view">${v5Title('薪資紀錄',v5Button('複製上月','duplicate-record',state.records.length ? '' : 'disabled')+v5Button('新增薪資','add-record','',true),`${ui.selectedYear} 年 · ${(currentCompany()?.name ? userHtml(currentCompany().name) : '尚未建立公司')}`)}${v5Stats([['淨入帳','$'+money(total)],['主業應發','$'+money(grossTotal)],['扣除含勞退自提','$'+money(deduct)],['已登記',records.length+' <small>筆</small>']])}<div class="v5-toolbar v5-salary-toolbar"><label class="sr-only" for="v5SalaryMonth">薪資月份</label><select class="field-select v5-month-filter" id="v5SalaryMonth"><option value="0">全部月份</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${v5.salaryMonth===i+1?'selected':''}>${i+1} 月</option>`).join('')}</select><div class="search-wrap"><label for="recordSearch" class="sr-only">搜尋薪資</label><input class="field" id="recordSearch" type="search" value="${escapeAttr(ui.search)}" placeholder="搜尋月份、金額或備註"></div>${v5Button('匯出 CSV','export-csv')}</div>
      ${records.length ? `<div class="v5-salary-list">${records.map(r=>{const open=ui.expandedRecords.has(r.id);return `<article class="v5-salary-record"><button class="v5-salary-row" type="button" data-action="toggle-record" data-id="${escapeAttr(r.id)}" aria-expanded="${open}" aria-controls="v5-record-${escapeAttr(r.id)}"><span><b>${r.month} 月薪資</b><small>${escapeHtml(r.payDate || '尚未填入帳日')}</small></span><span class="v5-pay-secondary"><small>主業應發</small><b>$${money(gross(r))}</b></span><span class="v5-pay-secondary"><small>扣除含自提</small><b>$${money(deductions(r)+pension(r))}</b></span><span class="v5-pay-net"><small>淨入帳</small><strong>$${money(combinedNet(r))}</strong></span><span class="v5-expand-label">${open?'收合':'明細'}</span></button><div class="v5-salary-meta"><span>${escapeHtml(reconciliationStatus(r))}</span><div>${v5Button('月結核對','reconcile-record',`data-id="${escapeAttr(r.id)}"`)}${v5Button('編輯','edit-record',`data-id="${escapeAttr(r.id)}"`)}</div></div>${open ? `<div class="v5-salary-detail" id="v5-record-${escapeAttr(r.id)}">${v5SalaryBreakdown(r)}<div class="form-actions"><button class="btn btn-danger btn-small" type="button" data-action="delete-record" data-id="${escapeAttr(r.id)}">刪除這筆薪資</button></div></div>` : ''}</article>`;}).join('')}</div>` : emptyPanel('','尚未有符合的薪資紀錄','登記本月薪資，或調整搜尋條件。',v5Button('新增薪資','add-record','',true))}</section>`;
    };
    const v5SalaryBreakdown = r => {
      const earnings = [['基本薪資',r.baseSalary],['伙食津貼',r.mealAllowance],['職務加給',r.positionAllowance],['加班',r.overtime],['獎金',r.bonus],...(r.customEarnings||[]).map(x=>[x.name?window.SalaryMateI18n.user(x.name):'其他收入',x.amount])];
      const deductionsList = [['勞保',r.laborIns],['健保',r.healthIns],['預扣稅',r.taxWithheld],['其他扣項',r.otherDeduction],['勞退自提',r.pensionSelf],...(r.customDeductions||[]).map(x=>[x.name?window.SalaryMateI18n.user(x.name):'其他扣項',x.amount])];
      return `<div class="details-grid">${[['應發項目',earnings],['扣除項目',deductionsList]].map(([title,items])=>`<div class="breakdown"><h4>${title}</h4>${items.filter(([,n])=>numberValue(n)).map(([name,n])=>`<div class="break-row"><span>${escapeHtml(name)}</span><b>$${money(n)}</b></div>`).join('')||'<p class="hint">無項目</p>'}</div>`).join('')}</div>${r.sideIncome ? `<div class="summary-row"><span>投資收入（舊欄位）</span><b>$${money(r.sideIncome)}</b></div>` : ''}${r.note ? `<p class="v5-record-note">${userHtml(r.note)}</p>` : ''}`;
    };

    const renderV5Calendar = () => {
      const y=Number(ui.selectedYear),m=v5.month,c=currentCompany(),prefix=`${y}-${pad2(m)}`;
      if(!v5.date.startsWith(prefix))v5.date=prefix+'-01';
      const first=new Date(y,m-1,1,12),offset=(first.getDay()+6)%7,days=new Date(y,m,0).getDate(),count=Math.ceil((offset+days)/7)*7;
      const byDate=new Map();
      for(const log of state.overtimeLogs.filter(v5Scope)){if(!byDate.has(log.date))byDate.set(log.date,[]);byDate.get(log.date).push({kind:'overtime',item:log,hours:log.hours});}
      for(const record of state.leaveRecords.filter(v5Scope)){for(const day of leaveDateEntries(record)){if(!byDate.has(day.date))byDate.set(day.date,[]);byDate.get(day.date).push({kind:'leave',item:record,hours:day.hours});}}
      const logs=state.overtimeLogs.filter(x=>v5Scope(x)&&x.date.startsWith(prefix));
      const annual=c?annualLeaveSummary(c,v5.date):null,hours=c?.workHoursPerDay||8,rows=byDate.get(v5.date)||[];
      const cells=Array.from({length:count},(_,i)=>{const d=new Date(y,m-1,i-offset+1,12),date=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate()),events=(byDate.get(date)||[]).filter(r=>r.item.status!=='cancelled');return `<button type="button" class="v5-day ${date===v5.date?'selected':''} ${date===todayIso()?'today':''} ${d.getMonth()!==m-1?'outside':''}" data-v5="day" data-date="${date}" aria-pressed="${date===v5.date}" tabindex="${date===v5.date?0:-1}" aria-label="${date}，${events.length} 筆紀錄"><span class="v5-date-number">${d.getDate()}</span>${events.slice(0,2).map(r=>`<span class="v5-calendar-tag ${r.kind} ${r.item.status==='planned'?'planned':''}">${r.kind==='leave'?escapeHtml(leaveTypeName(r.item.type)):'加班'} ${rateNumber(r.hours)}h</span>`).join('')}${events.length>2?`<small>另 ${events.length-2} 筆</small>`:''}</button>`;}).join('');
      return `<section class="view">${v5Title('工作日曆',v5Button('記加班','add-overtime')+v5Button('記請假','add-leave','',true))}${v5Tabs([['calendar','月曆'],['overtime','加班紀錄'],['leave','請假紀錄'],['comp','補休帳本']],'calendar','work-tab')}${v5Stats([['本月加班',rateNumber(logs.reduce((s,l)=>s+l.hours,0))+' <small>小時</small>','按日曆月份'],['加班費試算','$'+money(overtimeTotal(logs))],['可用特休',annual?.configured&&annual.limited?rateNumber(annual.remaining*hours)+' <small>小時</small>':'待設定'],['預留特休',annual?rateNumber(annual.reserved*hours)+' <small>小時</small>':'—']])}
      <div class="v5-calendar-layout"><section><div class="v5-calendar-top"><div class="v5-month-controls"><h3>${y} 年 ${m} 月</h3><button type="button" class="btn btn-small" data-v5="month" data-step="-1" aria-label="上一月">上一月</button><button type="button" class="btn btn-small" data-v5="today">今天</button><button type="button" class="btn btn-small" data-v5="month" data-step="1" aria-label="下一月">下一月</button></div><div class="v5-legend"><span>加班</span><span>請假</span></div></div><div class="v5-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(x=>`<span>${x}</span>`).join('')}</div><div class="v5-calendar-grid" role="group" aria-label="選擇日期">${cells}</div><p class="hint">點日期查看紀錄。虛線代表預計請假；薪資歸屬依公司計薪區間。</p></section><aside class="v5-agenda"><div class="section-title"><h3>${Number(v5.date.slice(5,7))} 月 ${Number(v5.date.slice(8))} 日</h3><span>${['週日','週一','週二','週三','週四','週五','週六'][new Date(v5.date+'T12:00:00').getDay()]}</span></div>${rows.length?rows.map(v5DayRow).join(''):'<div class="v5-quiet-empty">這天還沒有紀錄。</div>'}<div class="v5-day-actions">${v5Button('記加班','add-overtime')}${v5Button('記請假','add-leave')}</div><div class="v5-leave-balance"><h3>特休額度</h3>${annual?.configured?`<p class="hint">${annual.start} ～ ${annual.end} 前</p><dl><dt>核定／試算額度</dt><dd>${annual.limited?rateNumber(annual.entitlement*hours)+' 小時':'不設上限'}</dd><dt>已確認</dt><dd>${rateNumber(annual.used*hours)} 小時</dd><dt>預留</dt><dd>${rateNumber(annual.reserved*hours)} 小時</dd><dt>可用</dt><dd>${annual.limited?rateNumber(annual.remaining*hours)+' 小時':'不設上限'}</dd></dl>`:'<p class="hint">請先設定公司到職日與特休規則。</p>'}${c?v5Button('調整假別與額度','v5-leave-settings',`data-id="${escapeAttr(c.id)}"`):v5Button('建立公司','add-company-basic')}</div></aside></div></section>`;
    };

    const renderV5Attendance = () => {
      const active=v5.attendanceTab,leave=active==='leave';ui.attendanceTab=leave?'leave':'overtime';
      const tabs=v5Tabs([['calendar','月曆'],['overtime','加班紀錄'],['leave','請假紀錄'],['comp','補休帳本']],active,'work-tab');
      const body=active==='comp'?renderCompTimePanel():leave?renderLeavePanel():renderOvertimePanel();
      return `<section class="view">${v5Title(active==='comp'?'補休帳本':leave?'請假紀錄':'加班紀錄',active==='comp'?'':attendancePageActions())}${tabs}<div class="v5-work-list">${body}</div></section>`;
    };
    const renderV5Annual = () => {
      const stats=annualStats(), rows=filteredRecords(), c=currentCompany();
      if(v5.annualTab==='tax')return `<section class="view">${v5Title('年度對帳',v5Button('匯出薪資 CSV','export-csv'))}${v5AnnualMenu('tax')}<div class="v5-tax-body">${renderTax()}</div></section>`;
      return `<section class="view">${v5Title('年度總覽',v5Button('預覽報表','preview-annual-report')+v5Button('下載 CSV','export-annual-report'),`${ui.selectedYear} 年 · ${(c?.name ? userHtml(c?.name) : escapeHtml('尚未建立公司'))}`)}${v5AnnualMenu('overview')}${v5Stats([['薪資淨入帳','$'+money(stats.combinedNet)],['主業應發','$'+money(stats.gross)],['薪資扣除','$'+money(stats.deductions)],['薪資筆數',rows.length+' <small>筆</small>']])}
      <div class="v5-setting-row"><div><h3>個人投資收入</h3><p>全公司共用 · ${ui.selectedYear} 年實收 $${investmentMoney(investmentTotal())}</p></div><button type="button" class="btn" data-tab="investment">查看收入</button></div><div class="section-title"><h3>月份總覽</h3><span class="hint">未登記月份不當作零收入</span></div><div class="v5-month-grid">${Array.from({length:12},(_,i)=>{const r=rows.filter(x=>x.month===i+1);return `<button type="button" data-v5="salary-month" data-month="${i+1}" class="v5-month-tile"><span>${i+1} 月</span><strong>${r.length?'$'+money(r.reduce((s,x)=>s+combinedNet(x),0)):'未登記'}</strong><small>${r.length?r.length+' 筆薪資':'新增或查看薪資'}</small></button>`;}).join('')}</div>${renderAnnualAnalysis()}</section>`;
    };
    const renderV5Tools = () => `<section class="view">${v5Title('試算與調薪')}${v5AnnualMenu('tools')}<div class="v5-tools-body">${renderHourly()}</div></section>`;

    const renderV5Settings = () => {
      const c=currentCompany();
      const settingRow=(title,detail,action,label='開啟',extra='')=>`<div class="v5-setting-row"><div><h3>${title}</h3><p>${detail}</p></div>${v5Button(label,action,extra)}</div>`;
      return `<section class="view">${v5Title('設定')}<div class="v5-settings-columns"><div><details class="v5-settings-section v5-settings-disclosure"><summary class="v5-settings-summary"><span class="v5-group-title">工作與公司</span></summary><div class="v5-settings-content">${settingRow('公司管理',c?`${userHtml(c.name)} · 共 ${state.companies.length} 家公司`:'建立任職公司與薪資基礎','manage-companies')}${settingRow('薪資規則','本薪、津貼、扣項與計薪區間','company-salary-rules','設定',`data-id="${escapeAttr(c?.id||'')}" ${c?'':'disabled'}`)}${settingRow('特休與假別','到職日、假別額度與每日標準工時','v5-leave-settings','設定',`data-id="${escapeAttr(c?.id||'')}" ${c?'':'disabled'}`)}</div></details><details class="v5-settings-section v5-settings-disclosure"><summary class="v5-settings-summary"><span class="v5-group-title">顯示與操作</span></summary><div class="v5-settings-content"><label class="v5-language-setting"><span>介面語言</span><select class="field-select" data-language-preference><option value="auto">跟隨系統</option><option value="zh">繁體中文</option><option value="en">English</option></select></label>${settingRow('版面設定',escapeHtml(INTERFACE_STYLES[normalizeInterfaceStyle(ui.interfaceStyle)].name)+' · 介面風格、文字與密度、重點色','open-interface-settings','調整')}</div></details></div><div><details class="v5-settings-section v5-settings-disclosure"><summary class="v5-settings-summary"><span class="v5-group-title">資料管理</span></summary><div class="v5-settings-content">${settingRow('備份全部資料','一般 JSON 或密碼加密備份，包含薪資與全部投資資料','export-json','下載')}${settingRow('匯入備份','一般、加密或 SmartPortfolio 備份；可選覆蓋或新增','restore-backup-file','選擇檔案')}${settingRow('自己的 Google Drive','<span data-google-summary>'+escapeHtml(window.SalaryMateCloud?.summary()||'儲存至自己的 Google Drive，可選密碼加密')+'</span>','open-google-drive','開啟')}${settingRow('匯出報表','薪資、請假及出勤分析 CSV','v5-export-options','選擇報表')}${settingRow('資料檢查','檢查公司關聯、重複紀錄與補休餘額','data-health','檢查')}</div></details><details class="v5-settings-section v5-settings-disclosure"><summary class="v5-settings-summary"><span class="v5-group-title">說明</span></summary><div class="v5-settings-content">${settingRow('授權、隱私與試算','資料保存方式、授權文字與試算範圍','open-legal','閱讀')}<p class="hint">v5.0.0-dev.2-R83 · 全介面開發版<br>v5 資料獨立保存。可手動匯入薪資備份，原版本的資料仍保留。</p><details class="v5-cleanup"><summary>清除這個版本的資料</summary><p class="hint">請先匯出備份；只清除目前 v5 完整版的資料。</p>${v5Button('清除本機資料','clear-data')}</details></div></details></div></div></section>`;
    };
    const renderV5Companies = () => `<div class="v5-breadcrumb"><button type="button" data-tab="settings">設定</button><span>／ 公司管理</span></div>${renderCompanies()}`;
    const openV5LeaveSettings = id => {
      const c=getCompany(id)||currentCompany();if(!c)return openCompanyBasicForm();
      const policy=normalizeLeavePolicies(c.leavePolicies).annual;
      beginDraftScope({entityType:'v5-leave-settings',companyId:c.id,entityId:c.id,operational:false});
      openDialog('特休與假別設定',`<form id="v5LeaveSettingsForm"><input type="hidden" name="companyId" value="${escapeAttr(c.id)}"><p class="v5-form-context">${userHtml(c.name)}</p><div class="form-grid"><label><span class="field-label">到職日</span><input class="field" type="date" name="employmentStartDate" value="${escapeAttr(c.employmentStartDate)}"></label><label><span class="field-label">每日標準工時</span><input class="field" type="number" name="workHoursPerDay" value="${c.workHoursPerDay}" min="1" max="24" step="0.5" required></label><label class="span-2"><span class="field-label">特休額度方式</span><select class="field-select" name="quotaMode">${[['custom','填入公司核定額度'],['auto','依到職日與現有規則估算']].map(([v,t])=>`<option value="${v}" ${policy.mode===v?'selected':''}>${t}</option>`).join('')}</select></label><label><span class="field-label">核定額度（小時）</span><input class="field" type="number" name="quotaHours" min="0" max="8760" step="0.5" value="${policy.quotaDays*c.workHoursPerDay}"><span class="hint">選擇公司核定額度時使用。</span></label><label><span class="field-label">公司核定週期</span><select class="field-select" name="leaveQuotaCycle"><option value="calendar" ${c.leaveQuotaCycle!=='anniversary'?'selected':''}>曆年 1～12 月</option><option value="anniversary" ${c.leaveQuotaCycle==='anniversary'?'selected':''}>到職週年</option></select></label></div><p class="hint">自動估算依到職週期，結果請核對公司核定額度。修改標準工時會影響按天登記的請假換算。</p><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">返回</button><button class="btn btn-primary" type="submit">儲存設定</button></div></form>`);
    };
    const v5Clean = root => {
      if(!root?.querySelectorAll)return;
      root.querySelectorAll('.metric-icon,.empty-icon,.search-mark,.mode-preview,.theme-check').forEach(el=>el.remove());
      root.querySelectorAll('.soft-badge').forEach(el=>{if(/^(CM-\d+|Step \d+|Transaction)$/.test(el.textContent.trim()))el.remove();});
      root.querySelectorAll('button').forEach(el=>{for(const n of el.childNodes){if(n.nodeType===3)n.textContent=n.textContent.replace(/^\s*[＋←▣◫▦⬇⬆✓⌫]\s*/,'');}});
      root.querySelectorAll('table').forEach(table=>{if(!table.parentElement.classList.contains('table-scroll'))return;const headers=Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());table.querySelectorAll('tbody tr').forEach(tr=>{if(tr.children.length===headers.length)Array.from(tr.children).forEach((td,i)=>td.dataset.label=headers[i]);});});
      root.querySelectorAll('.notice.warning').forEach(el=>{if(el.id||el.closest('details')||el.querySelector('button,input')||el.textContent.length<150)return;const box=document.createElement('details');box.className='v5-explanation';const summary=document.createElement('summary');summary.textContent='計算方式與適用範圍';el.replaceWith(box);box.append(summary,el);});
    };

        const investmentMoney = amount => Number(amount).toLocaleString('zh-TW',{maximumFractionDigits:2});
    const investmentRows = () => state.investmentRecords.filter(r=>Number(r.date.slice(0,4))===Number(ui.selectedYear)).sort((a,b)=>b.date.localeCompare(a.date));
    const legacyInvestmentTotal = () => investmentRows().reduce((sum,r)=>sum+r.amount,0);
    const stockPortfolioModel = () => {
      const today=todayIso(),year=Number(ui.selectedYear),portfolio=state.stockPortfolio,cached=calculationCache.stockModels.get('current');
      if (cached?.portfolio===portfolio&&cached.year===year&&cached.today===today) return cached.result;
      const result=window.SalaryMateStocks.calculate(portfolio,year,today);
      calculationCache.stockModels.set('current',{portfolio,year,today,result});
      return result;
    };
    const investmentTotal = () => legacyInvestmentTotal()+stockPortfolioModel().yearDividends;
    const stocksUI = window.SalaryMateStocksUI.create({
      state:()=>state,year:()=>ui.selectedYear,today:()=>todayIso(),id:prefix=>newId(prefix),legacyTotal:legacyInvestmentTotal,model:stockPortfolioModel,
      begin:scope=>beginDraftScope(scope),assert:scope=>assertDraftScope(scope),open:(...args)=>openDialog(...args),close:()=>closeDialog(),
      validate:form=>validateNativeForm(form),error:(...args)=>showValidationSummary(...args),commit:(...args)=>commitStateMutation(...args),
      confirm:(...args)=>confirm(...args),render:()=>renderAll(),toast:(...args)=>toast(...args),
      csv:(rows,name)=>downloadBlob(window.SalaryMateAnnual.csv(rows),'text/csv;charset=utf-8',name),
      downloadJSON:(value,name)=>downloadBlob(JSON.stringify(value,null,2),'application/json',name)
    });
    const renderV5Investment = () => stocksUI.render(renderInvestmentIncome());
    const renderInvestmentIncome = () => {
      const rows=investmentRows(),total=legacyInvestmentTotal();
      return `<section class="view">${v5Title('投資收入',v5Button('新增收入','add-investment','',true),`${ui.selectedYear} 年 · 個人收入，不受公司篩選影響`)}${v5Stats([['年度實收','$'+investmentMoney(total)],['收入筆數',rows.length+' 筆']])}<div class="v5-month-grid">${Array.from({length:12},(_,i)=>{const entries=rows.filter(r=>Number(r.date.slice(5,7))===i+1);return `<div class="v5-month-tile"><span>${i+1} 月</span><strong>${entries.length?'$'+investmentMoney(entries.reduce((s,r)=>s+r.amount,0)):'未登記'}</strong></div>`;}).join('')}</div><div class="section-title"><h3>收入明細</h3>${v5Button('匯出 CSV','export-investment')}</div>${rows.map(r=>`<article class="v5-setting-row"><div><h3>${userHtml(r.name)}</h3><p>${escapeHtml(r.date)} · ${escapeHtml(r.kind)}${r.note?' · '+userHtml(r.note):''}</p><strong>$${investmentMoney(r.amount)}</strong></div><div class="page-actions">${v5Button('編輯','edit-investment',`data-id="${escapeAttr(r.id)}"`)}${v5Button('刪除','delete-investment',`data-id="${escapeAttr(r.id)}"`)}</div></article>`).join('')||'<div class="v5-quiet-empty">記錄已收到的股息、配息、利息或已實現損益。</div>'}</section>`;
    };
    const openInvestment = (id='') => {
      const r=state.investmentRecords.find(r=>r.id===id)||{id:'',date:todayIso(),name:'',kind:'股息／配息',amount:0,note:''};
      beginDraftScope({entityType:'investment',entityId:r.id,companyId:'',operational:false});
      openDialog(r.id?'編輯投資收入':'新增投資收入',`<form id="investmentForm" data-id="${escapeAttr(r.id)}"><div class="form-grid"><label><span class="field-label">入帳日期</span><input class="field" name="date" type="date" required value="${escapeAttr(r.date)}"></label><label><span class="field-label">收入類型</span><select class="field-select" name="kind">${['股息／配息','利息','已實現損益','其他','舊副業收入'].map(k=>`<option ${k===r.kind?'selected':''}>${k}</option>`).join('')}</select></label><label class="span-2"><span class="field-label">標的／名稱</span><input class="field" name="name" maxlength="80" required value="${escapeAttr(r.name)}" placeholder="例如：00878、定存利息"></label><label class="span-2"><span class="field-label">實收金額（新臺幣）</span><input class="field" name="amount" type="number" step="0.01" required value="${r.amount}"><span class="hint">扣除費用後的實收；已實現虧損可填負數。</span></label><label class="span-2"><span class="field-label">備註</span><input class="field" name="note" maxlength="200" value="${escapeAttr(r.note)}"></label></div><div class="form-actions"><button type="button" class="btn" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">儲存收入</button></div></form>`);
    };
    const saveInvestment = form => {
      if(!validateNativeForm(form))return;
      const id=form.dataset.id;
      if(!assertDraftScope({entityType:'investment',entityId:id,companyId:'',operational:false}))return;
      const d=new FormData(form),amount=Number(d.get('amount')),date=String(d.get('date')),name=String(d.get('name')).trim();
      if(!validIsoDate(date)||!name||!Number.isFinite(amount))return showValidationSummary(form,'請確認日期、名稱與實收金額。');
      const row={id:id||newId('investment'),date,name,kind:String(d.get('kind')),amount:Math.round(amount*100)/100,note:String(d.get('note')).trim()};
      if(commitStateMutation(()=>{const i=state.investmentRecords.findIndex(r=>r.id===id);if(i<0)state.investmentRecords.push(row);else state.investmentRecords[i]={...state.investmentRecords[i],...row};},'投資收入未儲存，原資料保持不變。')){closeDialog();renderAll();toast('投資收入已儲存');}
    };
    const deleteInvestment = id => confirm('刪除投資收入','確定刪除這筆收入？其他紀錄不受影響。',()=>{if(commitStateMutation(()=>{state.investmentRecords=state.investmentRecords.filter(r=>r.id!==id);})){closeDialog();renderAll();toast('已刪除');}},'刪除');

    const renderView = () => {
      window.SalaryMateCompanion?.stop();
      const renderers = { dashboard: renderV5Home, investment: renderV5Investment, records: renderV5Salary, calendar: renderV5Calendar, overtime: renderV5Attendance, hourly: renderV5Tools, tax: renderV5Annual, settings: renderV5Settings, companies: renderV5Companies };
      document.body.dataset.page = ui.tab;
      const globalState = renderAppStatePanel();
      const invalidBlocked = runtimeState.dataStatus === 'invalid' && !['companies','investment'].includes(ui.tab);
      const content = ['loading', 'failure'].includes(runtimeState.dataStatus) || invalidBlocked
        ? globalState
        : `${renderOperationNotice()}${(renderers[ui.tab] || renderDashboard)()}`;
      $('#mainContent').innerHTML = content;
      enhanceFormAccessibility($('#mainContent'));
      v5Clean($('#mainContent'));
      enhanceVisualHierarchy($('#mainContent'));
      window.SalaryMateI18n.apply($('#mainContent'));
      window.SalaryMateI18n.apply($('.topbar'));
      $$('.tab-btn').forEach((button) => {
        const active = button.dataset.tab === ({overtime:'calendar',hourly:'tax',companies:'settings'}[ui.tab] || ui.tab);
        button.classList.toggle('active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
      });
    };

    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-v5]');if(!button)return;
      const action=button.dataset.v5;
      if(action==='day'){
        v5.date=button.dataset.date;const p=parseDateParts(v5.date);v5.month=p.month;ui.selectedYear=p.year;renderFilters();renderView();$(`[data-v5="day"][data-date="${v5.date}"]`)?.focus({preventScroll:true});
      }else if(action==='month'){
        const d=new Date(Number(ui.selectedYear),v5.month-1+Number(button.dataset.step),1,12);if(d.getFullYear()<1900||d.getFullYear()>2199)return;ui.selectedYear=d.getFullYear();v5.month=d.getMonth()+1;v5.date=isoDate(ui.selectedYear,v5.month,1);renderAll();
      }else if(action==='today'){
        v5.date=todayIso();v5.month=Number(v5.date.slice(5,7));ui.selectedYear=Number(v5.date.slice(0,4));renderAll();
      }else if(action==='work-tab'){
        if(button.dataset.value==='calendar')selectPrimaryTab('calendar');else{v5.attendanceTab=button.dataset.value;ui.attendanceTab=v5.attendanceTab==='leave'?'leave':'overtime';if(!ui.overtimeMonth)ui.overtimeMonth=v5.month;if(!ui.leaveMonth)ui.leaveMonth=v5.month;selectPrimaryTab('overtime');}
      }else if(action==='annual-tab'){
        if(hasDirtyDraft()){toast('請先儲存目前的試算變更。','error');return;}
        if(button.dataset.value==='tools')selectPrimaryTab('hourly');else{v5.annualTab=button.dataset.value;selectPrimaryTab('tax');}
      }else if(action==='salary-month'){
        v5.salaryMonth=Number(button.dataset.month);ui.search='';selectPrimaryTab('records');
      }else if(action==='quick-hours'){
        const input=$('#overtimeForm [name="hours"]');if(input){input.value=button.dataset.value;updateOvertimePreview();markDraftDirty();}
      }
    });
    document.addEventListener('change',event=>{if(event.target.id==='v5SalaryMonth'){v5.salaryMonth=Number(event.target.value);renderView();}});
    document.addEventListener('keydown',event=>{
      const button=event.target.closest?.('[data-v5="day"]');if(!button)return;
      const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!step)return;event.preventDefault();
      const d=new Date(button.dataset.date+'T12:00:00');d.setDate(d.getDate()+step);if(d.getFullYear()<1900||d.getFullYear()>2199)return;v5.date=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate());v5.month=d.getMonth()+1;ui.selectedYear=d.getFullYear();renderAll();$(`[data-v5="day"][data-date="${v5.date}"]`)?.focus({preventScroll:true});
    });
    document.addEventListener('submit',event=>{
      if(event.target.id!=='v5LeaveSettingsForm')return;event.preventDefault();const form=event.target;if(!validateNativeForm(form))return;
      const data=new FormData(form),c=getCompany(data.get('companyId'));if(!c)return;
      if(!assertDraftScope({entityType:'v5-leave-settings',companyId:c.id,entityId:c.id,operational:false}))return;
      const hours=Number(data.get('workHoursPerDay')),quotaHours=Number(data.get('quotaHours')),start=String(data.get('employmentStartDate')||''),mode=String(data.get('quotaMode'));
      if((start&&!validIsoDate(start))||!Number.isFinite(hours)||hours<1||hours>24||!Number.isFinite(quotaHours)||quotaHours<0||!['auto','custom'].includes(mode)){showValidationSummary(form,'請確認日期、標準工時與特休額度。');return;}
      if((mode==='auto'||data.get('leaveQuotaCycle')==='anniversary')&&!start){showValidationSummary(form,'使用到職週期前，請先填寫到職日。');return;}
      const next=normalizeCompany({...c,employmentStartDate:start,workHoursPerDay:hours,leaveQuotaCycle:data.get('leaveQuotaCycle'),leavePolicies:{...c.leavePolicies,annual:{mode,quotaDays:mode==='custom'?quotaHours/hours:0}}});
      const ok=commitStateMutation(()=>{state.companies[state.companies.findIndex(x=>x.id===c.id)]=next;},'特休設定未儲存，原資料保持不變。','v5-leave-settings:'+c.id);
      if(ok){closeDialog();renderAll();toast('特休設定已儲存');}
    });

    const renderAll = () => {
      applyVisualPreferences();
      document.body.dataset.dataState = runtimeState.dataStatus;
      $('#mainContent')?.setAttribute('aria-busy', ['loading'].includes(runtimeState.dataStatus) || runtimeState.operationStatus === 'submitting' ? 'true' : 'false');
      renderFilters();
      renderView();
    };

    const defaultPayDate = (year, month) => {
      const date = new Date(Number(year), Number(month), 5);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-05`;
    };

    const blankRecord = () => {
      const company = currentCompany();
      const month = new Date().getMonth() + 1;
      const draft = normalizeRecord({
        id: newId('record'), companyId: company?.id || '', year: ui.selectedYear, month,
        payDate: defaultPayDate(ui.selectedYear, month), baseSalary: company?.baseSalary || 0,
        mealAllowance: company?.mealAllowance || 0, laborIns: company?.laborIns || 0,
        healthIns: company?.healthIns || 0, taxWithheld: company?.taxWithheld || 0
      });
      return applyCompanyDefaultsToRecord(draft, company);
    };

    const dialogShell = (title, body, footer = '') => `<div class="dialog-head"><h3 id="dialogTitle">${escapeHtml(title)}</h3><button class="close-btn" type="button" data-action="close-dialog" aria-label="關閉">關閉</button></div><div class="dialog-body">${body}</div>${footer}`;

    let dialogReturnFocus = null;
    let dialogReturnScrollY = 0;
    const afterPaint = (callback) => typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(callback)
      : setTimeout(callback, 0);

    const openDialog = (title, body, wide = false, footer = '') => {
      window.SalaryMateCompanion?.stop();
      const dialog = $('#appDialog');
      const opening = !dialog.open;
      if (opening) {
        dialogReturnFocus = document.activeElement && typeof document.activeElement.focus === 'function' ? document.activeElement : null;
        dialogReturnScrollY = Number(window.scrollY) || 0;
      }
      dialog.classList.toggle('wide', wide);
      dialog.classList.remove('interface-settings-dialog');
      $('#dialogContent').innerHTML = dialogShell(title, body, footer);
      if (opening) {
        dialog.showModal();
        captureDialogBaseline();
      }
      const coarsePointer = Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
      const focusTarget = coarsePointer
        ? $('.close-btn')
        : $('.dialog-body input, .dialog-body select, .dialog-body button:not(.close-btn)');
      enhanceFormAccessibility(dialog);
      v5Clean(dialog);
      enhanceVisualHierarchy(dialog);
      window.SalaryMateI18n.apply(dialog);
      focusTarget?.focus({ preventScroll: true });
    };

    const dialogFocusableElements = () => $$(FOCUSABLE_SELECTOR, $('#appDialog')).filter((element) => !element.hidden && !element.closest?.('[hidden]') && element.getAttribute('aria-hidden') !== 'true');
    const trapDialogFocus = (event) => {
      if (event.key !== 'Tab') return;
      const dialog = $('#appDialog');
      if (!dialog.open) return;
      const focusables = dialogFocusableElements();
      if (!focusables.length) { event.preventDefault(); dialog.focus?.(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    const dialogFormFingerprint = () => {
      const form = $('#dialogContent form');
      if (!form) return '';
      const data = new FormData(form);
      return JSON.stringify(Array.from(data.entries()).sort(([a], [b]) => String(a).localeCompare(String(b))));
    };
    const captureDialogBaseline = () => { ui.dialogBaseline = dialogFormFingerprint(); };
    const dialogHasUnsavedChanges = () => Boolean(ui.dialogBaseline && dialogFormFingerprint() && dialogFormFingerprint() !== ui.dialogBaseline);
    const requestCloseDialog = () => {
      if (dialogHasUnsavedChanges() && !window.confirm('尚有未儲存變更。要放棄變更嗎？')) return;
      closeDialog();
    };

    const closeDialog = () => {
      const dialog = $('#appDialog');
      const active = document.activeElement;
      if (dialog.contains?.(active) && typeof active?.blur === 'function') active.blur();
      if (dialog.open) dialog.close();
      ui.confirmAction = null;
      ui.dialogBaseline = '';
      const closingScope = ui.draftScope;
      clearDraftScope();
      if (closingScope?.entityType === 'payroll') { ui.recordDraft = null; ui.payrollStep = 1; }
      else if (closingScope?.entityType === 'overtime') ui.overtimeDraft = null;
      else if (closingScope?.entityType === 'leave') ui.leaveDraft = null;
      else if (closingScope?.entityType === 'salary-adjustment') ui.salaryAdjustmentDraft = null;
      else if (closingScope?.entityType === 'payroll-cycle') ui.payrollCycleDraft = null;
      afterPaint(() => afterPaint(() => {
        window.scrollTo?.({ top: dialogReturnScrollY, left: 0, behavior: 'auto' });
        const returnTarget = dialogReturnFocus && dialogReturnFocus.isConnected !== false ? dialogReturnFocus : $('#mainContent');
        returnTarget?.focus?.({ preventScroll: true });
        dialogReturnFocus = null;
      }));
    };

    const interfaceStylePreview = (key, style) => style.reference || style.ornate
      ? `<span class="v5-style-preview v5-reference-preview" data-preview-style="${key}" aria-hidden="true"><span class="v5-preview-heading">${visualIcon('wallet')}<b>薪資與投資</b></span><span class="v5-preview-money"><small>淨入帳</small><strong>$ —</strong></span>${style.baseStyle === 'pixel' ? hd2dCompanion('preview') : ''}<span class="v5-preview-notes"><i></i><i></i><i></i></span><span class="v5-preview-tags"><b>薪資</b><b>投資</b><b>日曆</b></span></span>`
      : `<span class="v5-style-preview" data-preview-style="${key}" aria-hidden="true"><span class="v5-style-preview-nav"></span><span class="v5-style-preview-card"><i></i><i></i><i></i></span><span class="v5-style-preview-card"><i></i><i></i></span></span>`;
    const interfaceStyleChoicesHtml = () => `<fieldset class="v5-style-fieldset"><legend>介面風格</legend><p class="hint">點選預覽立即套用華麗風格，可搭配重點色與背景效果。</p>${[['ornate','華麗風格'],['classic','原有風格']].map(([group,title]) => `<h4 class="v5-style-group-title">${title}</h4><div class="v5-style-options">${Object.entries(INTERFACE_STYLES).filter(([,style]) => (style.ornate || style.reference ? 'ornate' : 'classic') === group).map(([key, style]) => `<label class="v5-style-choice"><input type="radio" name="interfaceStyle" value="${key}" ${ui.interfaceStyle === key ? 'checked' : ''}>${interfaceStylePreview(key, style)}<span class="v5-style-choice-title">${style.name}</span><span class="v5-style-choice-note">${style.note}</span><span class="v5-style-selection">${ui.interfaceStyle === key ? '使用中' : '選用'}</span></label>`).join('')}</div>`).join('')}</fieldset>`;
    const hd2dBackgroundChoicesHtml = () => interfaceBaseStyle(ui.interfaceStyle) !== 'pixel' ? '' : `<fieldset class="v5-background-fieldset"><legend>背景設定</legend><p class="hint">點選場景立即套用，會記住這次選擇。</p><div class="v5-background-options">${Object.entries(HD2D_BACKGROUNDS).map(([key, scene]) => `<label class="v5-background-choice"><input type="radio" name="hd2dBackground" value="${key}" ${ui.hd2dBackground === key ? 'checked' : ''}><span class="v5-background-preview" data-background-preview="${key}" aria-hidden="true"></span><span class="v5-background-name">${scene.name}</span><span class="v5-background-note">${scene.note}</span><span class="v5-background-selection">${ui.hd2dBackground === key ? '使用中' : '選用'}</span></label>`).join('')}</div></fieldset>`;
    const surfaceMotionInfoHtml = () => {
      if (ui.surfaceOpacity === 'multi-dynamic') return '<p class="v5-motion-composite-note">選單加入光感動態，背景保留流光、光環、粒子與流星層次。</p>';
      if (ui.surfaceOpacity === 'dynamic') return '<p class="v5-motion-composite-note">主選單、分頁與展開選單會套用動態回饋。</p>';
      return '';
    };
    const surfaceOpacityChoicesHtml = () => `<fieldset class="v5-opacity-fieldset"><legend>背景與效果</legend><div class="v5-opacity-options">${[['translucent','半透明','保留淡色底，背景仍可見'],['frosted','霧面','靜態霧面，模糊背景'],['dynamic','動態','選單滑入、切換與點選動畫'],['multi-dynamic','多樣式動態效果','選單光感動畫與多層背景特效']].map(([key,title,note])=>`<label class="v5-opacity-choice"><input type="radio" name="surfaceOpacity" value="${key}" ${ui.surfaceOpacity===key?'checked':''}><b>${title}</b><span>${note}</span><small>${ui.surfaceOpacity===key?'使用中':'選用'}</small></label>`).join('')}</div>${surfaceMotionInfoHtml()}<p class="hint">動態模式會套用選單動畫；開啟減少動態效果時會停止動畫。</p></fieldset>`;
    const interfaceSettingsHtml = () => `<div class="v5-preferences">${interfaceStyleChoicesHtml()}${hd2dBackgroundChoicesHtml()}${surfaceOpacityChoicesHtml()}<h4>文字與密度</h4><div class="v5-choice-list" role="radiogroup" aria-label="文字與密度">${[['minimal','標準','一般字體與舒適間距'],['compact','緊湊','較小字體、縮短列高，顯示更多紀錄'],['large','大字','文字放大 25%，按鈕與間距一起加大']].map(([key,title,note])=>`<button type="button" role="radio" aria-checked="${ui.interfaceMode===key||key==='minimal'&&ui.interfaceMode==='standard'}" class="v5-preference-choice" data-action="set-interface-mode" data-mode="${key}"><span class="v5-mode-description"><b>${title}</b><span>${note}</span></span><span class="v5-mode-demo ${key}" aria-hidden="true"><span>薪資紀錄 <strong>$48,000</strong></span><span>加班紀錄 <strong>8 小時</strong></span></span><span class="v5-mode-selected">${ui.interfaceMode===key||key==='minimal'&&ui.interfaceMode==='standard'?'使用中':'選用'}</span></button>`).join('')}</div><h4>重點色</h4><div class="v5-theme-options" role="radiogroup" aria-label="重點色">${['slate','blue','teal','pink','violet','amber','rose'].map(key=>`<button class="btn" type="button" role="radio" aria-checked="${ui.colorTheme===key}" data-action="set-color-theme" data-theme="${key}"><span class="v5-accent-dot" style="--swatch:${COLOR_THEMES[key].color}" aria-hidden="true"></span>${COLOR_THEMES[key].name}</button>`).join('')}</div></div>`;

    const openInterfaceSettings = () => {
      const dialog = $('#appDialog');
      if (dialog.open && dialog.classList.contains('interface-settings-dialog')) {
        const body = dialog.querySelector('.dialog-body');
        const scrollTop = body.scrollTop;
        body.innerHTML = interfaceSettingsHtml();
        enhanceFormAccessibility(body);
        v5Clean(body);
        enhanceVisualHierarchy(body);
        window.SalaryMateI18n.apply(body);
        body.scrollTop = scrollTop;
        return;
      }
      openDialog('版面設定', interfaceSettingsHtml(), true, '<div class="dialog-footer"><button class="btn btn-primary" type="button" data-action="close-dialog">完成</button></div>');
      dialog.classList.add('interface-settings-dialog');
    };

    const setInterfaceStyle = value => {
      const before = ui.interfaceStyle;
      const next = normalizeInterfaceStyle(value);
      if (next === before) return;
      const saved = commitStateMutation(() => { ui.interfaceStyle = next; });
      if (!saved) ui.interfaceStyle = before;
      renderAll();
      openInterfaceSettings();
      $(`input[name="interfaceStyle"][value="${ui.interfaceStyle}"]`)?.focus({ preventScroll: true });
      if (saved) toast('介面風格已儲存');
    };

    const setSurfaceOpacity = value => {
      const before = ui.surfaceOpacity;
      const next = normalizeSurfaceOpacity(value);
      if (next === before) return;
      const dialog = $('#appDialog');
      const scrollTop = dialog?.scrollTop || 0;
      const saved = commitStateMutation(() => { ui.surfaceOpacity = next; });
      if (!saved) ui.surfaceOpacity = before;
      renderAll();
      openInterfaceSettings();
      if (dialog) dialog.scrollTop = scrollTop;
      $(`input[name="surfaceOpacity"][value="${ui.surfaceOpacity}"]`)?.focus({ preventScroll: true });
      if (saved) toast('背景與效果已儲存');
    };

    const setHd2dBackground = value => {
      if (interfaceBaseStyle(ui.interfaceStyle) !== 'pixel') return;
      const before = ui.hd2dBackground;
      const next = normalizeHd2dBackground(value);
      if (next === before) return;
      const dialog = $('#appDialog');
      const scrollTop = dialog?.scrollTop || 0;
      const saved = commitStateMutation(() => { ui.hd2dBackground = next; });
      if (!saved) ui.hd2dBackground = before;
      renderAll();
      openInterfaceSettings();
      if (dialog) dialog.scrollTop = scrollTop;
      $(`input[name="hd2dBackground"][value="${ui.hd2dBackground}"]`)?.focus({ preventScroll: true });
      if (saved) toast('背景已儲存');
    };

    const setInterfaceMode = (value) => {
      const nextMode = normalizeInterfaceMode(value);
      const before = ui.interfaceMode;
      if (nextMode === before) return;
      const dialog = $('#appDialog');
      const body = dialog.querySelector('.dialog-body');
      const choice = dialog.querySelector(`[data-action="set-interface-mode"][data-mode="${nextMode}"]`);
      const offset = body && choice ? choice.getBoundingClientRect().top - body.getBoundingClientRect().top : null;
      const saved = commitStateMutation(() => { ui.interfaceMode = nextMode; });
      if (!saved) ui.interfaceMode = before;
      renderAll();
      // Keep the native scroll container and touched controls alive during a density change.
      dialog.querySelectorAll('[data-action="set-interface-mode"]').forEach(button => {
        const selected = button.dataset.mode === ui.interfaceMode || button.dataset.mode === 'minimal' && ui.interfaceMode === 'standard';
        button.setAttribute('aria-checked', String(selected));
        button.querySelector('.v5-mode-selected').textContent = selected ? '使用中' : '選用';
      });
      window.SalaryMateI18n.apply(dialog);
      if (offset !== null) body.scrollTop += choice.getBoundingClientRect().top - body.getBoundingClientRect().top - offset;
      if (saved) toast(`已切換為「${INTERFACE_MODES[nextMode].name}」`);
    };

    const setColorTheme = (value) => {
      const nextTheme = normalizeColorTheme(value);
      const before = ui.colorTheme;
      if (nextTheme === before) return;
      const saved = commitStateMutation(() => { ui.colorTheme = nextTheme; });
      if (!saved) ui.colorTheme = before;
      renderAll();
      openInterfaceSettings();
      $(`[data-action="set-color-theme"][data-theme="${ui.colorTheme}"]`)?.focus({ preventScroll: true });
      if (saved) toast(`已套用「${COLOR_THEMES[nextTheme].name}」配色`);
    };

    const recordEditorFormHtml = (draft, editing) => {
      const company = getCompany(draft.companyId);
      const isDispatch = normalizeEmploymentMode(draft.employmentMode) === 'dispatch_hourly';
      const basePayFields = isDispatch
        ? `<label><span class="field-label">基本時薪 *</span><input class="field" name="baseHourlyRate" type="number" min="0.001" step="0.001" inputmode="decimal" required value="${escapeAttr(normalizeHourlyRate(draft.baseHourlyRate).toFixed(3))}"><span class="hint">儲存為本月獨立快照</span></label><label><span class="field-label">本月正常工時 *</span><input class="field" name="regularHours" type="number" min="0.5" max="744" step="0.5" inputmode="decimal" required value="${escapeAttr(draft.regularHours)}"><span class="hint">不含另外登錄的加班時數</span></label><label><span class="field-label">換算底薪</span><div class="field" id="recordBasePayPreview" style="background:var(--surface-2);font-weight:850">$${money(draft.baseSalary)}</div><span class="hint">基本時薪 × 正常工時，四捨五入至元</span></label>`
        : moneyInput('baseSalary', '底薪／本薪', draft.baseSalary);
      return `<form id="recordForm" novalidate>
        <input type="hidden" name="employmentMode" value="${escapeAttr(draft.employmentMode)}">
        <div class="form-grid cols-3">
          <label><span class="field-label">歸屬年份 *</span><input class="field" name="year" type="number" min="2000" max="2100" required value="${escapeAttr(draft.year)}"></label>
          <label><span class="field-label">歸屬月份 *</span><select class="field-select" name="month">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${Number(draft.month) === index + 1 ? 'selected' : ''}>${index + 1} 月</option>`).join('')}</select></label>
          <label><span class="field-label">入帳日期</span><input class="field" name="payDate" type="date" value="${escapeAttr(draft.payDate)}"></label>
          <input type="hidden" name="companyId" value="${escapeAttr(draft.companyId)}">
          <div class="span-3 payroll-context-lock"><span>紀錄公司</span><strong>${(company?.name ? userHtml(company?.name) : escapeHtml('公司資料需要確認'))}</strong><small>既有薪資不可在編輯時移轉到其他公司。</small></div>
          <div id="recordPeriodHint" class="notice span-3"><b>${escapeHtml(employmentModeName(draft.employmentMode))}｜本月工時／請假計算區間：</b>${escapeHtml(salaryPeriodLabel(draft.year, draft.month, draft.companyId))}（${escapeHtml(companyPayrollPeriodName(draft.companyId)) }）</div>
        </div>
        <div class="form-group earn" style="margin-top:14px"><div class="group-head"><strong>應發薪資項目</strong><span class="soft-badge">${isDispatch ? '派遣時薪快照' : '加項'}</span></div>${isDispatch ? '<div class="notice"><b>派遣薪資：</b>本月換算底薪會隨基本時薪與正常工時即時更新；儲存後不會因公司日後調薪而回溯變動。</div>' : ''}<div class="form-grid" style="margin-top:${isDispatch ? '10px' : '0'}">
          ${basePayFields}${moneyInput('mealAllowance', '伙食津貼', draft.mealAllowance)}${moneyInput('positionAllowance', '職務加給（計入時薪）', draft.positionAllowance)}${moneyInput('overtime', '加班費', draft.overtime)}${moneyInput('bonus', '獎金／紅利', draft.bonus)}
        </div><div class="custom-list">${customRowsHtml(draft.customEarnings, 'earning')}</div><div class="form-actions"><button class="btn btn-small" type="button" data-action="add-custom" data-kind="earning">＋ 自訂加項</button><button class="btn btn-small" type="button" data-action="pull-overtime">帶入薪資區間加班</button></div></div>
        <div class="form-group deduct" style="margin-top:14px"><div class="group-head"><strong>薪資扣除項目</strong><span class="soft-badge">扣項</span></div><div class="form-grid">
          ${moneyInput('laborIns', '勞保自負額', draft.laborIns)}${moneyInput('healthIns', '健保自負額', draft.healthIns)}${moneyInput('taxWithheld', '預扣所得稅', draft.taxWithheld)}${moneyInput('otherDeduction', '其他預設扣除', draft.otherDeduction)}
        </div><div class="custom-list">${customRowsHtml(draft.customDeductions, 'deduction')}</div><div class="form-actions"><button class="btn btn-small" type="button" data-action="add-custom" data-kind="deduction">＋ 自訂扣項</button></div></div>
        <div class="form-grid" style="margin-top:14px">${moneyInput('pensionSelf', '勞退個人自提', draft.pensionSelf)}<label class="span-2"><span class="field-label">備註</span><input class="field" name="note" type="text" maxlength="200" value="${escapeAttr(draft.note)}" placeholder="例如：含績效獎金、專案結算"></label></div>
        <div class="live-total"><span>預估可支配淨入帳</span><strong id="recordLiveTotal">$${money(combinedNet(draft))}</strong></div>
        <div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">${editing ? '儲存修改' : '新增紀錄'}</button></div>
      </form>`;
    };


    const payrollStepLabel = (step) => ['月份', '本月資料', '確認'][Math.max(0, Math.min(2, Number(step) - 1))];
    const payrollStepHeader = (step) => `<ol class="payroll-stepper" aria-label="建立薪資進度，第 ${step} 步，共 3 步">${[1,2,3].map((item) => `<li class="payroll-step ${item === step ? 'active' : item < step ? 'done' : ''}" ${item === step ? 'aria-current="step"' : ''} aria-label="第 ${item} 步，共 3 步，${['月份','本月資料','確認'][item - 1]}${item < step ? '，已完成' : item === step ? '，目前步驟' : ''}"><span aria-hidden="true">${item}</span><strong>${['月份','本月資料','確認'][item - 1]}</strong></li>`).join('')}</ol>`;
    const payrollCreateFormHtml = (draft) => {
      const step = Math.max(1, Math.min(3, Number(ui.payrollStep) || 1));
      const company = getCompany(draft.companyId);
      const isDispatch = normalizeEmploymentMode(draft.employmentMode) === 'dispatch_hourly';
      const basePayFields = isDispatch
        ? `<label><span class="field-label">基本時薪 *</span><input class="field" name="baseHourlyRate" type="number" min="0.001" step="0.001" required value="${escapeAttr(normalizeHourlyRate(draft.baseHourlyRate).toFixed(3))}"></label><label><span class="field-label">本月正常工時 *</span><input class="field" name="regularHours" type="number" min="0.5" max="744" step="0.5" required value="${escapeAttr(draft.regularHours)}"></label>`
        : moneyInput('baseSalary', '底薪／本薪', draft.baseSalary);
      const identityHidden = `<input type="hidden" name="companyId" value="${escapeAttr(draft.companyId)}"><input type="hidden" name="employmentMode" value="${escapeAttr(draft.employmentMode)}">`;
      if (step === 1) return `<form id="recordForm" data-payroll-step="1" novalidate>${identityHidden}${payrollStepHeader(step)}<div class="form-grid cols-3"><label><span class="field-label">歸屬年份 *</span><input class="field" name="year" type="number" min="2000" max="2100" required value="${escapeAttr(draft.year)}"></label><label><span class="field-label">歸屬月份 *</span><select class="field-select" name="month">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${Number(draft.month) === index + 1 ? 'selected' : ''}>${index + 1} 月</option>`).join('')}</select></label><label><span class="field-label">預計入帳日</span><input class="field" name="payDate" type="date" value="${escapeAttr(draft.payDate)}"></label><div class="span-3 payroll-context-lock"><span>目前公司</span><strong>${(company?.name ? userHtml(company?.name) : escapeHtml('未設定目前公司'))}</strong><small>建立流程期間公司固定；如需切換公司，請先取消草稿。</small></div><div id="recordPeriodHint" class="notice span-3"><b>計薪區間：</b>${escapeHtml(salaryPeriodLabel(draft.year, draft.month, draft.companyId))}（${escapeHtml(companyPayrollPeriodName(draft.companyId))}）</div></div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="button" data-action="payroll-next">下一步</button></div></form>`;
      if (step === 2) return `<form id="recordForm" data-payroll-step="2" novalidate>${identityHidden}<input type="hidden" name="year" value="${escapeAttr(draft.year)}"><input type="hidden" name="month" value="${escapeAttr(draft.month)}"><input type="hidden" name="payDate" value="${escapeAttr(draft.payDate)}">${payrollStepHeader(step)}<div class="payroll-context-lock"><span>${(company?.name ? userHtml(company?.name) : escapeHtml('未設定公司'))}｜${draft.year} 年 ${draft.month} 月</span><strong>${escapeHtml(salaryPeriodLabel(draft.year, draft.month, draft.companyId))}</strong></div><div class="form-group earn"><div class="group-head"><strong>固定與本月收入</strong><span class="soft-badge">Step 2</span></div><div class="form-grid">${basePayFields}${moneyInput('mealAllowance','伙食津貼',draft.mealAllowance)}${moneyInput('positionAllowance','職務加給',draft.positionAllowance)}${moneyInput('overtime','加班費',draft.overtime)}${moneyInput('bonus','獎金／紅利',draft.bonus)}</div><div class="custom-list">${customRowsHtml(draft.customEarnings,'earning')}</div><div class="form-actions"><button class="btn btn-small" type="button" data-action="add-custom" data-kind="earning">＋ 本月加項</button><button class="btn btn-small" type="button" data-action="pull-overtime">帶入本期加班</button></div></div><div class="form-group deduct"><div class="group-head"><strong>本月扣項與其他</strong><span class="soft-badge">Transaction</span></div><div class="form-grid">${moneyInput('laborIns','勞保自負額',draft.laborIns)}${moneyInput('healthIns','健保自負額',draft.healthIns)}${moneyInput('taxWithheld','預扣所得稅',draft.taxWithheld)}${moneyInput('otherDeduction','其他預設扣除',draft.otherDeduction)}${moneyInput('pensionSelf','勞退個人自提',draft.pensionSelf)}<label class="span-2"><span class="field-label">備註</span><input class="field" name="note" type="text" maxlength="200" value="${escapeAttr(draft.note)}"></label></div><div class="custom-list">${customRowsHtml(draft.customDeductions,'deduction')}</div><div class="form-actions"><button class="btn btn-small" type="button" data-action="add-custom" data-kind="deduction">＋ 本月扣項</button></div></div><div class="live-total"><span>預估可支配淨入帳</span><strong id="recordLiveTotal">$${money(combinedNet(draft))}</strong></div><div class="form-actions"><button class="btn" type="button" data-action="payroll-back">返回</button><button class="btn btn-primary" type="button" data-action="payroll-next">下一步</button></div></form>`;
      const grossAmount = gross(draft);
      const deductionAmount = deductions(draft);
      return `<form id="recordForm" data-payroll-step="3" novalidate>${identityHidden}<input type="hidden" name="year" value="${escapeAttr(draft.year)}"><input type="hidden" name="month" value="${escapeAttr(draft.month)}"><input type="hidden" name="payDate" value="${escapeAttr(draft.payDate)}">${payrollStepHeader(step)}<article class="card card-pad payroll-confirm"><div class="section-title"><div><h3>${(company?.name ? userHtml(company?.name) : escapeHtml('未設定公司'))}｜${draft.year} 年 ${draft.month} 月</h3><p>${escapeHtml(salaryPeriodLabel(draft.year, draft.month, draft.companyId))}</p></div></div>${companySummaryRow('基本薪資', `$${money(draft.baseSalary)}`)}${companySummaryRow('固定收入', `$${money(numberValue(draft.mealAllowance)+numberValue(draft.positionAllowance)+customTotal(draft.customEarnings.filter((item)=>item.sourceType==='company-fixed')))}`)}${companySummaryRow('加班', `$${money(draft.overtime)}`)}${companySummaryRow('獎金／本月加項', `$${money(numberValue(draft.bonus)+customTotal(draft.customEarnings.filter((item)=>item.sourceType!=='company-fixed')))}`)}${companySummaryRow('扣項', `−$${money(deductionAmount)}`)}${companySummaryRow('應發', `$${money(grossAmount)}`)}${companySummaryRow('實際入帳', `$${money(combinedNet(draft))}`)}</article><div class="notice"><b>建立前最後檢查：</b>公司與月份已鎖定；建立後成為獨立薪資快照，日後規則修改不回寫此筆。</div><div class="form-actions"><button class="btn" type="button" data-action="payroll-back">返回修改</button><button class="btn btn-primary" type="submit">建立薪資</button></div></form>`;
    };
    const recordFormHtml = (draft, editing) => editing ? recordEditorFormHtml(draft, true) : payrollCreateFormHtml(draft);

    const moneyInput = (name, label, value) => `<label><span class="field-label">${escapeHtml(label)}</span><input class="field" name="${escapeAttr(name)}" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(numberValue(value))}"></label>`;
    const customRowsHtml = (items, kind) => (items || []).map((item, index) => `<div class="custom-row ${kind === 'earning' ? 'earning-row' : ''}" data-custom-kind="${kind}" data-index="${index}"><input class="field" data-custom-name type="text" maxlength="40" value="${escapeAttr(item.name)}" placeholder="項目名稱"><input class="field" data-custom-amount type="number" min="0" step="1" value="${escapeAttr(item.amount)}" placeholder="金額">${kind === 'earning' ? `<label class="hourly-check" title="勾選後會納入名義時薪、加班基準與請假扣薪計算"><input data-custom-hourly type="checkbox" ${item.affectsHourly ? 'checked' : ''}> 計入時薪</label>` : ''}<button class="btn btn-danger btn-small" type="button" data-action="remove-custom" data-kind="${kind}" data-index="${index}" aria-label="移除自訂項目">×</button></div>`).join('');

    const collectRecordDraft = () => {
      const form = $('#recordForm');
      if (!form || !ui.recordDraft) return ui.recordDraft;
      const data = new FormData(form);
      const has = (name) => typeof data.has === 'function' ? data.has(name) : Boolean(form.elements?.namedItem?.(name));
      const value = (name, fallback) => has(name) ? data.get(name) : fallback;
      const employmentMode = normalizeEmploymentMode(value('employmentMode', ui.recordDraft.employmentMode));
      const draft = normalizeRecord({ ...ui.recordDraft,
        companyId: value('companyId', ui.recordDraft.companyId), year: value('year', ui.recordDraft.year), month: value('month', ui.recordDraft.month), payDate: value('payDate', ui.recordDraft.payDate),
        employmentMode,
        baseHourlyRate: employmentMode === 'dispatch_hourly' ? value('baseHourlyRate', ui.recordDraft.baseHourlyRate) : ui.recordDraft.baseHourlyRate,
        regularHours: employmentMode === 'dispatch_hourly' ? value('regularHours', ui.recordDraft.regularHours) : ui.recordDraft.regularHours,
        baseSalary: value('baseSalary', ui.recordDraft.baseSalary), mealAllowance: value('mealAllowance', ui.recordDraft.mealAllowance), positionAllowance: value('positionAllowance', ui.recordDraft.positionAllowance), overtime: value('overtime', ui.recordDraft.overtime), bonus: value('bonus', ui.recordDraft.bonus),
        laborIns: value('laborIns', ui.recordDraft.laborIns), healthIns: value('healthIns', ui.recordDraft.healthIns), taxWithheld: value('taxWithheld', ui.recordDraft.taxWithheld), otherDeduction: value('otherDeduction', ui.recordDraft.otherDeduction),
        pensionSelf: value('pensionSelf', ui.recordDraft.pensionSelf), sideIncome: value('sideIncome', ui.recordDraft.sideIncome), note: value('note', ui.recordDraft.note)
      });
      const earningRows = $$('[data-custom-kind="earning"]', form);
      const deductionRows = $$('[data-custom-kind="deduction"]', form);
      if (earningRows.length) draft.customEarnings = earningRows.map((row, index) => ({ ...ui.recordDraft.customEarnings?.[index], id: ui.recordDraft.customEarnings?.[index]?.id || newId('earn'), name: $('[data-custom-name]', row).value, amount: numberValue($('[data-custom-amount]', row).value), affectsHourly: Boolean($('[data-custom-hourly]', row)?.checked) }));
      if (deductionRows.length) draft.customDeductions = deductionRows.map((row, index) => ({ ...ui.recordDraft.customDeductions?.[index], id: ui.recordDraft.customDeductions?.[index]?.id || newId('deduct'), name: $('[data-custom-name]', row).value, amount: numberValue($('[data-custom-amount]', row).value) }));
      ui.recordDraft = draft;
      return draft;
    };

    const openRecordForm = (record = null) => {
      if (!state.companies.length) {
        toast('請先建立至少一家公司', 'error');
        selectPrimaryTab('companies');
        return;
      }
      if (!record && !currentCompany()) {
        toast('請先在公司管理設為目前公司，再建立薪資', 'error');
        selectPrimaryTab('companies');
        return;
      }
      ui.payrollStep = record ? 2 : 1;
      ui.recordDraft = record ? clone(record) : blankRecord();
      beginDraftScope({ entityType: 'payroll', companyId: ui.recordDraft.companyId, entityId: record?.id || '', payrollMonth: payrollMonthKey(ui.recordDraft.year, ui.recordDraft.month), operational: true });
      markSelectedEntity('payroll', record?.id || '', ui.recordDraft.companyId);
      openDialog(record ? '編輯薪資明細' : '建立薪資', recordFormHtml(ui.recordDraft, Boolean(record)), true);
    };

    const updateRecordPreview = () => {
      const draft = collectRecordDraft();
      const total = $('#recordLiveTotal');
      if (total && draft) total.textContent = `$${money(combinedNet(draft))}`;
      const basePay = $('#recordBasePayPreview');
      if (basePay && draft) basePay.textContent = `$${money(draft.baseSalary)}`;
      const periodHint = $('#recordPeriodHint');
      if (periodHint && draft) periodHint.innerHTML = `<b>${escapeHtml(employmentModeName(draft.employmentMode))}｜本月工時／請假計算區間：</b>${escapeHtml(salaryPeriodLabel(draft.year, draft.month, draft.companyId))}（${escapeHtml(companyPayrollPeriodName(draft.companyId)) }）`;
    };

    const blankCompanyBasicDraft = (company = null) => {
      const profile = company ? currentCompanySalaryProfile(company) : companyBaseSalaryProfile({ mealAllowance: 3000, defaultRegularHours: 174 });
      const fixed = normalizeFixedEarnings(profile.fixedEarnings);
      const nightIndex = fixed.findIndex((item) => item.name.trim() === '夜班津貼');
      const nightItem = nightIndex >= 0 ? fixed[nightIndex] : null;
      return {
        id: company?.id || '', name: company?.name || '',
        baseSalary: profile.baseSalary, baseHourlyRate: profile.baseHourlyRate,
        defaultRegularHours: profile.regularHours, employmentMode: profile.employmentMode,
        employmentStartDate: company?.employmentStartDate || '',
        mealAllowance: profile.mealAllowance, positionAllowance: profile.positionAllowance,
        nightAllowance: numberValue(nightItem?.amount),
        nightAllowanceItem: nightItem || { id: newId('fixed'), name: '夜班津貼', amount: 0, affectsHourly: true },
        nightAllowanceIndex: nightIndex,
        fixedEarnings: fixed.filter((_, index) => index !== nightIndex)
      };
    };

    const companyBasicFixedEarnings = (draft) => {
      const items = normalizeFixedEarnings(draft.fixedEarnings).filter((item) => item.name.trim() || item.amount);
      if (draft.nightAllowanceIndex >= 0 || numberValue(draft.nightAllowance)) {
        const night = { ...draft.nightAllowanceItem, amount: numberValue(draft.nightAllowance), affectsHourly: true };
        items.splice(draft.nightAllowanceIndex >= 0 ? Math.min(draft.nightAllowanceIndex, items.length) : items.length, 0, night);
      }
      return items;
    };
    const companyBasicSalaryProfile = (draft) => ({
      employmentMode: normalizeEmploymentMode(draft.employmentMode),
      baseSalary: numberValue(draft.baseSalary), baseHourlyRate: normalizeHourlyRate(draft.baseHourlyRate),
      regularHours: normalizeRegularHours(draft.defaultRegularHours, 174),
      mealAllowance: numberValue(draft.mealAllowance), positionAllowance: numberValue(draft.positionAllowance),
      fixedEarnings: companyBasicFixedEarnings(draft)
    });
    const companySalaryFingerprint = (profile) => JSON.stringify([
      profile.employmentMode, salaryProfileBasePay(profile),
      ...(profile.employmentMode === 'dispatch_hourly' ? [profile.baseHourlyRate, profile.regularHours] : []),
      numberValue(profile.mealAllowance), numberValue(profile.positionAllowance),
      normalizeFixedEarnings(profile.fixedEarnings).filter((item) => item.name.trim() || item.amount)
    ]);
    const companyBasicMoneyInput = (name, label, value) => `<label><span class="field-label">${escapeHtml(label)}</span><input class="field" name="${name}" type="number" min="0" step="1" inputmode="numeric" required value="${escapeAttr(numberValue(value))}"></label>`;
    const companyBasicFixedRowsHtml = (items) => (items || []).map((item, index) => `<div class="company-pay-item" data-basic-fixed-row data-index="${index}"><label><span class="field-label">自定義項目名稱</span><input class="field" name="basicFixed_${index}_name" type="text" maxlength="40" value="${escapeAttr(item.name)}" placeholder="例如：全勤獎金"></label><label><span class="field-label">金額</span><input class="field" name="basicFixed_${index}_amount" type="number" min="0" step="1" inputmode="numeric" required value="${escapeAttr(item.amount)}"></label><button class="btn btn-danger btn-small" type="button" data-action="remove-basic-fixed" data-index="${index}" aria-label="移除自定義薪資項目">×</button></div>`).join('');
    const companyBasicCalculationHtml = (draft) => {
      const profile = companyBasicSalaryProfile(draft);
      const basis = salaryProfileOvertimeBasis(profile);
      return `<div class="summary-row"><span>固定薪資合計</span><strong>$${money(basis.total)}</strong></div><div class="summary-row"><span>公司預設加班時薪</span><strong>$${hourlyRateNumber(basis.hourlyRate)}</strong></div><p class="hint">${profile.employmentMode === 'dispatch_hourly' ? '換算基本月薪＋固定津貼，再除以正常工時。' : '基本月薪＋伙食津貼＋職務津貼＋夜班津貼＋自定義固定項目，再除以 240。'}</p><p class="company-pay-equation">$${money(basis.total)} ÷ ${rateNumber(basis.divisor)} = $${hourlyRateNumber(basis.hourlyRate)}</p>`;
    };
    const companyBasicFormHtml = (draft, editing) => {
      const dispatch = draft.employmentMode === 'dispatch_hourly';
      const converted = Math.round(numberValue(draft.baseHourlyRate) * numberValue(draft.defaultRegularHours));
      return `<form id="companyBasicForm" novalidate><div class="form-grid">
        ${!editing ? `<fieldset class="span-2 v5-pay-type"><legend class="field-label">計薪方式 *</legend><div class="v5-pay-type-options"><label class="v5-pay-type-option ${!dispatch?'selected':''}"><input type="radio" name="employmentMode" value="monthly" ${!dispatch?'checked':''}><span><b>月薪制</b><small>每月固定基本薪資</small></span></label><label class="v5-pay-type-option ${dispatch?'selected':''}"><input type="radio" name="employmentMode" value="dispatch_hourly" ${dispatch?'checked':''}><span><b>時薪制</b><small>基本時薪 × 每月正常工時</small></span></label></div></fieldset>` : ''}
        <label class="span-2"><span class="field-label">公司名稱 *</span><input class="field" name="name" required maxlength="80" value="${escapeAttr(draft.name)}" placeholder="例如：A 公司"></label>
        <label class="span-2"><span class="field-label">到職日 *</span><input class="field" name="employmentStartDate" type="date" required value="${escapeAttr(draft.employmentStartDate)}"></label>
      </div><section class="form-group company-pay-section" aria-labelledby="companyPayTitle"><div class="group-head"><strong id="companyPayTitle">薪資計算</strong><span class="soft-badge">${dispatch ? '時薪制' : '月薪制'}</span></div>
        <div class="form-grid">${dispatch ? `<label><span class="field-label">基本時薪 *</span><input class="field" name="baseHourlyRate" type="number" min="0.001" step="0.001" inputmode="decimal" required value="${escapeAttr(draft.baseHourlyRate || '')}"></label><label><span class="field-label">每月正常工時 *</span><input class="field" name="defaultRegularHours" type="number" min="0.5" max="744" step="0.5" inputmode="decimal" required value="${escapeAttr(draft.defaultRegularHours)}"></label><div class="span-2 summary-row"><span>換算基本月薪</span><strong id="companyHourlyPreview">$${money(converted)}</strong></div>` : companyBasicMoneyInput('baseSalary', '基本月薪 *', draft.baseSalary)}
          ${companyBasicMoneyInput('mealAllowance', '伙食津貼', draft.mealAllowance)}
          ${companyBasicMoneyInput('positionAllowance', '職務津貼', draft.positionAllowance)}
          ${companyBasicMoneyInput('nightAllowance', '夜班津貼', draft.nightAllowance)}
        </div><div class="company-pay-custom"><div class="group-head"><strong>自定義固定項目</strong><button class="btn btn-small" type="button" data-action="add-basic-fixed">＋ 新增項目</button></div><div id="companyBasicFixedList">${companyBasicFixedRowsHtml(draft.fixedEarnings)}</div></div>
        <p class="hint">以上固定項目會帶入新建薪資，並計入加班與請假扣薪基準。單次加項請在每月薪資明細輸入。</p>
        <div id="companyBasicCalculation" class="notice company-pay-calculation" aria-live="polite" aria-atomic="true">${companyBasicCalculationHtml(draft)}</div>
      </section><div class="notice"><b>生效方式：</b>${editing ? '薪資變更自今天起生效；既有薪資單與已儲存的加班時薪保持不變。' : '建立公司的起始薪資設定。'}${editing ? ` <span>${escapeHtml(todayIso())}</span>` : ''}</div>
      <div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">${editing ? '儲存' : '建立公司'}</button></div></form>`;
    };

    const openCompanyBasicForm = (company = null) => {
      ui.companyDraft = blankCompanyBasicDraft(company);
      beginDraftScope({ entityType: 'company', companyId: company?.id || '', entityId: company?.id || '', operational: false });
      openDialog(company ? '編輯公司基本資料' : '新增公司', companyBasicFormHtml(ui.companyDraft, Boolean(company)), true);
    };

    const collectCompanyBasicDraft = () => {
      const form = $('#companyBasicForm');
      if (!form || !ui.companyDraft) return ui.companyDraft;
      const data = new FormData(form);
      ui.companyDraft = {
        ...ui.companyDraft,
        name: String(data.get('name') || '').trim(),
        employmentMode: data.has('employmentMode') ? normalizeEmploymentMode(data.get('employmentMode')) : normalizeEmploymentMode(ui.companyDraft.employmentMode),
        baseSalary: data.has('baseSalary') ? numberValue(data.get('baseSalary')) : numberValue(ui.companyDraft.baseSalary),
        baseHourlyRate: data.has('baseHourlyRate') ? normalizeHourlyRate(data.get('baseHourlyRate')) : normalizeHourlyRate(ui.companyDraft.baseHourlyRate),
        defaultRegularHours: data.has('defaultRegularHours') ? normalizeRegularHours(data.get('defaultRegularHours'), 174) : normalizeRegularHours(ui.companyDraft.defaultRegularHours, 174),
        mealAllowance: numberValue(data.get('mealAllowance')),
        positionAllowance: numberValue(data.get('positionAllowance')),
        nightAllowance: numberValue(data.get('nightAllowance')),
        fixedEarnings: [...form.querySelectorAll('[data-basic-fixed-row]')].map((row) => {
          const index = Number(row.dataset.index);
          return { ...ui.companyDraft.fixedEarnings[index],
            name: String(data.get(`basicFixed_${index}_name`) || '').trim(),
            amount: numberValue(data.get(`basicFixed_${index}_amount`)), affectsHourly: true };
        }),
        employmentStartDate: String(data.get('employmentStartDate') || '')
      };
      return ui.companyDraft;
    };

    const updateCompanyBasicPreview = () => {
      const draft = collectCompanyBasicDraft();
      if (!draft) return;
      const hourly = $('#companyHourlyPreview');
      if (hourly) hourly.textContent = `$${money(salaryProfileBasePay(companyBasicSalaryProfile(draft)))}`;
      const summary = $('#companyBasicCalculation');
      if (summary) summary.innerHTML = companyBasicCalculationHtml(draft);
    };
    const changeCompanyBasicFixed = (index = null) => {
      const draft = collectCompanyBasicDraft();
      if (!draft) return;
      if (index === null) draft.fixedEarnings.push({ id: newId('fixed'), name: '', amount: 0, affectsHourly: true });
      else if (Number.isInteger(index) && index >= 0 && index < draft.fixedEarnings.length) draft.fixedEarnings.splice(index, 1);
      $('#companyBasicFixedList').innerHTML = companyBasicFixedRowsHtml(draft.fixedEarnings);
      enhanceFormAccessibility($('#companyBasicForm'));
      updateCompanyBasicPreview(); markDraftDirty();
      (index === null ? $('#companyBasicFixedList .company-pay-item:last-child input') : $('#companyBasicForm [data-action="add-basic-fixed"]'))?.focus();
    };
    const commitCompanyBasicDraft = (basic) => {
      const existing = basic.id ? getCompany(basic.id) : null;
      const salary = companyBasicSalaryProfile(basic);
      let company = null;
      const ok = commitStateMutation(() => {
        if (existing) {
          company = normalizeCompany({
            ...existing,
            name: basic.name,
            employmentStartDate: basic.employmentStartDate
          });
          if (companySalaryFingerprint(salary) !== companySalaryFingerprint(currentCompanySalaryProfile(existing))) {
            upsertCurrentSalaryRuleProfile(company, salary, '公司薪資計算更新');
          }
          const index = state.companies.findIndex((item) => item.id === company.id);
          state.companies[index] = company;
        } else {
          company = normalizeCompany({
            id: newId('company'),
            name: basic.name,
            position: '',
            isCurrent: state.companies.length === 0,
            employmentMode: normalizeEmploymentMode(basic.employmentMode),
            baseSalary: basic.employmentMode === 'dispatch_hourly' ? Math.round(basic.baseHourlyRate * basic.defaultRegularHours) : basic.baseSalary,
            baseHourlyRate: basic.employmentMode === 'dispatch_hourly' ? basic.baseHourlyRate : 0,
            defaultRegularHours: basic.employmentMode === 'dispatch_hourly' ? basic.defaultRegularHours : 174,
            mealAllowance: salary.mealAllowance,
            positionAllowance: salary.positionAllowance,
            fixedEarnings: salary.fixedEarnings,
            laborIns: 0,
            healthIns: 0,
            taxWithheld: 0,
            employmentStartDate: basic.employmentStartDate,
            workHoursPerDay: 8,
            leaveQuotaCycle: 'calendar',
            leavePolicies: defaultLeavePolicies(),
            payrollPeriodType: 'calendar',
            leaveDeductionEach: 500,
            deductionRuleNote: DEFAULT_DEDUCTION_RULE
          });
          state.companies.push(company);
        }
        if (company.isCurrent) state.companies.forEach((item) => { item.isCurrent = item.id === company.id; });
        if (company.isCurrent || !state.overtimeCalculator.companyId) applyCompanyDefaultsToCalculator(company);
      }, existing ? '儲存失敗。原本公司資料保持不變。' : '公司建立失敗。資料尚未建立。');
      if (!ok || !company) return false;
      ui.companyDetailId = company.id;
      ui.companyFilter = currentCompany()?.id || company.id;
      closeDialog();
      renderAll();
      toast(existing ? '公司基本資料已更新' : (company.isCurrent ? '公司已建立並設為目前公司' : '公司已建立；目前公司未切換'));
      return true;
    };

    const saveCompanyBasicForm = () => {
      const form = $('#companyBasicForm');
      if (!form || !ui.companyDraft) return toast('公司表單尚未準備完成。請重新開啟後再試一次。', 'error');
      if (!validateNativeForm(form)) return;
      const draft = collectCompanyBasicDraft();
      if (!assertDraftScope({ entityType: 'company', companyId: draft.id || '', entityId: draft.id || '', operational: false, allowNewCompany: !draft.id })) return;
      if (!draft.name) { validateField(form, 'name', '請輸入公司名稱。'); return; }
      if (!validIsoDate(draft.employmentStartDate)) { validateField(form, 'employmentStartDate', '到職日格式不正確，請重新選擇日期。'); return; }
      if (draft.employmentMode === 'dispatch_hourly') {
        if (!(draft.baseHourlyRate > 0)) { validateField(form, 'baseHourlyRate', '請輸入大於 0 的基本時薪。'); return; }
        if (!(draft.defaultRegularHours > 0 && draft.defaultRegularHours <= 744)) { validateField(form, 'defaultRegularHours', '正常工時須大於 0 且不超過 744 小時。'); return; }
      } else if (draft.baseSalary < 0) { validateField(form, 'baseSalary', '基本月薪不可小於 0。'); return; }
      for (const field of ['mealAllowance', 'positionAllowance', 'nightAllowance']) {
        if (draft[field] < 0) { validateField(form, field, '津貼金額不可小於 0。'); return; }
      }
      for (const [index, item] of draft.fixedEarnings.entries()) {
        if (item.amount < 0) { validateField(form, `basicFixed_${index}_amount`, '津貼金額不可小於 0。'); return; }
        if (item.amount && !item.name.trim()) { validateField(form, `basicFixed_${index}_name`, '請為自定義薪資項目填寫名稱。'); return; }
      }
      const warnings = [];
      if (state.companies.some((company) => company.id !== draft.id && company.name.trim().toLowerCase() === draft.name.toLowerCase())) {
        warnings.push('已有相同公司名稱；若是不同任職期間仍可繼續建立。');
        setFieldValidation(form.elements.namedItem('name'), '已有相同公司名稱；不同任職期間仍可儲存。', 'warning');
      }
      if (draft.employmentMode !== 'dispatch_hourly' && draft.baseSalary === 0) {
        warnings.push('基本月薪目前為 0 元。');
        setFieldValidation(form.elements.namedItem('baseSalary'), '基本月薪為 0 元；允許儲存，但請確認這是預期設定。', 'warning');
      }
      if (warnings.length) {
        ui.companyDraft = { ...draft };
        openDialog('請確認公司資料', `<div class="notice warning"><b>這些是提醒，不會阻止儲存。</b>${warnings.map((warning) => `<p style="margin:6px 0 0">${escapeHtml(warning)}</p>`).join('')}</div><div class="form-actions"><button class="btn" type="button" data-action="edit-company-basic-again">返回修改</button><button class="btn btn-primary" type="button" data-action="confirm-company-basic">仍要儲存</button></div>`);
        return;
      }
      commitCompanyBasicDraft(draft);
    };

    const setCurrentCompany = (id) => {
      const company = getCompany(id);
      if (!company) {
        setDataStatus('invalid', '找不到指定公司。請回公司管理重新選擇目前公司。');
        renderAll();
        return toast('找不到公司。系統沒有切換到其他公司。', 'error');
      }
      if (hasDirtyDraft()) return toast('目前有尚未儲存的變更，請先儲存或取消後再切換公司', 'error');
      if (currentCompany()?.id === company.id) return toast(`目前已使用「${window.SalaryMateI18n.user(company.name)}」`, 'info');
      const previousCompany = currentCompany();
      const previousFilter = ui.companyFilter;
      setOperationStatus('submitting', 'switch-company', `正在切換到「${window.SalaryMateI18n.user(company.name)}」…`);
      renderAll();
      const ok = commitStateMutation(() => {
        state.companies.forEach((item) => { item.isCurrent = item.id === company.id; });
        applyCompanyDefaultsToCalculator(company);
      }, `無法切換公司。目前仍使用「${previousCompany?.name ? window.SalaryMateI18n.user(previousCompany.name) : '原公司'}」。`, `switch-company:${previousCompany?.id || 'none'}:${company.id}`, false);
      if (!ok) {
        ui.companyFilter = previousFilter;
        renderAll();
        return;
      }
      bumpContextGeneration();
      ui.companyFilter = company.id;
      ui.recordDraft = null;
      ui.payrollStep = 1;
      ui.overtimeDraft = null;
      ui.leaveDraft = null;
      ui.yearEndDraft = null;
      ui.salaryAdjustmentDraft = null;
      ui.companyDetailId = '';
      clearOperationalSelection();
      invalidateCalculationCache();
      setOperationStatus('idle');
      syncDataStatusFromState();
      renderAll();
      toast(`目前公司已切換為「${window.SalaryMateI18n.user(company.name)}」`);
    };

    const currentSalaryAdjustmentForDate = (companyId, effectiveDate = todayIso()) => state.salaryAdjustments.find((item) => item.companyId === companyId && item.effectiveDate === effectiveDate) || null;

    const upsertCurrentSalaryRuleProfile = (company, updates, note) => {
      if (!company) return null;
      const effectiveDate = todayIso();
      const existing = currentSalaryAdjustmentForDate(company.id, effectiveDate);
      const current = salaryProfileAt(company, effectiveDate);
      const previous = salaryProfileTotal(salaryProfileBefore(company, effectiveDate, existing?.id || ''));
      const next = normalizeSalaryAdjustment({
        ...current,
        ...updates,
        id: existing?.id || newId('raise'),
        companyId: company.id,
        effectiveDate,
        previousFixedSalary: previous,
        reason: existing?.reason || 'custom',
        note: existing?.note || note
      });
      const index = state.salaryAdjustments.findIndex((item) => item.id === next.id);
      if (index >= 0) state.salaryAdjustments[index] = next;
      else state.salaryAdjustments.push(next);
      return next;
    };

    const basicSalaryRuleFormHtml = (company) => {
      const profile = currentCompanySalaryProfile(company);
      const dispatch = profile.employmentMode === 'dispatch_hourly';
      return `<form id="basicSalaryRuleForm" data-company-id="${escapeAttr(company.id)}" novalidate><div class="form-grid">
        ${dispatch
          ? `<label><span class="field-label">基本時薪 *</span><input class="field" name="baseHourlyRate" type="number" min="0.001" step="0.001" required value="${escapeAttr(profile.baseHourlyRate)}"></label><label><span class="field-label">正常工時 *</span><input class="field" name="regularHours" type="number" min="0.5" max="744" step="0.5" required value="${escapeAttr(profile.regularHours)}"></label>`
          : `<label class="span-2"><span class="field-label">基本月薪 *</span><input class="field" name="baseSalary" type="number" min="0" step="1" required value="${escapeAttr(profile.baseSalary)}"></label>`}
        <div class="notice span-2"><b>生效方式：</b>儲存後以今天（${escapeHtml(todayIso())}）建立薪資快照，只影響之後新增的薪資預設；既有薪資紀錄不回溯修改。</div>
      </div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">儲存基本薪資</button></div></form>`;
    };

    const openBasicSalaryRule = (company) => {
      if (!company) return toast('找不到公司，請重新整理後再試', 'error');
      beginDraftScope({ entityType: 'basic-salary', companyId: company.id, entityId: company.id, operational: false });
      openDialog('基本薪資', basicSalaryRuleFormHtml(company));
    };

    const saveBasicSalaryRule = () => {
      const form = $('#basicSalaryRuleForm');
      if (!validateNativeForm(form)) return;
      const company = getCompany(form.dataset.companyId);
      if (!company) { showValidationSummary(form, '公司資料需要確認。請返回公司管理重新開啟薪資規則。'); return; }
      if (!assertDraftScope({ entityType: 'basic-salary', companyId: company.id, entityId: company.id, operational: false })) return;
      const data = new FormData(form);
      const profile = currentCompanySalaryProfile(company);
      const updates = profile.employmentMode === 'dispatch_hourly'
        ? { baseHourlyRate: normalizeHourlyRate(data.get('baseHourlyRate')), regularHours: normalizeRegularHours(data.get('regularHours'), 174) }
        : { baseSalary: Math.max(0, numberValue(data.get('baseSalary'))) };
      if (profile.employmentMode === 'dispatch_hourly' && updates.baseHourlyRate <= 0) { validateField(form, 'baseHourlyRate', '基本時薪必須大於 0。'); return; }
      if (profile.employmentMode === 'dispatch_hourly' && updates.regularHours <= 0) { validateField(form, 'regularHours', '正常工時必須大於 0。'); return; }
      const ok = commitStateMutation(() => upsertCurrentSalaryRuleProfile(company, updates, 'CM-03 基本薪資更新'));
      if (!ok) return;
      closeDialog(); renderAll(); toast('基本薪資已更新；歷史薪資保持不變');
    };

    const fixedIncomeRuleRowsHtml = (items) => (items || []).map((item, index) => `<div class="custom-row" data-fixed-income-row data-index="${index}"><input class="field" data-fixed-income-name type="text" maxlength="40" value="${escapeAttr(item.name)}" placeholder="例如：全勤、輪班津貼"><input class="field" data-fixed-income-amount type="number" min="0" step="1" value="${escapeAttr(item.amount)}" placeholder="金額"><button class="btn btn-danger btn-small" type="button" data-action="remove-fixed-income-rule" data-index="${index}" aria-label="移除固定收入">×</button></div>`).join('');

    const fixedIncomeRuleFormHtml = (draft) => `<form id="fixedIncomeRuleForm" data-company-id="${escapeAttr(draft.companyId)}" novalidate><div class="form-grid">${moneyInput('mealAllowance', '伙食津貼', draft.mealAllowance)}${moneyInput('positionAllowance', '職務加給', draft.positionAllowance)}</div><div class="form-group earn" style="margin-top:14px"><div class="group-head"><strong>其他固定收入</strong><span class="soft-badge">每月預設</span></div><div class="custom-list">${fixedIncomeRuleRowsHtml(draft.fixedEarnings)}</div><div class="form-actions"><button class="btn btn-small" type="button" data-action="add-fixed-income-rule">＋ 新增固定收入</button></div></div><div class="notice"><b>規則／交易分離：</b>這裡只設定每月固定收入；單次加項與一般獎金仍在每月薪資明細輸入。</div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">儲存固定收入</button></div></form>`;

    const openFixedIncomeRule = (company) => {
      if (!company) return toast('找不到公司，請重新整理後再試', 'error');
      const profile = currentCompanySalaryProfile(company);
      ui.salaryRulesDraft = { companyId: company.id, mealAllowance: profile.mealAllowance, positionAllowance: profile.positionAllowance, fixedEarnings: fixedIncomeItems(profile).map((item) => ({ ...item })) };
      beginDraftScope({ entityType: 'fixed-income', companyId: company.id, entityId: company.id, operational: false });
      openDialog('固定收入', fixedIncomeRuleFormHtml(ui.salaryRulesDraft), true);
    };

    const collectFixedIncomeRuleDraft = () => {
      const form = $('#fixedIncomeRuleForm');
      if (!form || !ui.salaryRulesDraft) return ui.salaryRulesDraft;
      const data = new FormData(form);
      ui.salaryRulesDraft = {
        ...ui.salaryRulesDraft,
        mealAllowance: Math.max(0, numberValue(data.get('mealAllowance'))),
        positionAllowance: Math.max(0, numberValue(data.get('positionAllowance'))),
        fixedEarnings: $$('[data-fixed-income-row]', form).map((row, index) => ({
          id: ui.salaryRulesDraft.fixedEarnings?.[index]?.id || newId('fixed'),
          name: $('[data-fixed-income-name]', row)?.value || '',
          amount: Math.max(0, numberValue($('[data-fixed-income-amount]', row)?.value)),
          affectsHourly: true
        }))
      };
      return ui.salaryRulesDraft;
    };

    const saveFixedIncomeRule = () => {
      const form = $('#fixedIncomeRuleForm');
      if (!validateNativeForm(form)) return;
      const draft = collectFixedIncomeRuleDraft();
      const company = getCompany(draft?.companyId);
      if (!company) { showValidationSummary(form, '公司資料需要確認。請返回公司管理重新開啟固定收入設定。'); return; }
      if (!assertDraftScope({ entityType: 'fixed-income', companyId: company.id, entityId: company.id, operational: false })) return;
      const unnamedAmount = $$('[data-fixed-income-row]', form).find((row) => !String($('[data-fixed-income-name]', row)?.value || '').trim() && numberValue($('[data-fixed-income-amount]', row)?.value) > 0);
      if (unnamedAmount) { setFieldValidation($('[data-fixed-income-name]', unnamedAmount), '請輸入固定收入名稱，或將金額清為 0。'); focusFirstValidationError(form); return; }
      const ok = commitStateMutation(() => upsertCurrentSalaryRuleProfile(company, { mealAllowance: draft.mealAllowance, positionAllowance: draft.positionAllowance, fixedEarnings: normalizeFixedEarnings(draft.fixedEarnings) }, 'CM-03 固定收入更新'));
      if (!ok) return;
      closeDialog(); renderAll(); toast('固定收入已更新；單次加項與歷史薪資不受影響');
    };

    const companyRuleItemRowsHtml = (items, kind) => (items || []).map((item, index) => {
      const prefix = kind === 'earning' ? 'ruleEarning' : 'ruleDeduction';
      return `<div class="company-pay-item" data-rule-item-kind="${kind}" data-index="${index}"><label><span class="field-label">${kind === 'earning' ? '自訂加項名稱' : '自訂扣項名稱'}</span><input class="field" name="${prefix}_${index}_name" type="text" maxlength="40" value="${escapeAttr(item.name)}" placeholder="${kind === 'earning' ? '例如：交通津貼' : '例如：福利金、宿舍費'}"></label><label><span class="field-label">金額</span><input class="field" name="${prefix}_${index}_amount" type="number" min="0" step="1" inputmode="numeric" required value="${escapeAttr(numberValue(item.amount))}"></label><button class="btn btn-danger btn-small" type="button" data-action="remove-company-rule-item" data-kind="${kind}" data-index="${index}" aria-label="${kind === 'earning' ? '移除自訂加項' : '移除自訂扣項'}">×</button></div>`;
    }).join('');

    const companyRuleItemsTotalsHtml = (draft) => `<div class="summary-row"><span>固定加項合計</span><strong>$${money(customTotal(draft.fixedEarnings))}</strong></div><div class="summary-row"><span>預設扣項合計</span><strong>$${money(numberValue(draft.laborIns) + numberValue(draft.healthIns) + customTotal(draft.fixedDeductions))}</strong></div>`;

    const defaultDeductionRuleFormHtml = (draft) => `<form id="defaultDeductionRuleForm" data-company-id="${escapeAttr(draft.companyId)}" novalidate>
      <div class="form-group company-pay-section"><div class="group-head"><strong>自訂加項</strong><button class="btn btn-small" type="button" data-action="add-company-rule-item" data-kind="earning">＋ 新增加項</button></div><div id="companyRuleEarnings">${companyRuleItemRowsHtml(draft.fixedEarnings, 'earning')}</div><p class="hint">這裡的固定加項與公司薪資計算共用，會計入加班及請假扣薪基準。</p></div>
      <div class="form-group company-pay-section"><div class="group-head"><strong>預設扣項</strong></div><div class="form-grid">${moneyInput('laborIns', '預設勞保自負額', draft.laborIns)}${moneyInput('healthIns', '預設健保自負額', draft.healthIns)}</div><div class="group-head company-pay-custom"><strong>自訂扣項</strong><button class="btn btn-small" type="button" data-action="add-company-rule-item" data-kind="deduction">＋ 新增扣項</button></div><div id="companyRuleDeductions">${companyRuleItemRowsHtml(draft.fixedDeductions, 'deduction')}</div><p class="hint">扣項會減少薪資淨額，不會改變加班時薪。</p></div>
      <div id="companyRuleItemsTotals" class="notice company-pay-calculation" aria-live="polite">${companyRuleItemsTotalsHtml(draft)}</div><p class="hint">固定加項變更自今天起生效；扣項帶入之後新建的薪資。既有薪資紀錄保留原值。</p><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">儲存加項／扣項</button></div></form>`;

    const openDefaultDeductionRule = (company) => {
      if (!company) return toast('找不到公司，請重新整理後再試', 'error');
      const profile = currentCompanySalaryProfile(company);
      ui.payItemsDraft = { companyId: company.id, laborIns: company.laborIns, healthIns: company.healthIns,
        fixedEarnings: normalizeFixedEarnings(profile.fixedEarnings), fixedDeductions: normalizeFixedDeductions(company.fixedDeductions) };
      beginDraftScope({ entityType: 'default-deduction', companyId: company.id, entityId: company.id, operational: false });
      openDialog('自訂加項／扣項', defaultDeductionRuleFormHtml(ui.payItemsDraft), true);
    };

    const collectDefaultDeductionRuleDraft = () => {
      const form = $('#defaultDeductionRuleForm');
      if (!form || !ui.payItemsDraft) return null;
      const data = new FormData(form);
      const collect = (kind, previous, prefix) => [...form.querySelectorAll(`[data-rule-item-kind="${kind}"]`)].map((row) => {
        const index = Number(row.dataset.index);
        return { ...previous[index], name: String(data.get(`${prefix}_${index}_name`) || '').trim(), amount: numberValue(data.get(`${prefix}_${index}_amount`)), affectsHourly: kind === 'earning' };
      });
      ui.payItemsDraft = { ...ui.payItemsDraft, laborIns: numberValue(data.get('laborIns')), healthIns: numberValue(data.get('healthIns')),
        fixedEarnings: collect('earning', ui.payItemsDraft.fixedEarnings, 'ruleEarning'),
        fixedDeductions: collect('deduction', ui.payItemsDraft.fixedDeductions, 'ruleDeduction') };
      return ui.payItemsDraft;
    };

    const updateCompanyRuleItemsPreview = () => {
      const draft = collectDefaultDeductionRuleDraft();
      const summary = $('#companyRuleItemsTotals');
      if (draft && summary) summary.innerHTML = companyRuleItemsTotalsHtml(draft);
    };

    const changeCompanyRuleItem = (kind, index = null) => {
      if (!['earning', 'deduction'].includes(kind)) return;
      const draft = collectDefaultDeductionRuleDraft();
      if (!draft) return;
      const items = kind === 'earning' ? draft.fixedEarnings : draft.fixedDeductions;
      if (index === null) items.push({ id: newId(kind === 'earning' ? 'fixed' : 'fixed-deduct'), name: '', amount: 0, affectsHourly: kind === 'earning' });
      else if (Number.isInteger(index) && index >= 0 && index < items.length) items.splice(index, 1);
      const selector = kind === 'earning' ? '#companyRuleEarnings' : '#companyRuleDeductions';
      $(selector).innerHTML = companyRuleItemRowsHtml(items, kind);
      enhanceFormAccessibility($('#defaultDeductionRuleForm'));
      updateCompanyRuleItemsPreview(); markDraftDirty();
      (index === null ? $(`${selector} .company-pay-item:last-child input`) : $(`#defaultDeductionRuleForm [data-action="add-company-rule-item"][data-kind="${kind}"]`))?.focus();
    };

    const saveDefaultDeductionRule = () => {
      const form = $('#defaultDeductionRuleForm');
      if (!form || !validateNativeForm(form)) return;
      const draft = collectDefaultDeductionRuleDraft();
      const company = getCompany(draft?.companyId);
      if (!company) { showValidationSummary(form, '公司資料需要確認。請返回公司管理重新開啟預設扣項。'); return; }
      if (!assertDraftScope({ entityType: 'default-deduction', companyId: company.id, entityId: company.id, operational: false })) return;
      for (const field of ['laborIns', 'healthIns']) if (draft[field] < 0) { validateField(form, field, '金額不可小於 0。'); return; }
      for (const [key, prefix] of [['fixedEarnings', 'ruleEarning'], ['fixedDeductions', 'ruleDeduction']]) {
        for (const [index, item] of draft[key].entries()) {
          if (item.amount < 0) { validateField(form, `${prefix}_${index}_amount`, '金額不可小於 0。'); return; }
          if (item.amount && !item.name) { validateField(form, `${prefix}_${index}_name`, '請輸入自訂項目名稱。'); return; }
        }
      }
      const fixedEarnings = normalizeFixedEarnings(draft.fixedEarnings).filter((item) => item.name.trim() || item.amount);
      const fixedDeductions = normalizeFixedDeductions(draft.fixedDeductions).filter((item) => item.name.trim() || item.amount);
      const profile = currentCompanySalaryProfile(company);
      const ok = commitStateMutation(() => {
        if (companySalaryFingerprint(profile) !== companySalaryFingerprint({ ...profile, fixedEarnings })) {
          upsertCurrentSalaryRuleProfile(company, { fixedEarnings }, '自訂固定加項更新');
          if (company.isCurrent || state.overtimeCalculator.companyId === company.id) applyCompanyDefaultsToCalculator(company);
        }
        company.laborIns = draft.laborIns; company.healthIns = draft.healthIns; company.fixedDeductions = fixedDeductions;
      });
      if (!ok) return;
      closeDialog(); renderAll(); toast('自訂加項／扣項已儲存；既有薪資保持不變');
    };

    const companyAnnualLeaveHint = (draft) => {
      const summary = leaveQuotaSummary(draft, 'annual');
      if (summary.policy.mode === 'custom') return `目前採公司自訂額度 ${rateNumber(summary.entitlement)} 天，依「${draft.leaveQuotaCycle === 'anniversary' ? '到職週年' : '曆年'}」重置。`;
      if (!summary.configured) return '填入第一天上班日後，系統才會啟用特休年資與額度計算。';
      if (!summary.entitlement) return `目前尚未取得自動特休額度；下一個計算節點為 ${summary.nextGrantDate}。`;
      return `目前自動週年基準為 ${summary.entitlement} 天；本期自 ${summary.start} 起至 ${summary.end} 前，下一次增加日為 ${summary.nextGrantDate}。`;
    };

    const companyLeavePolicyFieldsHtml = (draft) => {
      const policies = normalizeLeavePolicies(draft.leavePolicies);
      return Object.entries(LEAVE_TYPES).map(([type, meta]) => {
        if (type === 'menstrual') return `<div class="quota-policy-row" data-fixed-leave-policy="menstrual"><div class="quota-policy-name">${escapeHtml(meta.label)}</div><div><span class="field-label">額度方式</span><div class="field" style="display:flex;align-items:center;font-weight:800">每個曆月 1 天</div></div><div><span class="field-label">重置方式</span><div class="field" style="display:flex;align-items:center;font-weight:800">每月自動重置</div></div></div>`;
        const policy = policies[type];
        const modeOptions = type === 'annual'
          ? `<option value="auto" ${policy.mode === 'auto' ? 'selected' : ''}>依到職日自動試算</option><option value="custom" ${policy.mode === 'custom' ? 'selected' : ''}>公司自訂額度</option>`
          : `<option value="unlimited" ${policy.mode === 'unlimited' ? 'selected' : ''}>不設管理上限</option><option value="custom" ${policy.mode === 'custom' ? 'selected' : ''}>公司自訂額度</option>`;
        return `<div class="quota-policy-row"><div class="quota-policy-name">${escapeHtml(meta.label)}</div><label><span class="field-label">額度方式</span><select class="field-select" name="leavePolicy_${type}_mode">${modeOptions}</select></label><label><span class="field-label">自訂天數</span><input class="field" name="leavePolicy_${type}_quotaDays" type="number" min="0" max="366" step="0.5" value="${escapeAttr(policy.quotaDays)}"><span class="hint">僅自訂額度時套用</span></label></div>`;
      }).join('');
    };

    const companyFixedRowsHtml = (items) => (items || []).map((item, index) => `<div class="custom-row" data-company-fixed-row data-index="${index}"><input class="field" name="fixedEarning_${index}_name" type="text" maxlength="40" value="${escapeAttr(item.name)}" placeholder="例如：全勤獎金、輪班津貼"><input class="field" name="fixedEarning_${index}_amount" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(numberValue(item.amount))}" placeholder="金額"><button class="btn btn-danger btn-small" type="button" data-action="remove-company-fixed" data-index="${index}" aria-label="移除固定加項">×</button></div>`).join('');

    const companyFormHtml = (draft, editing) => {
      const isDispatch = normalizeEmploymentMode(draft.employmentMode) === 'dispatch_hourly';
      const salaryFields = isDispatch
        ? `<label><span class="field-label">預設基本時薪 *</span><input class="field" name="baseHourlyRate" type="number" min="0.001" step="0.001" inputmode="decimal" required value="${escapeAttr(normalizeHourlyRate(draft.baseHourlyRate).toFixed(3))}"><span class="hint">最多保留小數後三碼</span></label><label><span class="field-label">每月預設正常工時 *</span><input class="field" name="defaultRegularHours" type="number" min="0.5" max="744" step="0.5" inputmode="decimal" required value="${escapeAttr(draft.defaultRegularHours)}"><span class="hint">新增薪資時可按月份修改</span></label><div class="notice span-2" id="companyDispatchPreview"><b>預估月基本薪資：</b>$${money(normalizeHourlyRate(draft.baseHourlyRate) * numberValue(draft.defaultRegularHours))}（$${hourlyRateNumber(draft.baseHourlyRate)} × ${rateNumber(draft.defaultRegularHours)} 小時）。實際月薪以每月薪資明細的正常工時快照為準。</div>`
        : moneyInput('baseSalary', '預設本薪', draft.baseSalary);
      return `<form id="companyForm">
      <div class="form-grid">
        <label class="span-2"><span class="field-label">公司名稱 *</span><input class="field" name="name" aria-label="公司名稱" required maxlength="80" value="${escapeAttr(draft.name)}"></label>
        <label><span class="field-label">職稱／職位</span><input class="field" name="position" maxlength="60" value="${escapeAttr(draft.position)}"></label>
        <label><span class="field-label">任職狀態</span><select class="field-select" name="isCurrent"><option value="true" ${draft.isCurrent ? 'selected' : ''}>現任公司</option><option value="false" ${!draft.isCurrent ? 'selected' : ''}>歷任公司</option></select></label>
        <label class="span-2"><span class="field-label">計薪方式</span><select class="field-select" name="employmentMode"><option value="monthly" ${!isDispatch ? 'selected' : ''}>月薪制</option><option value="dispatch_hourly" ${isDispatch ? 'selected' : ''}>派遣（時薪）</option></select><span class="hint">派遣時薪制會以「基本時薪 × 當月正常工時」換算底薪，並保留每月快照。</span></label>
        ${salaryFields}${moneyInput('mealAllowance', '預設伙食津貼', draft.mealAllowance)}${moneyInput('positionAllowance', '預設職務加給', draft.positionAllowance)}
        ${moneyInput('laborIns', '預設勞保自負額', draft.laborIns)}${moneyInput('healthIns', '預設健保自負額', draft.healthIns)}
      </div>
      <div class="form-group earn" style="margin-top:14px">
        <div class="group-head"><strong>固定加給與津貼</strong><span class="soft-badge">納入時薪</span></div>
        <div class="notice"><b>連動方式：</b>職務加給與下列固定加項會自動帶入新薪資紀錄，並納入薪資時薪分析及請假扣薪的固定薪資基礎；每日加班時薪仍由每筆紀錄獨立保存。</div>
        <div class="custom-list">${companyFixedRowsHtml(draft.fixedEarnings)}</div>
        <div class="form-actions"><button class="btn btn-small" type="button" data-action="add-company-fixed">＋ 自行加入固定加項</button></div>
      </div>
      <div class="form-group" style="margin-top:14px">
        <div class="group-head"><strong>出勤與特休設定</strong><span class="soft-badge">到職週年基準</span></div>
        <div class="form-grid">
          <label><span class="field-label">第一天上班日（到職日）</span><input class="field" name="employmentStartDate" type="date" value="${escapeAttr(draft.employmentStartDate)}"></label>
          <label><span class="field-label">每日標準工時</span><input class="field" name="workHoursPerDay" type="number" min="1" max="24" step="0.5" value="${escapeAttr(draft.workHoursPerDay)}"><span class="hint">請假天數與半天會依此換算時數，預設 8 小時。</span></label>
          <div class="notice span-2"><b>特休試算：</b>${escapeHtml(companyAnnualLeaveHint(draft))}</div>
        </div>
      </div>
      <div class="form-group" style="margin-top:14px">
        <div class="group-head"><strong>假別額度管理</strong><span class="soft-badge">可自行調整</span></div>
        <div class="form-grid" style="margin-bottom:10px">
          <label class="span-2"><span class="field-label">公司自訂額度週期</span><select class="field-select" name="leaveQuotaCycle"><option value="calendar" ${draft.leaveQuotaCycle === 'calendar' ? 'selected' : ''}>曆年制（每年 1/1 重置）</option><option value="anniversary" ${draft.leaveQuotaCycle === 'anniversary' ? 'selected' : ''}>到職週年制</option></select><span class="hint">特休選「自動試算」時仍依到職週年；此選項套用於所有公司自訂額度。</span></label>
        </div>
        <div class="quota-policy-list">${companyLeavePolicyFieldsHtml(draft)}</div>
        <div class="notice" style="margin-top:10px"><b>管理原則：</b>預計請假會先保留額度、已確認會列入已用；生理假固定每個曆月 1 天並於每月重置，其他不設上限假別仍保留用量分析。這是公司內部管理設定，不會取代實際人事制度。</div>
      </div>
      <div class="form-group" style="margin-top:14px">
        <div class="group-head"><strong>計薪區間與扣款規則</strong><span class="soft-badge">公司預設</span></div>
        <div class="form-grid">
          <label class="span-2"><span class="field-label">加班／薪資計算區間</span><select class="field-select" name="payrollPeriodType"><option value="calendar" ${draft.payrollPeriodType === 'calendar' ? 'selected' : ''}>標準｜每月 1 日～月底</option><option value="prev16" ${draft.payrollPeriodType === 'prev16' ? 'selected' : ''}>公司自訂｜16 日～次月 15 日</option><option value="custom" ${draft.payrollPeriodType === 'custom' ? 'selected' : ''}>公司自訂｜指定開始／結束日</option></select><span class="hint">進階設定已提供獨立編輯入口；這裡保留舊流程相容性。</span></label>
          <label><span class="field-label">自訂開始日</span><input class="field" name="payrollCycleStartDay" type="number" min="1" max="31" step="1" value="${escapeAttr(draft.payrollPeriodType === 'prev16' ? 16 : draft.payrollCycleStartDay || 1)}"></label>
          <label><span class="field-label">自訂結束日</span><input class="field" name="payrollCycleEndDay" type="number" min="1" max="31" step="1" value="${escapeAttr(draft.payrollPeriodType === 'prev16' ? 15 : draft.payrollCycleEndDay || 31)}"></label>
          ${moneyInput('leaveDeductionEach', '每次扣款金額', draft.leaveDeductionEach)}
          <div class="notice"><b>扣款計算：</b>每次扣款金額 × 本期扣款次數；次數在加班費試算頁輸入。</div>
          <label class="span-2"><span class="field-label">扣款規則備註</span><textarea class="field-textarea" name="deductionRuleNote" maxlength="240">${escapeHtml(draft.deductionRuleNote)}</textarea></label>
        </div>
        <div class="notice warning" style="margin-top:10px">變更計薪區間後，既有加班與請假紀錄會立即依新規則重新歸屬薪資月份；跨日請假也會重新拆分，但原始日期不會被修改。已同步的請假扣項若金額改變，系統會提示重新同步。</div>
      </div>
    </form>`;
    };

    const companyDialogFooterHtml = (editing) => `<div class="dialog-footer" data-dialog-footer="company"><button class="btn" type="button" data-action="new-company">${editing ? '取消編輯' : '清空'}</button><button class="btn btn-primary" type="button" data-action="save-company">${editing ? '儲存公司設定' : '新增公司'}</button></div>`;

    const companySalarySummary = (company) => company.employmentMode === 'dispatch_hourly'
      ? `派遣時薪 $${hourlyRateNumber(company.baseHourlyRate)} × 預設 ${rateNumber(company.defaultRegularHours)} 小時＝$${money(company.baseHourlyRate * company.defaultRegularHours)}`
      : `月薪制｜本薪 $${money(company.baseSalary)}`;

    const renderCompanyDialogBody = () => {
      const draft = ui.companyDraft || normalizeCompany({ id: '', name: '', isCurrent: state.companies.length === 0, baseSalary: 0, mealAllowance: 3000 });
      return `<div class="section-title"><div><h3 style="font-size:15px">既有公司</h3><p>現任公司會成為新增薪資與請假紀錄的預設值；每日加班時薪獨立保存</p></div></div><div class="company-list">${state.companies.length ? state.companies.map((company) => { const annual = annualLeaveSummary(company); const managedQuotaCount = Object.values(normalizeLeavePolicies(company.leavePolicies)).filter((policy) => policy.mode === 'custom').length; const fixedCount = normalizeFixedEarnings(company.fixedEarnings).filter((item) => item.name.trim() || item.amount).length; return `<div class="company-item"><div><h4>${userHtml(company.name)} <span class="status ${company.isCurrent ? 'current' : 'former'}">${company.isCurrent ? '現任' : '歷任'}</span> <span class="soft-badge">${escapeHtml(employmentModeName(company.employmentMode))}</span></h4><p>${(company.position ? userHtml(company.position) : '未設定職稱')}｜${escapeHtml(companySalarySummary(company))}｜職務加給 $${money(company.positionAllowance)}｜固定加項 ${fixedCount} 項／$${money(customTotal(company.fixedEarnings))}</p><p>${escapeHtml(companyPayrollPeriodName(company.id))}｜到職 ${escapeHtml(company.employmentStartDate || '尚未設定')}｜每日 ${rateNumber(company.workHoursPerDay)} 小時｜特休 ${annual.configured ? `${rateNumber(annual.remaining)}／${rateNumber(annual.entitlement)} 天` : '尚未啟用'}｜自訂額度 ${managedQuotaCount} 項</p></div><div class="company-item-actions"><button class="btn btn-small" type="button" data-action="edit-company" data-id="${escapeAttr(company.id)}">編輯</button><button class="btn btn-small btn-danger" type="button" data-action="delete-company" data-id="${escapeAttr(company.id)}">刪除</button></div></div>`; }).join('') : '<div class="notice">尚未建立公司。新增後即可開始記錄薪資、加班與請假。</div>'}</div><div class="section-title"><div><h3 style="font-size:15px">${draft.id ? '編輯公司' : '新增公司'}</h3></div></div>${companyFormHtml(draft, Boolean(draft.id))}`;
    };

    const openCompanyManager = (company = null) => {
      ui.companyDraft = company ? clone(company) : normalizeCompany({ id: '', name: '', isCurrent: state.companies.length === 0, baseSalary: 0, mealAllowance: 3000 });
      beginDraftScope({ entityType: 'company-full', companyId: company?.id || '', entityId: company?.id || '', operational: false });
      openDialog('公司詳細設定', renderCompanyDialogBody(), true, companyDialogFooterHtml(Boolean(ui.companyDraft.id)));
    };

    const companyOvertimeRate = (companyId, date) => salaryProfileOvertimeBasis(salaryProfileAt(getCompany(companyId), date)).hourlyRate;
    const blankOvertime = () => {
      const company = currentCompany();
      const date = v5WorkDate();
      return normalizeOvertime({ id: newId('ot'), date, companyId: company?.id || '', type: 'weekday', hours: 2, hourlyRate: companyOvertimeRate(company?.id, date), customRate: 1.34 });
    };

    const overtimeAttributionText = (draft) => {
      const attributed = salaryMonthForDate(draft.date, draft.companyId);
      if (!attributed) return '請選擇日期以判斷薪資月份';
      return `此筆歸屬 ${attributed.year} 年 ${attributed.month} 月薪資｜計算區間 ${salaryPeriodLabel(attributed.year, attributed.month, draft.companyId)}`;
    };

    const overtimeFormHtml = (draft, editing) => {
      const company = getCompany(draft.companyId);
      return `<form id="overtimeForm"><input type="hidden" name="companyId" value="${escapeAttr(draft.companyId)}"><p class="v5-form-context">${(company?.name ? userHtml(company?.name) : escapeHtml(''))}</p><div class="form-grid">
      <label><span class="field-label">日期</span><input class="field" name="date" type="date" required value="${escapeAttr(draft.date)}"></label>
      <label><span class="field-label">加班時數</span><input class="field" name="hours" type="number" min="0.5" max="${draft.type==='restday'?12:24}" step="0.5" required value="${draft.hours}"></label>
      <div class="v5-hours span-2">${[1,2,8,10].map(n=>`<button type="button" class="btn btn-small" data-v5="quick-hours" data-value="${n}">${n} 小時</button>`).join('')}</div>
      <label class="span-2"><span class="field-label">加班類型</span><select class="field-select" name="type">${[['weekday','平日 · 近似倍率 1.34／1.67'],['restday','休息日 · 近似倍率 1.34／1.67／2.67'],['holiday','例假日／約定假日 · 公司約定 2.0 倍'],['spring','春節約定 · 2.5 倍'],['custom','自訂固定倍率']].map(([v,t])=>`<option value="${v}" ${draft.type===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <label><span class="field-label">本次時薪（元）</span><input class="field" name="hourlyRate" type="number" min="0" step="0.001" inputmode="decimal" required value="${escapeAttr(roundHourlyRate(draft.hourlyRate).toFixed(3))}"><span class="hint">每筆獨立保存，後續調薪不回寫。</span></label>
      <label id="customRateField" ${draft.type==='custom'?'':'hidden'}><span class="field-label">固定倍率</span><input class="field" name="customRate" type="number" min="0" step="0.01" value="${draft.customRate}"></label>
      <div class="span-2 company-overtime-default"><span class="hint"><span>當日公司薪資基準：</span><strong id="overtimeCompanyBasis">$${hourlyRateNumber(companyOvertimeRate(draft.companyId, draft.date))}</strong></span><button class="btn btn-small" type="button" data-action="use-company-overtime-rate">帶入公司基準</button><span class="hint">可依公司核定時薪調整；手動輸入後不隨日期自動改寫。</span></div>
      <label class="span-2"><span class="field-label">備註（選填）</span><input class="field" name="note" maxlength="160" value="${escapeAttr(draft.note)}" placeholder="例如：產線支援"></label></div>
      <div class="live-total"><span>本次加班費試算</span><strong id="overtimeLiveTotal">$${money(overtimeAmount(draft))}</strong></div>
      <details class="v5-explanation"><summary>薪資歸屬與試算說明</summary><div id="overtimePeriodHint" class="notice">${escapeHtml(overtimeAttributionText(draft))}</div><p class="hint">1.34／1.67 是近似倍率，2.0／春節 2.5 為公司約定試算。星期幾不等於法定日別，請依班表與薪資單確認。</p></details>
      <div class="form-actions">${editing?`<button class="btn btn-danger form-delete-action" type="button" data-action="delete-overtime" data-id="${escapeAttr(draft.id)}">刪除紀錄</button>`:''}<button class="btn" type="button" data-action="close-dialog">返回</button><button class="btn btn-primary" type="submit">${editing?'儲存修改':'儲存加班'}</button></div></form>`;
    };

    const collectOvertimeDraft = () => {
      const form = $('#overtimeForm');
      if (!form || !ui.overtimeDraft) return ui.overtimeDraft;
      const data = new FormData(form);
      const companyId = String(data.get('companyId') || '');
      const date = String(data.get('date') || '');
      ui.overtimeDraft = normalizeOvertime({ ...ui.overtimeDraft, date, companyId, type: data.get('type'), hours: data.get('hours'), hourlyRate: data.get('hourlyRate'), customRate: data.get('customRate'), note: data.get('note') });
      return ui.overtimeDraft;
    };

    const openOvertimeForm = (log = null) => {
      if(log&&state.compTimeCredits.some(row=>row.sourceId===log.id))return toast('這筆加班已有補休來源，請先撤銷未使用轉入，或保留原始紀錄。','error');
      if (!state.companies.length) {
        toast('請先建立至少一家公司', 'error');
        openCompanyBasicForm();
        return;
      }
      if (!log && !currentCompany()) { toast('請先在公司管理設為目前公司', 'error'); selectPrimaryTab('companies'); return; }
      ui.overtimeDraft = log ? clone(log) : blankOvertime();
      ui.overtimeRateManual = Boolean(log);
      beginDraftScope({ entityType: 'overtime', companyId: ui.overtimeDraft.companyId, entityId: log?.id || '', operational: true });
      markSelectedEntity('overtime', log?.id || '', ui.overtimeDraft.companyId);
      openDialog(log ? '編輯加班紀錄' : '新增每日加班', overtimeFormHtml(ui.overtimeDraft, Boolean(log)), false);
    };

    const useCompanyOvertimeRate = () => {
      const draft = collectOvertimeDraft();
      if (!draft) return;
      draft.hourlyRate = companyOvertimeRate(draft.companyId, draft.date);
      $('#overtimeForm [name="hourlyRate"]').value = draft.hourlyRate.toFixed(3);
      ui.overtimeRateManual = false;
      updateOvertimePreview(); markDraftDirty();
    };
    const updateOvertimePreview = (changedField = '') => {
      if (changedField === 'hourlyRate') ui.overtimeRateManual = true;
      const draft = collectOvertimeDraft();
      if (!draft) return;
      if (changedField === 'date' && !ui.overtimeRateManual && !state.overtimeLogs.some((log) => log.id === draft.id)) {
        draft.hourlyRate = companyOvertimeRate(draft.companyId, draft.date);
        $('#overtimeForm [name="hourlyRate"]').value = draft.hourlyRate.toFixed(3);
      }
      const basis = $('#overtimeCompanyBasis');
      if (basis) basis.textContent = `$${hourlyRateNumber(companyOvertimeRate(draft.companyId, draft.date))}`;
      const total = $('#overtimeLiveTotal');
      if (total && draft) total.textContent = `$${money(overtimeAmount(draft))}`;
      const periodHint = $('#overtimePeriodHint');
      if (periodHint && draft) periodHint.innerHTML = `<b>薪資歸屬：</b>${escapeHtml(overtimeAttributionText(draft))}`;
      const customField = $('#customRateField');
      if (customField) customField.hidden = draft.type !== 'custom';
    };

    const blankLeave = () => {
      const company = currentCompany();
      return normalizeLeave({ id: newId('leave'), startDate: v5WorkDate(), endDate: v5WorkDate(), companyId: company?.id || '', type: 'annual', durationMode: 'full_day', status: 'planned', quantity: 1, paidRatio: 100, attendanceDeduction: 0 });
    };

    const leaveAttributionText = (draft) => {
      const allocations = leaveAllocations(draft);
      if (!allocations.length) return '請確認日期區間；目前沒有可計算的工作日';
      const labels = allocations.map((item) => `${item.year} 年 ${item.month} 月 ${rateNumber(item.hours)} 小時`).join('、');
      return allocations.length > 1 ? `跨計薪區間，自動拆分為：${labels}` : `歸屬 ${labels}｜計算區間 ${salaryPeriodLabel(allocations[0].year, allocations[0].month, draft.companyId)}`;
    };

    const leaveAnnualHintText = (draft) => {
      const company = getCompany(draft.companyId);
      const summary = company ? leaveQuotaSummary(company, draft.type, draft.startDate || todayIso()) : null;
      if (draft.type === 'menstrual' && summary) {
        const parts = parseDateParts(summary.start);
        const cycleLabel = parts ? `${parts.year} 年 ${parts.month} 月` : '本月';
        return `生理假每個曆月可使用 1 天｜${cycleLabel}已確認 ${rateNumber(summary.used)} 天｜預留 ${rateNumber(summary.reserved)} 天｜目前可用 ${rateNumber(summary.remaining)} 天；本次申請 ${rateNumber(leaveDays(draft))} 天。`;
      }
      if (summary?.limited && !summary.configured) return '此假別使用到職週年週期，但公司尚未設定第一天上班日；儲存時會提醒確認。';
      if (summary?.limited) return `${leaveTypeName(draft.type)}本期額度 ${rateNumber(summary.entitlement)} 天｜已確認 ${rateNumber(summary.used)} 天｜預留 ${rateNumber(summary.reserved)} 天｜目前可用 ${rateNumber(summary.remaining)} 天；本次申請 ${rateNumber(leaveDays(draft))} 天。`;
      if (draft.type === 'sick') return '普通病假預設半薪；目前未設管理上限，仍會列入出勤與用量分析。全勤／出勤扣款請依公司薪資單輸入。';
      return `${leaveTypeName(draft.type)}目前未設管理上限；已確認與預計用量仍會分開統計，給薪比例可自行修改。`;
    };

    const leaveDurationFieldsHtml = (draft) => {
      if (draft.durationMode === 'hours') return `<label><span class="field-label">請假時數 *</span><input class="field" name="customHours" type="number" min="0.5" max="24" step="0.5" required value="${escapeAttr(draft.customHours || 1)}"></label><div class="notice"><b>小時請假：</b>將依公司每日標準工時換算特休天數與扣薪。</div>`;
      if (draft.durationMode !== 'range') return '';
      return `<label><span class="field-label">結束日期 *</span><input class="field" name="endDate" type="date" required min="${escapeAttr(draft.startDate)}" value="${escapeAttr(draft.endDate || draft.startDate)}"></label><label><span class="field-label">開始日區段</span><select class="field-select" name="startPortion"><option value="full" ${draft.startPortion === 'full' ? 'selected' : ''}>整天</option><option value="pm" ${draft.startPortion === 'pm' ? 'selected' : ''}>下午半天起</option></select></label><label><span class="field-label">結束日區段</span><select class="field-select" name="endPortion"><option value="full" ${draft.endPortion === 'full' ? 'selected' : ''}>整天</option><option value="am" ${draft.endPortion === 'am' ? 'selected' : ''}>上午半天止</option></select></label><label style="align-self:end"><span class="field-label">非工作日</span><span class="field" style="display:flex;align-items:center;gap:8px"><input name="includeWeekends" type="checkbox" value="true" ${draft.includeWeekends ? 'checked' : ''}> 納入週六、週日</span></label>`;
    };

    const leaveFormHtml = (draft, editing) => {
      const company=getCompany(draft.companyId);
      return `<form id="leaveForm"><input type="hidden" name="companyId" value="${escapeAttr(draft.companyId)}"><p class="v5-form-context">${(company?.name ? userHtml(company?.name) : escapeHtml(''))}</p><div class="form-grid">
      <label><span class="field-label">日期</span><input class="field" name="startDate" type="date" required value="${escapeAttr(draft.startDate)}"></label>
      <label><span class="field-label">狀態</span><select class="field-select" name="status">${[['planned','預計'],['confirmed','已確認'],['cancelled','已取消']].map(([v,t])=>`<option value="${v}" ${draft.status===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <label><span class="field-label">假別</span><select class="field-select" name="type">${Object.entries(LEAVE_TYPES).map(([v,t])=>`<option value="${v}" ${draft.type===v?'selected':''}>${escapeHtml(t.label)}${['sick','menstrual','personal','family'].includes(v) ? ` · ${t.paidRatio===50 ? '扣半薪' : '扣全薪'}` : ''}</option>`).join('')}</select></label>
      <label><span class="field-label">請假時間</span><select class="field-select" name="durationMode">${[['full_day','整天'],['half_am','上午半天'],['half_pm','下午半天'],['hours','自訂小時'],['range','連續多天']].map(([v,t])=>`<option value="${v}" ${draft.durationMode===v?'selected':''}>${t}</option>`).join('')}</select></label>
      ${leaveDurationFieldsHtml(draft)}
      ${draft.type==='compensatory'?`<label class="span-2 checkbox-line"><input name="compTimeLinked" type="checkbox" value="true" ${draft.compTimeLinked?'checked':''}> 從補休帳本扣除（確認後生效）</label>`:''}
      <label class="span-2"><span class="field-label">備註（選填）</span><input class="field" name="note" maxlength="160" value="${escapeAttr(draft.note)}" placeholder="例如：回診、家庭安排"></label></div>
      <div class="v5-leave-preview"><span>請假時數</span><strong id="leaveHoursPreview">${rateNumber(leaveHours(draft))} 小時</strong></div>
      <p class="hint" id="leaveAnnualHint">${escapeHtml(leaveAnnualHintText(draft))}</p>
      <div class="notice"><p class="hint">病假、生理假預設扣半薪；事假、家庭照顧假預設扣全薪。</p><div class="summary-row"><span>本次扣薪比例</span><b id="leaveDeductionRatioPreview">${rateNumber(100-clamp(draft.paidRatio,0,100))}%</b></div><div class="summary-row"><span>請假扣薪試算</span><b id="leaveWagePreview">−$${money(leaveWageDeduction(draft))}</b></div><div class="summary-row"><span>扣款試算合計</span><b id="leaveTotalPreview">$${money(leaveTotalDeduction(draft))}</b></div></div>
      <details class="v5-explanation"><summary>給薪與扣款設定</summary><div class="form-grid"><label><span class="field-label">給薪比例（%）</span><input class="field" name="paidRatio" type="number" min="0" max="100" step="1" required value="${draft.paidRatio}"></label>${moneyInput('attendanceDeduction','出勤扣款（元）',draft.attendanceDeduction)}</div><div id="leavePeriodHint" class="notice">${escapeHtml(leaveAttributionText(draft))}</div><p class="hint">確認後可在請假紀錄預覽並帶入薪資扣項。</p></details>
      <div class="form-actions">${editing?`<button class="btn btn-danger form-delete-action" type="button" data-action="delete-leave" data-id="${escapeAttr(draft.id)}">刪除紀錄</button>`:''}<button class="btn" type="button" data-action="close-dialog">返回</button><button class="btn btn-primary" type="submit">${editing?'儲存修改':'儲存請假'}</button></div></form>`;
    };

    const collectLeaveDraft = () => {
      const form = $('#leaveForm');
      if (!form || !ui.leaveDraft) return ui.leaveDraft;
      const data = new FormData(form);
      const startDate = data.get('startDate');
      const durationMode = data.get('durationMode') || ui.leaveDraft.durationMode;
      const customHours = durationMode === 'hours' ? data.get('customHours') : 0;
      ui.leaveDraft = normalizeLeave({
        ...ui.leaveDraft,
        startDate,
        endDate: durationMode === 'range' ? (data.get('endDate') || startDate) : startDate,
        date: startDate,
        companyId: data.get('companyId'),
        status: data.get('status'),
        type: data.get('type'),
        compTimeLinked: data.get('compTimeLinked')==='true',
        durationMode,
        startPortion: data.get('startPortion') || 'full',
        endPortion: data.get('endPortion') || 'full',
        includeWeekends: data.get('includeWeekends') === 'true',
        customHours,
        quantity: durationMode === 'hours' ? customHours : 1,
        paidRatio: data.get('paidRatio'),
        attendanceDeduction: data.get('attendanceDeduction'),
        note: data.get('note')
      });
      return ui.leaveDraft;
    };

    const openLeaveForm = (record = null) => {
      if (!state.companies.length) {
        toast('請先建立至少一家公司', 'error');
        openCompanyBasicForm();
        return;
      }
      if (!record && !currentCompany()) { toast('請先在公司管理設為目前公司', 'error'); selectPrimaryTab('companies'); return; }
      ui.leaveDraft = record ? clone(record) : blankLeave();
      beginDraftScope({ entityType: 'leave', companyId: ui.leaveDraft.companyId, entityId: record?.id || '', operational: true });
      markSelectedEntity('leave', record?.id || '', ui.leaveDraft.companyId);
      openDialog(record ? '編輯請假紀錄' : '新增請假紀錄', leaveFormHtml(ui.leaveDraft, Boolean(record)), false);
    };

    const updateLeavePreview = () => {
      const draft = collectLeaveDraft();
      if (!draft) return;
      const periodHint = $('#leavePeriodHint');
      if (periodHint) periodHint.innerHTML = `<b>薪資歸屬：</b>${escapeHtml(leaveAttributionText(draft))}`;
      const hours = $('#leaveHoursPreview');
      if (hours) hours.textContent = `${rateNumber(leaveHours(draft))} 小時`;
      const wage = $('#leaveWagePreview');
      if (wage) wage.textContent = `−$${money(leaveWageDeduction(draft))}`;
      const ratio = $('#leaveDeductionRatioPreview');
      if (ratio) ratio.textContent = `${rateNumber(100-clamp(draft.paidRatio,0,100))}%`;
      const total = $('#leaveTotalPreview');
      if (total) total.textContent = `$${money(leaveTotalDeduction(draft))}`;
      const annualHint = $('#leaveAnnualHint');
      if (annualHint) annualHint.innerHTML = `<b>假別提醒：</b>${escapeHtml(leaveAnnualHintText(draft))}`;
    };

    const confirm = (title, message, action, confirmLabel = '確定') => {
      ui.confirmAction = action;
      openDialog(title, `<p style="margin-top:0;color:var(--muted)">${escapeHtml(message)}</p><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-danger" type="button" data-action="confirm-action">${escapeHtml(confirmLabel)}</button></div>`);
    };

    const recordExists = (draft, exceptId = '') => state.records.some((record) => record.id !== exceptId && record.companyId === draft.companyId && Number(record.year) === Number(draft.year) && Number(record.month) === Number(draft.month));

    const saveRecordForm = () => {
      const draft = collectRecordDraft();
      const form = $('#recordForm');
      if (!validateNativeForm(form)) return;
      if (!assertDraftScope({ entityType: 'payroll', companyId: draft.companyId, entityId: state.records.some((record) => record.id === draft.id) ? draft.id : '', payrollMonth: payrollMonthKey(draft.year, draft.month), operational: true })) return;
      if (!getCompany(draft.companyId)) { showValidationSummary(form, '目前公司資料需要確認。薪資尚未建立，請回公司管理重新選擇目前公司。'); focusFirstValidationError(form); return; }
      const editing = state.records.some((record) => record.id === draft.id);
      if (!editing && ui.payrollStep !== 3) { showValidationSummary(form, '請完成「月份 → 本月資料 → 確認」3 個步驟後再建立薪資。'); return; }
      if (!editing && draft.companyId !== currentCompany()?.id) { showValidationSummary(form, '目前公司已變更。薪資尚未建立，請取消後重新開始。'); return; }
      if (draft.employmentMode === 'dispatch_hourly' && draft.baseHourlyRate <= 0) { validateField(form, 'baseHourlyRate', '請輸入大於 0 的基本時薪。'); return; }
      if (draft.employmentMode === 'dispatch_hourly' && draft.regularHours <= 0) { validateField(form, 'regularHours', '請輸入大於 0 的正常工時。'); return; }
      if (recordExists(draft, editing ? draft.id : '')) { showValidationSummary(form, '這家公司在這個薪資月份已有薪資紀錄。請查看既有紀錄或選擇其他月份。'); return; }
      const index = state.records.findIndex((record) => record.id === draft.id);
      const ok = commitStateMutation(() => {
        if (index >= 0) state.records[index] = draft;
        else state.records.push(draft);
      }, '薪資建立失敗。資料尚未建立，原本資料保持不變。');
      if (!ok) return;
      closeDialog();
      renderAll();
      toast(index >= 0 ? '薪資紀錄已更新' : '薪資紀錄已新增');
    };

    const collectCompanyDraft = () => {
      const form = $('#companyForm');
      if (!form || !ui.companyDraft) return ui.companyDraft;
      const data = new FormData(form);
      const existingLeavePolicies = normalizeLeavePolicies(ui.companyDraft.leavePolicies);
      const leavePolicies = Object.fromEntries(Object.keys(LEAVE_TYPES).map((type) => [type, {
        mode: type === 'menstrual' ? existingLeavePolicies[type].mode : data.get(`leavePolicy_${type}_mode`),
        quotaDays: type === 'menstrual' ? existingLeavePolicies[type].quotaDays : data.get(`leavePolicy_${type}_quotaDays`)
      }]));
      const fixedEarnings = (ui.companyDraft.fixedEarnings || []).map((item, index) => ({
        ...item,
        id: item.id || newId('fixed'),
        name: data.get(`fixedEarning_${index}_name`) ?? item.name,
        amount: data.get(`fixedEarning_${index}_amount`) ?? item.amount,
        affectsHourly: true
      }));
      ui.companyDraft = normalizeCompany({
        ...ui.companyDraft,
        name: data.get('name'),
        position: data.get('position'),
        isCurrent: data.get('isCurrent') === 'true',
        employmentMode: data.get('employmentMode'),
        baseSalary: data.has('baseSalary') ? data.get('baseSalary') : ui.companyDraft.baseSalary,
        baseHourlyRate: data.has('baseHourlyRate') ? data.get('baseHourlyRate') : ui.companyDraft.baseHourlyRate,
        defaultRegularHours: data.has('defaultRegularHours') ? data.get('defaultRegularHours') : ui.companyDraft.defaultRegularHours,
        mealAllowance: data.get('mealAllowance'),
        positionAllowance: data.get('positionAllowance'),
        fixedEarnings,
        laborIns: data.get('laborIns'),
        healthIns: data.get('healthIns'),
        employmentStartDate: data.get('employmentStartDate'),
        workHoursPerDay: data.get('workHoursPerDay'),
        leaveQuotaCycle: data.get('leaveQuotaCycle'),
        leavePolicies,
        payrollPeriodType: data.get('payrollPeriodType'),
        payrollCycleStartDay: data.get('payrollCycleStartDay'),
        payrollCycleEndDay: data.get('payrollCycleEndDay'),
        leaveDeductionEach: data.get('leaveDeductionEach'),
        deductionRuleNote: data.get('deductionRuleNote')
      });
      return ui.companyDraft;
    };

    const saveCompanyForm = () => {
      const form = $('#companyForm');
      if (!form || !ui.companyDraft) return toast('公司表單尚未準備完成。請重新開啟後再試一次。', 'error');
      if (!validateNativeForm(form)) return;
      const collectedCompanyDraft = collectCompanyDraft();
      if (!assertDraftScope({ entityType: 'company-full', companyId: collectedCompanyDraft?.id || '', entityId: collectedCompanyDraft?.id || '', operational: false, allowNewCompany: !collectedCompanyDraft?.id })) return;
      const draft = normalizeCompany({
        ...collectedCompanyDraft,
        id: ui.companyDraft?.id || newId('company'),
        fixedEarnings: normalizeFixedEarnings(ui.companyDraft?.fixedEarnings).filter((item) => item.name.trim() || numberValue(item.amount))
      });
      if (!draft.name.trim()) { validateField(form, 'name', '請輸入公司名稱。'); return; }
      if (draft.employmentMode === 'dispatch_hourly' && draft.baseHourlyRate <= 0) { validateField(form, 'baseHourlyRate', '基本時薪必須大於 0。'); return; }
      if (draft.employmentMode === 'dispatch_hourly' && draft.defaultRegularHours <= 0) { validateField(form, 'defaultRegularHours', '每月預設正常工時必須大於 0。'); return; }
      const index = state.companies.findIndex((company) => company.id === draft.id);
      const ok = commitStateMutation(() => {
        if (draft.isCurrent) state.companies.forEach((company) => { company.isCurrent = false; });
        if (index >= 0) state.companies[index] = draft;
        else state.companies.push(draft);
        if (state.overtimeCalculator.companyId === draft.id || !getCompany(state.overtimeCalculator.companyId)) applyCompanyDefaultsToCalculator(draft);
      }, index >= 0 ? '儲存失敗。原本公司資料保持不變。' : '公司建立失敗。資料尚未建立。');
      if (!ok) return;
      ui.companyDraft = normalizeCompany({ id: '', name: '', isCurrent: false, baseSalary: 0, mealAllowance: 3000 });
      openDialog('公司詳細設定', renderCompanyDialogBody(), true, companyDialogFooterHtml(false));
      renderFilters();
      renderView();
      toast(index >= 0 ? '公司資料已更新' : '公司已新增');
    };

    const saveOvertimeForm = () => {
      const draft = collectOvertimeDraft();
      const form = $('#overtimeForm');
      if (!validateNativeForm(form)) return;
      if (!assertDraftScope({ entityType: 'overtime', companyId: draft.companyId, entityId: state.overtimeLogs.some((log) => log.id === draft.id) ? draft.id : '', operational: true })) return;
      if(state.compTimeCredits.some(row=>row.sourceId===draft.id)){showValidationSummary(form,'這筆加班已轉入補休，無法編輯來源。');return}
      if (numberValue(draft.hourlyRate) <= 0) { validateField(form, 'hourlyRate', '每日加班時薪必須大於 0。'); return; }
      if (draft.type === 'restday' && draft.hours > 12) { validateField(form, 'hours', '休息日加班時數不可超過 12 小時。'); return; }
      const duplicate = state.overtimeLogs.some((log) => log.id !== draft.id && log.companyId === draft.companyId && log.date === draft.date && log.type === draft.type && numberValue(log.hours) === numberValue(draft.hours));
      if (duplicate) { showValidationSummary(form, '相同日期、公司、類型與時數的加班紀錄已存在。請調整內容或編輯既有紀錄。'); return; }
      const index = state.overtimeLogs.findIndex((log) => log.id === draft.id);
      const ok = commitStateMutation(() => {
        if (index >= 0) state.overtimeLogs[index] = draft;
        else state.overtimeLogs.push(draft);
      }, '加班紀錄儲存失敗。原本資料保持不變。');
      if (!ok) return;
      closeDialog();
      renderAll();
      toast(index >= 0 ? '加班紀錄已更新' : '加班紀錄已新增');
    };

    const leavePortionForDate = (record, date) => {
      if (record.durationMode === 'half_am') return 'am';
      if (record.durationMode === 'half_pm') return 'pm';
      if (record.durationMode === 'range') {
        if (date === record.startDate && record.startPortion === 'pm') return 'pm';
        if (date === record.endDate && record.endPortion === 'am') return 'am';
      }
      return 'full';
    };
    const leaveOverlap = (draft) => {
      if (draft.status === 'cancelled') return null;
      const draftEntries = leaveDateEntries(draft);
      return state.leaveRecords.find((record) => {
        if (record.id === draft.id || record.companyId !== draft.companyId || record.status === 'cancelled') return false;
        return leaveDateEntries(record).some((existing) => draftEntries.some((entry) => {
          if (entry.date !== existing.date) return false;
          const currentPortion = leavePortionForDate(draft, entry.date);
          const existingPortion = leavePortionForDate(record, existing.date);
          return !(currentPortion === 'am' && existingPortion === 'pm') && !(currentPortion === 'pm' && existingPortion === 'am');
        }));
      }) || null;
    };
    const leaveOvertimeDates = (draft) => {
      if (draft.status === 'cancelled') return [];
      const dates = new Set(leaveDateEntries(draft).map((entry) => entry.date));
      return [...new Set(state.overtimeLogs.filter((log) => log.companyId === draft.companyId && dates.has(log.date)).map((log) => log.date))].sort();
    };
    const menstrualQuotaCapacity = (draft, company) => {
      const requestedByMonth = leaveDateEntries(draft).reduce((months, entry) => {
        const key = entry.date.slice(0, 7);
        months.set(key, (months.get(key) || 0) + entry.days);
        return months;
      }, new Map());
      const details = [...requestedByMonth.entries()].map(([monthKey, requested]) => {
        const summary = leaveQuotaSummary(company, 'menstrual', `${monthKey}-01`);
        const usedByOthers = state.leaveRecords
          .filter((record) => record.id !== draft.id && record.companyId === draft.companyId && record.type === 'menstrual' && record.status !== 'cancelled')
          .reduce((sum, record) => sum + leaveDateEntries(record)
            .filter((entry) => entry.date.slice(0, 7) === monthKey)
            .reduce((days, entry) => days + entry.days, 0), 0);
        const available = Math.max(0, 1 - usedByOthers);
        return { monthKey, requested, available, exceeded: Math.max(0, requested - available), summary };
      });
      return {
        configured: true,
        limited: true,
        monthly: true,
        requested: details.reduce((sum, item) => sum + item.requested, 0),
        available: details.reduce((sum, item) => sum + item.available, 0),
        details,
        violations: details.filter((item) => item.exceeded > 0),
        summary: details[0]?.summary || leaveQuotaSummary(company, 'menstrual', draft.startDate || todayIso())
      };
    };
    const leaveQuotaCapacity = (draft) => {
      const company = getCompany(draft.companyId);
      if (!company || draft.status === 'cancelled') return null;
      if (draft.type === 'menstrual') return menstrualQuotaCapacity(draft, company);
      const summary = leaveQuotaSummary(company, draft.type, draft.startDate || todayIso());
      if (!summary.limited) return { configured: true, limited: false, requested: leaveDays(draft), available: null, summary };
      if (!summary.configured) return { configured: false, limited: true, requested: leaveDays(draft), available: 0, summary };
      const usedByOthers = state.leaveRecords
        .filter((record) => record.id !== draft.id && record.companyId === draft.companyId && record.type === draft.type && record.status !== 'cancelled')
        .reduce((sum, record) => sum + leaveDateEntries(record).filter((entry) => entry.date >= summary.start && entry.date < summary.end).reduce((days, entry) => days + entry.days, 0), 0);
      return { configured: true, limited: true, requested: leaveDays(draft), available: Math.max(0, numberValue(summary.entitlement) - usedByOthers), cycle: summary, summary };
    };
    const annualLeaveCapacity = (draft) => draft.type === 'annual' ? leaveQuotaCapacity(draft) : null;
    const persistLeave = (draft) => {
      const index = state.leaveRecords.findIndex((record) => record.id === draft.id);
      const ok = commitStateMutation(() => {
        if (index >= 0) state.leaveRecords[index] = draft;
        else state.leaveRecords.push(draft);
      }, '請假紀錄儲存失敗。原本資料保持不變。');
      if (!ok) return false;
      closeDialog();
      renderAll();
      toast(index >= 0 ? '請假紀錄已更新' : '請假紀錄已新增');
      return true;
    };

    const saveLeaveForm = () => {
      const draft = collectLeaveDraft();
      const form = $('#leaveForm');
      if (!validateNativeForm(form)) return;
      if (!assertDraftScope({ entityType: 'leave', companyId: draft.companyId, entityId: state.leaveRecords.some((record) => record.id === draft.id) ? draft.id : '', operational: true })) return;
      if (!getCompany(draft.companyId)) { showValidationSummary(form, '目前公司資料需要確認。請回公司管理重新選擇目前公司。'); return; }
      if (!validIsoDate(draft.startDate)) { validateField(form, 'startDate', '開始日期格式不正確，請重新選擇。'); return; }
      if (!validIsoDate(draft.endDate)) { validateField(form, 'endDate', '結束日期格式不正確，請重新選擇。'); return; }
      if (draft.endDate < draft.startDate) { validateField(form, 'endDate', '結束日期不可早於開始日期。'); return; }
      if (draft.durationMode === 'range' && !enumerateIsoDates(draft.startDate, draft.endDate).length) { validateField(form, 'endDate', '跨日請假最多可輸入 366 天。'); return; }
      if (!leaveDateEntries(draft).length) { showValidationSummary(form, '此區間沒有可計算的工作日。請勾選納入週末或調整日期。'); return; }
      if (draft.durationMode === 'hours' && leaveHours(draft) > (numberValue(getCompany(draft.companyId)?.workHoursPerDay) || 8)) { validateField(form, 'customHours', '單日小時請假不可超過公司每日標準工時。'); return; }
      const overlap = leaveOverlap(draft);
      if (overlap) { showValidationSummary(form, `與 ${leaveDateText(overlap)} 的「${leaveTypeName(overlap.type)}」紀錄重疊。請先調整日期或區段。`); return; }
      if(draft.type==='compensatory'&&draft.status==='confirmed'&&draft.compTimeLinked){
        const replacement=state.leaveRecords.filter(row=>row.id!==draft.id).concat(draft);
        const checked=compTimeLedger(state.compTimeCredits,state.compTimeSettlements,replacement,draft.companyId);
        if(checked.violations.length){showValidationSummary(form,'補休來源不足、已到期或帳本來源異常；請檢查加班轉入與結算紀錄。');return}
      }
      const warnings = [];
      const overtimeDates = leaveOvertimeDates(draft);
      if (overtimeDates.length) warnings.push(`${overtimeDates.join('、')} 同日已有加班紀錄`);
      const quota = leaveQuotaCapacity(draft);
      if (quota?.monthly && quota.violations.length) warnings.push(quota.violations.map((item) => {
        const [year, month] = item.monthKey.split('-').map(Number);
        return `${year} 年 ${month} 月生理假每月額度 1 天，本次 ${rateNumber(item.requested)} 天超過目前可用 ${rateNumber(item.available)} 天`;
      }).join('；'));
      else if (quota?.limited && !quota.configured) warnings.push(`公司尚未設定第一天上班日，無法檢查${leaveTypeName(draft.type)}額度`);
      else if (quota?.limited && quota.requested > quota.available) warnings.push(`本次${leaveTypeName(draft.type)} ${rateNumber(quota.requested)} 天超過目前可用 ${rateNumber(quota.available)} 天`);
      if (warnings.length) {
        confirm('儲存請假前確認', `${warnings.join('；')}。仍要儲存此筆請假紀錄嗎？`, () => persistLeave(draft), '仍要儲存');
        return;
      }
      persistLeave(draft);
    };

    // COPY_MONTH_START
    let copyMonthDraft = null;
    const duplicateLatestRecord = () => {
      const company = currentCompany();
      if (!company || (ui.companyFilter !== 'ALL' && ui.companyFilter !== company.id)) return toast('請先選擇目前公司，再複製上月薪資。', 'error');
      const latest = sortedRecords(state.records.filter(record => record.companyId === company.id))[0];
      if (!latest) return toast('目前公司沒有可複製的薪資紀錄，請先新增薪資。', 'error');
      const target = window.SalaryMateCopyMonth.next(Number(latest.year), Number(latest.month));
      copyMonthDraft = {companyId:company.id,year:target.year,month:target.month};
      beginDraftScope({entityType:'copy-month',companyId:company.id,operational:true});
      renderCopyMonthPreview();
    };
    const renderCopyMonthPreview = () => {
      const draft = copyMonthDraft;
      if (!draft) return;
      const plan = window.SalaryMateCopyMonth.plan(state.records,draft.companyId,draft.year,draft.month);
      draft.fingerprint = plan.fingerprint;
      const format = value => Number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});
      const rows = plan.rows?.map(row => `<div class="reconcile-row"><strong>${escapeHtml(row.label)}</strong><div><small>上月</small>$${format(row.before)}</div><div><small>本月帶入</small>$${format(row.after)}</div><span>${row.kept?'保留，請確認':'清零／不帶入'}</span></div>`).join('') || '';
      openDialog('複製上月薪資｜套用前預覽', `<form id="copyMonthForm"><h3>${userHtml(companyName(draft.companyId))}</h3><label for="copyTargetMonth">目標薪資月份</label><input class="field" id="copyTargetMonth" type="month" required min="2000-01" max="2100-12" value="${draft.year}-${pad2(draft.month)}"><p>來源固定為同公司的前一月。預覽與套用都不會直接儲存薪資。</p>${plan.error ? `<div class="notice warning" role="alert">${escapeHtml(plan.error)}</div>` : `<p>來源：${plan.source.year} 年 ${plan.source.month} 月。入帳日重新計算；核對狀態重設為未核對。</p><p>固定收入、固定扣項、勞健保與自提沿用上月；加班、獎金、副業、預扣稅、其他扣除及非固定自訂項目需重新填寫。時薪制的正常工時沿用上月，請於下一步確認。</p><div class="reconcile-list">${rows}</div>`}<div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit" ${plan.error?'disabled':''}>套用到新增表單</button></div></form>`,true);
    };
    const applyCopyMonth = () => {
      const scope = copyMonthDraft;
      if (!scope || !assertDraftScope({entityType:'copy-month',companyId:scope.companyId,operational:true})) return;
      if (!$('#copyMonthForm')?.reportValidity()) return;
      const plan = window.SalaryMateCopyMonth.plan(state.records,scope.companyId,scope.year,scope.month);
      if (plan.error) { renderCopyMonthPreview(); return; }
      if (plan.fingerprint !== scope.fingerprint) { renderCopyMonthPreview(); toast('上月資料已變更，請重新確認預覽後再套用。','error'); return; }
      const draft = normalizeRecord({...plan.draft,id:newId('record'),payDate:defaultPayDate(scope.year,scope.month)});
      ui.recordDraft = draft;
      ui.payrollStep = 2;
      beginDraftScope({entityType:'payroll',companyId:draft.companyId,entityId:'',payrollMonth:payrollMonthKey(draft.year,draft.month),operational:true});
      clearOperationalSelection();
      copyMonthDraft = null;
      openDialog('建立薪資',recordFormHtml(draft,false),true);
      toast('已帶入新增表單，確認本月資料後再儲存。');
    };
    // COPY_MONTH_END

    const syncOvertimeToRecord = () => {
      const month = Number(ui.overtimeMonth);
      if (!month) return toast('請先選擇要同步的月份', 'error');
      if (ui.companyFilter === 'ALL') return toast('同步前請先在上方選擇一家公司', 'error');
      const logs = overtimeForScope(month, ui.companyFilter);
      const amount = overtimeTotal(logs);
      if (!amount) return toast('此月份沒有可同步的加班費', 'error');
      const period = salaryPeriodLabel(ui.selectedYear, month, ui.companyFilter);
      const record = state.records.find((item) => item.companyId === ui.companyFilter && Number(item.year) === Number(ui.selectedYear) && Number(item.month) === month);
      if (record) {
        confirm('同步加班費', `將 ${month} 月薪資區間（${period}）加班費 $${money(amount)} 寫入現有薪資紀錄，並取代原加班費欄位。`, () => {
          const ok = commitStateMutation(() => { record.overtime = amount; }, '同步失敗。原本薪資資料保持不變。', `sync-overtime:${record.id}:${ui.selectedYear}-${month}`);
          if (!ok) { renderAll(); return; }
          closeDialog();
          renderAll();
          toast(`已同步 ${month} 月薪資區間加班費 $${money(amount)}`);
        }, '確認同步');
      } else {
        const draft = blankRecord();
        draft.companyId = ui.companyFilter;
        draft.year = ui.selectedYear;
        draft.month = month;
        draft.payDate = defaultPayDate(ui.selectedYear, month);
        const company = getCompany(ui.companyFilter);
        applyCompanyDefaultsToRecord(draft, company);
        draft.overtime = amount;
        openRecordForm(draft);
        toast(`已帶入 ${month} 月薪資區間（${period}）加班費，完成薪資欄位後再儲存`);
      }
    };

    const syncLeaveToRecord = () => {
      const month = Number(ui.leaveMonth);
      if (!month) return toast('請先選擇要同步的薪資月份', 'error');
      if (ui.companyFilter === 'ALL') return toast('同步前請先在上方選擇一家公司', 'error');
      const info = leaveSyncInfo(ui.selectedYear, month, ui.companyFilter);
      if (!info.total) return toast('此月份沒有已確認的請假扣款可同步', 'error');
      const period = salaryPeriodLabel(ui.selectedYear, month, ui.companyFilter);
      confirm('預覽請假扣款連動', `${ui.selectedYear} 年 ${month} 月薪資區間 ${period}：請假扣薪 $${money(info.wage)}、全勤／出勤扣款 $${money(info.attendance)}，合計 $${money(info.total)}。同步會新增或更新一筆有連動標記的自訂扣項，不會重複累加。`, () => {
        const linkedItem = {
          id: info.linkedItem?.id || newId('deduct'),
          name: '請假扣薪＋出勤扣款（工時／出勤連動）',
          amount: info.total,
          sourceType: 'leave-payroll',
          sourceKey: info.sourceKey
        };
        if (info.record) {
          const deductions = normalizeCustomItems(info.record.customDeductions)
            .filter((item) => !(item.sourceType === 'leave-payroll' && item.sourceKey === info.sourceKey));
          deductions.push(linkedItem);
          const ok = commitStateMutation(() => { info.record.customDeductions = deductions; }, '同步失敗。原本薪資扣項保持不變。', `sync-leave:${info.record.id}:${info.sourceKey}`);
          if (!ok) { renderAll(); return; }
          closeDialog();
          renderAll();
          toast(`已同步 ${month} 月請假扣款 $${money(info.total)}，未重複新增扣項`);
          return;
        }
        const draft = blankRecord();
        const company = getCompany(ui.companyFilter);
        Object.assign(draft, {
          companyId: ui.companyFilter,
          year: ui.selectedYear,
          month,
          payDate: defaultPayDate(ui.selectedYear, month)
        });
        applyCompanyDefaultsToRecord(draft, company);
        draft.customDeductions.push(linkedItem);
        closeDialog();
        openRecordForm(draft);
        toast(`已帶入 ${month} 月請假扣款 $${money(info.total)}，確認薪資欄位後再儲存`);
      }, '確認同步');
    };

    const unlinkLeaveFromRecord = () => {
      const month = Number(ui.leaveMonth);
      if (!month || ui.companyFilter === 'ALL') return toast('請先選擇單一公司與薪資月份', 'error');
      const info = leaveSyncInfo(ui.selectedYear, month, ui.companyFilter);
      if (!info.record || !info.linkedItem) return toast('此月份尚未建立請假扣款連動', 'error');
      confirm('解除請假扣款連動', `將從 ${ui.selectedYear} 年 ${month} 月薪資明細移除連動扣項 $${money(info.linkedItem.amount)}；請假紀錄本身不會刪除。`, () => {
        const ok = commitStateMutation(() => {
          info.record.customDeductions = (info.record.customDeductions || []).filter((item) => !(item.sourceType === 'leave-payroll' && item.sourceKey === info.sourceKey));
        }, '解除連動失敗。原本薪資扣項保持不變。', `unlink-leave:${info.record.id}:${info.sourceKey}`);
        if (!ok) { renderAll(); return; }
        closeDialog();
        renderAll();
        toast('薪資扣款連動已解除，請假紀錄仍保留');
      }, '確認解除');
    };

    const loadCalculatorRecord = () => {
      const month = Number(ui.hourlyMonth);
      if (!month) return toast('請先選擇要帶入的月份', 'error');
      const calc = clone(state.overtimeCalculator);
      const calculatorCompanyId = activeCalculatorCompany()?.id || '';
      const candidates = state.records.filter((record) =>
        Number(record.year) === Number(ui.selectedYear) &&
        Number(record.month) === month &&
        (!calculatorCompanyId || record.companyId === calculatorCompanyId)
      );
      if (!candidates.length) return toast('找不到目前年度與月份的薪資紀錄', 'error');
      if (candidates.length > 1 && !calculatorCompanyId) return toast('同月份有多家公司，請先選擇試算公司', 'error');
      const record = candidates[0];
      const custom = normalizeCustomItems(record.customEarnings);
      const fixedCustom = custom.filter((item) => item.affectsHourly === true);
      const attendance = fixedCustom.find((item) => /全勤/.test(item.name || ''));
      const legacyPosition = numberValue(record.positionAllowance) ? null : fixedCustom.find((item) => /職務|加級|職位/.test(item.name || ''));
      const remainingFixed = fixedCustom.filter((item) => item !== attendance && item !== legacyPosition);
      calc.companyId = record.companyId;
      calc.baseSalary = numberValue(record.baseSalary);
      calc.mealAllowance = numberValue(record.mealAllowance);
      calc.attendanceBonus = numberValue(attendance?.amount);
      calc.positionAllowance = numberValue(record.positionAllowance) + numberValue(legacyPosition?.amount);
      calc.otherFixed = customTotal(remainingFixed);
      if (record.employmentMode === 'dispatch_hourly') calc.overtimeDivisor = recordRegularHours(record);
      Object.keys(calc.hours).forEach((key) => { calc.hours[key] = 0; });

      const logs = overtimeForSalaryMonth(record.year, month, record.companyId);
      let skippedCustom = 0;
      logs.forEach((log) => {
        const hours = numberValue(log.hours);
        if (log.type === 'weekday') {
          calc.hours.first += Math.min(hours, 2);
          calc.hours.second += Math.max(0, hours - 2);
        } else if (log.type === 'restday' || log.type === 'weekend') {
          calc.hours.first += Math.min(hours, 2);
          calc.hours.second += Math.min(Math.max(hours - 2, 0), 6);
          calc.hours.restExtra += Math.max(0, hours - 8);
        } else if (log.type === 'holiday') {
          calc.hours.holiday += hours;
        } else if (log.type === 'spring') {
          calc.hours.spring += hours;
        } else {
          skippedCustom += 1;
        }
      });
      if (!commitStateMutation(() => { state.overtimeCalculator = calc; })) { renderView(); return; }
      renderView();
      toast(`已帶入 ${month} 月薪資、${salaryPeriodLabel(record.year, month, record.companyId)} 與 ${logs.length - skippedCustom} 筆加班紀錄${skippedCustom ? `；${skippedCustom} 筆自訂倍率請手動補入` : ''}`);
    };

    const resetCalculator = () => confirm('重設加班費試算', '將清空薪資與累積時數，並恢復 1／1.34／1.67／2／2.67／2.5 倍率。其他薪資與加班紀錄不受影響。', () => {
      const companyId = state.overtimeCalculator.companyId;
      if (!commitStateMutation(() => {
        state.overtimeCalculator = defaultOvertimeCalculator();
        state.overtimeCalculator.companyId = companyId;
      })) { renderView(); return; }
      closeDialog();
      renderView();
      toast('加班費試算已重設');
    }, '確認重設');

    const ensureYearEndDraftScope = () => {
      const draft = ui.yearEndDraft;
      if (!draft) return null;
      const current = ui.draftScope;
      if (current?.entityType === 'year-end' && current.companyId === String(draft.companyId || '') && current.entityId === String(draft.id || '')) return current;
      return beginDraftScope({ entityType: 'year-end', companyId: draft.companyId, entityId: draft.id, operational: false, baselineFingerprint: stableDraftFingerprint(draft) });
    };

    const collectYearEndDraft = () => {
      const form = $('#yearEndForm');
      if (!form || !ui.yearEndDraft) return ui.yearEndDraft;
      const data = new FormData(form);
      const gradeRules = $$('[data-yearend-grade]', form).map((row, index) => ({
        id: ui.yearEndDraft.gradeRules?.[index]?.id || newId('grade'),
        name: $('[data-grade-name]', row)?.value || `等級 ${index + 1}`,
        multiplier: $('[data-grade-multiplier]', row)?.value || 0
      }));
      ui.yearEndDraft = normalizeYearEndEstimate({
        ...ui.yearEndDraft,
        companyId: ui.yearEndCompanyId,
        year: ui.selectedYear,
        baseMode: data.get('baseMode'),
        customBase: data.get('customBase'),
        fixedMonths: data.get('fixedMonths'),
        selectedGradeId: data.get('selectedGradeId'),
        gradeRules,
        prorateByEmployment: data.has('prorateByEmployment'),
        extraAdjustment: data.get('extraAdjustment'),
        withholdingThreshold: data.get('withholdingThreshold'),
        withholdingRate: data.get('withholdingRate'),
        note: data.get('note')
      });
      return ui.yearEndDraft;
    };

    const updateYearEndPreview = () => {
      const draft = collectYearEndDraft();
      const company = getCompany(draft?.companyId);
      const results = $('#yearEndResults');
      if (results && draft && company) results.innerHTML = yearEndResultsHtml(draft, company);
      const customBase = $('#yearEndCustomBase');
      if (customBase && draft) customBase.hidden = draft.baseMode !== 'custom';
    };

    const deleteYearEndEstimate = id => {
      const saved=state.yearEndEstimates.find(item=>item.id===id);if(!saved)return;
      confirm('刪除年終試算',`${saved.year} 年的年終試算設定將被刪除。已登錄的薪資與獎金不受影響。`,()=>{
        if(!commitStateMutation(()=>{state.yearEndEstimates=state.yearEndEstimates.filter(item=>item.id!==id);},'刪除失敗，原資料保持不變。'))return;
        ui.yearEndDraft=null;closeDialog();renderAll();toast('年終試算已刪除。');
      },'刪除');
    };
    const saveYearEndEstimate = () => {
      const form = $('#yearEndForm');
      ensureYearEndDraftScope();
      const draft = collectYearEndDraft();
      if (!form || !draft || !validateNativeForm(form)) return;
      if (!assertDraftScope({ entityType: 'year-end', companyId: draft.companyId, entityId: draft.id, operational: false })) return;
      if (!getCompany(draft.companyId)) { showValidationSummary(form, '年終規則資料需要確認。公司資料不存在，請重新選擇公司。'); return; }
      if (draft.baseMode === 'custom' && numberValue(draft.customBase) < 0) { validateField(form, 'customBase', '自訂計算基數不可小於 0。'); return; }
      const invalidGrade = normalizeYearEndGrades(draft.gradeRules).find((grade) => !String(grade.name || '').trim() || numberValue(grade.multiplier) < 0);
      if (invalidGrade) { showValidationSummary(form, '年終規則資料需要確認。請檢查績效級距名稱與倍率。'); return; }
      const duplicateIndex = state.yearEndEstimates.findIndex((item) => item.id !== draft.id && item.companyId === draft.companyId && Number(item.year) === Number(draft.year));
      const index = state.yearEndEstimates.findIndex((item) => item.id === draft.id);
      const ok = commitStateMutation(() => {
        if (duplicateIndex >= 0) state.yearEndEstimates[duplicateIndex] = draft;
        else if (index >= 0) state.yearEndEstimates[index] = draft;
        else state.yearEndEstimates.push(draft);
      }, '年終規則儲存失敗。原本資料保持不變。');
      if (!ok) return;
      clearDraftScope();
      renderView();
      toast(`${draft.year} 年年終試算設定已儲存`);
    };

    const salaryAdjustmentFixedRowsHtml = (items) => (items || []).map((item, index) => `<div class="custom-row" data-adjustment-fixed-row data-index="${index}"><input class="field" data-adjustment-name type="text" maxlength="40" value="${escapeAttr(item.name)}" placeholder="例如：全勤獎金、輪班津貼"><input class="field" data-adjustment-amount type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(numberValue(item.amount))}" placeholder="金額"><button class="btn btn-danger btn-small" type="button" data-action="remove-adjustment-fixed" data-index="${index}" aria-label="移除固定加項">×</button></div>`).join('');

    const blankSalaryAdjustment = () => {
      const company = selectedRaiseCompany();
      if (!company) return null;
      const effectiveDate = Number(ui.selectedYear) === currentYear ? todayIso() : isoDate(ui.selectedYear, 1, 1);
      const profile = salaryProfileBefore(company, effectiveDate);
      return normalizeSalaryAdjustment({
        id: newId('raise'),
        companyId: company.id,
        effectiveDate,
        employmentMode: profile.employmentMode,
        baseSalary: profile.baseSalary,
        baseHourlyRate: profile.baseHourlyRate,
        regularHours: profile.regularHours,
        mealAllowance: profile.mealAllowance,
        positionAllowance: profile.positionAllowance,
        fixedEarnings: clone(profile.fixedEarnings),
        previousFixedSalary: salaryProfileTotal(profile),
        reason: 'annual'
      });
    };

    const salaryAdjustmentFormHtml = (draft, editing) => {
      const company = getCompany(draft.companyId);
      const previous = salaryProfileTotal(salaryProfileBefore(company, draft.effectiveDate, editing ? draft.id : ''));
      const total = salaryAdjustmentTotal(draft);
      const difference = total - previous;
      const isDispatch = draft.employmentMode === 'dispatch_hourly';
      const salaryFields = isDispatch
        ? `<label><span class="field-label">調整後基本時薪 *</span><input class="field" name="baseHourlyRate" type="number" min="0.001" step="0.001" inputmode="decimal" required value="${escapeAttr(normalizeHourlyRate(draft.baseHourlyRate).toFixed(3))}"></label><label><span class="field-label">每月預設正常工時 *</span><input class="field" name="regularHours" type="number" min="0.5" max="744" step="0.5" required value="${escapeAttr(draft.regularHours)}"></label><div class="notice span-2"><b>換算月基本薪資：</b>$${money(salaryProfileBasePay(draft))}；生效後只成為新薪資明細的預設快照。</div>`
        : moneyInput('baseSalary', '調整後本薪', draft.baseSalary);
      return `<form id="salaryAdjustmentForm">
        <input type="hidden" name="companyId" value="${escapeAttr(draft.companyId)}">
        <input type="hidden" name="employmentMode" value="${escapeAttr(draft.employmentMode)}">
        <div class="notice"><b>套用公司：</b>${(company?.name ? userHtml(company?.name) : escapeHtml('未指定'))}｜${escapeHtml(employmentModeName(draft.employmentMode))}。此調薪快照不會回溯修改既有薪資或每日加班時薪；請假扣薪仍會依請假日期套用當時生效薪資。</div>
        <div class="form-grid" style="margin-top:14px">
          <label><span class="field-label">生效日期 *</span><input class="field" name="effectiveDate" type="date" required value="${escapeAttr(draft.effectiveDate)}"></label>
          <label><span class="field-label">調整原因</span><select class="field-select" name="reason"><option value="annual" ${draft.reason === 'annual' ? 'selected' : ''}>年度調薪</option><option value="promotion" ${draft.reason === 'promotion' ? 'selected' : ''}>晉升調薪</option><option value="performance" ${draft.reason === 'performance' ? 'selected' : ''}>績效調薪</option><option value="new_hire" ${draft.reason === 'new_hire' ? 'selected' : ''}>新進起薪</option><option value="custom" ${draft.reason === 'custom' ? 'selected' : ''}>其他調整</option></select></label>
          ${salaryFields}
          ${moneyInput('mealAllowance', '調整後伙食津貼', draft.mealAllowance)}
          ${moneyInput('positionAllowance', '調整後職務加給', draft.positionAllowance)}
        </div>
        <div class="form-group earn" style="margin-top:14px"><div class="group-head"><strong>調整後其他固定加項</strong><span class="soft-badge">完整快照</span></div><div class="custom-list">${salaryAdjustmentFixedRowsHtml(draft.fixedEarnings)}</div><div class="form-actions"><button class="btn btn-small" type="button" data-action="add-adjustment-fixed">＋ 新增固定加項</button></div></div>
        <label style="display:block;margin-top:14px"><span class="field-label">備註</span><textarea class="field-textarea" name="note" maxlength="240">${userHtml(draft.note)}</textarea></label>
        <div id="salaryAdjustmentLiveSummary" class="live-total"><span>調整後固定薪資</span><strong>$${money(total)} <small class="${difference >= 0 ? 'change-positive' : 'change-negative'}">${difference >= 0 ? '+' : '−'}$${money(Math.abs(difference))}</small></strong></div>
        <div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">${editing ? '儲存調薪修改' : '新增調薪紀錄'}</button></div>
      </form>`;
    };

    const collectSalaryAdjustmentDraft = () => {
      const form = $('#salaryAdjustmentForm');
      if (!form || !ui.salaryAdjustmentDraft) return ui.salaryAdjustmentDraft;
      const data = new FormData(form);
      const fixedEarnings = $$('[data-adjustment-fixed-row]', form).map((row, index) => ({
        id: ui.salaryAdjustmentDraft.fixedEarnings?.[index]?.id || newId('fixed'),
        name: $('[data-adjustment-name]', row)?.value || '',
        amount: $('[data-adjustment-amount]', row)?.value || 0,
        affectsHourly: true
      }));
      ui.salaryAdjustmentDraft = normalizeSalaryAdjustment({
        ...ui.salaryAdjustmentDraft,
        companyId: data.get('companyId'),
        effectiveDate: data.get('effectiveDate'),
        reason: data.get('reason'),
        employmentMode: data.get('employmentMode'),
        baseSalary: data.has('baseSalary') ? data.get('baseSalary') : ui.salaryAdjustmentDraft.baseSalary,
        baseHourlyRate: data.has('baseHourlyRate') ? data.get('baseHourlyRate') : ui.salaryAdjustmentDraft.baseHourlyRate,
        regularHours: data.has('regularHours') ? data.get('regularHours') : ui.salaryAdjustmentDraft.regularHours,
        mealAllowance: data.get('mealAllowance'),
        positionAllowance: data.get('positionAllowance'),
        fixedEarnings,
        note: data.get('note')
      });
      return ui.salaryAdjustmentDraft;
    };

    const updateSalaryAdjustmentPreview = () => {
      const draft = collectSalaryAdjustmentDraft();
      const summary = $('#salaryAdjustmentLiveSummary');
      const company = getCompany(draft?.companyId);
      if (!summary || !draft || !company) return;
      const previous = salaryProfileTotal(salaryProfileBefore(company, draft.effectiveDate, state.salaryAdjustments.some((item) => item.id === draft.id) ? draft.id : ''));
      const total = salaryAdjustmentTotal(draft);
      const difference = total - previous;
      summary.innerHTML = `<span>調整後固定薪資</span><strong>$${money(total)} <small class="${difference >= 0 ? 'change-positive' : 'change-negative'}">${difference >= 0 ? '+' : '−'}$${money(Math.abs(difference))}</small></strong>`;
    };

    const openSalaryAdjustmentForm = (record = null) => {
      if (!state.companies.length) return openCompanyManager();
      ui.salaryAdjustmentDraft = record ? clone(record) : blankSalaryAdjustment();
      if (!ui.salaryAdjustmentDraft) return;
      beginDraftScope({ entityType: 'salary-adjustment', companyId: ui.salaryAdjustmentDraft.companyId, entityId: record?.id || '', operational: false });
      openDialog(record ? '編輯調薪紀錄' : '新增調薪紀錄', salaryAdjustmentFormHtml(ui.salaryAdjustmentDraft, Boolean(record)), true);
    };

    const saveSalaryAdjustmentForm = () => {
      const form = $('#salaryAdjustmentForm');
      const draft = collectSalaryAdjustmentDraft();
      if (!form || !draft || !validateNativeForm(form)) return;
      const company = getCompany(draft.companyId);
      if (!company) { showValidationSummary(form, '年度加薪設定資料需要確認。公司資料不存在，請重新選擇公司。'); return; }
      if (!assertDraftScope({ entityType: 'salary-adjustment', companyId: draft.companyId, entityId: state.salaryAdjustments.some((item) => item.id === draft.id) ? draft.id : '', operational: false })) return;
      if (!validIsoDate(draft.effectiveDate)) { validateField(form, 'effectiveDate', '生效日期格式不正確，請重新選擇。'); return; }
      if (draft.employmentMode === 'dispatch_hourly' && draft.baseHourlyRate <= 0) { validateField(form, 'baseHourlyRate', '調整後基本時薪必須大於 0。'); return; }
      if (draft.employmentMode === 'dispatch_hourly' && draft.regularHours <= 0) { validateField(form, 'regularHours', '每月預設正常工時必須大於 0。'); return; }
      if (state.salaryAdjustments.some((item) => item.id !== draft.id && item.companyId === draft.companyId && item.effectiveDate === draft.effectiveDate)) { validateField(form, 'effectiveDate', '同公司、同生效日已有調薪紀錄。請編輯既有紀錄或改用其他日期。'); return; }
      draft.fixedEarnings = normalizeFixedEarnings(draft.fixedEarnings).filter((item) => item.name.trim() || numberValue(item.amount));
      draft.previousFixedSalary = salaryProfileTotal(salaryProfileBefore(company, draft.effectiveDate, draft.id));
      const index = state.salaryAdjustments.findIndex((item) => item.id === draft.id);
      const ok = commitStateMutation(() => {
        if (index >= 0) state.salaryAdjustments[index] = draft;
        else state.salaryAdjustments.push(draft);
      }, '年度加薪設定儲存失敗。原本資料保持不變。');
      if (!ok) return;
      closeDialog();
      renderAll();
      toast(index >= 0 ? '調薪紀錄已更新' : '調薪紀錄已新增');
    };

    const deleteSalaryAdjustment = (id) => {
      const record = state.salaryAdjustments.find((item) => item.id === id);
      if (!record) return;
      confirm('刪除調薪紀錄', `確定刪除 ${record.effectiveDate} 的「${salaryAdjustmentReasonName(record.reason)}」？既有薪資與加班紀錄不受影響。`, () => {
        const ok = commitStateMutation(() => { state.salaryAdjustments = state.salaryAdjustments.filter((item) => item.id !== id); }, '刪除失敗。原本調薪紀錄保持不變。', `delete-salary-adjustment:${id}`);
        if (!ok) { renderAll(); return; }
        closeDialog(); renderAll(); toast('調薪紀錄已刪除');
      }, '刪除');
    };

    const exportJson = () => {
      if (window.SalaryMateNative) return window.SalaryMateNative.openDataCenter();
      openDialog('匯出完整備份', `<form id="backupExportForm"><p>包含公司、薪資、加班、請假及全部投資資料。</p><label class="backup-choice"><input type="checkbox" name="encrypted"><span><b>使用密碼加密（選用）</b><small>未勾選時，下載一般 JSON 備份。</small></span></label><fieldset id="backupPasswords" hidden disabled><label><span class="field-label">備份密碼（至少 8 個字元）</span><input class="field" type="password" name="password" required minlength="8" maxlength="1024" autocomplete="new-password"></label><label><span class="field-label">再次輸入密碼</span><input class="field" type="password" name="confirmation" required autocomplete="new-password"></label><p class="hint">密碼不會被儲存。忘記密碼將無法還原這份備份，請妥善保管。</p></fieldset><p class="backup-status" role="status"></p><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">下載備份</button></div></form>`);
    };

    const saveBackupExport = async form => {
      if (form.dataset.busy || !validateNativeForm(form)) return;
      const encrypted = form.elements.encrypted.checked;
      if (encrypted && form.elements.password.value !== form.elements.confirmation.value) return showValidationSummary(form, '兩次密碼不一致，請重新確認。');
      const status = $('.backup-status', form), button = $('[type="submit"]', form);
      form.dataset.busy = 'true'; button.disabled = true;
      status.textContent = encrypted ? '正在加密備份…' : '正在準備備份…';
      try {
        let payload = { ...clone(state), exportInfo: { app: '個人薪資與投資管理', appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() } };
        if (encrypted) payload = await window.SalaryMateBackup.encrypt(payload, form.elements.password.value);
        if (!form.isConnected || !$('#appDialog').open) return;
        downloadBlob(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', `個人薪資與投資管理_v${APP_VERSION}_${encrypted ? 'encrypted' : 'backup'}_${todayIso()}.json`);
        closeDialog(); toast(encrypted ? '加密備份已匯出' : '完整 JSON 備份已匯出');
      } catch (error) { if (form.isConnected) status.textContent = error.message; }
      finally { delete form.dataset.busy; button.disabled = false; }
    };

    const csvEscape = (value) => {
      let text = String(value ?? '');
      if (typeof value !== 'number' && /^[\s\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const exportCsv = () => {
      const header = ['年份','月份','發薪公司','計薪方式','基本時薪','正常工時','底薪／時薪換算底薪','伙食津貼','職務加給','加班費','獎金','自訂加項','時薪計算基礎','應發總額','勞保','健保','預扣稅','其他扣除','自訂扣項','勞退自提','副業收入','主業實領','可支配淨入帳','入帳日期','備註'];
      const rows = sortedRecords().map((record) => [record.year, record.month, companyName(record.companyId), employmentModeName(record.employmentMode), record.employmentMode === 'dispatch_hourly' ? hourlyRateNumber(record.baseHourlyRate) : '', record.employmentMode === 'dispatch_hourly' ? record.regularHours : '', record.baseSalary, record.mealAllowance, record.positionAllowance, record.overtime, record.bonus, (record.customEarnings || []).map((item) => `${item.name}:${item.amount}${item.affectsHourly ? '（計入時薪）' : ''}`).join('；'), recordHourlyBase(record), gross(record), record.laborIns, record.healthIns, record.taxWithheld, record.otherDeduction, (record.customDeductions || []).map((item) => `${item.name}:${item.amount}`).join('；'), record.pensionSelf, record.sideIncome, mainNet(record), combinedNet(record), record.payDate, record.note]);
      const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
      downloadBlob(csv, 'text/csv;charset=utf-8', `個人薪資與投資管理_${ui.selectedYear}_salary_records.csv`);
      toast(`已匯出 ${rows.length} 筆薪資紀錄`);
    };

    const exportLeaveCsv = () => {
      const header = ['開始日期','結束日期','發薪公司','流程狀態','假別','請假區段','本範圍天數','本範圍時數','給薪比例','預估請假扣薪','全勤／出勤扣款','歸屬薪資月份','備註'];
      const rows = [...leaveRecordsInScope(ui.selectedYear, 0, ui.companyFilter)].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))).map((record) => {
        const allocations = leaveAllocations(record).filter((allocation) => allocation.year === Number(ui.selectedYear));
        return [
          record.startDate,
          record.endDate,
          companyName(record.companyId),
          leaveStatusName(record.status),
          leaveTypeName(record.type),
          leaveQuantityText(record),
          allocations.reduce((sum, allocation) => sum + allocation.days, 0),
          allocations.reduce((sum, allocation) => sum + allocation.hours, 0),
          `${rateNumber(record.paidRatio)}%`,
          allocations.reduce((sum, allocation) => sum + allocation.wageDeduction, 0),
          allocations.reduce((sum, allocation) => sum + allocation.attendanceDeduction, 0),
          allocations.map((allocation) => `${allocation.year}-${pad2(allocation.month)}（${rateNumber(allocation.hours)}h）`).join('；'),
          record.note
        ];
      });
      const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
      downloadBlob(csv, 'text/csv;charset=utf-8', `個人薪資與投資管理_${ui.selectedYear}_leave_records.csv`);
      toast(`已匯出 ${rows.length} 筆請假紀錄（含全部狀態）`);
    };

    const exportAttendanceCsv = () => {
      const header = ['年份','薪資月份','公司篩選','涵蓋公司月份','推估工作日','預定工時','已確認請假時數','預計請假時數','推估出勤時數','推估出勤率','加班時數','請假扣薪','全勤／出勤扣款'];
      const rows = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const analysis = attendanceAnalysis(ui.selectedYear, month, ui.companyFilter);
        return [
          ui.selectedYear,
          month,
          ui.companyFilter === 'ALL' ? '全部公司' : companyName(ui.companyFilter),
          analysis.coverageMonths,
          analysis.scheduledDays,
          analysis.expectedHours,
          analysis.confirmedHours,
          analysis.plannedHours,
          analysis.attendedHours,
          analysis.attendanceRate == null ? '' : `${rateNumber(analysis.attendanceRate)}%`,
          analysis.overtimeHours,
          analysis.wageDeduction,
          analysis.attendanceDeduction
        ];
      });
      const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
      downloadBlob(csv, 'text/csv;charset=utf-8', `個人薪資與投資管理_${ui.selectedYear}_attendance_analysis.csv`);
      toast('已匯出 12 個月出勤分析');
    };

    const dataHealthReport = () => {
      const issues = [];
      const orphanCounts = [
        ['薪資', state.records],
        ['加班', state.overtimeLogs],
        ['請假', state.leaveRecords],
        ['調薪', state.salaryAdjustments],
        ['年終', state.yearEndEstimates]
      ].map(([label, records]) => ({ label, count: records.filter((record) => !getCompany(record.companyId)).length })).filter((item) => item.count > 0);
      if (orphanCounts.length) issues.push({ severity: 'error', title: '存在找不到公司的紀錄', detail: orphanCounts.map((item) => `${item.label} ${item.count} 筆`).join('、') });

      const compIssues=compTimeLedger().violations;
      if(compIssues.length)issues.push({severity:'error',title:'補休來源或餘額異常',detail:`共 ${compIssues.length} 筆，異常來源不列入可用餘額，請至加班紀錄核對。`});

      const salaryKeys = new Map();
      state.records.forEach((record) => {
        const key = `${record.companyId}:${record.year}-${pad2(record.month)}`;
        salaryKeys.set(key, (salaryKeys.get(key) || 0) + 1);
      });
      const duplicateSalaryMonths = [...salaryKeys.values()].filter((count) => count > 1).length;
      if (duplicateSalaryMonths) issues.push({ severity: 'error', title: '同公司同月份有重複薪資', detail: `共 ${duplicateSalaryMonths} 個月份需要確認` });

      const invalidLeaves = state.leaveRecords.filter((record) => !validIsoDate(record.startDate) || !validIsoDate(record.endDate) || record.endDate < record.startDate || !leaveDateEntries(record).length).length;
      if (invalidLeaves) issues.push({ severity: 'error', title: '請假日期或時數無法計算', detail: `共 ${invalidLeaves} 筆，請編輯日期區間或請假量` });
      const invalidOvertime = state.overtimeLogs.filter((log) => !validIsoDate(log.date) || numberValue(log.hours) <= 0 || overtimeHourlyRate(log) <= 0).length;
      if (invalidOvertime) issues.push({ severity: 'error', title: '加班資料不完整', detail: `共 ${invalidOvertime} 筆，請確認日期、時數與基準時薪` });
      const invalidDispatchCompanies = state.companies.filter((company) => company.employmentMode === 'dispatch_hourly' && (company.baseHourlyRate <= 0 || company.defaultRegularHours <= 0)).length;
      if (invalidDispatchCompanies) issues.push({ severity: 'error', title: '派遣公司時薪設定不完整', detail: `共 ${invalidDispatchCompanies} 家，請確認基本時薪與預設正常工時` });
      const invalidDispatchRecords = state.records.filter((record) => record.employmentMode === 'dispatch_hourly' && (record.baseHourlyRate <= 0 || record.regularHours <= 0)).length;
      if (invalidDispatchRecords) issues.push({ severity: 'error', title: '派遣薪資快照不完整', detail: `共 ${invalidDispatchRecords} 筆，請確認該月基本時薪與正常工時` });

      let staleLinks = 0;
      state.records.forEach((record) => (record.customDeductions || []).filter((item) => item.sourceType === 'leave-payroll').forEach((item) => {
        const expectedKey = leaveSyncKey(record.companyId, record.year, record.month);
        const expectedAmount = leaveDeductionSummary(record.year, record.month, record.companyId).total;
        if (item.sourceKey !== expectedKey || numberValue(item.amount) !== expectedAmount) staleLinks += 1;
      }));
      if (staleLinks) issues.push({ severity: 'warning', title: '請假扣款連動需要更新', detail: `共 ${staleLinks} 個薪資月份的連動金額或來源已變更` });

      const asOfDate = Number(ui.selectedYear) === currentYear ? todayIso() : `${ui.selectedYear}-12-31`;
      const quotaOverages = state.companies.flatMap((company) => Object.keys(LEAVE_TYPES).map((type) => ({ company, type, summary: leaveQuotaSummary(company, type, asOfDate) }))).filter((item) => item.summary.exceeded > 0);
      if (quotaOverages.length) issues.push({ severity: 'warning', title: '假別額度已超出', detail: quotaOverages.map((item) => `${item.company.name}／${leaveTypeName(item.type)} ${rateNumber(item.summary.exceeded)} 天`).join('、') });

      const missingStartDates = state.companies.filter((company) => normalizeLeavePolicies(company.leavePolicies).annual.mode === 'auto' && !validIsoDate(company.employmentStartDate)).length;
      if (missingStartDates) issues.push({ severity: 'warning', title: '特休自動試算尚未啟用', detail: `${missingStartDates} 家公司尚未設定第一天上班日` });

      const invalidAdjustments = state.salaryAdjustments.filter((record) => !validIsoDate(record.effectiveDate) || salaryAdjustmentTotal(record) <= 0 || (record.employmentMode === 'dispatch_hourly' && (record.baseHourlyRate <= 0 || record.regularHours <= 0))).length;
      if (invalidAdjustments) issues.push({ severity: 'error', title: '調薪資料不完整', detail: `共 ${invalidAdjustments} 筆，請確認生效日與調整後薪資` });

      try {
        window.SalaryMateStocks.validate(state.stockPortfolio);
        const stocks=window.SalaryMateStocks.calculate(state.stockPortfolio,ui.selectedYear,todayIso());
        if(stocks.missing)issues.push({severity:'warning',title:'股票股價尚未補齊',detail:`${stocks.missing} 檔持股缺少手動股價，尚無完整市值與未實現損益。`});
      } catch(error) { issues.push({severity:'error',title:'股票紀錄需要確認',detail:error.message}); }

      return {
        issues,
        errors: issues.filter((issue) => issue.severity === 'error').length,
        warnings: issues.filter((issue) => issue.severity === 'warning').length,
        recordCount: state.records.length + state.overtimeLogs.length + state.leaveRecords.length + state.compTimeCredits.length + state.compTimeSettlements.length + state.salaryAdjustments.length + state.yearEndEstimates.length + state.investmentRecords.length + state.stockPortfolio.assets.length + state.stockPortfolio.transactions.length
      };
    };

    const openDataHealthReport = () => {
      const report = dataHealthReport();
      const headline = report.errors ? '需要處理資料錯誤' : report.warnings ? '可繼續使用，仍有提醒' : '資料狀態良好';
      const tone = report.errors ? 'leave-cancelled' : report.warnings ? 'leave-planned' : 'leave-confirmed';
      const issuesHtml = report.issues.length ? `<div class="health-list">${report.issues.map((issue) => `<div class="health-item"><span class="status ${issue.severity === 'error' ? 'leave-cancelled' : 'leave-planned'}">${issue.severity === 'error' ? '錯誤' : '提醒'}</span><div><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.detail)}</p></div></div>`).join('')}</div>` : '<div class="notice" style="margin-top:14px"><b>檢查完成：</b>未發現孤兒資料、重複薪資月份、無效日期、失效連動或額度超用。</div>';
      const body = `<div class="section-title"><div><h3 style="font-size:16px">目前瀏覽器資料</h3><p>非破壞性檢查，不會修改或刪除任何紀錄</p></div><span class="status ${tone}">${escapeHtml(headline)}</span></div><div class="health-grid"><div class="health-stat"><span>已檢查紀錄</span><b>${report.recordCount}</b></div><div class="health-stat"><span>資料錯誤</span><b class="${report.errors ? 'text-rose' : 'text-green'}">${report.errors}</b></div><div class="health-stat"><span>待確認提醒</span><b class="${report.warnings ? 'text-amber' : 'text-green'}">${report.warnings}</b></div></div>${issuesHtml}<div class="form-actions"><button class="btn" type="button" data-action="export-json">先備份全部資料</button><button class="btn btn-primary" type="button" data-action="close-dialog">完成</button></div>`;
      openDialog('資料完整性健檢', body, true);
    };

    const resetTransientUiAfterRestore = () => {
      ui.recordDraft = null;
      ui.payrollStep = 1;
      ui.companyDraft = null;
      ui.companyDetailId = '';
      ui.companyDetailSection = 'overview';
      ui.salaryRulesDraft = null;
      ui.payrollCycleDraft = null;
      ui.overtimeDraft = null;
      ui.leaveDraft = null;
      ui.yearEndDraft = null;
      ui.salaryAdjustmentDraft = null;
      ui.confirmAction = null;
      ui.draftScope = null;
      ui.selectedEntityScope = null;
      ui.expandedRecords.clear();
      bumpContextGeneration();
      invalidateCalculationCache();
    };

    const backupService = window.SalaryMateBackup;
    const commitBackupImport = imported => {
      const lock = 'restore:commit';
      if (!acquireOperationLock(lock)) return;
      const before = clone(state);
      state = imported;
      restoreUiPreferences();
      if (!saveState(true)) {
        state = before;
        restoreUiPreferences();
        releaseOperationLock(lock, false);
        toast('匯入失敗。現有資料保持不變。', 'error');
        return;
      }
      releaseOperationLock(lock, true);
      restoreUiPreferences();
      resetTransientUiAfterRestore();
      syncDataStatusFromState();
      setOperationStatus('idle');
      closeDialog(); renderAll(); toast('備份資料已匯入');
    };
    const showBackupPreview = imported => {
      const baseline = JSON.stringify(state), token = newId('backup');
      openDialog('預覽備份匯入', `<form id="backupImportForm"><p>備份包含 ${imported.companies.length} 家公司、${imported.records.length} 筆薪資、${imported.overtimeLogs.length} 筆加班、${imported.leaveRecords.length} 筆請假、${imported.investmentRecords.length} 筆投資收入、${imported.stockPortfolio.assets.length} 檔股票及 ${imported.stockPortfolio.transactions.length} 筆股票紀錄。</p><fieldset class="backup-options"><legend>相同資料如何處理？</legend><label class="backup-choice"><input type="radio" name="mode" value="overwrite" checked><span><b>覆蓋相同資料</b><small>相同紀錄更新為備份內容，其餘資料保留；備份中新的紀錄會加入。</small></span></label><label class="backup-choice"><input type="radio" name="mode" value="copy"><span><b>新增為獨立副本</b><small>保留原資料，另建公司及股票帳戶副本。總覽會同時計入兩份資料。</small></span></label><details class="backup-advanced"><summary>完整還原</summary><label class="backup-choice"><input type="radio" name="mode" value="restore"><span><b>全部取代</b><small>以備份完全取代本機資料及偏好設定；不在備份中的現有資料也會移除。</small></span></label><label class="backup-choice"><input type="checkbox" name="restoreAck"><span>我了解全部取代會移除目前資料</span></label></details></fieldset><p class="hint">優先依紀錄識別碼比對；無相同識別碼時，再依公司名稱、薪資年月、股票帳戶等欄位辨識。</p><div id="backupImportPreview" aria-live="polite"></div><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="button" data-action="confirm-action">確認匯入</button></div></form>`, true);
      const form = $('#backupImportForm'), preview = $('#backupImportPreview'), button = $('[data-action="confirm-action"]', form);
      let planned = null;
      const refresh = () => {
        try {
          const mode = form.elements.mode.value;
          planned = backupService.merge(state, imported, mode, token);
          preview.innerHTML = mode === 'restore'
            ? '<p class="notice warning">確認還原後，所有本機資料會由這份備份取代。</p>'
            : '<div class="backup-summary">' + planned.stats.filter(s => s.added || s.replaced).map(s => `<div><b>${userHtml(s.name)}</b><span>新增 ${s.added} · 覆蓋 ${s.replaced}</span></div>`).join('') + '</div><p class="hint">偏好設定沿用目前裝置。</p>';
          button.disabled = mode === 'restore' && !form.elements.restoreAck.checked;
        } catch (error) { planned = null; button.disabled = true; preview.innerHTML = `<p class="notice warning">${escapeHtml(error.message)}</p>`; }
      };
      form.addEventListener('change', refresh);
      ui.confirmAction = () => {
        if (!planned || button.disabled) return;
        if (JSON.stringify(state) !== baseline) return showValidationSummary(form, '目前資料已變更，請重新選擇備份檔。');
        commitBackupImport(planned.next);
      };
      refresh();
    };
    const acceptBackup = async (raw, generation) => {
      if (!isContextGenerationCurrent(generation)) throw new Error('STALE_CONTEXT');
      if (raw?.format === 'smartportfolio-backup' || (Array.isArray(raw?.holdings) && Array.isArray(raw?.transactions))) {
        setOperationStatus('idle');
        await stocksUI.importFile({ name: 'SmartPortfolio.json', size: 0, text: async () => JSON.stringify(raw) });
        return;
      }
      if (!raw || !Array.isArray(raw.records) || !Array.isArray(raw.companies)) throw new Error('UNSUPPORTED_FORMAT');
      ensureSupportedSchema(raw);
      validateBackupCollections(raw);
      const imported = normalizeState(raw);
      setOperationStatus('idle');
      showBackupPreview(imported);
    };
    const openEncryptedBackup = (raw, generation) => {
      openDialog('解鎖加密備份', '<form id="backupDecryptForm"><p>輸入匯出時設定的密碼。解鎖後會先預覽，尚不會變更資料。</p><label><span class="field-label">備份密碼</span><input class="field" type="password" name="password" required maxlength="1024" autocomplete="off"></label><p class="backup-status" role="status"></p><div class="form-actions"><button class="btn" type="button" data-action="close-dialog">取消</button><button class="btn btn-primary" type="submit">解鎖並預覽</button></div></form>');
      const form = $('#backupDecryptForm');
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (form.dataset.busy || !validateNativeForm(form)) return;
        form.dataset.busy = 'true';
        const button = $('[type="submit"]', form), status = $('.backup-status', form);
        button.disabled = true; status.textContent = '正在解鎖…';
        try {
          const decoded = await backupService.decrypt(raw, form.elements.password.value);
          if (!form.isConnected || !$('#appDialog').open) return;
          form.elements.password.value = '';
          await acceptBackup(decoded, generation);
        } catch (error) { if (form.isConnected) status.textContent = backupImportError(error); }
        finally { delete form.dataset.busy; button.disabled = false; }
      });
    };
    const backupImportError = error => ({
      READ_FAILED: '備份檔案無法讀取。',
      UNSUPPORTED_FORMAT: '不支援的備份格式。',
      NEWER_SCHEMA: '這份備份來自較新版本，請更新程式後再還原。',
      INVALID_SCHEMA: '備份資料結構不完整。',
      INVALID_COLLECTION: '備份資料結構不完整。',
      INVALID_DATE: '備份含無效日期，請使用 YYYY-MM-DD 格式。',
      DUPLICATE_ID: '備份含重複識別碼，請先檢查來源。',
      STALE_CONTEXT: '目前公司或資料已變更，請重新選擇備份。',
      CORRUPT_JSON: '備份檔案內容已損毀或不是有效 JSON。'
    }[error?.message] || error?.message || '備份無法讀取。') + ' 現有資料保持不變。';
    const importJson = async file => {
      if (!file) return;
      if (hasDirtyDraft()) {
        toast('目前有尚未儲存的變更。請先儲存或放棄變更，再執行匯入。', 'error');
        if ($('#jsonImport')) $('#jsonImport').value = '';
        return;
      }
      const generation = contextGeneration();
      setOperationStatus('loading', 'restore-read', '正在讀取並驗證備份檔案…');
      renderView();
      try {
        if (file.size > 45 * 1024 * 1024) throw new Error('備份檔案超過 45 MB。');
        let text;
        try { text = await file.text(); } catch { throw new Error('READ_FAILED'); }
        if (text.length > 45 * 1024 * 1024) throw new Error('備份檔案超過 45 MB。');
        if (!isContextGenerationCurrent(generation)) throw new Error('STALE_CONTEXT');
        let raw;
        try { raw = JSON.parse(text); } catch { throw new Error('CORRUPT_JSON'); }
        if (backupService.isEncrypted(raw)) { setOperationStatus('idle'); openEncryptedBackup(raw, generation); }
        else await acceptBackup(raw, generation);
      } catch (error) {
        const message = backupImportError(error);
        setOperationStatus('failure', 'restore-read', message); renderAll(); toast(message, 'error');
      } finally { if ($('#jsonImport')) $('#jsonImport').value = ''; }
    };

    const clearData = () => confirm('清除全部本機資料', '公司、薪資、投資收入、股票與交易紀錄、加班、請假、年終試算、調薪歷程與試算設定都會刪除。建議先匯出 JSON 備份。', () => {
      const ok = commitStateMutation(() => { state = emptyState(); restoreUiPreferences(); }, '清除失敗。原本資料保持不變。', 'clear-all-data');
      if (!ok) { restoreUiPreferences(); renderAll(); return; }
      ui.search = '';
      resetTransientUiAfterRestore();
      setDataStatus('empty', '目前裝置尚未建立 SalaryMate 資料。');
      setOperationStatus('idle');
      closeDialog();
      renderAll();
      toast('本機資料已清除');
    }, '永久清除');

    const deleteRecord = (id) => {
      const record = state.records.find((item) => item.id === id);
      if (!record) return;
      confirm('刪除薪資紀錄', `確定刪除 ${record.year} 年 ${record.month} 月「${window.SalaryMateI18n.user(companyName(record.companyId))}」薪資紀錄？`, () => {
        const ok = commitStateMutation(() => { state.records = state.records.filter((item) => item.id !== id); }, '刪除失敗。原本薪資紀錄保持不變。', `delete-payroll:${id}`);
        if (!ok) { renderAll(); return; }
        ui.expandedRecords.delete(id);
        closeDialog(); renderAll(); toast('薪資紀錄已刪除');
      }, '刪除');
    };

    const deleteOvertime = (id) => {
      const log = state.overtimeLogs.find((item) => item.id === id);
      if (!log) return;
      if(state.compTimeCredits.some(item=>item.sourceId===id))return toast('這筆加班已有補休來源，請先檢查來源帳本。','error');
      confirm('刪除加班紀錄', `確定刪除 ${log.date} 的 ${log.hours} 小時加班紀錄？`, () => {
        const ok = commitStateMutation(() => { state.overtimeLogs = state.overtimeLogs.filter((item) => item.id !== id); }, '刪除失敗。原本加班紀錄保持不變。', `delete-overtime:${id}`);
        if (!ok) { renderAll(); return; }
        closeDialog(); renderAll(); toast('加班紀錄已刪除');
      }, '刪除');
    };

    const deleteLeave = (id) => {
      const record = state.leaveRecords.find((item) => item.id === id);
      if (!record) return;
      confirm('刪除請假紀錄', `確定刪除 ${leaveDateText(record)} 的「${leaveTypeName(record.type)}」紀錄？若已同步薪資，連動狀態會顯示需更新。`, () => {
        const ok = commitStateMutation(() => { state.leaveRecords = state.leaveRecords.filter((item) => item.id !== id); }, '刪除失敗。原本請假紀錄保持不變。', `delete-leave:${id}`);
        if (!ok) { renderAll(); return; }
        closeDialog(); renderAll(); toast('請假紀錄已刪除');
      }, '刪除');
    };

    const deleteCompany = (id) => {
      const company = getCompany(id);
      if (!company) return;
      const references = state.records.filter((record) => record.companyId === id).length
        + state.overtimeLogs.filter((log) => log.companyId === id).length
        + state.leaveRecords.filter((record) => record.companyId === id).length
        + state.compTimeCredits.filter((record) => record.companyId === id).length
        + state.compTimeSettlements.filter((record) => record.companyId === id).length
        + state.salaryAdjustments.filter((record) => record.companyId === id).length
        + state.yearEndEstimates.filter((record) => record.companyId === id).length;
      if (references) return toast(`此公司仍被 ${references} 筆紀錄使用，請改標示為歷任公司`, 'error');
      confirm('刪除公司', `確定刪除「${window.SalaryMateI18n.user(company.name)}」？`, () => {
        const ok = commitStateMutation(() => {
          state.companies = state.companies.filter((item) => item.id !== id);
          if (state.overtimeCalculator.companyId === id) state.overtimeCalculator.companyId = '';
        }, '刪除失敗。原本公司資料保持不變。', `delete-company:${id}`);
        if (!ok) { renderAll(); return; }
        if (ui.companyFilter === id) ui.companyFilter = 'ALL';
        closeDialog(); renderAll(); toast('公司資料已刪除');
      }, '刪除');
    };

    const selectPrimaryTab = (value, behavior = 'smooth', historyMode = 'push') => {
      const nextTab = ROUTE_TABS.includes(value) ? value : 'dashboard';
      const changed = ui.tab !== nextTab;
      if (changed && ui.draftScope?.dirty && !$('#appDialog')?.open) {
        toast('目前有尚未儲存的變更，請先儲存或取消。', 'error');
        return false;
      }
      if (!selectedEntityIsInCurrentScope()) clearOperationalSelection();
      ui.tab = nextTab;
      renderView();
      if (changed) focusPageHeading();
      if (historyMode === 'push' && changed && typeof history?.pushState === 'function') history.pushState({ salaryMateTab: nextTab }, '', `#${nextTab}`);
      window.scrollTo?.({ top: 0, left: 0, behavior });
      return true;
    };

    const currentHistoryState = () => ({
      salaryMateTab: ui.tab,
      companyDetailId: ui.tab === 'companies' ? String(ui.companyDetailId || '') : '',
      companyDetailSection: ui.tab === 'companies' ? String(ui.companyDetailSection || 'overview') : 'overview'
    });
    const pushCompanyDetailHistory = () => {
      if (typeof history?.pushState !== 'function') return;
      history.pushState(currentHistoryState(), '', '#companies');
    };
    const openCompanyDetailRoute = (companyId, section = 'overview') => {
      const targetCompany = getCompany(companyId);
      if (!targetCompany) { toast('公司資料不存在，請重新整理公司管理。', 'error'); return; }
      ui.companyDetailId = targetCompany.id;
      ui.companyDetailSection = ['overview', 'salary-rules', 'advanced-rules'].includes(section) ? section : 'overview';
      selectPrimaryTab('companies', 'smooth', 'none');
      renderView();
      focusPageHeading();
      pushCompanyDetailHistory();
    };

    document.addEventListener('click', (event) => {
      const stockButton=event.target.closest('[data-stock]');
      if(stockButton){stocksUI.click(stockButton);return;}
      const tabButton = event.target.closest('[data-tab]');
      if (tabButton) {
        selectPrimaryTab(tabButton.dataset.tab);
        return;
      }
      const attendanceButton = event.target.closest('[data-attendance-tab]');
      if (attendanceButton) {
        ui.attendanceTab = attendanceButton.dataset.attendanceTab === 'leave' ? 'leave' : 'overtime';
        saveState();
        renderView();
        return;
      }
      const salaryButton = event.target.closest('[data-salary-tab]');
      if (salaryButton) {
        ui.salaryCalcTab = ['overtime', 'yearend', 'raises'].includes(salaryButton.dataset.salaryTab) ? salaryButton.dataset.salaryTab : 'overtime';
        saveState();
        renderView();
        return;
      }
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      if (actionButton.closest('[data-stop-row]')) event.stopPropagation();
      const action = actionButton.dataset.action;
      const id = actionButton.dataset.id;
      const actions = {
        'jingyu-fly': () => window.SalaryMateCompanion?.fly(actionButton),
        'pick-company': () => { closeCompanyPicker(true); setCurrentCompany(id); },
        'picker-edit-company': () => { closeCompanyPicker(true); openCompanyBasicForm(getCompany(id)); },
        'picker-delete-company': () => { closeCompanyPicker(true); deleteCompany(id); },
        'v5-open-pay': () => { v5.salaryMonth = 0; ui.search = ''; ui.expandedRecords.add(id); selectPrimaryTab('records'); },
        'v5-leave-settings': () => openV5LeaveSettings(id),
        'v5-export-options': () => openDialog('匯出報表', `<div class="v5-export-options">${v5Button('薪資明細 CSV','export-csv')}${v5Button('請假紀錄 CSV','export-leave-csv')}${v5Button('出勤分析 CSV','export-attendance-csv')}${v5Button('年度整合 CSV','export-annual-report')}</div>`),
        'retry-load': retryAppLoad,
        'restore-backup-file': () => $('#jsonImport')?.click(),
        'open-google-drive': () => window.SalaryMateCloud?.open(),
        'dismiss-operation-failure': () => { setOperationStatus('idle'); renderView(); },
        'add-record': () => openRecordForm(),
        'reconcile-record': () => openReconciliation(id),
        'reconcile-match': completeMatchingReconciliation,
        'edit-record': () => openRecordForm(state.records.find((record) => record.id === id)),
        'delete-record': () => deleteRecord(id),
        'duplicate-record': duplicateLatestRecord,
        'manage-companies': () => selectPrimaryTab('companies'),
        'open-interface-settings': openInterfaceSettings,
        'open-legal': () => openDialog('授權、隱私與試算說明', window.SalaryMateLegal?.html || '<p>說明尚未載入，請重新開啟。</p>', true),
        'save-company': saveCompanyForm,
        'edit-company': () => openCompanyManager(getCompany(id)),
        'delete-company': () => deleteCompany(id),
        'add-company-basic': () => openCompanyBasicForm(),
        'edit-company-basic': () => openCompanyBasicForm(getCompany(id)),
        'edit-company-basic-again': () => openDialog(ui.companyDraft?.id ? '編輯公司基本資料' : '新增公司', companyBasicFormHtml(ui.companyDraft || blankCompanyBasicDraft(), Boolean(ui.companyDraft?.id)), true),
        'add-basic-fixed': () => changeCompanyBasicFixed(),
        'remove-basic-fixed': () => changeCompanyBasicFixed(Number(actionButton.dataset.index)),
        'confirm-company-basic': () => commitCompanyBasicDraft(ui.companyDraft),
        'view-company': () => openCompanyDetailRoute(id, 'overview'),
        'company-back': () => {
          if (hasDirtyDraft()) return toast('目前有尚未儲存的變更，請先儲存或取消。', 'error');
          if (history.state?.companyDetailId && typeof history?.back === 'function') history.back();
          else { ui.companyDetailId = ''; ui.companyDetailSection = 'overview'; renderView(); focusPageHeading(); }
        },
        'company-salary-rules': () => openCompanyDetailRoute(id || currentCompany()?.id || '', 'salary-rules'),
        'salary-rules-back': () => { ui.companyDetailSection = 'overview'; renderView(); focusPageHeading(); },
        'company-advanced-rules': () => openCompanyDetailRoute(id || currentCompany()?.id || '', 'advanced-rules'),
        'advanced-rules-back': () => { ui.companyDetailSection = 'overview'; renderView(); focusPageHeading(); },
        'edit-payroll-cycle': () => openPayrollCycleRule(getCompany(id)),
        'add-annual-raise': () => { const company = getCompany(id); if (!company) return; ui.raiseCompanyId = company.id; openSalaryAdjustmentForm(); },
        'open-year-end-rule': () => { const company = getCompany(id); if (!company) return; ui.yearEndCompanyId = company.id; ui.yearEndDraft = null; ui.salaryCalcTab = 'yearend'; ui.companyFilter = company.id; saveState(); selectPrimaryTab('hourly'); },
        'company-special-rules': () => openCompanyManager(getCompany(id)),
        'edit-basic-salary-rule': () => openCompanyBasicForm(getCompany(id)),
        'add-investment': () => openInvestment(),
        'edit-investment': () => openInvestment(id),
        'delete-investment': () => deleteInvestment(id),
        'export-investment': () => downloadBlob(window.SalaryMateAnnual.csv([['入帳日期','名稱','類型','實收金額（TWD）','備註'],...investmentRows().map(r=>[r.date,r.name,r.kind,r.amount,r.note])]),'text/csv;charset=utf-8',`投資收入_${ui.selectedYear}.csv`),
        'add-fixed-income-rule': () => {const draft=collectFixedIncomeRuleDraft();if(!draft)return;draft.fixedEarnings.push({id:newId('fixed'),name:'',amount:0,affectsHourly:true});$('#fixedIncomeRuleForm .custom-list').innerHTML=fixedIncomeRuleRowsHtml(draft.fixedEarnings);enhanceFormAccessibility($('#fixedIncomeRuleForm'));markDraftDirty();$('#fixedIncomeRuleForm .custom-row:last-child input')?.focus();},
        'remove-fixed-income-rule': () => {const draft=collectFixedIncomeRuleDraft();if(!draft)return;draft.fixedEarnings.splice(Number(actionButton.dataset.index),1);$('#fixedIncomeRuleForm .custom-list').innerHTML=fixedIncomeRuleRowsHtml(draft.fixedEarnings);enhanceFormAccessibility($('#fixedIncomeRuleForm'));markDraftDirty();},
        'edit-fixed-income-rule': () => openCompanyBasicForm(getCompany(id)),
        'edit-default-deduction-rule': () => openDefaultDeductionRule(getCompany(id)),
        'add-company-rule-item': () => changeCompanyRuleItem(actionButton.dataset.kind),
        'remove-company-rule-item': () => changeCompanyRuleItem(actionButton.dataset.kind, Number(actionButton.dataset.index)),
        'set-current-company': () => setCurrentCompany(id),
        'company-full-settings': () => openCompanyManager(getCompany(id)),
        'new-company': () => openCompanyBasicForm(),
        'add-overtime': () => openOvertimeForm(),
        'use-company-overtime-rate': useCompanyOvertimeRate,
        'edit-overtime': () => openOvertimeForm(state.overtimeLogs.find((log) => log.id === id)),
        'credit-comp-time': () => openCompCredit(id),
        'edit-comp-credit': () => openCompCredit(id, true),
        'settle-comp-time': () => openCompSettlement(id),
        'edit-comp-settlement': () => openCompSettlement(id, true),
        'delete-comp-credit': () => deleteCompCredit(id),
        'delete-comp-settlement': () => deleteCompSettlement(id),
        'delete-year-end': () => deleteYearEndEstimate(id),
        'delete-overtime': () => deleteOvertime(id),
        'add-leave': () => openLeaveForm(),
        'edit-leave': () => openLeaveForm(state.leaveRecords.find((record) => record.id === id)),
        'delete-leave': () => deleteLeave(id),
        'sync-overtime': syncOvertimeToRecord,
        'sync-leave': syncLeaveToRecord,
        'unlink-leave': unlinkLeaveFromRecord,
        'load-calculator-record': loadCalculatorRecord,
        'edit-calculator-company': () => openCompanyManager(activeCalculatorCompany()),
        'reset-calculator': resetCalculator,
        'toggle-hourly-advanced': () => { ui.hourlyAdvancedOpen = !ui.hourlyAdvancedOpen; saveState(); renderView(); },
        'save-yearend': saveYearEndEstimate,
        'add-salary-adjustment': () => openSalaryAdjustmentForm(),
        'edit-salary-adjustment': () => openSalaryAdjustmentForm(state.salaryAdjustments.find((record) => record.id === id)),
        'delete-salary-adjustment': () => deleteSalaryAdjustment(id),
        'export-json': exportJson,
        'print-page': () => window.print(),
        'export-csv': exportCsv,
        'preview-annual-report': previewAnnualReport,
        'download-annual-print': downloadAnnualPrint,
        'export-annual-report': exportAnnualReport,
        'export-leave-csv': exportLeaveCsv,
        'export-attendance-csv': exportAttendanceCsv,
        'data-health': openDataHealthReport,
        'clear-data': clearData,
        'close-dialog': requestCloseDialog,
        'confirm-action': () => ui.confirmAction?.()
      };
      if (action === 'toggle-record') {
        const record = state.records.find((item) => item.id === id);
        ui.expandedRecords.has(id) ? ui.expandedRecords.delete(id) : ui.expandedRecords.add(id);
        if (ui.expandedRecords.has(id) && record) markSelectedEntity('payroll', record.id, record.companyId);
        else if (ui.selectedEntityScope?.entityId === id) markSelectedEntity('', '', '');
        renderView();
      } else if (action === 'add-yearend-grade') {
        ensureYearEndDraftScope();
        const draft = collectYearEndDraft();
        draft.gradeRules.push({ id: newId('grade'), name: `等級 ${draft.gradeRules.length + 1}`, multiplier: 0 });
        markDraftDirty();
        renderView();
      } else if (action === 'remove-yearend-grade') {
        ensureYearEndDraftScope();
        const draft = collectYearEndDraft();
        if (draft.gradeRules.length <= 1) return toast('至少保留一個績效級距', 'error');
        draft.gradeRules.splice(Number(actionButton.dataset.index), 1);
        if (!draft.gradeRules.some((grade) => grade.id === draft.selectedGradeId)) draft.selectedGradeId = draft.gradeRules[0].id;
        markDraftDirty();
        renderView();
      } else if (action === 'set-interface-mode') {
        setInterfaceMode(actionButton.dataset.mode);
      } else if (action === 'set-color-theme') {
        setColorTheme(actionButton.dataset.theme);
      } else if (action === 'add-adjustment-fixed') {
        collectSalaryAdjustmentDraft();
        ui.salaryAdjustmentDraft.fixedEarnings.push({ id: newId('fixed'), name: '', amount: 0, affectsHourly: true });
        openDialog(state.salaryAdjustments.some((record) => record.id === ui.salaryAdjustmentDraft.id) ? '編輯調薪紀錄' : '新增調薪紀錄', salaryAdjustmentFormHtml(ui.salaryAdjustmentDraft, state.salaryAdjustments.some((record) => record.id === ui.salaryAdjustmentDraft.id)), true);
      } else if (action === 'remove-adjustment-fixed') {
        collectSalaryAdjustmentDraft();
        ui.salaryAdjustmentDraft.fixedEarnings.splice(Number(actionButton.dataset.index), 1);
        openDialog(state.salaryAdjustments.some((record) => record.id === ui.salaryAdjustmentDraft.id) ? '編輯調薪紀錄' : '新增調薪紀錄', salaryAdjustmentFormHtml(ui.salaryAdjustmentDraft, state.salaryAdjustments.some((record) => record.id === ui.salaryAdjustmentDraft.id)), true);
      } else if (action === 'add-company-fixed') {
        collectCompanyDraft();
        ui.companyDraft.fixedEarnings.push({ id: newId('fixed'), name: '', amount: 0, affectsHourly: true });
        openDialog('公司詳細設定', renderCompanyDialogBody(), true, companyDialogFooterHtml(Boolean(ui.companyDraft.id)));
      } else if (action === 'remove-company-fixed') {
        collectCompanyDraft();
        ui.companyDraft.fixedEarnings.splice(Number(actionButton.dataset.index), 1);
        openDialog('公司詳細設定', renderCompanyDialogBody(), true, companyDialogFooterHtml(Boolean(ui.companyDraft.id)));
      } else if (action === 'payroll-next') {
        const form = $('#recordForm');
        const draft = collectRecordDraft();
        if (!form?.reportValidity()) return;
        if (ui.payrollStep === 1) {
          const company = getCompany(draft.companyId);
          if (!company || draft.companyId !== currentCompany()?.id) return toast('目前公司已變更，請取消草稿後重新建立', 'error');
          if (ui.draftScope?.entityType === 'payroll') ui.draftScope.payrollMonth = payrollMonthKey(draft.year, draft.month);
          if (recordExists(draft, '')) return toast('同公司、同年月已有薪資紀錄，請改用編輯', 'error');
          draft.payDate = defaultPayDate(draft.year, draft.month);
          draft.overtime = overtimeTotal(overtimeForSalaryMonth(draft.year, draft.month, draft.companyId));
          draft.bonus = 0;
          draft.otherDeduction = 0;
          draft.pensionSelf = 0;
          draft.sideIncome = 0;
          draft.note = '';
          draft.customDeductions = [];
          draft.customEarnings = normalizeCustomItems(draft.customEarnings).filter((item) => item.sourceType === 'company-fixed');
          applyCompanyDefaultsToRecord(draft, company);
          ui.recordDraft = draft;
        }
        ui.payrollStep = Math.min(3, ui.payrollStep + 1);
        openDialog('建立薪資', recordFormHtml(draft, false), true);
      } else if (action === 'payroll-back') {
        collectRecordDraft();
        ui.payrollStep = Math.max(1, ui.payrollStep - 1);
        openDialog('建立薪資', recordFormHtml(ui.recordDraft, false), true);
      } else if (action === 'add-custom') {
        collectRecordDraft();
        const list = actionButton.dataset.kind === 'earning' ? ui.recordDraft.customEarnings : ui.recordDraft.customDeductions;
        list.push({ id: newId('item'), name: '', amount: 0, ...(actionButton.dataset.kind === 'earning' ? { affectsHourly: false } : {}) });
        openDialog(state.records.some((record) => record.id === ui.recordDraft.id) ? '編輯薪資明細' : '新增月度薪資', recordFormHtml(ui.recordDraft, state.records.some((record) => record.id === ui.recordDraft.id)), true);
      } else if (action === 'remove-custom') {
        collectRecordDraft();
        const list = actionButton.dataset.kind === 'earning' ? ui.recordDraft.customEarnings : ui.recordDraft.customDeductions;
        list.splice(Number(actionButton.dataset.index), 1);
        openDialog(state.records.some((record) => record.id === ui.recordDraft.id) ? '編輯薪資明細' : '新增月度薪資', recordFormHtml(ui.recordDraft, state.records.some((record) => record.id === ui.recordDraft.id)), true);
      } else if (action === 'pull-overtime') {
        const draft = collectRecordDraft();
        draft.overtime = overtimeTotal(overtimeForSalaryMonth(draft.year, draft.month, draft.companyId));
        openDialog(state.records.some((record) => record.id === draft.id) ? '編輯薪資明細' : '新增月度薪資', recordFormHtml(draft, state.records.some((record) => record.id === draft.id)), true);
        toast(`已帶入 ${draft.month} 月薪資區間（${salaryPeriodLabel(draft.year, draft.month, draft.companyId)}）加班費 $${money(draft.overtime)}`);
      } else {
        actions[action]?.();
      }
      if (['manage-companies','open-interface-settings','export-json','export-csv','export-leave-csv','export-attendance-csv','data-health','clear-data'].includes(action)) closeDataMenu();
    });

    document.addEventListener('submit', (event) => {
      event.preventDefault();
      if (event.target.id === 'backupExportForm') saveBackupExport(event.target);
      if (event.target.id === 'reconciliationForm') saveReconciliation(event.submitter?.value === 'confirm');
      if (event.target.id === 'compCreditForm') saveCompCredit();
      if (event.target.id === 'compSettlementForm') saveCompSettlement();
      if (event.target.id === 'copyMonthForm') applyCopyMonth();
      if (event.target.id === 'recordForm') saveRecordForm();
      if (event.target.id === 'companyForm') saveCompanyForm();
      else if (event.target.id === 'basicSalaryRuleForm') saveBasicSalaryRule();
      else if (event.target.id === 'fixedIncomeRuleForm') saveFixedIncomeRule();
      else if (event.target.id === 'defaultDeductionRuleForm') saveDefaultDeductionRule();
      else if (event.target.id === 'payrollCycleForm') savePayrollCycleRule();
      if (event.target.id === 'companyBasicForm') saveCompanyBasicForm();
      if (event.target.id === 'investmentForm') {event.preventDefault();saveInvestment(event.target);}
      if (['stockForm','stockSearchForm','stockListForm','stockCatalogForm','stockImportForm','stockBatchForm'].includes(event.target.id)) {event.preventDefault();stocksUI.submit(event.target);}
      if (event.target.id === 'overtimeForm') saveOvertimeForm();
      if (event.target.id === 'leaveForm') saveLeaveForm();
      if (event.target.id === 'yearEndForm') saveYearEndEstimate();
      if (event.target.id === 'salaryAdjustmentForm') saveSalaryAdjustmentForm();
    });

    let recordSearchComposing = false;
    document.addEventListener('compositionstart', event => { if(event.target.id==='recordSearch')recordSearchComposing=true; });
    document.addEventListener('compositionend', event => {
      if(event.target.id!=='recordSearch')return;
      recordSearchComposing=false;ui.search=event.target.value;renderView();
      const input=$('#recordSearch');input?.focus();input?.setSelectionRange(ui.search.length,ui.search.length);
    });
    document.addEventListener('input', (event) => {
      if (event.target.matches('#backupExportForm [name="encrypted"]')) {
        const fields = $('#backupPasswords');
        fields.hidden = fields.disabled = !event.target.checked;
      }
      stocksUI.onInput(event);
      if(event.target.closest('#stockForm[data-kind="transaction"]'))stocksUI.updateTradeForm(false);
      if (event.target.id === 'recordSearch') {
        if(event.isComposing||recordSearchComposing)return;
        ui.search = event.target.value;
        const cursor = event.target.selectionStart;
        renderView();
        const input = $('#recordSearch');
        input?.focus();
        input?.setSelectionRange(cursor, cursor);
      } else if (event.target.closest('#companyBasicForm')) {
        updateCompanyBasicPreview();
      } else if (event.target.closest('#defaultDeductionRuleForm')) {
        updateCompanyRuleItemsPreview();
      } else if (event.target.closest('#reconciliationForm')) {
        updateReconciliationPreview();
      } else if (event.target.closest('#recordForm')) {
        updateRecordPreview();
      } else if (event.target.closest('#overtimeForm')) {
        updateOvertimePreview(event.target.name);
      } else if (event.target.closest('#leaveForm')) {
        updateLeavePreview();
      } else if (event.target.closest('#yearEndForm')) {
        ensureYearEndDraftScope();
        updateYearEndPreview();
      } else if (event.target.name === 'payrollPeriodType' && event.target.closest('#payrollCycleForm')) {
        const company = getCompany(ui.payrollCycleDraft?.id);
        if (company) {
          collectPayrollCycleDraft();
          openDialog('特殊薪資週期', payrollCycleFormHtml(company), true);
        }
      } else if (event.target.closest('#companyForm')) {
        const draft = collectCompanyDraft();
        if (event.target.name === 'employmentMode') {
          openDialog('公司詳細設定', renderCompanyDialogBody(), true, companyDialogFooterHtml(Boolean(ui.companyDraft.id)));
        } else {
          const preview = $('#companyDispatchPreview');
          if (preview && draft) preview.innerHTML = `<b>預估月基本薪資：</b>$${money(draft.baseHourlyRate * draft.defaultRegularHours)}（$${hourlyRateNumber(draft.baseHourlyRate)} × ${rateNumber(draft.defaultRegularHours)} 小時）。實際月薪以每月薪資明細的正常工時快照為準。`;
        }
      } else if (event.target.closest('#salaryAdjustmentForm')) {
        updateSalaryAdjustmentPreview();
      }
    });

    document.addEventListener('change', (event) => {
      if (event.target.name === 'interfaceStyle' && event.target.closest('.v5-style-fieldset')) { setInterfaceStyle(event.target.value); return; }
      if (event.target.name === 'surfaceOpacity' && event.target.closest('.v5-opacity-fieldset')) { setSurfaceOpacity(event.target.value); return; }
      if (event.target.name === 'hd2dBackground' && event.target.closest('.v5-background-fieldset')) { setHd2dBackground(event.target.value); return; }
      stocksUI.onChange(event);
      if(event.target.closest('#stockForm[data-kind="transaction"]'))stocksUI.updateTradeForm(event.target.name==='assetId');
      if(event.target.id==='annualThroughMonth'){
        const month=Number(event.target.value);
        if(Number.isInteger(month)&&month>=1&&month<=12)annualMonthChoices.set(Number(ui.selectedYear),month);
        renderView();
        $('#annualThroughMonth')?.focus();
        return;
      }
      if (event.target.id === 'copyTargetMonth' && copyMonthDraft) {
        const [year, month] = event.target.value.split('-').map(Number);
        copyMonthDraft.year = year; copyMonthDraft.month = month;
        renderCopyMonthPreview();
        return;
      }
      if (event.target.name === 'employmentMode' && event.target.closest('#companyBasicForm')) {
        collectCompanyBasicDraft();
        openDialog(ui.companyDraft.id ? '編輯公司基本資料' : '新增公司', companyBasicFormHtml(ui.companyDraft, Boolean(ui.companyDraft.id)), true);
        $('#companyBasicForm [name="name"]')?.focus({preventScroll:true});
      } else if (event.target.name === 'type' && event.target.closest('#overtimeForm')) {
        const hours=$('#overtimeForm [name="hours"]');
        hours.value=['restday','holiday'].includes(event.target.value)?'8':'2';
        hours.max=event.target.value==='restday'?'12':'24';
        updateOvertimePreview();markDraftDirty();
      } else if (event.target.id === 'companyFilter') {
        const companyId = String(event.target.value || '');
        if (companyId) setCurrentCompany(companyId);
        else toast('請選擇一家公司設為目前公司', 'error');
      } else if (event.target.id === 'yearFilter') {
        ui.selectedYear = Number(event.target.value);
        saveState();
        renderView();
      } else if (event.target.id === 'overtimeMonth') {
        ui.overtimeMonth = Number(event.target.value);
        saveState();
        renderView();
      } else if (event.target.id === 'leaveMonth') {
        ui.leaveMonth = Number(event.target.value);
        saveState();
        renderView();
      } else if (event.target.id === 'leaveStatus') {
        ui.leaveStatus = ['active', 'confirmed', 'planned', 'cancelled', 'all'].includes(event.target.value) ? event.target.value : 'active';
        saveState();
        renderView();
      } else if (event.target.id === 'hourlyMonth') {
        ui.hourlyMonth = Number(event.target.value);
        saveState();
        renderView();
      } else if (event.target.id === 'yearEndCompany') {
        if (ui.draftScope?.entityType === 'year-end' && hasDirtyDraft() && !window.confirm('年終規則有尚未儲存的變更。要放棄變更並切換公司嗎？')) { renderView(); return; }
        clearDraftScope();
        ui.yearEndCompanyId = String(event.target.value || '');
        ui.yearEndDraft = null;
        saveState();
        renderView();
      } else if (event.target.id === 'raiseCompany') {
        ui.raiseCompanyId = String(event.target.value || '');
        saveState();
        renderView();
      } else if (event.target.id === 'calculatorCompany') {
        const company = getCompany(String(event.target.value || ''));
        if (company) setCurrentCompany(company.id);
        else {
          state.overtimeCalculator.companyId = '';
          saveState();
          renderAll();
        }
      } else if (event.target.id === 'jsonImport') {
        importJson(event.target.files?.[0]);
      } else if (event.target.name === 'type' && event.target.closest('#leaveForm')) {
        const draft = collectLeaveDraft();
        draft.paidRatio = LEAVE_TYPES[draft.type]?.paidRatio ?? 0;
        if(draft.type==='compensatory'&&!state.leaveRecords.some(row=>row.id===draft.id)) draft.compTimeLinked=true;
        openDialog(state.leaveRecords.some((record) => record.id === draft.id) ? '編輯請假紀錄' : '新增請假紀錄', leaveFormHtml(draft, state.leaveRecords.some((record) => record.id === draft.id)));
      } else if (event.target.name === 'durationMode' && event.target.closest('#leaveForm')) {
        const draft = collectLeaveDraft();
        openDialog(state.leaveRecords.some((record) => record.id === draft.id) ? '編輯請假紀錄' : '新增請假紀錄', leaveFormHtml(draft, state.leaveRecords.some((record) => record.id === draft.id)));
      } else if (event.target.closest('#leaveForm')) {
        updateLeavePreview();
      } else if (event.target.closest('#yearEndForm')) {
        ensureYearEndDraftScope();
        updateYearEndPreview();
      } else if (event.target.closest('#companyForm')) {
        const draft = collectCompanyDraft();
        if (event.target.name === 'employmentMode') {
          openDialog('公司詳細設定', renderCompanyDialogBody(), true, companyDialogFooterHtml(Boolean(ui.companyDraft.id)));
        } else {
          const preview = $('#companyDispatchPreview');
          if (preview && draft) preview.innerHTML = `<b>預估月基本薪資：</b>$${money(draft.baseHourlyRate * draft.defaultRegularHours)}（$${hourlyRateNumber(draft.baseHourlyRate)} × ${rateNumber(draft.defaultRegularHours)} 小時）。實際月薪以每月薪資明細的正常工時快照為準。`;
        }
      } else if (event.target.closest('#salaryAdjustmentForm')) {
        updateSalaryAdjustmentPreview();
      } else if (event.target.dataset.calcSetting) {
        const key = event.target.dataset.calcSetting;
        const textKeys = new Set(['ruleNote']);
        commitStateMutation(() => {
          if (textKeys.has(key)) {
            state.overtimeCalculator[key] = String(event.target.value || '');
          } else if (key === 'variableAdjustment') {
            state.overtimeCalculator[key] = numberValue(event.target.value);
          } else if (key === 'periodStartDay' || key === 'periodEndDay') {
            state.overtimeCalculator[key] = clamp(event.target.value, 1, 31);
          } else if (key === 'overtimeDivisor') {
            state.overtimeCalculator[key] = clamp(event.target.value, 1, 744);
          } else {
            state.overtimeCalculator[key] = Math.max(0, numberValue(event.target.value));
          }
        });
        renderView();
      } else if (event.target.dataset.calcMultiplier) {
        const key = event.target.dataset.calcMultiplier;
        if (Object.prototype.hasOwnProperty.call(state.overtimeCalculator.multipliers, key)) {
          commitStateMutation(() => { state.overtimeCalculator.multipliers[key] = clamp(event.target.value, 0, 10); });
          renderView();
        }
      } else if (event.target.dataset.calcHours) {
        const key = event.target.dataset.calcHours;
        if (Object.prototype.hasOwnProperty.call(state.overtimeCalculator.hours, key)) {
          commitStateMutation(() => { state.overtimeCalculator.hours[key] = clamp(event.target.value, 0, 744); });
          renderView();
        }
      } else if (event.target.dataset.setting) {
        const key = event.target.dataset.setting;
        commitStateMutation(() => { state.hourlySettings[key] = Math.max(0, numberValue(event.target.value)); });
        renderView();
      }
    });

    document.addEventListener('invalid', (event) => {
      const control = event.target;
      if (control?.matches?.('input, select, textarea')) {
        event.preventDefault();
        setFieldValidation(control, nativeConstraintMessage(control), 'error');
      }
    }, true);
    document.addEventListener('input', (event) => {
      const control = event.target;
      if (control?.closest?.('form') && ui.draftScope) markDraftDirty();
      if (control?.matches?.('input, select, textarea') && control.checkValidity?.()) clearFieldValidation(control);
    });
    document.addEventListener('change', (event) => {
      const control = event.target;
      if (control?.closest?.('form') && ui.draftScope) markDraftDirty();
      if (control?.matches?.('input, select, textarea') && control.checkValidity?.()) clearFieldValidation(control);
    });

    if (!history.state?.salaryMateTab && typeof history?.replaceState === 'function') history.replaceState(currentHistoryState(), '', `#${ui.tab}`);
    window.addEventListener('popstate', (event) => {
      if (hasDirtyDraft()) { if (typeof history?.pushState === 'function') history.pushState(currentHistoryState(), '', `#${ui.tab}`); toast('目前有尚未儲存的變更，請先儲存或取消', 'error'); return; }
      const target = event.state?.salaryMateTab || String(location.hash || '').replace(/^#/, '') || 'dashboard';
      if (!selectedEntityIsInCurrentScope()) clearOperationalSelection();
      if (target === 'companies') {
        ui.companyDetailId = String(event.state?.companyDetailId || '');
        ui.companyDetailSection = ['overview', 'salary-rules', 'advanced-rules'].includes(event.state?.companyDetailSection) ? event.state.companyDetailSection : 'overview';
      } else {
        ui.companyDetailId = '';
        ui.companyDetailSection = 'overview';
      }
      selectPrimaryTab(target, 'auto', 'none');
      focusPageHeading();
    });
    window.addEventListener('beforeunload', (event) => { if (hasDirtyDraft()) { event.preventDefault(); event.returnValue = ''; } });

    const companyPicker = $('.company-picker');
    const companyPickerButton = $('#companyPickerButton');
    const companyPickerPanel = $('#companyPickerPanel');
    const openCompanyPicker = () => {
      if (companyPickerButton.disabled) return;
      closeDataMenu();
      companyPickerPanel.hidden = false;
      companyPickerButton.setAttribute('aria-expanded', 'true');
    };
    companyPickerButton.addEventListener('click', () => {
      if (companyPickerPanel.hidden) openCompanyPicker(); else closeCompanyPicker();
    });
    companyPicker.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !companyPickerPanel.hidden) {
        event.preventDefault();closeCompanyPicker(true);return;
      }
      if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
      event.preventDefault();openCompanyPicker();
      const buttons = $$('button', companyPickerPanel);
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : index < 0 ? (event.key === 'ArrowUp' ? buttons.length - 1 : 0)
        : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus({preventScroll:true});
      buttons[next].scrollIntoView?.({block:'nearest'});
    });
    document.addEventListener('click', event => { if (!companyPicker.contains(event.target)) closeCompanyPicker(); });
    document.addEventListener('focusin', event => { if (!companyPicker.contains(event.target)) closeCompanyPicker(); });

    const dataMenuButton = $('#dataMenuButton');
    const dataMenu = $('#dataMenu');
    const closeDataMenu = () => {
      dataMenu.hidden = true;
      dataMenuButton.setAttribute('aria-expanded', 'false');
    };
    dataMenuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      dataMenu.hidden = !dataMenu.hidden;
      dataMenuButton.setAttribute('aria-expanded', String(!dataMenu.hidden));
    });
    dataMenuButton.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !dataMenu.hidden) { event.preventDefault(); closeDataMenu(); dataMenuButton.focus(); }
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.menu-wrap')) closeDataMenu();
    });
    dataMenu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDataMenu(); dataMenuButton.focus(); }
    });
    document.addEventListener('keydown', (event) => {
      const fileTrigger = event.target.closest?.('.menu-file-trigger[role="button"]');
      if (fileTrigger && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileTrigger.querySelector('input[type="file"]')?.click(); return; }
      const radio = event.target.closest?.('[role="radio"]');
      if (!radio || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      const group = radio.closest('[role="radiogroup"]');
      if (!group) return;
      const radios = $$('[role="radio"]', group);
      const index = radios.indexOf(radio);
      if (index < 0 || radios.length < 2) return;
      event.preventDefault();
      const direction = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1;
      const nextRadio = radios[(index + direction + radios.length) % radios.length];
      nextRadio.focus();
      nextRadio.click();
    });
    const appDialog = $('#appDialog');
    appDialog.addEventListener('click', (event) => {
      if (event.target === appDialog) requestCloseDialog();
    });
    appDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      requestCloseDialog();
    });
    appDialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); requestCloseDialog(); return; }
      trapDialogFocus(event);
    });

    const mainContent = $('#mainContent');
    const swipeBlockedSelector = 'input, textarea, select, button, a, [role="tablist"], .table-scroll, .stock-table-wrap, .table-top-scroll, .attendance-trend-scroll, [data-swipe-block]';
    let swipeStart = null;
    const isMobileViewport = () => Number(window.innerWidth || 1024) <= 820;
    mainContent.addEventListener('touchstart', (event) => {
      swipeStart = null;
      if (!isMobileViewport() || event.touches?.length !== 1) return;
      if (event.target?.closest?.(swipeBlockedSelector)) return;
      const touch = event.touches[0];
      const viewportWidth = Number(window.innerWidth || 0);
      if (touch.clientX <= 24 || (viewportWidth && touch.clientX >= viewportWidth - 24)) return;
      swipeStart = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    }, { passive: true });
    mainContent.addEventListener('touchend', (event) => {
      const start = swipeStart;
      swipeStart = null;
      if (!start || event.changedTouches?.length !== 1) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Date.now() - start.at > 700 || Math.abs(deltaX) < 72 || Math.abs(deltaY) > Math.abs(deltaX) * .65) return;
      const currentIndex = PRIMARY_TABS.indexOf(ui.tab);
      const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
      if (nextIndex < 0 || nextIndex >= PRIMARY_TABS.length) return;
      selectPrimaryTab(PRIMARY_TABS[nextIndex], 'auto');
    }, { passive: true });
    mainContent.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });

    const topbar = $('.topbar');
    const syncTopbarHeight = () => {
      const height = Math.ceil(topbar?.getBoundingClientRect?.().height || 72);
      document.body.style?.setProperty?.('--topbar-height', `${height}px`);
    };
    syncTopbarHeight();
    if (typeof ResizeObserver === 'function' && topbar) new ResizeObserver(syncTopbarHeight).observe(topbar);

    setDataStatus('loading', '正在安全讀取本機薪資資料…');
    renderAll();
    loadState();
    if (runtimeState.dataStatus !== 'failure') restoreUiPreferences();
    renderAll();
    window.SalaryMateData = Object.freeze({
      exportPayload: () => JSON.stringify({ ...clone(state), exportInfo: { app: '個人薪資與投資管理', appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() } }, null, 2),
      operationalScope: () => clone({ currentCompanyId: currentCompany()?.id || '', draftScope: ui.draftScope, selectedEntityScope: ui.selectedEntityScope, contextGeneration: runtimeState.generation, operationStatus: runtimeState.operationStatus }),
      importPayload: payload => importJson({ text: async () => payload }),
      handleBackButton: () => {
        const menu = $('#dataMenu');
        if (menu && !menu.hidden) {
          menu.hidden = true;
          $('#dataMenuButton')?.setAttribute('aria-expanded', 'false');
          return true;
        }
        if ($('#appDialog')?.open) {
          requestCloseDialog();
          return true;
        }
        if (ui.tab !== 'dashboard') {
          selectPrimaryTab('dashboard', 'auto');
          return true;
        }
        return false;
      }
    });
    window.SalaryMateCloud = window.SalaryMateGoogleDriveUI.create({
      openDialog, closeDialog, confirm, toast, escapeHtml, userHtml,
      snapshot: () => JSON.parse(window.SalaryMateData.exportPayload()),
      importFile: importJson
    });
    if (new URLSearchParams(window.location.search).get('action') === 'add-record') {
      history.replaceState?.({}, '', window.location.pathname);
      setTimeout(() => openRecordForm(), 0);
    }
    if (ui.migratedLegacy) setTimeout(() => toast('已自動轉入舊版 v2 瀏覽器資料'), 250);
  })();
