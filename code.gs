/****************************************************
 * Hotel Cashier Backend — Google Apps Script
 * Repository: mamuluxgeo-cmd/Otelsalaro
 * Sheet ID: 1f6oVzM8xF3ZL211T2KcpG1UN9MFmGn5lOiu6lsndDXs
 ****************************************************/

const CONFIG = {
  SPREADSHEET_ID: '1f6oVzM8xF3ZL211T2KcpG1UN9MFmGn5lOiu6lsndDXs',
  TIMEZONE: 'Asia/Tbilisi',
  CACHE_SECONDS: 240,
  CACHE_KEY_BOOTSTRAP: 'OTEL_SALARO_BOOTSTRAP_V1'
};

const SHEETS = {
  SALES_CHANNELS: 'Settings_SalesChannels',
  PAYMENT_METHODS: 'Settings_PaymentMethods',
  ROOMS: 'Settings_Rooms',
  SHIFTS: 'Shifts',
  TRANSACTIONS: 'Transactions',
  EXPENSES: 'Expenses',
  WITHDRAWALS: 'CashWithdrawals',
  SHIFT_CLOSE: 'ShiftClose',
  SHIFT_CLOSE_DETAILS: 'ShiftCloseDetails',
  ADJUSTMENTS: 'Adjustments',
  EDIT_LOG: 'EditLog'
};

const HEADERS = {
  Settings_SalesChannels: ['id','name','color','status','createdAt','updatedAt'],
  Settings_PaymentMethods: ['id','name','type','color','status','createdAt','updatedAt'],
  Settings_Rooms: ['id','roomName','description','status','createdAt','updatedAt'],
  Shifts: ['id','date','openedAt','openingCash','status','cashier','comment','closedAt','createdAt','updatedAt'],
  Transactions: ['id','shiftId','date','type','roomId','salesChannelId','paymentMethodId','amount','comment','status','createdAt','updatedAt'],
  Expenses: ['id','shiftId','date','purpose','paymentMethodId','amount','comment','status','createdAt','updatedAt'],
  CashWithdrawals: ['id','shiftId','date','paymentMethodId','amount','givenTo','purpose','comment','status','createdAt','updatedAt'],
  ShiftClose: ['id','shiftId','date','expectedTotal','actualTotal','totalDiff','expectedCash','actualCash','cashDiff','status','comment','createdAt','updatedAt'],
  ShiftCloseDetails: ['id','closeId','shiftId','paymentMethodId','expectedAmount','actualAmount','difference','status','comment','createdAt','updatedAt'],
  Adjustments: ['id','shiftId','date','targetType','targetId','amount','comment','status','createdAt','updatedAt'],
  EditLog: ['id','date','sheetName','rowId','action','field','oldValue','newValue','comment','createdAt']
};

const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELED: 'canceled'
};

const COLORS = ['#2563EB','#16A34A','#EA580C','#9333EA','#0891B2','#DC2626','#CA8A04','#0F766E','#7C3AED','#DB2777','#475569','#65A30D'];

function doGet(e) {
  try {
    const payload = getGetPayload(e);
    const action = payload.action || 'ping';
    const result = handleAction(action, payload);
    if (payload.callback) return jsonpResponse(result, payload.callback);
    return jsonResponse(result);
  } catch (err) {
    const params = e && e.parameter ? e.parameter : {};
    const result = errorResult(err);
    if (params.callback) return jsonpResponse(result, params.callback);
    return jsonResponse(result);
  }
}

function doPost(e) {
  try {
    const payload = parsePostPayload(e);
    const action = payload.action || 'ping';
    return jsonResponse(handleAction(action, payload));
  } catch (err) {
    return jsonResponse(errorResult(err));
  }
}

