/**
 * Date helpers for the many formats eCourts uses. Everything the API returns is ISO (YYYY-MM-DD).
 */
const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
    september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function build(y, m, d) {
    const year = Number(y), month = Number(m), day = Number(d);
    if (!(year >= 1900 && year <= 2100) || month < 1 || month > 12 || day < 1) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    // Reject overflow such as 31 Feb.
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Accepts: 2025-04-14 · 14-04-2025 · 14/04/2025 · 14.04.2025 · 22nd August 2016 · 14-Apr-2025 · 14 Apr 2025
 * @returns {string|null} ISO date or null when the text is not a recognisable date.
 */
function toISODate(input) {
    if (input === null || input === undefined) return null;
    const s = String(input).replace(/[\xa0]/g, ' ').trim();
    if (!s || s === '-' || s === '—') return null;

    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (m) return build(m[1], m[2], m[3]);

    m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) return build(m[3], m[2], m[1]);

    m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})/);
    if (m) {
        const month = MONTHS[m[2].toLowerCase()];
        if (month) return build(m[3], month, m[1]);
    }
    return null;
}

/** Whole days from `fromISO` to `toISO` (both ISO dates), UTC-safe. */
function daysBetween(fromISO, toISO) {
    const a = Date.parse(`${fromISO}T00:00:00Z`);
    const b = Date.parse(`${toISO}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
}

/** Today as ISO date (UTC) — injectable for tests. */
function todayISO(now = new Date()) {
    return now.toISOString().slice(0, 10);
}

/** ISO date `days` after today (can be negative). */
function addDaysISO(days, now = new Date()) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
    return d.toISOString().slice(0, 10);
}

module.exports = { toISODate, daysBetween, todayISO, addDaysISO };
