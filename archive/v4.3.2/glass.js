/* Glass R2: device-only appearance settings. Never reads or writes payroll state. */
(() => {
  'use strict';
  const KEY = 'salarymate.visualEffects.v1';
  const modes = Object.freeze({
    normal: { name: '一般', detail: '輕透介面，省電流暢' },
    fine: { name: '精細', detail: '細緻霧面，柔和過場' },
    dynamic: { name: '高動態', detail: '流動邊光，點按光波' }
  });
  const valid = value => Object.prototype.hasOwnProperty.call(modes, value);
  const normalize = value => valid(value) ? value : 'fine';
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduceTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let selected = 'fine';
  let storageFailed = false;
  try { selected = normalize(localStorage.getItem(KEY)); } catch { storageFailed = true; }
  let frame = 0;
  let pendingPointer = null;
  let litCard = null;
  let pointerAttached = false;
  let tapAttached = false;
  let tapWave = null;
  let tapTimer = 0;

  const clearTap = () => {
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = 0;
    tapWave?.remove();
    tapWave = null;
  };
  const pointerDown = event => {
    if (event.button != null && event.button !== 0) return;
    const target = event.target.closest?.('.btn, .tab-btn, .glass-option-face');
    if (!target || target.disabled || target.closest?.('#securityCover')) return;
    clearTap();
    const rect = target.getBoundingClientRect();
    const wave = document.createElement('span');
    wave.className = 'glass-tap-wave';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.left = `${Math.round(event.clientX - rect.left)}px`;
    wave.style.top = `${Math.round(event.clientY - rect.top)}px`;
    target.appendChild(wave);
    tapWave = wave;
    tapTimer = setTimeout(clearTap, 700);
  };

  const clearSpotlight = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pendingPointer = null;
    if (litCard) {
      litCard.style.removeProperty('--glass-x');
      litCard.style.removeProperty('--glass-y');
      litCard = null;
    }
  };
  const pointerMove = event => {
    if (event.pointerType === 'touch') return;
    const card = event.target.closest?.('.card');
    if (!card) { clearSpotlight(); return; }
    pendingPointer = { card, x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const pointer = pendingPointer;
      if (!pointer || !pointer.card.isConnected) return;
      if (litCard !== pointer.card) clearSpotlight();
      litCard = pointer.card;
      const rect = litCard.getBoundingClientRect();
      litCard.style.setProperty('--glass-x', `${Math.round(pointer.x - rect.left)}px`);
      litCard.style.setProperty('--glass-y', `${Math.round(pointer.y - rect.top)}px`);
    });
  };
  const notice = () => {
    const notes = [];
    if (reduceMotion.matches) notes.push('已依系統「減少動態效果」停用動畫與互動流光。');
    if (reduceTransparency.matches) notes.push('已依系統「減少透明度」改用實色介面。');
    notes.push(storageFailed ? '目前無法儲存偏好，重新開啟後可能恢復預設。' : '此裝置會記住你的選擇，不影響薪資資料。');
    return notes.join(' ');
  };
  const syncControls = () => {
    document.querySelectorAll('input[name="salarymate-glass"]').forEach(input => {
      input.checked = input.value === selected;
    });
    document.querySelectorAll('[data-glass-notice]').forEach(element => {
      const text = notice();
      if (element.textContent !== text) element.textContent = text;
    });
  };
  const apply = () => {
    root.dataset.glassChoice = selected;
    root.dataset.glassMode = reduceMotion.matches ? 'normal' : selected;
    root.dataset.glassOpaque = String(reduceTransparency.matches);
    root.dataset.glassPaused = String(document.hidden);
    const interactive = selected === 'dynamic' && !reduceMotion.matches && !reduceTransparency.matches && !document.hidden;
    const needsPointer = interactive && finePointer.matches;
    if (needsPointer !== pointerAttached) {
      document[needsPointer ? 'addEventListener' : 'removeEventListener']('pointermove', pointerMove);
      pointerAttached = needsPointer;
    }
    if (!needsPointer) clearSpotlight();
    if (interactive !== tapAttached) {
      document[interactive ? 'addEventListener' : 'removeEventListener']('pointerdown', pointerDown, { passive: true });
      tapAttached = interactive;
    }
    if (!interactive) clearTap();
    syncControls();
  };
  const setMode = value => {
    if (!valid(value)) return;
    selected = value;
    try { localStorage.setItem(KEY, selected); storageFailed = false; }
    catch { storageFailed = true; }
    clearSpotlight();
    apply();
  };
  const settingsHtml = () => `<fieldset class="glass-settings" aria-describedby="glassNotice">
    <legend>動態玻璃</legend>
    <p class="glass-description">透明層次與動態強度，可隨時切換。</p>
    <div class="glass-options">${Object.entries(modes).map(([value, mode]) => `<label class="glass-option">
      <input class="glass-radio" type="radio" name="salarymate-glass" value="${value}" ${selected === value ? 'checked' : ''}>
      <span class="glass-option-face">
        <span class="glass-sample glass-sample-${value}" aria-hidden="true"><span></span></span>
        <span class="glass-option-name">${mode.name}</span><span class="glass-option-detail">${mode.detail}</span>
      </span>
    </label>`).join('')}</div>
    <p class="glass-notice" id="glassNotice" data-glass-notice role="status">${notice()}</p>
  </fieldset>`;

  window.SalaryMateGlass = Object.freeze({ settingsHtml });
  document.addEventListener('change', event => {
    if (event.target.matches?.('input[name="salarymate-glass"]')) setMode(event.target.value);
  });
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) {
      selected = normalize(event.newValue);
      clearSpotlight();
      apply();
    }
  });
  for (const media of [reduceMotion, reduceTransparency, finePointer]) {
    if (media.addEventListener) media.addEventListener('change', apply);
    else media.addListener?.(apply);
  }
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('blur', () => { clearSpotlight(); clearTap(); });
  const observeSettings = () => {
    const content = document.querySelector('#dialogContent');
    if (content) new MutationObserver(syncControls).observe(content, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeSettings, { once: true });
  else observeSettings();
  apply();
})();