function handleAction(action, payload) {
  switch (action) {
    case 'ping': return ok({ app: 'Otelsalaro', time: nowIso() });
    case 'setup': return setupDatabase();
    case 'clearCache': clearAppCache(); return ok({ message: 'Cache cleared' });
    case 'getBootstrap': return getBootstrap(payload);
    case 'addSalesChannel': return addSalesChannel(payload);
    case 'updateSalesChannel': return updateSalesChannel(payload);
    case 'addPaymentMethod': return addPaymentMethod(payload);
    case 'updatePaymentMethod': return updatePaymentMethod(payload);
    case 'addRoom': return addRoom(payload);
    case 'updateRoom': return updateRoom(payload);
    case 'openShift': return openShift(payload);
    case 'updateShift': return updateShift(payload);
    case 'closeShift': return closeShift(payload);
    case 'addTransaction': return addTransaction(payload);
    case 'updateTransaction': return updateTransaction(payload);
    case 'addExpense': return addExpense(payload);
    case 'updateExpense': return updateExpense(payload);
    case 'addWithdrawal': return addWithdrawal(payload);
    case 'updateWithdrawal': return updateWithdrawal(payload);
    case 'addAdjustment': return addAdjustment(payload);
    case 'getHistory': return getHistory(payload);
    case 'getStats': return getStats(payload);
    case 'submitBatch': return submitBatch(payload);
    default: throw new Error('Unknown action: ' + action);
  }
}

function setupDatabase() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet();
    Object.keys(HEADERS).forEach(function(sheetName) {
      const sheet = getOrCreateSheet(ss, sheetName);
      ensureHeaders(sheet, HEADERS[sheetName]);
      styleSheet(sheet);
    });
    seedDefaultPaymentMethods();
    seedDefaultSalesChannels();
    clearAppCache();
    return ok({ message: 'Database setup completed', sheets: Object.keys(HEADERS) });
  } finally {
    lock.releaseLock();
  }
}

function getBootstrap(payload) {
  const force = toBool(payload.forceRefresh);
  if (!force) {
    const cached = CacheService.getScriptCache().get(CONFIG.CACHE_KEY_BOOTSTRAP);
    if (cached) return ok(JSON.parse(cached));
  }
  const data = {
    salesChannels: getRowsAsObjects(SHEETS.SALES_CHANNELS),
    paymentMethods: getRowsAsObjects(SHEETS.PAYMENT_METHODS),
    rooms: getRowsAsObjects(SHEETS.ROOMS),
    shifts: getRowsAsObjects(SHEETS.SHIFTS),
    lastOpenShift: getLastOpenShift(),
    generatedAt: nowIso()
  };
  CacheService.getScriptCache().put(CONFIG.CACHE_KEY_BOOTSTRAP, JSON.stringify(data), CONFIG.CACHE_SECONDS);
  return ok(data);
}

function addSalesChannel(payload) {
  requireText(payload.name, 'გაყიდვების არხის სახელი აუცილებელია');
  const item = { id: makeId('SC'), name: clean(payload.name), color: payload.color || makeStableColor(payload.name), status: payload.status || STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.SALES_CHANNELS, item);
  clearAppCache();
  return ok({ item: item });
}

function updateSalesChannel(payload) {
  requireText(payload.id, 'ID აუცილებელია');
  const item = updateObjectById(SHEETS.SALES_CHANNELS, payload.id, { name: payload.name, color: payload.color, status: payload.status, updatedAt: nowIso() }, payload.comment || '');
  clearAppCache();
  return ok({ item: item });
}

function addPaymentMethod(payload) {
  requireText(payload.name, 'ბანკის/გადახდის წყაროს სახელი აუცილებელია');
  const item = { id: makeId('PM'), name: clean(payload.name), type: payload.type || 'bank', color: payload.color || makeStableColor(payload.name), status: payload.status || STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.PAYMENT_METHODS, item);
  clearAppCache();
  return ok({ item: item });
}

function updatePaymentMethod(payload) {
  requireText(payload.id, 'ID აუცილებელია');
  const item = updateObjectById(SHEETS.PAYMENT_METHODS, payload.id, { name: payload.name, type: payload.type, color: payload.color, status: payload.status, updatedAt: nowIso() }, payload.comment || '');
  clearAppCache();
  return ok({ item: item });
}

function addRoom(payload) {
  requireText(payload.roomName, 'ნომრის დასახელება აუცილებელია');
  const item = { id: makeId('RM'), roomName: clean(payload.roomName), description: payload.description || '', status: payload.status || STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.ROOMS, item);
  clearAppCache();
  return ok({ item: item });
}

