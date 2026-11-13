const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../services/costModel');

const adj = (stage, fault) => ({ date: '2024-01-01', stage, fault, adjourned: true, reason: '' });

test('base cost for the default assumptions is built from four heads (no double clerk fee)', () => {
    const r = m.calculateAdjournmentImpact([adj('evidence', 'court_system')]);
    // fees 32,500 + travel 500 + wages 1,800 + incidentals (1,500 clerk + 400 + 240 + 125 + 1,500)
    assert.equal(r.costHeadSummary.professionalFees, 32500);
    assert.equal(r.costHeadSummary.travelStay, 500);
    assert.equal(r.costHeadSummary.opportunityCost, 1800);
    assert.equal(r.costHeadSummary.incidentals, 3765);
    assert.equal(r.totalDrain, 38565);
});

test('the fee a user types is the professional fee (juniors are opt-in)', () => {
    assert.equal(m.professionalFees(5000), 5000);
    assert.equal(m.professionalFees(5000, 1), 5000 + 3350);
    assert.equal(m.professionalFees(100000, 2), 100000 + 15000 * 2); // junior fee capped
    assert.equal(m.professionalFees(0, 0, 8000), 8000); // junior-only matter
});

test('outstation and intercity include the hotel, as labelled', () => {
    assert.equal(m.travelCost('local'), 500);
    assert.equal(m.travelCost('outstation'), 5000);
    assert.equal(m.travelCost('intercity'), 11000);
    const local = m.calculateAdjournmentImpact([adj('evidence', 'court_system')], { travelMode: 'local' });
    const out = m.calculateAdjournmentImpact([adj('evidence', 'court_system')], { travelMode: 'outstation' });
    assert.equal(out.costHeadSummary.travelStay - local.costHeadSummary.travelStay, 4500);
});

test('stage and fault multipliers are applied and fault buckets are populated', () => {
    const base = m.calculateAdjournmentImpact([adj('evidence', 'court_system')]).totalDrain;
    const finalArg = m.calculateAdjournmentImpact([adj('final_arguments', 'court_system')]).totalDrain;
    assert.ok(Math.abs(finalArg / base - 1.5) < 0.001);

    const r = m.calculateAdjournmentImpact([adj('evidence', 'opposite_party'), adj('evidence', 'own_side'), adj('evidence', 'court_system'), adj('evidence', 'unspecified')]);
    assert.ok(r.recoverableFromOP > 0, 'opposite-party adjournments are reachable and recoverable');
    assert.ok(r.absorbedByOwn > 0 && r.systemicCost > 0 && r.unattributedCost > 0);
    assert.equal(r.recoverableFromOP / r.systemicCost > 1.19, true); // 1.20x vs 1.00x
    assert.equal(r.netUnrecoverable, r.totalDrain - r.recoverableFromOP);
});

test('only confirmed adjournments are costed', () => {
    const r = m.calculateAdjournmentImpact([{ ...adj('evidence', 'court_system'), adjourned: false }]);
    assert.equal(r.adjournedCount, 0);
    assert.equal(r.totalDrain, 0);
    assert.equal(r.avgCostPerAdj, 0);
});

test('toModelHearing uses the hearing stage, not the case stage', () => {
    const early = m.toModelHearing({ classification: 'adjourned_court', faultParty: 'court_system', stage: 1 });
    const late = m.toModelHearing({ classification: 'adjourned_court', faultParty: 'court_system', stage: 7 });
    assert.equal(early.stage, 'filing_admission');
    assert.equal(late.stage, 'final_arguments');
    assert.equal(m.toModelHearing({ classification: 'productive', stage: 5 }).adjourned, false);
    assert.equal(m.toModelHearing({ classification: 'unknown', stage: 5 }).adjourned, false);
});

test('estimateCaseCost reports unclear hearings separately', () => {
    const r = m.estimateCaseCost({ hearings: [
        { classification: 'adjourned_court', faultParty: 'court_system', stage: 3 },
        { classification: 'unknown', stage: 3 },
        { classification: 'productive', stage: 3 },
    ] });
    assert.equal(r.adjournedCount, 1);
    assert.equal(r.unclearCount, 1);
});

test('cost config options expose the tables the UI needs', () => {
    const o = m.getCostConfigOptions();
    assert.ok(o.workerTypes.some((w) => w.id === 'salaried_formal' && w.perDay === 1800));
    assert.ok(o.travelModes.some((t) => t.id === 'outstation'));
    assert.equal(o.defaults.seniorFeePerHearing, 32500);
});
