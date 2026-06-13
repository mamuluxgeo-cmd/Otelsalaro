const API_URL = 'https://script.google.com/macros/s/AKfycbyKkNVxzAE9QQRKxYaMwGN5MGKlkiE9ApWrqkMmhO3jxgcUwwyEMLv0vwwjwSeSilUC/exec';
const REPORT_PASSWORD = '2020';

const state = {
  bootstrap: { salesChannels: [], paymentMethods: [], rooms: [], shifts: [], lastOpenShift: null },
  stats: null,
  history: [],
  reportStats: null,
  reportHistory: [],
  reportUnlocked: sessionStorage.getItem('otelReportUnlocked') === '1',
  pendingProtectedPage: '',
  editing: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function money(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString('ka-GE', { maximumFractionDigits: 2 })} ₾`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

function toast(message, isError = false) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.toggle('error', isError);
  box.classList.add('show');
  setTimeout(() => box.classList.remove('show'), 2800);
}

function setApiStatus(text, ok = false) {
  $('#apiStatus').textContent = text;
  $('.status-dot').classList.toggle('ok', ok);
  $('#lastSync').textContent = `ბოლო განახლება: ${new Date().toLocaleTimeString('ka-GE')}`;
}

function api(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `otelCb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement('script');
    const params = new URLSearchParams({ action, callback: callbackName, payload: JSON.stringify(payload) });

    window[callbackName] = (response) => {
      cleanup();
      if (!response || !response.success) {
        reject(new Error(response && response.error ? response.error : 'შეცდომა'));
        return;
      }
      resolve(response.data);
    };

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }

    script.onerror = () => {
      cleanup();
      reject(new Error('Apps Script-ს ვერ დაუკავშირდა'));
    };

    script.src = `${API_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

async function loadBootstrap(forceRefresh = false) {
  try {
    setApiStatus('იტვირთება', false);
    const data = await api('getBootstrap', { forceRefresh });
    state.bootstrap = data;
    setApiStatus('დაკავშირებულია', true);
    renderAll();
    await loadStats(todayFilters());
    await loadHistory(todayFilters());
    if (state.reportUnlocked) await loadDailyReport();
  } catch (err) {
    setApiStatus('შეცდომა', false);
    toast(err.message, true);
  }
}

function todayFilters() {
  return { dateFrom: today(), dateTo: today() };
}

async function loadStats(filters = {}) {
  const data = await api('getStats', filters);
  state.stats = data;
  renderStats(data);
  renderDashboard(data);
}

async function loadHistory(filters = {}) {
  const data = await api('getHistory', filters);
  state.history = data.items || [];
  renderHistory();
}

async function loadDailyReport() {
  const filters = todayFilters();
  const [stats, historyData] = await Promise.all([
    api('getStats', filters),
    api('getHistory', filters)
  ]);
  state.reportStats = stats;
  state.reportHistory = historyData.items || [];
  renderDailyReport();
}

function renderAll() {
  renderSelects();
  renderSettingsLists();
  renderPaymentChips();
  renderShift();
  renderCloseFields();
}

function activeRows(rows) {
  return (rows || []).filter(item => item.status !== 'inactive' && item.status !== 'canceled');
}

function fillSelect(id, rows, labelKey, placeholder = 'აირჩიე') {
  const select = $(id);
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + activeRows(rows).map(item => `<option value="${esc(item.id)}">${esc(item[labelKey] || item.name)}</option>`).join('');
  if (current) select.value = current;
}

function renderSelects() {
  const { rooms, salesChannels, paymentMethods } = state.bootstrap;
  fillSelect('#incomeRoom', rooms, 'roomName', 'ოთახი');
  fillSelect('#incomeChannel', salesChannels, 'name', 'არხი');
  fillSelect('#incomePayment', paymentMethods, 'name', 'წყარო');
  fillSelect('#otherIncomePayment', paymentMethods, 'name', 'წყარო');
  fillSelect('#expensePayment', paymentMethods, 'name', 'წყარო');
  fillSelect('#withdrawalPayment', paymentMethods, 'name', 'წყარო');
  fillSelect('#statsPayment', paymentMethods, 'name', 'ყველა წყარო');
  fillSelect('#statsChannel', salesChannels, 'name', 'ყველა არხი');
}

function renderPaymentChips() {
  const wrap = $('#paymentChips');
  wrap.innerHTML = activeRows(state.bootstrap.paymentMethods).map(item => chip(item.name, item.color)).join('') || '<div class="empty-state">გადახდის წყაროები ჯერ არ არის.</div>';
}

function chip(name, color) {
  return `<span class="chip"><i class="chip-color" style="background:${esc(color || '#64748b')}"></i>${esc(name)}</span>`;
}

function renderSettingsLists() {
  $('#salesChannelList').innerHTML = activeRows(state.bootstrap.salesChannels).map(item => editableMiniItem('salesChannel', item, item.name, item.color)).join('') || '<div class="empty-state">არხი ჯერ არ არის.</div>';
  $('#paymentMethodList').innerHTML = activeRows(state.bootstrap.paymentMethods).map(item => editableMiniItem('paymentMethod', item, `${item.name} • ${item.type}`, item.color)).join('') || '<div class="empty-state">გადახდის წყარო ჯერ არ არის.</div>';
  $('#roomList').innerHTML = activeRows(state.bootstrap.rooms).map(item => editableMiniItem('room', item, item.description ? `${item.roomName} • ${item.description}` : item.roomName, '#334155')).join('') || '<div class="empty-state">ნომერი ჯერ არ არის.</div>';
}

function editableMiniItem(kind, item, text, color) {
  return `
    <span class="mini-item editable">
      <i class="chip-color" style="background:${esc(color || '#64748b')}"></i>
      <span class="mini-item-name">${esc(text)}</span>
      <button class="edit-btn" type="button" data-edit-kind="${esc(kind)}" data-edit-id="${esc(item.id)}">რედაქტირება</button>
    </span>`;
}

function findByKind(kind, id) {
  const map = { salesChannel: state.bootstrap.salesChannels, paymentMethod: state.bootstrap.paymentMethods, room: state.bootstrap.rooms };
  return (map[kind] || []).find(item => String(item.id) === String(id));
}

function openEditModal(kind, id) {
  const item = findByKind(kind, id);
  if (!item) return toast('ჩანაწერი ვერ მოიძებნა', true);
  state.editing = { kind, id };
  const form = $('#editForm');
  const titles = { salesChannel: 'გაყიდვების არხის რედაქტირება', paymentMethod: 'ბანკის / გადახდის წყაროს რედაქტირება', room: 'ნომრის რედაქტირება' };
  $('#editTitle').textContent = titles[kind] || 'რედაქტირება';

  if (kind === 'salesChannel') {
    form.innerHTML = `<label>სახელი<input name="name" required value="${esc(item.name)}" /></label><label>ფერი<input name="color" type="color" value="${esc(item.color || '#2563eb')}" /></label>${statusField(item.status)}${editCommentField()}${modalActions()}`;
  }
  if (kind === 'paymentMethod') {
    form.innerHTML = `<label>სახელი<input name="name" required value="${esc(item.name)}" /></label><label>ტიპი<select name="type">${option('cash', 'ქეში', item.type)}${option('bank', 'ბანკი', item.type)}${option('terminal', 'ტერმინალი', item.type)}${option('transfer', 'გადარიცხვა', item.type)}</select></label><label>ფერი<input name="color" type="color" value="${esc(item.color || '#2563eb')}" /></label>${statusField(item.status)}${editCommentField()}${modalActions()}`;
  }
  if (kind === 'room') {
    form.innerHTML = `<label>ნომერი<input name="roomName" required value="${esc(item.roomName)}" /></label><label>აღწერა<input name="description" value="${esc(item.description || '')}" /></label>${statusField(item.status)}${editCommentField()}${modalActions()}`;
  }
  $('#editModal').classList.remove('hidden');
}

function statusField(current = 'active') {
  return `<label>სტატუსი<select name="status">${option('active', 'აქტიური', current)}${option('inactive', 'გამორთული', current)}</select></label>`;
}

function editCommentField() {
  return '<label>ცვლილების კომენტარი<input name="editComment" placeholder="მაგ: სახელის შეცვლა" /></label>';
}

function modalActions() {
  return '<div class="modal-actions"><button class="liquid-btn" type="submit">შენახვა</button><button class="liquid-btn ghost" type="button" data-close-modal>გაუქმება</button></div>';
}

function option(value, label, current) {
  return `<option value="${esc(value)}" ${String(value) === String(current) ? 'selected' : ''}>${esc(label)}</option>`;
}

function closeEditModal() {
  $('#editModal').classList.add('hidden');
  $('#editForm').innerHTML = '';
  state.editing = null;
}

async function saveEdit(form) {
  if (!state.editing) return;
  const payload = { id: state.editing.id, ...getFormData(form) };
  const actions = { salesChannel: 'updateSalesChannel', paymentMethod: 'updatePaymentMethod', room: 'updateRoom' };
  const action = actions[state.editing.kind];
  if (!action) return;
  try {
    await api(action, payload);
    toast('ცვლილება შენახულია');
    closeEditModal();
    await loadBootstrap(true);
  } catch (err) {
    toast(err.message, true);
  }
}

function renderShift() {
  const shift = state.bootstrap.lastOpenShift;
  const badge = $('#shiftBadge');
  const info = $('#shiftInfo');
  if (!shift) {
    badge.textContent = 'ცვლა არ არის გახსნილი';
    badge.className = 'pill neutral';
    info.innerHTML = 'გახსენით ცვლა დილის კასით. სურვილის შემთხვევაში ოპერაციები მაინც დაემატება ცვლის გარეშე.';
    return;
  }
  badge.textContent = 'გახსნილია';
  badge.className = 'pill open';
  info.innerHTML = `<div class="small-card"><span>Shift ID</span><strong>${esc(shift.id)}</strong></div><div class="small-card"><span>დილის კასა</span><strong>${money(shift.openingCash)}</strong></div><div class="small-card"><span>მოლარე</span><strong>${esc(shift.cashier || '-')}</strong></div><div class="small-card"><span>გახსნა</span><strong>${esc(shift.openedAt || '-')}</strong></div>`;
}

function renderDashboard(stats) {
  if (!stats) return;
  $('#dashIncome').textContent = money(stats.totals.income);
  $('#dashExpense').textContent = money(stats.totals.expense);
  $('#dashWithdrawal').textContent = money(stats.totals.withdrawal);
  $('#dashNet').textContent = money(stats.totals.net);
}

function renderStats(stats) {
  if (!stats) return;
  $('#statsResult').innerHTML = `<div class="small-card"><span>შემოსავალი</span><strong>${money(stats.totals.income)}</strong></div><div class="small-card"><span>ხარჯი</span><strong>${money(stats.totals.expense)}</strong></div><div class="small-card"><span>ინკასაცია</span><strong>${money(stats.totals.withdrawal)}</strong></div><div class="small-card"><span>სუფთა შედეგი</span><strong>${money(stats.totals.net)}</strong></div>${renderGroupCards('ბანკი', stats.byPayment)}${renderGroupCards('არხი', stats.bySalesChannel)}`;
}

function renderGroupCards(title, rows = []) {
  return rows.map(row => `<div class="small-card"><span>${esc(title)}: ${esc(row.name || row.id)}</span><strong>${money(row.amount)}</strong></div>`).join('');
}

function renderHistory() {
  const rows = state.history.slice(0, 80);
  if (!rows.length) {
    $('#historyList').innerHTML = '<div class="empty-state">ისტორია ჯერ ცარიელია.</div>';
    return;
  }
  $('#historyList').innerHTML = `<table class="data-table"><thead><tr><th>დრო</th><th>ტიპი</th><th>თანხა</th><th>კომენტარი</th><th>სტატუსი</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.createdAt || row.date || '-')}</td><td>${esc(labelGroup(row.group))}</td><td>${money(row.amount || row.expectedTotal || 0)}</td><td>${esc(row.comment || row.purpose || '-')}</td><td>${esc(row.status || '-')}</td></tr>`).join('')}</tbody></table>`;
}