function updateRoom(payload) {
  requireText(payload.id, 'ID აუცილებელია');
  const item = updateObjectById(SHEETS.ROOMS, payload.id, { roomName: payload.roomName, description: payload.description, status: payload.status, updatedAt: nowIso() }, payload.comment || '');
  clearAppCache();
  return ok({ item: item });
}

function openShift(payload) {
  const item = { id: makeId('SH'), date: payload.date || todayDate(), openedAt: nowIso(), openingCash: toMoney(payload.openingCash), status: STATUS.OPEN, cashier: payload.cashier || '', comment: payload.comment || '', closedAt: '', createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.SHIFTS, item);
  clearAppCache();
  return ok({ item: item });
}

function updateShift(payload) {
  requireText(payload.id, 'Shift ID აუცილებელია');
  const item = updateObjectById(SHEETS.SHIFTS, payload.id, { date: payload.date, openingCash: isEmpty(payload.openingCash) ? undefined : toMoney(payload.openingCash), status: payload.status, cashier: payload.cashier, comment: payload.comment, closedAt: payload.closedAt, updatedAt: nowIso() }, payload.editComment || '');
  clearAppCache();
  return ok({ item: item });
}

function addTransaction(payload) {
  const amount = toMoney(payload.amount);
  if (amount <= 0) throw new Error('შემოსავლის თანხა უნდა იყოს 0-ზე მეტი');
  const item = { id: makeId('TR'), shiftId: payload.shiftId || '', date: payload.date || todayDate(), type: payload.type || 'room_income', roomId: payload.roomId || '', salesChannelId: payload.salesChannelId || '', paymentMethodId: payload.paymentMethodId || '', amount: amount, comment: payload.comment || '', status: payload.status || STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.TRANSACTIONS, item);
  clearAppCache();
  return ok({ item: item });
}

function updateTransaction(payload) {
  requireText(payload.id, 'Transaction ID აუცილებელია');
  const item = updateObjectById(SHEETS.TRANSACTIONS, payload.id, { shiftId: payload.shiftId, date: payload.date, type: payload.type, roomId: payload.roomId, salesChannelId: payload.salesChannelId, paymentMethodId: payload.paymentMethodId, amount: isEmpty(payload.amount) ? undefined : toMoney(payload.amount), comment: payload.comment, status: payload.status, updatedAt: nowIso() }, payload.editComment || '');
  clearAppCache();
  return ok({ item: item });
}

function addExpense(payload) {
  const amount = toMoney(payload.amount);
  if (amount <= 0) throw new Error('ხარჯის თანხა უნდა იყოს 0-ზე მეტი');
  const item = { id: makeId('EX'), shiftId: payload.shiftId || '', date: payload.date || todayDate(), purpose: payload.purpose || '', paymentMethodId: payload.paymentMethodId || '', amount: amount, comment: payload.comment || '', status: payload.status || STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.EXPENSES, item);
  clearAppCache();
  return ok({ item: item });
}

function updateExpense(payload) {
  requireText(payload.id, 'Expense ID აუცილებელია');
  const item = updateObjectById(SHEETS.EXPENSES, payload.id, { shiftId: payload.shiftId, date: payload.date, purpose: payload.purpose, paymentMethodId: payload.paymentMethodId, amount: isEmpty(payload.amount) ? undefined : toMoney(payload.amount), comment: payload.comment, status: payload.status, updatedAt: nowIso() }, payload.editComment || '');
  clearAppCache();
  return ok({ item: item });
}

function addWithdrawal(payload) {
  const amount = toMoney(payload.amount);
  if (amount <= 0) throw new Error('გატანის თანხა უნდა იყოს 0-ზე მეტი');
  const item = { id: makeId('WD'), shiftId: payload.shiftId || '', date: payload.date || todayDate(), paymentMethodId: payload.paymentMethodId || '', amount: amount, givenTo: payload.givenTo || '', purpose: payload.purpose || 'ინკასაცია', comment: payload.comment || '', status: payload.status || STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.WITHDRAWALS, item);
  clearAppCache();
  return ok({ item: item });
}

