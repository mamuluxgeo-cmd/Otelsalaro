/****************************************************
 * Otelsalaro date filter fix v2
 * Paste this at the very bottom of Apps Script code.gs
 * This overrides older filterRows / normalizeFilters safely.
 ****************************************************/

function dateOnlySafe(value) {
  if (value === undefined || value === null || value === '') return '';

  if (value instanceof Date) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  const text = String(value).trim();

  // Handles: 2026-06-13, 2026-06-13 17:19:37, 2026-06-13T17:19:37
  const matchIso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (matchIso) return matchIso[1];

  // Handles: 13/06/2026 or 13.06.2026 if Google ever returns localized text
  const matchLocal = text.match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})/);
  if (matchLocal) {
    const day = ('0' + matchLocal[1]).slice(-2);
    const month = ('0' + matchLocal[2]).slice(-2);
    const year = matchLocal[3];
    return year + '-' + month + '-' + day;
  }

  return text.slice(0, 10);
}

function normalizeFilters(payload) {
  payload = payload || {};
  return {
    shiftId: payload.shiftId || '',
    dateFrom: dateOnlySafe(payload.dateFrom || ''),
    dateTo: dateOnlySafe(payload.dateTo || ''),
    paymentMethodId: payload.paymentMethodId || '',
    salesChannelId: payload.salesChannelId || '',
    roomId: payload.roomId || '',
    type: payload.type || '',
    status: payload.status || ''
  };
}

function filterRows(rows, filters) {
  filters = filters || {};
  const dateFrom = dateOnlySafe(filters.dateFrom || '');
  const dateTo = dateOnlySafe(filters.dateTo || '');

  return (rows || []).filter(function(row) {
    const rowDate = dateOnlySafe(row.date || row.createdAt || row.openedAt || row.closedAt || '');

    if (filters.shiftId && row.shiftId !== filters.shiftId && row.id !== filters.shiftId) return false;

    // If a date filter exists, compare only yyyy-MM-dd part.
    // This prevents 2026-06-13 17:19:37 from disappearing when filter is 2026-06-13.
    if (dateFrom && rowDate && rowDate < dateFrom) return false;
    if (dateTo && rowDate && rowDate > dateTo) return false;

    if (filters.paymentMethodId && row.paymentMethodId !== filters.paymentMethodId) return false;
    if (filters.salesChannelId && row.salesChannelId !== filters.salesChannelId) return false;
    if (filters.roomId && row.roomId !== filters.roomId) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;

    return true;
  });
}

function clearOtelCacheNow() {
  clearAppCache();
  return ok({ message: 'Cache cleared after date filter fix v2', time: nowIso() });
}
