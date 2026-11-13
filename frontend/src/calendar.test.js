import { describe, expect, it } from 'vitest';
import { buildICS, escapeICS, googleCalendarUrl, isIsoDate, nextDayISO } from './calendar';

describe('calendar helpers', () => {
    it('nextDayISO crosses month and year ends without timezone drift', () => {
        expect(nextDayISO('2026-11-30')).toBe('2026-12-01');
        expect(nextDayISO('2026-12-31')).toBe('2027-01-01');
        expect(nextDayISO('2028-02-28')).toBe('2028-02-29');
    });

    it('isIsoDate validates', () => {
        expect(isIsoDate('2026-11-13')).toBe(true);
        expect(isIsoDate('13-11-2026')).toBe(false);
        expect(isIsoDate('')).toBe(false);
        expect(isIsoDate(undefined)).toBe(false);
    });

    it('all-day events end on the NEXT day (exclusive) and include UID + DTSTAMP', () => {
        const ics = buildICS({ uid: 'x@vakalat', dateISO: '2026-12-01', title: 'Hearing', now: new Date('2026-11-13T10:20:30Z') });
        expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
        expect(ics).toContain('DTEND;VALUE=DATE:20261202');
        expect(ics).toContain('UID:x@vakalat');
        expect(ics).toContain('DTSTAMP:20261113T102030Z');
        expect(ics.endsWith('\r\n')).toBe(true);
        expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
    });

    it('escapes ICS text and folds long lines', () => {
        expect(escapeICS('a,b;c\nd\\e')).toBe('a\\,b\\;c\\nd\\\\e');
        const ics = buildICS({ uid: 'u', dateISO: '2026-12-01', title: 'T', description: 'word '.repeat(60) });
        expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
    });

    it('returns null for an invalid date', () => {
        expect(buildICS({ uid: 'u', dateISO: 'soon', title: 'T' })).toBeNull();
        expect(googleCalendarUrl({ dateISO: 'soon', title: 'T' })).toBeNull();
    });

    it('google calendar url uses a one-day range ending the next day', () => {
        const url = new URL(googleCalendarUrl({ dateISO: '2026-12-01', title: 'Court, hearing', details: 'CNR: X', location: 'Pune' }));
        expect(url.hostname).toBe('calendar.google.com');
        expect(url.searchParams.get('dates')).toBe('20261201/20261202');
        expect(url.searchParams.get('text')).toBe('Court, hearing');
    });
});