function updateWithdrawal(payload) {
  requireText(payload.id, 'Withdrawal ID აუცილებელია');
  const item = updateObjectById(SHEETS.WITHDRAWALS, payload.id, { shiftId: payload.shiftId, date: payload.date, paymentMethodId: payload.paymentMethodId, amount: isEmpty(payload.amount) ? undefined : toMoney(payload.amount), givenTo: payload.givenTo, purpose: payload.purpose, comment: payload.comment, status: payload.status, updatedAt: nowIso() }, payload.editComment || '');
  clearAppCache();
  return ok({ item: item });
}

function addAdjustment(payload) {
  const item = { id: makeId('AD'), shiftId: payload.shiftId || '', date: payload.date || todayDate(), targetType: payload.targetType || 'shift_difference', targetId: payload.targetId || '', amount: toMoney(payload.amount || 0), comment: payload.comment || '', status: payload.status || STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() };
  appendObject(SHEETS.ADJUSTMENTS, item);
  clearAppCache();
  return ok({ item: item });
}

function closeShift(payload) {
  requireText(payload.shiftId, 'Shift ID აუცილებელია');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const expected = calculateExpectedByPayment({ shiftId: payload.shiftId });
    const actualByPayment = typeof payload.actualByPayment === 'string' ? JSON.parse(payload.actualByPayment || '{}') : (payload.actualByPayment || {});
    const paymentMethods = getRowsAsObjects(SHEETS.PAYMENT_METHODS);
    const cashIds = paymentMethods.filter(pm => pm.type === 'cash').map(pm => pm.id);
    const allIds = unique(Object.keys(expected.byPayment).concat(Object.keys(actualByPayment)));
    let expectedTotal = 0, actualTotal = 0, expectedCash = 0, actualCash = 0;
    allIds.forEach(function(id) {
      const ex = toMoney(expected.byPayment[id] || 0);
      const ac = toMoney(actualByPayment[id] || 0);
      expectedTotal += ex;
      actualTotal += ac;
      if (cashIds.indexOf(id) !== -1) { expectedCash += ex; actualCash += ac; }
    });
    const closeId = makeId('CL');
    const closeItem = { id: closeId, shiftId: payload.shiftId, date: payload.date || todayDate(), expectedTotal: round2(expectedTotal), actualTotal: round2(actualTotal), totalDiff: round2(actualTotal - expectedTotal), expectedCash: round2(expectedCash), actualCash: round2(actualCash), cashDiff: round2(actualCash - expectedCash), status: STATUS.CLOSED, comment: payload.comment || '', createdAt: nowIso(), updatedAt: nowIso() };
    appendObject(SHEETS.SHIFT_CLOSE, closeItem);
    const details = allIds.map(function(id) {
      const ex = toMoney(expected.byPayment[id] || 0);
      const ac = toMoney(actualByPayment[id] || 0);
      const diff = round2(ac - ex);
      return { id: makeId('CD'), closeId: closeId, shiftId: payload.shiftId, paymentMethodId: id, expectedAmount: ex, actualAmount: ac, difference: diff, status: diff === 0 ? 'correct' : diff > 0 ? 'metoba' : 'danaklisi', comment: payload.comment || '', createdAt: nowIso(), updatedAt: nowIso() };
    });
    appendObjects(SHEETS.SHIFT_CLOSE_DETAILS, details);
    updateObjectById(SHEETS.SHIFTS, payload.shiftId, { status: STATUS.CLOSED, closedAt: nowIso(), updatedAt: nowIso() }, 'ცვლის დახურვა');
    clearAppCache();
    return ok({ close: closeItem, details: details });
  } finally {
    lock.releaseLock();
  }
}

function submitBatch(payload) {
  const operations = typeof payload.operations === 'string' ? JSON.parse(payload.operations || '[]') : (payload.operations || []);
  if (!Array.isArray(operations)) throw new Error('operations უნდა იყოს სია');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const results = operations.map(function(op, index) {
      try {
        if (!op || !op.action) throw new Error('action არ არის მითითებული');
        return { index: index, action: op.action, success: true, result: handleAction(op.action, op.payload || {}) };
      } catch (err) {
        return { index: index, action: op && op.action ? op.action : '', success: false, error: String(err.message || err) };
      }
    });
    clearAppCache();
    return ok({ count: operations.length, results: results });
  } finally {
    lock.releaseLock();
  }
}

