// Date filter fix for Otelsalaro Apps Script
// Copy this block to the bottom of code.gs in Apps Script, then Deploy a new version.

function onlyDateKey(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  const text = String(value).trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text.slice(0, 10);
}

function filterRows(rows, filters) {
  const dateFrom = onlyDateKey(filters.dateFrom || '');
  const dateTo = onlyDateKey(filters.dateTo || '');

  return rows.filter(function(row) {
    const rowDate = onlyDateKey(row.date || row.createdAt || '');

    if (filters.shiftId && row.shiftId !== filters.shiftId && row.id !== filters.shiftId) return false;
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
