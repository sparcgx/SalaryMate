import { VERSION, KEY, LEAVES, uid, dateKey, validDate, initialState, calendarDates, leaveBalance, monthSummary, putEntry, putCompany, parseBackup, backup, LocalStore, round } from './core.js';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const num = n => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(n);
const money = n => 'NT$ ' + new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(n);
const today = () => dateKey();
const statusNames = { confirmed: '已確認', planned: '預計', cancelled: '已取消' };
let storage;
try { storage = localStorage; } catch { storage = { getItem() { throw new Error('unavailable'); } }; }
const store = new LocalStore(storage);
let state, loadError = '';
try { state = store.load(); } catch (e) { state = initialState(); loadError = e.message; }
let companyId = state.companies[0].id, selected = today(), month = selected.slice(0, 7), view = 'calendar', filter = 'all', statusFilter = 'active';
let editing = null, draftKind = 'overtime', draftCompanyId = null, pendingBackup = null, toastTimer;
const company = () => state.companies.find(c => c.id === companyId);
const year = () => month.slice(0, 4);
const dayLabel = date => new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric' }).format(new Date(date + 'T12:00:00'));
const weekday = date => new Intl.DateTimeFormat('zh-TW', { weekday: 'long' }).format(new Date(date + 'T12:00:00'));
function message(msg) { $('#toast').textContent = msg; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200); }
function notice(msg, action = '') { $('#notice').hidden = false; $('#notice').innerHTML = esc(msg) + action; }
function commit(next) { state = store.save(next); render(); }
function entriesForDay(d) { return state.entries.filter(e => e.companyId === companyId && e.date === d).sort((a, b) => (a.status === 'cancelled') - (b.status === 'cancelled') || a.kind.localeCompare(b.kind)); }
function entryName(e) { return e.kind === 'overtime' ? '加班' : e.leaveType; }
function row(e, withDate = false) {
  const amount = e.kind === 'overtime' && e.hourlyRate !== null ? money(round(e.hours * e.hourlyRate * e.multiplier)) : '';
  return `<button type="button" class="entry-item ${e.kind === 'leave' ? 'leave' : ''} ${e.status === 'cancelled' ? 'cancelled' : ''}" data-action="edit" data-id="${esc(e.id)}" aria-label="編輯 ${esc(e.date)} ${esc(entryName(e))} ${num(e.hours)} 小時 ${statusNames[e.status]}"><span class="entry-top"><span class="entry-title">${esc(entryName(e))}</span><span class="number">${num(e.hours)} 小時</span></span><span class="entry-meta">${withDate ? `<span>${esc(e.date)}</span>` : ''}<span class="status ${e.status}">${statusNames[e.status]}</span>${amount ? `<span>試算 ${amount}</span>` : ''}</span>${e.note ? `<p class="entry-note">${esc(e.note)}</p>` : ''}</button>`;
}
function heading() {
  return `<div class="page-heading"><div class="title-group"><h1>${Number(month.slice(5))} 月<span class="year">${year()} 年</span></h1><div class="month-controls"><button type="button" data-action="prev" aria-label="上一個月"><span class="chevron left" aria-hidden="true"></span></button><button type="button" data-action="today">本月</button><button type="button" data-action="next" aria-label="下一個月"><span class="chevron" aria-hidden="true"></span></button><button type="button" data-action="pick-month" aria-label="選擇年月">選月份</button></div></div><button type="button" class="primary" data-action="add">新增紀錄</button></div>`;
}
function summary() {
  const stats = monthSummary(state, companyId, month), balance = leaveBalance(state, companyId, year());
  return `<div class="summary-strip" aria-label="本月與年度摘要">
  <div class="metric"><span class="metric-label">本月加班</span><span class="metric-value">${num(stats.hours)}<small>小時</small></span><span class="metric-sub">${stats.plannedHours ? `另有 ${num(stats.plannedHours)} 小時預計加班` : '已確認的加班紀錄'}</span></div>
  <div class="metric"><span class="metric-label">加班費試算</span><span class="metric-value">${stats.unpriced && !stats.amount ? '—' : num(stats.amount)}${stats.unpriced && !stats.amount ? '' : '<small>元</small>'}</span><span class="metric-sub">${stats.unpriced ? `${stats.unpriced} 筆尚未填試算時薪` : '依各筆時薪與倍率計算'}</span></div>
  <div class="metric"><span class="metric-label">${year()} 可安排特休</span><span class="metric-value">${balance.available === null ? '<button type="button" class="inline-link" data-action="quota">設定額度</button>' : `${num(balance.available)}<small>小時</small>`}</span><span class="metric-sub">已扣除使用與排定時數</span></div>
  <div class="metric"><span class="metric-label">${year()} 已排定特休</span><span class="metric-value">${num(balance.booked)}<small>小時</small></span><span class="metric-sub">未來及待確認的請假</span></div></div>`;
}
function balanceDetail() {
  const b = leaveBalance(state, companyId, year());
  return `<section class="balance-detail" aria-label="年度特休明細"><h3>${year()} 年特休</h3><dl><dt>年度額度</dt><dd>${b.quota === null ? '未設定' : num(b.quota) + ' 小時'}</dd><dt>已使用</dt><dd>${num(b.used)} 小時</dd><dt>已排定</dt><dd>${num(b.booked)} 小時</dd><dt>可再安排</dt><dd>${b.available === null ? '—' : num(b.available) + ' 小時'}</dd></dl><p class="calendar-hint">按 1～12 月歸戶，額度以公司核定為準。</p><button type="button" class="small-button" data-action="quota">調整額度</button></section>`;
}
function calendarView() {
  const days = calendarDates(month).map(d => {
    const entries = entriesForDay(d).filter(e => e.status !== 'cancelled');
    return `<button type="button" class="day ${d === selected ? 'selected' : ''} ${d === today() ? 'today' : ''} ${d.slice(0, 7) !== month ? 'other-month' : ''}" data-action="day" data-date="${d}" tabindex="${d === selected ? '0' : '-1'}" ${validDate(d) ? '' : 'disabled'} aria-pressed="${d === selected}" ${d === today() ? 'aria-current="date"' : ''} aria-label="${d} ${weekday(d)}，${entries.length ? entries.map(e => `${entryName(e)} ${num(e.hours)} 小時 ${statusNames[e.status]}`).join('，') : '無紀錄'}"><span class="day-number">${Number(d.slice(-2))}</span>${entries.slice(0, 2).map(e => `<span class="cal-tag ${e.kind === 'leave' ? 'leave' : ''} ${e.status === 'planned' ? 'planned' : ''}">${e.kind === 'overtime' ? '加班' : esc(e.leaveType)} ${num(e.hours)}h</span>`).join('')}${entries.length > 2 ? `<span class="more-events">+${entries.length - 2} 筆</span>` : ''}</button>`;
  }).join('');
  const entries = entriesForDay(selected);
  return `${heading()}${summary()}<div class="calendar-layout"><section aria-label="月曆"><div class="calendar-top"><div class="legend"><span><i></i>加班</span><span><i class="leave-mark"></i>請假</span><span>虛線：預計</span></div><p>選擇日期，查看或新增紀錄</p></div><div class="weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(d => `<span>${d}</span>`).join('')}</div><div class="calendar-grid" role="group" aria-label="${year()} 年 ${Number(month.slice(5))} 月日期；方向鍵切換日期">${days}</div></section><aside class="agenda"><section><div class="agenda-heading"><h2>${dayLabel(selected)}</h2><span>${weekday(selected)}</span></div>${entries.length ? entries.map(e => row(e)).join('') : `<div class="day-empty"><p>這天還沒有紀錄。<br>加班或請假，從這裡開始。</p><div class="day-actions"><button type="button" data-action="add-ot">記加班</button><button type="button" data-action="add-leave">記請假</button></div></div>`}${entries.length ? '<button type="button" class="agenda-add" data-action="add">新增這天的紀錄</button>' : ''}</section>${balanceDetail()}</aside></div>`;
}
function recordsView() {
  const entries = state.entries.filter(e => e.companyId === companyId && e.date.startsWith(month) && (filter === 'all' || (filter === 'annual' ? e.kind === 'leave' && e.leaveType === '特休' : e.kind === filter)) && (statusFilter === 'all' || (statusFilter === 'active' ? e.status !== 'cancelled' : e.status === statusFilter))).sort((a, b) => b.date.localeCompare(a.date));
  let lastDate = '';
  const mobile = entries.map(e => { const label = e.date !== lastDate ? `<div class="record-date-group">${dayLabel(e.date)}　${weekday(e.date)}</div>` : ''; lastDate = e.date; return label + row(e); }).join('');
  return `${heading()}${summary()}<div class="filter-bar" aria-label="紀錄篩選">${[['all','全部'],['overtime','加班'],['annual','特休'],['leave','請假']].map(([v,t]) => `<button type="button" data-action="filter" data-filter="${v}" class="${filter === v ? 'active' : ''}" aria-pressed="${filter === v}">${t}</button>`).join('')}<label class="sr-only" for="statusFilter">紀錄狀態</label><select id="statusFilter">${[['active','有效紀錄'],['confirmed','已確認'],['planned','預計'],['cancelled','已取消'],['all','所有狀態']].map(([v,t]) => `<option value="${v}" ${statusFilter === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>${entries.length ? `<div class="desktop-table"><table class="records-table"><thead><tr><th>日期</th><th>項目</th><th class="numeric">時數</th><th>狀態</th><th class="numeric">加班費試算</th><th>備註</th><th><span class="sr-only">操作</span></th></tr></thead><tbody>${entries.map(e => `<tr class="${e.status === 'cancelled' ? 'cancelled' : ''}"><td class="mono">${e.date.slice(5).replace('-',' / ')}<br><small class="muted">${weekday(e.date)}</small></td><td>${esc(entryName(e))}</td><td class="numeric">${num(e.hours)}</td><td><span class="status ${e.status}">${statusNames[e.status]}</span></td><td class="numeric">${e.kind === 'overtime' && e.hourlyRate !== null ? money(round(e.hours * e.hourlyRate * e.multiplier)) : '—'}</td><td class="note-col">${esc(e.note) || '—'}</td><td><button type="button" class="plain" data-action="edit" data-id="${esc(e.id)}">編輯</button></td></tr>`).join('')}</tbody></table></div><div class="mobile-records">${mobile}</div><p class="record-total">共 ${entries.length} 筆 · 小時計錄可填至小數點後兩位</p>` : '<div class="empty-state"><h2>目前沒有符合的紀錄</h2><p>可新增加班、請假，或切換月份與篩選條件。</p><button type="button" data-action="add">新增紀錄</button></div>'}`;
}
function settingsView() {
  const c = company(), y = year();
  return `<div class="page-heading"><h1>設定</h1><button type="button" class="small-button" data-action="add-company">新增公司</button></div><div class="settings-grid"><div><form id="companyForm"><section class="settings-section"><h2>目前公司</h2><div class="field"><label for="companyName">公司名稱</label><input id="companyName" name="name" value="${esc(c.name)}" maxlength="50" required></div><div class="field-row"><div class="field"><label for="hourlyRate">加班試算時薪（元）</label><input id="hourlyRate" name="hourlyRate" type="number" inputmode="decimal" min="0" max="100000" step="0.01" value="${c.hourlyRate ?? ''}" placeholder="可先留白"></div><div class="field"><label for="defaultMultiplier">預設試算倍率</label><input id="defaultMultiplier" name="multiplier" type="number" inputmode="decimal" min="0" max="10" step="0.01" value="${c.multiplier}" required></div></div><p>時薪與倍率只作為新增紀錄的預設值。既有紀錄保留當時的數值；實際金額請核對薪資單。</p><div id="companyError" class="form-error" role="alert"></div><button type="submit" class="primary">儲存公司設定</button></section></form><section class="settings-section"><h2>特休額度</h2><form id="quotaForm"><div class="field-row"><div class="field"><label for="quotaYear">年度</label><input id="quotaYear" name="year" type="number" min="1900" max="2199" step="1" value="${y}" required></div><div class="field"><label for="quotaHours">年度總額度（小時）</label><input id="quotaHours" name="hours" type="number" inputmode="decimal" min="0" max="3000" step="0.01" value="${c.quotas[y] ?? ''}" placeholder="填公司核定的時數" required></div></div><p>以每年 1 月 1 日至 12 月 31 日計算。請填總額度，系統會扣除已使用及已排定的特休，不會自動推算年資或法定天數。</p><div id="quotaError" class="form-error" role="alert"></div><button type="submit">儲存特休額度</button></form></section></div><div class="settings-right"><section class="settings-section"><h2>備份與還原</h2><p>備份包含 v5 所有公司、加班與請假紀錄。換裝置或清除瀏覽器前，請先下載保存。</p><div class="backup-actions"><button type="button" data-action="export">匯出備份</button><button type="button" data-action="import">匯入備份</button></div><div class="settings-note">JSON 備份未加密。還原前會顯示資料筆數，並下載目前資料的備份。</div></section><section class="settings-section"><h2>資料與版本</h2><p>資料只儲存在目前瀏覽器，沒有雲端同步。不同裝置與瀏覽器的紀錄互相獨立。</p><p>v5 使用獨立資料區。v4 的薪資、歷史與備份仍由原版本管理，目前不自動轉入。</p><button type="button" data-action="about" class="small-button">使用與隱私說明</button><div class="settings-note">v${VERSION} · 介面與流程開發版</div></section></div></div>`;
}
function render() {
  $('#companySelect').innerHTML = state.companies.map(c => `<option value="${esc(c.id)}" ${c.id === companyId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  document.querySelectorAll('[data-view]').forEach(b => { if (b.dataset.view === view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  $('#main').innerHTML = view === 'settings' ? settingsView() : view === 'records' ? recordsView() : calendarView();
}
function switchView(next) { view = next; render(); window.scrollTo({ top:0, behavior:'instant' }); }
function selectDay(d, focus = false) { selected = d; month = d.slice(0, 7); render(); if (focus) document.querySelector(`[data-date="${d}"]`)?.focus(); }
function stepMonth(step) { const date = new Date(month + '-01T12:00:00'); date.setMonth(date.getMonth() + step); const m = dateKey(date).slice(0,7); if (m < '1900-01' || m > '2199-12') return; month = m; selected = m === today().slice(0,7) ? today() : m + '-01'; render(); }
function openEditor(kind = 'overtime', entry = null) {
  if (store.blocked) return message('請先處理本機資料讀取問題。');
  editing = entry?.id || null; draftKind = entry?.kind || kind; draftCompanyId = companyId;
  const draft = entry || { date: selected, hours: draftKind === 'overtime' ? 2 : 8, status: selected > today() ? 'planned' : 'confirmed', note:'', leaveType:'特休', hourlyRate:company().hourlyRate, multiplier:company().multiplier };
  editorBody(draft);
  $('#editor').showModal();
}
function editorBody(d) {
  $('#entryForm').innerHTML = `<div class="dialog-heading"><h2 id="editorTitle">${editing ? '編輯紀錄' : '新增紀錄'}</h2><button type="button" class="plain" data-action="close-editor" aria-label="關閉登記視窗">關閉</button></div><div class="kind-tabs" aria-label="紀錄類別"><button type="button" data-action="kind" data-kind="overtime" aria-pressed="${draftKind === 'overtime'}">加班</button><button type="button" data-action="kind" data-kind="leave" aria-pressed="${draftKind === 'leave'}">請假</button></div><div class="field-row"><div class="field"><label for="entryDate">日期</label><input id="entryDate" name="date" type="date" min="1900-01-01" max="2199-12-31" value="${esc(d.date)}" required></div><div class="field"><label for="entryStatus">狀態</label><select id="entryStatus" name="status">${Object.entries(statusNames).filter(([v]) => v !== 'cancelled' || editing).map(([v,t]) => `<option value="${v}" ${d.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>${draftKind === 'leave' ? `<div class="field"><label for="leaveType">假別</label><select id="leaveType" name="leaveType">${LEAVES.map(t => `<option ${d.leaveType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}<div class="field"><label for="entryHours">${draftKind === 'leave' ? '請假' : '加班'}時數</label><input id="entryHours" name="hours" type="number" inputmode="decimal" min="0.01" max="24" step="0.01" value="${esc(d.hours)}" required><div class="quick-hours">${(draftKind === 'leave' ? [1,2,4,8] : [1,2,3,4]).map(n => `<button type="button" data-action="hours" data-hours="${n}">${n} 小時</button>`).join('')}</div></div>${draftKind === 'overtime' ? `<div class="estimate"><span>加班費試算</span><strong id="estimateValue"></strong></div><details class="compact-details" ${d.hourlyRate === null ? 'open' : ''}><summary>本次時薪與倍率</summary><div class="field-row"><div class="field"><label for="entryRate">時薪（元）</label><input id="entryRate" name="hourlyRate" type="number" inputmode="decimal" min="0" max="100000" step="0.01" value="${d.hourlyRate ?? ''}" placeholder="可先留白"></div><div class="field"><label for="entryMultiplier">倍率</label><input id="entryMultiplier" name="multiplier" type="number" inputmode="decimal" min="0" max="10" step="0.01" value="${d.multiplier ?? company().multiplier}" required></div></div><p>1.34 為近似試算值；依公司約定填寫，不以星期幾自動判定法定日別。</p></details>` : '<p id="leaveHint" class="settings-note"></p>'}<div class="field"><label for="entryNote">備註 <span class="muted">（選填）</span></label><textarea id="entryNote" name="note" rows="2" maxlength="300" placeholder="例如：產線支援、回診">${esc(d.note)}</textarea></div><div id="entryError" class="form-error" role="alert"></div><div class="dialog-actions">${editing && d.status !== 'cancelled' ? '<button type="button" class="plain danger" data-action="cancel-entry">取消這筆</button>' : ''}<button type="button" data-action="close-editor">返回</button><button type="submit" class="primary">儲存紀錄</button></div>`;
  updateEstimate();
}
function updateEstimate() {
  if (draftKind === 'overtime') {
    const rate = $('#entryRate').value, hours = Number($('#entryHours').value), multiplier = Number($('#entryMultiplier').value);
    $('#estimateValue').textContent = rate === '' ? '尚未設定時薪' : money(round(Number(rate) * hours * multiplier));
  } else {
    const d = $('#entryDate').value, type = $('#leaveType').value;
    if (!validDate(d)) return;
    const b = leaveBalance(state, draftCompanyId, d.slice(0,4));
    $('#leaveHint').textContent = type !== '特休' ? '此假別不扣特休額度，也不自動計算薪資扣款。' : b.quota === null ? `${d.slice(0,4)} 年尚未設定特休額度，可先登記，再到設定填入額度。` : `${d.slice(0,4)} 年可再安排 ${num(b.available)} 小時特休。${editing ? '儲存時會重新計算這筆紀錄。' : ''}`;
  }
}
function currentDraft() { return Object.fromEntries(new FormData($('#entryForm'))); }
function utility(title, content) { $('#utilityBody').innerHTML = `<div class="dialog-heading"><h2 id="utilityTitle">${title}</h2><button type="button" class="plain" data-action="close-utility">關閉</button></div>${content}`; $('#utility').showModal(); }
function download(text, filename) { const url = URL.createObjectURL(new Blob([text], {type:'application/json;charset=utf-8'})); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function exportData(prefix = 'SalaryMate_v5_Backup') { download(backup(state), `${prefix}_${today()}_${Date.now()}.json`); }
function about() { utility('使用與隱私說明', `<div class="dialog-copy"><h3>加班試算</h3><p>以每筆填入的時數 × 時薪 × 倍率估算，保留當時設定。1.34 是近似試算值，不是適用所有情況的法定倍率；不同日別或時段可分筆登記並填入對應倍率。請以公司規定及薪資單核對。</p><h3>特休與請假</h3><p>特休額度由你填入，按曆年統計。已確認且日期已到的特休列為已使用；預計或未來特休列為已排定；取消的紀錄不扣額度。本版不計算年資、週年制、到期結轉、法定權益或請假扣薪。</p><h3>本機資料</h3><p>工作紀錄只保存在目前瀏覽器，沒有雲端同步。瀏覽器資料與 JSON 備份未加密；請定期匯出至可信任位置。網站託管服務仍可能處理一般連線資訊，但本頁不主動傳送你的工作紀錄。</p><h3>版本與授權</h3><p>v${VERSION} 是獨立開發版。v4 資料不會自動轉入。此頁使用原生 HTML、CSS、JavaScript 與系統字型，無外部圖像或字型下載。既有授權文件可於<a href="../v4.3.3-dev.1/legal.html" target="_blank" rel="noopener">授權頁</a>閱讀。</p></div>`); }

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]');
  if (nav) { switchView(nav.dataset.view); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'prev') stepMonth(-1);
  if (action === 'next') stepMonth(1);
  if (action === 'today') { selected = today(); month = selected.slice(0,7); render(); }
  if (action === 'day') selectDay(button.dataset.date, true);
  if (action === 'add' || action === 'add-ot') openEditor('overtime');
  if (action === 'add-leave') openEditor('leave');
  if (action === 'edit') { const entry = state.entries.find(e => e.id === button.dataset.id && e.companyId === companyId); if (entry) openEditor(entry.kind, entry); }
  if (action === 'close-editor') $('#editor').close();
  if (action === 'close-utility') { $('#utility').close(); pendingBackup = null; }
  if (action === 'kind') { const d = currentDraft(); draftKind = button.dataset.kind; d.hourlyRate = d.hourlyRate ?? company().hourlyRate; d.multiplier = d.multiplier ?? company().multiplier; d.leaveType = d.leaveType || '特休'; editorBody(d); }
  if (action === 'hours') { $('#entryHours').value = button.dataset.hours; updateEstimate(); }
  if (action === 'cancel-entry') { $('#entryStatus').value = 'cancelled'; $('#entryForm').requestSubmit(); }
  if (action === 'filter') { filter = button.dataset.filter; render(); }
  if (action === 'quota') { switchView('settings'); $('#quotaHours').focus(); }
  if (action === 'about') about();
  if (action === 'export') { try { exportData(); message('備份已下載'); } catch(e) { message(e.message); } }
  if (action === 'import') $('#backupInput').click();
  if (action === 'reload') location.reload();
  if (action === 'raw-backup') { if (store.raw) download(store.raw,`SalaryMate_v5_Recover_${Date.now()}.json`); else message('沒有可下載的原始資料。'); }
  if (action === 'add-company') utility('新增公司', '<form id="newCompanyForm"><div class="field"><label for="newCompanyName">公司名稱</label><input id="newCompanyName" name="name" maxlength="50" required placeholder="輸入公司名稱"></div><div class="form-error" id="newCompanyError" role="alert"></div><div class="dialog-actions"><button type="button" data-action="close-utility">返回</button><button type="submit" class="primary">新增公司</button></div></form>');
  if (action === 'pick-month') utility('選擇月份', `<form id="monthForm"><div class="field"><label for="selectedMonth">年月</label><input type="month" id="selectedMonth" name="month" value="${month}" min="1900-01" max="2199-12" required></div><div id="monthError" class="form-error" role="alert"></div><div class="dialog-actions"><button type="submit" class="primary">查看月份</button></div></form>`);
  if (action === 'restore') {
    try {
      if (!pendingBackup) throw new Error('請重新選擇備份檔。');
      const next = pendingBackup;
      exportData('SalaryMate_v5_Before_Restore');
      const saved = store.save(next);
      state = saved; companyId = state.companies[0].id; pendingBackup = null; $('#utility').close(); render(); message('v5 備份已還原');
    } catch(e) { $('#restoreError').textContent = e.message; }
  }
});

document.addEventListener('submit', event => {
  const form = event.target; if (!['entryForm','companyForm','quotaForm','newCompanyForm','monthForm'].includes(form.id)) return;
  event.preventDefault(); const data = Object.fromEntries(new FormData(form));
  if (form.id === 'entryForm') {
    try {
      const entry = { ...data, id: editing || uid(), companyId: draftCompanyId, kind: draftKind, hourlyRate: data.hourlyRate === '' ? null : data.hourlyRate };
      const next = putEntry(state, entry), saved = store.save(next);
      state = saved; selected = data.date; month = selected.slice(0,7); $('#editor').close(); render(); message(data.status === 'cancelled' ? '已取消紀錄，時數已重新計算' : '紀錄已儲存');
    } catch(e) { $('#entryError').textContent = e.message; }
  }
  if (form.id === 'companyForm') {
    try { commit(putCompany(state, { ...company(), ...data })); message('公司設定已儲存'); } catch(e) { $('#companyError').textContent = e.message; }
  }
  if (form.id === 'quotaForm') {
    try { const c = company(); commit(putCompany(state, { ...c, quotas: { ...c.quotas, [data.year]: data.hours } })); message(`${data.year} 年特休額度已儲存`); } catch(e) { $('#quotaError').textContent = e.message; }
  }
  if (form.id === 'newCompanyForm') {
    try { const id = uid(), next = putCompany(state, {id, name:data.name, hourlyRate:null, multiplier:1.34, quotas:{}}); state = store.save(next); companyId = id; $('#utility').close(); render(); message('公司已新增'); } catch(e) { $('#newCompanyError').textContent = e.message; }
  }
  if (form.id === 'monthForm') { if (!validDate(data.month + '-01')) { $('#monthError').textContent = '請選擇有效的月份。'; return; } month = data.month; selected = month === today().slice(0,7) ? today() : month + '-01'; $('#utility').close(); render(); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'companySelect') { companyId = event.target.value; render(); }
  if (event.target.id === 'statusFilter') { statusFilter = event.target.value; render(); }
  if (event.target.id === 'quotaYear') $('#quotaHours').value = company().quotas[event.target.value] ?? '';
  if (event.target.closest('#entryForm')) updateEstimate();
});
document.addEventListener('input', event => { if (event.target.closest('#entryForm')) updateEstimate(); });
$('#backupInput').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('備份檔超過 10 MB，無法匯入。');
    pendingBackup = parseBackup(await file.text());
    utility('還原 v5 備份', `<div class="dialog-copy"><p>這份備份將取代本機目前的 <strong>v5 資料</strong>。</p><dl class="restore-summary"><dt>公司</dt><dd>${pendingBackup.companies.length} 家</dd><dt>加班與請假紀錄</dt><dd>${pendingBackup.entries.length} 筆</dd></dl><p>確認後會先下載目前資料的備份。v4 資料不受影響。</p></div><div id="restoreError" class="form-error" role="alert"></div><div class="dialog-actions"><button type="button" data-action="close-utility">返回</button><button type="button" class="primary" data-action="restore">備份目前資料並還原</button></div>`);
  } catch(e) { pendingBackup = null; utility('無法匯入', `<p class="dialog-copy">${esc(e.message)}</p>`); }
});
document.addEventListener('keydown', event => {
  if (!event.target.matches('[data-action="day"]')) return;
  const step = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7}[event.key];
  if (!step) return; event.preventDefault(); const date = new Date(event.target.dataset.date + 'T12:00:00'); date.setDate(date.getDate() + step); const d = dateKey(date); if (validDate(d)) selectDay(d, true);
});
window.addEventListener('storage', event => { if (event.key === KEY && event.newValue !== store.raw) notice('另一分頁已更新資料。請保留目前輸入，重新整理後再繼續。', '<button type="button" data-action="reload">重新整理</button>'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#editor').open && !$('#utility').open && view !== 'settings') render(); });
render();
if (loadError) notice(loadError, '<button type="button" data-action="raw-backup">下載原始資料</button>');
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(() => { notice('離線模式尚未就緒；目前仍可在線上使用，請保留資料備份。'); }); });
}