function getHistory(payload) {
  const filters = normalizeFilters(payload);
  const items = [];
  filterRows(getRowsAsObjects(SHEETS.TRANSACTIONS), filters).forEach(r => items.push(Object.assign({ group: 'income' }, r)));
  filterRows(getRowsAsObjects(SHEETS.EXPENSES), filters).forEach(r => items.push(Object.assign({ group: 'expense' }, r)));
  filterRows(getRowsAsObjects(SHEETS.WITHDRAWALS), filters).forEach(r => items.push(Object.assign({ group: 'withdrawal' }, r)));
  filterRows(getRowsAsObjects(SHEETS.SHIFT_CLOSE), filters).forEach(r => items.push(Object.assign({ group: 'shift_close' }, r)));
  items.sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
  return ok({ items: items });
}

function getStats(payload) {
  const filters = normalizeFilters(payload);
  const paymentMethods = getRowsAsObjects(SHEETS.PAYMENT_METHODS);
  const channels = getRowsAsObjects(SHEETS.SALES_CHANNELS);
  const rooms = getRowsAsObjects(SHEETS.ROOMS);
  const transactions = filterRows(getRowsAsObjects(SHEETS.TRANSACTIONS), filters).filter(isActiveRow);
  const expenses = filterRows(getRowsAsObjects(SHEETS.EXPENSES), filters).filter(isActiveRow);
  const withdrawals = filterRows(getRowsAsObjects(SHEETS.WITHDRAWALS), filters).filter(isActiveRow);
  const closes = filterRows(getRowsAsObjects(SHEETS.SHIFT_CLOSE), filters);
  const incomeTotal = sumBy(transactions, 'amount');
  const expenseTotal = sumBy(expenses, 'amount');
  const withdrawalTotal = sumBy(withdrawals, 'amount');
  return ok({
    totals: {
      income: incomeTotal,
      expense: expenseTotal,
      withdrawal: withdrawalTotal,
      net: round2(incomeTotal - expenseTotal)
    },
    byPayment: groupMoneyBy(transactions, 'paymentMethodId', 'amount', paymentMethods, 'id'),
    expensesByPayment: groupMoneyBy(expenses, 'paymentMethodId', 'amount', paymentMethods, 'id'),
    withdrawalsByPayment: groupMoneyBy(withdrawals, 'paymentMethodId', 'amount', paymentMethods, 'id'),
    bySalesChannel: groupMoneyBy(transactions, 'salesChannelId', 'amount', channels, 'id'),
    byRoom: groupMoneyBy(transactions, 'roomId', 'amount', rooms, 'id'),
    closeDiffs: {
      totalDiff: round2(sumBy(closes, 'totalDiff')),
      cashDiff: round2(sumBy(closes, 'cashDiff'))
    }
  });
}

function calculateExpectedByPayment(filters) {
  const byPayment = {};
  const shifts = filters.shiftId ? getRowsAsObjects(SHEETS.SHIFTS).filter(s => s.id === filters.shiftId) : [];
  const paymentMethods = getRowsAsObjects(SHEETS.PAYMENT_METHODS);
  const cash = paymentMethods.find(pm => pm.type === 'cash');
  shifts.forEach(function(shift) {
    if (cash) byPayment[cash.id] = round2((byPayment[cash.id] || 0) + toMoney(shift.openingCash));
  });
  const tx = filterRows(getRowsAsObjects(SHEETS.TRANSACTIONS), filters).filter(isActiveRow);
  const ex = filterRows(getRowsAsObjects(SHEETS.EXPENSES), filters).filter(isActiveRow);
  const wd = filterRows(getRowsAsObjects(SHEETS.WITHDRAWALS), filters).filter(isActiveRow);
  tx.forEach(r => byPayment[r.paymentMethodId] = round2((byPayment[r.paymentMethodId] || 0) + toMoney(r.amount)));
  ex.forEach(r => byPayment[r.paymentMethodId] = round2((byPayment[r.paymentMethodId] || 0) - toMoney(r.amount)));
  wd.forEach(r => byPayment[r.paymentMethodId] = round2((byPayment[r.paymentMethodId] || 0) - toMoney(r.amount)));
  return { byPayment: byPayment };
}