function labelGroup(group) {
  return { income: 'შემოსავალი', expense: 'ხარჯი', withdrawal: 'ინკასაცია', shift_close: 'დახურვა' }[group] || group;
}

function renderCloseFields() {
  const wrap = $('#closeFields');
  const methods = activeRows(state.bootstrap.paymentMethods);
  if (!methods.length) {
    wrap.innerHTML = '<div class="empty-state full">ჯერ დაამატეთ ბანკები / გადახდის წყაროები.</div>';
    return;
  }
  wrap.innerHTML = methods.map(pm => `<label>${esc(pm.name)}<input type="number" step="0.01" data-payment="${esc(pm.id)}" placeholder="რეალური თანხა" /></label>`).join('') + '<label class="full">კომენტარი<input id="closeComment" placeholder="დანაკლისი / მეტობა / ახსნა" /></label>';
}

function renderDailyReport() {
  const stats = state.reportStats;
  if (!stats) return;
  const reportDate = today();
  const paymentMethods = activeRows(state.bootstrap.paymentMethods);
  const cashIds = paymentMethods.filter(pm => pm.type === 'cash').map(pm => pm.id);
  const openingCash = getTodayOpeningCash();
  const expectedByPayment = buildExpectedByPayment(stats, openingCash, cashIds);
  const expectedCash = cashIds.reduce((sum, id) => sum + (expectedByPayment[id] || 0), 0);

  $('#reportDateText').textContent = `დღე: ${reportDate}`;
  $('#reportOpeningCash').textContent = money(openingCash);
  $('#reportIncome').textContent = money(stats.totals.income);
  $('#reportExpense').textContent = money(stats.totals.expense);
  $('#reportExpectedCash').textContent = money(expectedCash);

  $('#reportPaymentGrid').innerHTML = paymentMethods.map(pm => {
    const income = findAmount(stats.byPayment, pm.id);
    const expense = findAmount(stats.expensesByPayment, pm.id);
    const withdrawal = findAmount(stats.withdrawalsByPayment, pm.id);
    const expected = expectedByPayment[pm.id] || 0;
    const isCash = pm.type === 'cash';
    return `<div class="source-card" style="--source:${esc(pm.color || '#2563eb')}">
      <div class="source-top"><span class="source-dot"></span><strong>${esc(pm.name)}</strong><em>${esc(pm.type || '')}</em></div>
      <div class="source-lines">
        ${isCash ? `<span>დილის კასა <b>${money(openingCash)}</b></span>` : ''}
        <span>შემოსავალი <b>${money(income)}</b></span>
        <span>ხარჯი <b>${money(expense)}</b></span>
        <span>ინკასაცია <b>${money(withdrawal)}</b></span>
      </div>
      <div class="source-total"><span>უნდა იყოს</span><strong>${money(expected)}</strong></div>
    </div>`;
  }).join('') || '<div class="empty-state">წყაროები ჯერ არ არის.</div>';

  $('#reportTotals').innerHTML = `
    <div class="summary-row"><span>შემოსავალი სულ</span><strong>${money(stats.totals.income)}</strong></div>
    <div class="summary-row"><span>ხარჯი სულ</span><strong>${money(stats.totals.expense)}</strong></div>
    <div class="summary-row"><span>ინკასაცია სულ</span><strong>${money(stats.totals.withdrawal)}</strong></div>
    <div class="summary-row primary"><span>სუფთა შედეგი</span><strong>${money(stats.totals.net)}</strong></div>
    <div class="summary-row cash"><span>ქეში სალაროში უნდა იყოს</span><strong>${money(expectedCash)}</strong></div>`;

  renderReportTransactions();
}

