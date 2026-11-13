// Calendar helpers for a single all-day hearing date. Dates are ISO (YYYY-MM-DD) strings and are
// handled as plain calendar dates — never through local-time Date objects — so nothing shifts a day.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s) {
    return typeof s === 'string' && ISO_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** The calendar day after `iso` (all-day events end on the NEXT day, exclusive). */
export function nextDayISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const compact = (iso) => iso.replace(/-/g, '');

export function googleCalendarUrl({ dateISO, title, details = '', location = '' }) {
    if (!isIsoDate(dateISO)) return null;
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${compact(dateISO)}/${compact(nextDayISO(dateISO))}`,
        details,
        location,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** RFC 5545 TEXT escaping. */
export function escapeICS(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

/** Fold long lines at 75 characters as required by RFC 5545. */
function fold(line) {
    if (line.length <= 75) return line;
    const out = [];
    let rest = line;
    out.push(rest.slice(0, 75));
    rest = rest.slice(75);
    while (rest.length) { out.push(` ${rest.slice(0, 74)}`); rest = rest.slice(74); }
    return out.join('\r\n');
}

export function buildICS({ uid, dateISO, title, description = '', location = '', now = new Date() }) {
    if (!isIsoDate(dateISO)) return null;
    const stamp = `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Vakalat//Hearing Reminder//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(dateISO)}`,
        `DTEND;VALUE=DATE:${compact(nextDayISO(dateISO))}`,
        `SUMMARY:${escapeICS(title)}`,
        `DESCRIPTION:${escapeICS(description)}`,
        `LOCATION:${escapeICS(location)}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Triggers a browser download of an .ics file. */
export function downloadICS(filename, content) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