function getLastOpenShift() {
  const rows = getRowsAsObjects(SHEETS.SHIFTS).filter(r => r.status === STATUS.OPEN);
  rows.sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)));
  return rows[0] || null;
}

function seedDefaultPaymentMethods() {
  if (getRowsAsObjects(SHEETS.PAYMENT_METHODS).length) return;
  appendObjects(SHEETS.PAYMENT_METHODS, [
    { id: makeId('PM'), name: 'ქეში', type: 'cash', color: makeStableColor('ქეში'), status: STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() },
    { id: makeId('PM'), name: 'საქართველოს ბანკი', type: 'bank', color: makeStableColor('საქართველოს ბანკი'), status: STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() },
    { id: makeId('PM'), name: 'TBC', type: 'bank', color: makeStableColor('TBC'), status: STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() },
    { id: makeId('PM'), name: 'ტერმინალი', type: 'terminal', color: makeStableColor('ტერმინალი'), status: STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() },
    { id: makeId('PM'), name: 'გადარიცხვა', type: 'transfer', color: makeStableColor('გადარიცხვა'), status: STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() }
  ]);
}

function seedDefaultSalesChannels() {
  if (getRowsAsObjects(SHEETS.SALES_CHANNELS).length) return;
  const defaults = ['Booking','Airbnb','Walk-in','Instagram','Facebook','ტელეფონით ჯავშანი','სხვა'];
  appendObjects(SHEETS.SALES_CHANNELS, defaults.map(name => ({ id: makeId('SC'), name: name, color: makeStableColor(name), status: STATUS.ACTIVE, createdAt: nowIso(), updatedAt: nowIso() })));
}

function getSpreadsheet() { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }
function getSheet(name) { return getOrCreateSheet(getSpreadsheet(), name); }
function getOrCreateSheet(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }

