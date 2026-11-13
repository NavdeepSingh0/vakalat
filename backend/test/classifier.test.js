const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyHearing, stageFromText, assignHearingStages } = require('../services/ecourts/classifier');

const cls = (t) => classifyHearing(t).classification;

test('court-side reasons are adjourned_court', () => {
    for (const t of ['NNFR', 'Heavy board', 'Judge on leave', 'Adjourned - COVID lockdown', 'Court holiday', 'Presiding officer transferred']) {
        assert.equal(cls(t), 'adjourned_court', t);
        assert.equal(classifyHearing(t).faultParty, 'court_system');
    }
});

test('advocate absence is adjourned_lawyer with the right party', () => {
    assert.deepEqual(classifyHearing("Adjourned - plaintiff's advocate absent"), { classification: 'adjourned_lawyer', faultParty: 'own_side' });
    assert.deepEqual(classifyHearing("Respondent's counsel sought time"), { classification: 'adjourned_lawyer', faultParty: 'opposite_party' });
    assert.equal(classifyHearing('Advocate absent').faultParty, 'unspecified');
});

test('generic adjournments', () => {
    assert.equal(cls('ADJ'), 'adjourned_other');
    assert.equal(cls('Adjourned for arguments'), 'adjourned_other'); // "adjourned" wins over "arguments"
    assert.equal(cls('S/O'), 'adjourned_other');
    assert.equal(cls('Standing over'), 'adjourned_other');
});

test('audit regressions: ambiguous purposes are unknown, not guessed', () => {
    for (const t of ['Further Order', 'Appearance', 'Hearing', 'Order', 'Reply', 'Issues', 'Consideration', '', null, undefined]) {
        assert.equal(cls(t), 'unknown', String(t));
    }
});

test('final outcomes are disposed, not productive/adjourned', () => {
    for (const t of ['Dismissed in default', 'Case Disposed', 'Decreed', 'Withdrawn', 'Settled']) assert.equal(cls(t), 'disposed', t);
});

test('clear progress is productive', () => {
    for (const t of ['Plaintiff Evidence', 'For Arguments', 'Part Heard', 'Written Statement', 'Framing of Issues', 'Cross Examination', 'Notice', 'Cognizance']) {
        assert.equal(cls(t), 'productive', t);
    }
});

test('stage detection is word-bounded and ordered', () => {
    assert.equal(stageFromText('Plaintiff Evidence').stage, 5);
    assert.equal(stageFromText('PE').stage, 5);
    assert.equal(stageFromText('Final Arguments').stage, 7);
    assert.equal(stageFromText('For Judgment').stage, 8);
    assert.equal(stageFromText('Written Statement').stage, 3);
    assert.equal(stageFromText('Framing of Issues').stage, 4);
    // old bug: "allowed"/"decree" anywhere meant Stage 8
    assert.equal(stageFromText('Application allowed for further time'), null);
    assert.equal(stageFromText('Preceded by delay'), null);
    assert.equal(stageFromText(''), null);
});

test('hearing stages only move forward and are capped at the current stage', () => {
    const hearings = [
        { purpose: 'Notice' }, { purpose: 'ADJ' }, { purpose: 'Framing of Issues' },
        { purpose: 'NNFR' }, { purpose: 'Plaintiff Evidence' }, { purpose: 'Arguments' },
    ];
    assignHearingStages(hearings, 5);
    assert.deepEqual(hearings.map((h) => h.stage), [3, 3, 4, 4, 5, 5]); // capped at 5, never regresses
});
