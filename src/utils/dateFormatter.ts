/**
 * Robust date formatting utility for submission timestamps and cheat logs
 */
export function formatSubmissionTime(item: any): string {
  if (!item) return '--';

  // 1. Check direct date/timestamp fields
  const candidates = [
    item.submitted_at,
    item.timestamp,
    item.created_at,
    item.time,
    item.date,
    item.submission_time,
    item.submit_time
  ];

  for (const val of candidates) {
    if (val !== undefined && val !== null && val !== '') {
      // Check if it's already a formatted date string (e.g. "13/08/2026 18:50:00" or ISO)
      if (typeof val === 'string' && val.includes('/') && (val.includes(':') || val.includes(' '))) {
        return val;
      }

      // Check numeric or numeric string timestamp (e.g. 1786646801982)
      if (typeof val === 'number' || (!isNaN(Number(val)) && String(val).trim().length >= 10)) {
        const d = new Date(Number(val));
        if (!isNaN(d.getTime())) {
          return formatLocale(d);
        }
      }

      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return formatLocale(d);
      }
    }
  }

  // 2. Extract timestamp from submission_id (e.g. "1_IELTS01_1786646801982")
  const idToExtract = item.submission_id || item.log_id || (typeof item === 'string' ? item : '');
  if (typeof idToExtract === 'string') {
    const parts = idToExtract.split('_');
    const lastPart = parts[parts.length - 1];
    if (lastPart && !isNaN(Number(lastPart)) && lastPart.length >= 10) {
      const d = new Date(Number(lastPart));
      if (!isNaN(d.getTime())) {
        return formatLocale(d);
      }
    }
  }

  return '--';
}

function formatLocale(d: Date): string {
  // Format as: 18:50:15 13/08/2026
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${hours}:${minutes}:${seconds} - ${day}/${month}/${year}`;
}

/**
 * Safely normalizes any timestamp representation (ISO string, numeric epoch, Date, DD/MM/YYYY)
 * into a YYYY-MM-DD key without throwing when external backends return numbers or non-strings.
 */
export function toIsoDateKey(val: unknown): string {
  if (val === undefined || val === null || val === '') return '';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '';
    const ms = val > 0 && val < 1e11 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }
  if (typeof val !== 'string') {
    return '';
  }
  const str = val.trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    const d = new Date(str.length === 10 ? num * 1000 : num);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }
  const ddmmyyyy = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
}