function ensureHeaders(sheet, headers) {
  const existing = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
  const needs = headers.some((h, i) => existing[i] !== h);
  if (needs) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function styleSheet(sheet) {
  const cols = Math.max(sheet.getLastColumn(), 1);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#111827').setFontColor('#FFFFFF');
  sheet.setRowHeight(1, 34);
  for (let i = 1; i <= cols; i++) sheet.setColumnWidth(i, 150);
}

function appendObject(sheetName, obj) { appendObjects(sheetName, [obj]); }
function appendObjects(sheetName, objects) {
  if (!objects || !objects.length) return;
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  ensureHeaders(sheet, headers);
  const values = objects.map(obj => headers.map(h => obj[h] === undefined ? '' : obj[h]));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

function getRowsAsObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  ensureHeaders(sheet, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function(row) {
    const obj = {};
    headers.forEach((h, i) => obj[h] = normalizeCell(row[i]));
    return obj;
  }).filter(r => r.id !== '');
}

function updateObjectById(sheetName, id, fields, comment) {
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  ensureHeaders(sheet, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('ჩანაწერი ვერ მოიძებნა');
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex(v => String(v) === String(id));
  if (index === -1) throw new Error('ჩანაწერი ვერ მოიძებნა: ' + id);
  const rowNumber = index + 2;
  const currentValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const current = {};
  headers.forEach((h, i) => current[h] = currentValues[i]);
  Object.keys(fields).forEach(function(key) {
    if (fields[key] === undefined) return;
    const col = headers.indexOf(key) + 1;
    if (col <= 0) return;
    const oldValue = current[key];
    const newValue = fields[key];
    if (String(oldValue) !== String(newValue)) {
      sheet.getRange(rowNumber, col).setValue(newValue);
      logEdit(sheetName, id, 'update', key, oldValue, newValue, comment || '');
      current[key] = newValue;
    }
  });
  return getRowsAsObjects(sheetName).find(r => String(r.id) === String(id));
}

function logEdit(sheetName, rowId, action, field, oldValue, newValue, comment) {
  appendObject(SHEETS.EDIT_LOG, { id: makeId('LG'), date: todayDate(), sheetName: sheetName, rowId: rowId, action: action, field: field, oldValue: oldValue, newValue: newValue, comment: comment || '', createdAt: nowIso() });
}

function filterRows(rows, filters) {
  return rows.filter(function(row) {
    if (filters.shiftId && row.shiftId !== filters.shiftId && row.id !== filters.shiftId) return false;
    if (filters.dateFrom && String(row.date) < filters.dateFrom) return false;
    if (filters.dateTo && String(row.date) > filters.dateTo) return false;
    if (filters.paymentMethodId && row.paymentMethodId !== filters.paymentMethodId) return false;
    if (filters.salesChannelId && row.salesChannelId !== filters.salesChannelId) return false;
    if (filters.roomId && row.roomId !== filters.roomId) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });
}

function normalizeFilters(payload) {
  return {
    shiftId: payload.shiftId || '',
    dateFrom: payload.dateFrom || '',
    dateTo: payload.dateTo || '',
    paymentMethodId: payload.paymentMethodId || '',
    salesChannelId: payload.salesChannelId || '',
    roomId: payload.roomId || '',
    type: payload.type || '',
    status: payload.status || ''
  };
}

function groupMoneyBy(rows, groupKey, amountKey, refs, refKey) {
  const map = {};
  rows.forEach(function(row) {
    const id = row[groupKey] || 'unknown';
    if (!map[id]) map[id] = { id: id, name: findRefName(refs, refKey, id), amount: 0 };
    map[id].amount = round2(map[id].amount + toMoney(row[amountKey]));
  });
  return Object.keys(map).map(k => map[k]);
}

function findRefName(refs, key, id) {
  const item = (refs || []).find(r => String(r[key]) === String(id));
  return item ? (item.name || item.roomName || id) : id;
}

function sumBy(rows, key) { return round2((rows || []).reduce((sum, r) => sum + toMoney(r[key]), 0)); }
function isActiveRow(row) { return row.status !== STATUS.CANCELED && row.status !== STATUS.INACTIVE; }
function unique(arr) { return Array.from(new Set(arr.filter(Boolean))); }
function clearAppCache() { CacheService.getScriptCache().remove(CONFIG.CACHE_KEY_BOOTSTRAP); }
function makeId(prefix) { return prefix + '-' + Utilities.getUuid().slice(0, 8).toUpperCase(); }
function nowIso() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"); }
function todayDate() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'); }
function toMoney(value) { const n = Number(String(value || 0).replace(',', '.')); return isNaN(n) ? 0 : round2(n); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function clean(value) { return String(value || '').trim(); }
function isEmpty(value) { return value === undefined || value === null || value === ''; }
function requireText(value, message) { if (!clean(value)) throw new Error(message); }
function toBool(value) { return value === true || value === 'true' || value === '1' || value === 1; }
function normalizeCell(value) { return value instanceof Date ? Utilities.formatDate(value, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss') : value; }
function makeStableColor(text) { let hash = 0; String(text || '').split('').forEach(ch => hash = ((hash << 5) - hash) + ch.charCodeAt(0)); return COLORS[Math.abs(hash) % COLORS.length]; }
function ok(data) { return { success: true, data: data }; }
function errorResult(err) { return { success: false, error: String(err.message || err), time: nowIso() }; }
function jsonResponse(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function jsonpResponse(data, callback) {
  const safeCallback = String(callback || 'callback').replace(/[^a-zA-Z0-9_.$]/g, '');
  return ContentService.createTextOutput(safeCallback + '(' + JSON.stringify(data) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function parsePostPayload(e) {
  if (!e || !e.postData) return {};
  const type = e.postData.type || '';
  const raw = e.postData.contents || '';
  if (type.indexOf('application/json') !== -1) return JSON.parse(raw || '{}');
  const params = e.parameter || {};
  if (params.payload) return JSON.parse(params.payload);
  return Object.assign({}, params);
}

function getGetPayload(e) {
  const params = e && e.parameter ? Object.assign({}, e.parameter) : {};
  if (params.payload) {
    try { return Object.assign(params, JSON.parse(params.payload)); } catch (err) {}
  }
  return params;
}
