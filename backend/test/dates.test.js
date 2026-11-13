const test = require('node:test');
const assert = require('node:assert/strict');
const { toISODate, daysBetween, addDaysISO } = require('../services/ecourts/dates');

test('toISODate handles every eCourts format', () => {
    assert.equal(toISODate('2025-04-14'), '2025-04-14');
    assert.equal(toISODate('14-04-2025'), '2025-04-14');
    assert.equal(toISODate('14/04/2025'), '2025-04-14');
    assert.equal(toISODate('4.4.2025'), '2025-04-04');
    assert.equal(toISODate('22nd August 2016'), '2016-08-22');
    assert.equal(toISODate('1st January 2020'), '2020-01-01');
    assert.equal(toISODate('14-Apr-2025'), '2025-04-14');
    assert.equal(toISODate('14 Sept 2025'), '2025-09-14');
    assert.equal(toISODate(String.fromCharCode(160) + '14-04-2025' + String.fromCharCode(160)), '2025-04-14');
});

test('toISODate rejects non-dates and impossible dates', () => {
    for (const bad of ['', '-', '—', null, undefined, 'Adjourned', '31-02-2025', '00-01-2025', '14-13-2025', 'Judge on leave']) {
        assert.equal(toISODate(bad), null, String(bad));
    }
});

test('daysBetween / addDaysISO are UTC-safe', () => {
    assert.equal(daysBetween('2026-11-13', '2026-11-25'), 12);
    assert.equal(daysBetween('2026-11-25', '2026-11-13'), -12);
    assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2); // across DST changes in some zones
    assert.equal(addDaysISO(12, new Date('2026-11-13T23:30:00Z')), '2026-11-25');
});
