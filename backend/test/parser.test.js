const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCaseHTML, stateFromCnr } = require('../services/ecourts/parser');

const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'case.html'), 'utf8');
const parsed = parseCaseHTML(html, 'KLTS010000452019', 'district');

test('title and parties come from structured elements, not the whole page text', () => {
    assert.equal(parsed.title, 'Meera Nair Vs Sunil Nair');
    assert.equal(parsed.petitioner, 'Meera Nair');
    assert.equal(parsed.respondent, 'Sunil Nair');
    assert.equal(parsed.petitionerAdvocate, 'A. Menon');
    assert.equal(parsed.respondentAdvocate, 'R. Pillai');
    assert.doesNotMatch(parsed.title, /Privacy|Terms of Use/); // old bug: junk page text became the title
});

test('dates are ISO', () => {
    assert.equal(parsed.filedDate, '2019-03-12');
    assert.equal(parsed.registrationDate, '2019-03-18');
    assert.equal(parsed.firstHearingDate, '2019-06-15');
    assert.equal(parsed.nextHearingDate, '2026-01-25');
});

test('court, case type, acts, state', () => {
    assert.equal(parsed.caseType, 'OS - Original Suit');
    assert.match(parsed.court, /Civil Judge Senior Division, Thrissur/);
    assert.deepEqual(parsed.acts, [{ act: 'Specific Relief Act', section: '34' }]);
    assert.equal(parsed.state, 'Kerala');
    assert.equal(stateFromCnr('MHNA010000012019'), 'Maharashtra');
    assert.equal(stateFromCnr('ZZ'), '');
});

test('hearings are sorted oldest-first and numbered in that order', () => {
    const dates = parsed.hearings.map((h) => h.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.deepEqual(parsed.hearings.map((h) => h.id), [1, 2, 3, 4, 5]);
    assert.equal(parsed.hearings[0].purpose, 'Notice');
    assert.equal(parsed.hearings.at(-1).purpose, 'Plaintiff Evidence');
});

test('hearings are classified with fault and stage', () => {
    const byPurpose = (p) => parsed.hearings.find((h) => h.purpose.startsWith(p));
    assert.equal(byPurpose('Notice').classification, 'productive');
    const adj = byPurpose('Adjourned');
    assert.equal(adj.classification, 'adjourned_lawyer');
    assert.equal(adj.faultParty, 'opposite_party');
    assert.equal(byPurpose('NNFR').classification, 'adjourned_court');
    assert.ok(parsed.hearings.every((h) => h.stage >= 1 && h.stage <= parsed.currentStage));
});

test('stage is detected from the explicit Case Stage row', () => {
    assert.equal(parsed.currentStage, 5);
    assert.equal(parsed.currentStageCode, 'PE');
    assert.equal(parsed.isDisposed, false);
});

test('order PDFs are linked to the hearing on the same date; refs stay internal', () => {
    const withOrder = parsed.hearings.filter((h) => h.orderRef);
    assert.deepEqual(withOrder.map((h) => h.date), ['2019-09-20', '2021-03-10']);
    assert.deepEqual(withOrder[0].orderRef, { normalV: 'nv123', caseVal: 'cv456', courtCode: 'cc789', filename: 'order_20092019.pdf' });
    assert.equal(parsed.orders.length, 2);
    assert.ok(parsed.orders.every((o) => !('_ref' in o) && !('orderRef' in o)));
});

test('next hearing purpose comes from the row carrying the next date', () => {
    assert.equal(parsed.nextHearingPurpose, 'Plaintiff Evidence');
});

test('unparseable pages fall back safely', () => {
    const empty = parseCaseHTML('<div>nothing here</div>', 'DLND030000032021');
    assert.equal(empty.title, 'Case DLND030000032021');
    assert.equal(empty.hearings.length, 0);
    assert.equal(empty.state, 'Delhi');
    assert.equal(empty.district, ''); // no longer derived from CNR characters
});