function getTodayOpeningCash() {
  const d = today();
  return (state.bootstrap.shifts || [])
    .filter(shift => String(shift.date) === d)
    .reduce((sum, shift) => sum + Number(shift.openingCash || 0), 0);
}

function buildExpectedByPayment(stats, openingCash, cashIds) {
  const map = {};
  (stats.byPayment || []).forEach(row => map[row.id] = (map[row.id] || 0) + Number(row.amount || 0));
  (stats.expensesByPayment || []).forEach(row => map[row.id] = (map[row.id] || 0) - Number(row.amount || 0));
  (stats.withdrawalsByPayment || []).forEach(row => map[row.id] = (map[row.id] || 0) - Number(row.amount || 0));
  cashIds.forEach(id => map[id] = (map[id] || 0) + Number(openingCash || 0));
  Object.keys(map).forEach(id => map[id] = Math.round(map[id] * 100) / 100);
  return map;
}

function findAmount(rows = [], id) {
  const found = rows.find(row => String(row.id) === String(id));
  return found ? Number(found.amount || 0) : 0;
}

function renderReportTransactions() {
  const rows = state.reportHistory.slice(0, 150);
  if (!rows.length) {
    $('#reportTransactions').innerHTML = '<div class="empty-state">დღეს ოპერაცია ჯერ არ არის.</div>';
    return;
  }
  $('#reportTransactions').innerHTML = `<table class="data-table"><thead><tr><th>დრო</th><th>ტიპი</th><th>წყარო</th><th>ოთახი / დანიშნულება</th><th>თანხა</th><th>კომენტარი</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.createdAt || row.date || '-')}</td><td><span class="type-pill ${esc(row.group || '')}">${esc(labelGroup(row.group))}</span></td><td>${esc(paymentName(row.paymentMethodId))}</td><td>${esc(row.roomId ? roomName(row.roomId) : row.purpose || '-')}</td><td>${money(row.amount || row.expectedTotal || 0)}</td><td>${esc(row.comment || '-')}</td></tr>`).join('')}</tbody></table>`;
}

function paymentName(id) {
  const item = (state.bootstrap.paymentMethods || []).find(pm => String(pm.id) === String(id));
  return item ? item.name : '-';
}

function roomName(id) {
  const item = (state.bootstrap.rooms || []).find(room => String(room.id) === String(id));
  return item ? item.roomName : id;
}

function openReportLock() {
  $('#reportLockModal').classList.remove('hidden');
  setTimeout(() => $('#reportPassword')?.focus(), 50);
}

function closeReportLock() {
  $('#reportLockModal').classList.add('hidden');
  $('#reportPasswordForm')?.reset();
  state.pendingProtectedPage = '';
}

async function unlockReport() {
  const pass = $('#reportPassword').value;
  if (pass !== REPORT_PASSWORD) {
    toast('პაროლი არასწორია', true);
    return;
  }
  state.reportUnlocked = true;
  sessionStorage.setItem('otelReportUnlocked', '1');
  const page = state.pendingProtectedPage || 'dailyReport';
  closeReportLock();
  openPage(page, true);
  await loadDailyReport();
  toast('დღის პროცესი გაიხსნა');
}

function lockReport() {
  state.reportUnlocked = false;
  sessionStorage.removeItem('otelReportUnlocked');
  openPage('dashboard', true);
  toast('დღის პროცესი დაიბლოკა');
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function currentShiftId() {
  return state.bootstrap.lastOpenShift ? state.bootstrap.lastOpenShift.id : '';
}

async function submitAction(action, payload, form, successText) {
  try {
    await api(action, payload);
    if (form) form.reset();
    toast(successText);
    await loadBootstrap(true);
  } catch (err) {
    toast(err.message, true);
  }
}

function bindForms() {
  $('#shiftForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('openShift', getFormData(e.target), e.target, 'ცვლა გაიხსნა'); });
  $('#incomeForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('addTransaction', { ...getFormData(e.target), shiftId: currentShiftId(), type: 'room_income' }, e.target, 'შემოსავალი დაემატა'); });
  $('#otherIncomeForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('addTransaction', { ...getFormData(e.target), shiftId: currentShiftId(), type: 'other_income' }, e.target, 'სხვა შემოსავალი დაემატა'); });
  $('#expenseForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('addExpense', { ...getFormData(e.target), shiftId: currentShiftId() }, e.target, 'ხარჯი დაემატა'); });
  $('#withdrawalForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('addWithdrawal', { ...getFormData(e.target), shiftId: currentShiftId() }, e.target, 'ინკასაცია დაემატა'); });
  $('#salesChannelForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('addSalesChannel', getFormData(e.target), e.target, 'გაყიდვების არხი დაემატა'); });
  $('#paymentMethodForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('addPaymentMethod', getFormData(e.target), e.target, 'გადახდის წყარო დაემატა'); });
  $('#roomForm').addEventListener('submit', (e) => { e.preventDefault(); submitAction('addRoom', getFormData(e.target), e.target, 'ნომერი დაემატა'); });
  $('#statsFilter').addEventListener('submit', async (e) => { e.preventDefault(); try { await loadStats(getFormData(e.target)); toast('სტატისტიკა განახლდა'); } catch (err) { toast(err.message, true); } });
  $('#closeShiftBtn').addEventListener('click', async () => {
    const shiftId = currentShiftId();
    if (!shiftId) return toast('აქტიური ცვლა ვერ მოიძებნა', true);
    const actualByPayment = {};
    $$('[data-payment]', $('#closeFields')).forEach(input => { if (input.value !== '') actualByPayment[input.dataset.payment] = Number(input.value); });
    await submitAction('closeShift', { shiftId, actualByPayment, comment: $('#closeComment')?.value || '' }, null, 'ცვლა დაიხურა');
  });
  $('#editForm').addEventListener('submit', (e) => { e.preventDefault(); saveEdit(e.target); });
  $('#reportPasswordForm').addEventListener('submit', (e) => { e.preventDefault(); unlockReport(); });
  $('#refreshReportBtn').addEventListener('click', async () => { await loadDailyReport(); toast('დღის პროცესი განახლდა'); });
  $('#lockReportBtn').addEventListener('click', lockReport);
}

function bindNavigation() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (page === 'dailyReport' && !state.reportUnlocked) {
      state.pendingProtectedPage = page;
      openReportLock();
      return;
    }
    openPage(page);
    if (page === 'dailyReport') loadDailyReport();
  }));
  $$('[data-page-jump]').forEach(btn => btn.addEventListener('click', () => openPage(btn.dataset.pageJump)));
  $('#refreshBtn').addEventListener('click', () => loadBootstrap(true));
}

function bindEditControls() {
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-kind]');
    if (editBtn) { openEditModal(editBtn.dataset.editKind, editBtn.dataset.editId); return; }
    if (e.target.closest('[data-close-modal]')) closeEditModal();
    if (e.target.closest('[data-close-report-lock]')) closeReportLock();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeEditModal(); closeReportLock(); }
  });
}

function openPage(pageId, force = false) {
  if (pageId === 'dailyReport' && !state.reportUnlocked && !force) {
    state.pendingProtectedPage = pageId;
    openReportLock();
    return;
  }
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageId));
  $$('.page').forEach(page => page.classList.toggle('active', page.id === pageId));
  const activeBtn = $(`.nav-btn[data-page="${pageId}"]`);
  $('#pageTitle').textContent = activeBtn ? activeBtn.textContent : 'სასტუმროს სალარო';
}

function initDefaults() {
  const from = $('[name="dateFrom"]', $('#statsFilter'));
  const to = $('[name="dateTo"]', $('#statsFilter'));
  if (from) from.value = today();
  if (to) to.value = today();
}

bindNavigation();
bindForms();
bindEditControls();
initDefaults();
loadBootstrap(true);
