const test = require('node:test');
const assert = require('node:assert/strict');
const { CaseStore } = require('../services/caseStore');
const { buildDemoCases } = require('../data/demo-cases');
const { toPublicCase } = require('../services/serialize');

function makeStore(extra = {}) {
    const clock = { t: 1_000_000 };
    const store = new CaseStore({ demoCases: buildDemoCases(), ttlMs: 60_000, now: () => clock.t, ...extra });
    return { store, clock };
}

test('demo cases load and are searchable', async () => {
    const { store } = makeStore();
    assert.equal(store.listDemo().length, 5);
    assert.equal((await store.getCase('mhna010000012019')).cnr, 'MHNA010000012019');
    assert.equal(store.searchDemo('party', 'sharma').length, 1);
    assert.equal(store.searchDemo('advocate', 'kumar').length >= 1, true);
    assert.equal(await store.getCase('ZZZZ000000000000'), null);
});

test('demo next-hearing dates are generated in the future', () => {
    const now = new Date('2030-06-01T00:00:00Z');
    for (const c of buildDemoCases(now)) assert.ok(c.nextHearingDate > '2030-06-01', c.cnr);
});

test('live cases expire after the TTL', async () => {
    const { store, clock } = makeStore();
    await store.saveLiveCase('KLTS010000452019', { cnr: 'KLTS010000452019', hearings: [] });
    assert.ok(await store.getCase('KLTS010000452019'));
    clock.t += 60_001;
    assert.equal(await store.getCase('KLTS010000452019'), null);
});

test('a live case never overwrites the demo case underneath it', async () => {
    const { store, clock } = makeStore();
    await store.saveLiveCase('MHNA010000012019', { cnr: 'MHNA010000012019', title: 'LIVE', hearings: [] });
    assert.equal((await store.getCase('MHNA010000012019')).title, 'LIVE');
    assert.equal(store.listDemo().find((c) => c.cnr === 'MHNA010000012019').title, 'Priya Sharma vs. Rajesh Sharma');
    clock.t += 60_001; // live copy expires → demo is visible again
    assert.equal((await store.getCase('MHNA010000012019')).title, 'Priya Sharma vs. Rajesh Sharma');
});

test('order text/summary caches expire and merge patches', async () => {
    const { store, clock } = makeStore();
    await store.patchOrder('MHNA010000012019', 4, { text: 'abc' });
    await store.patchOrder('MHNA010000012019', 4, { summary: { summary: 's' } });
    const e = await store.getOrder('MHNA010000012019', 4);
    assert.equal(e.text, 'abc');
    assert.equal(e.summary.summary, 's');
    clock.t += 60_001;
    assert.equal(await store.getOrder('MHNA010000012019', 4), null);
});

test('optional persistence is written through and read back; failures never break the store', async () => {
    const saved = new Map();
    const persistence = {
        saveCase: async (cnr, data) => { saved.set(cnr, data); },
        loadCase: async (cnr) => saved.get(cnr) || null,
    };
    const { store } = makeStore({ persistence });
    await store.saveLiveCase('KLTS010000452019', { cnr: 'KLTS010000452019', hearings: [] });
    assert.ok(saved.has('KLTS010000452019'));

    const fresh = makeStore({ persistence }).store; // new process: memory empty, Firestore has it
    assert.ok(await fresh.getCase('KLTS010000452019'));

    const broken = makeStore({ persistence: { saveCase: async () => { throw new Error('boom'); }, loadCase: async () => { throw new Error('boom'); } } }).store;
    await broken.saveLiveCase('KLTS010000452019', { cnr: 'KLTS010000452019', hearings: [] });
    assert.ok(await broken.getCase('KLTS010000452019'));
});

test('public serialisation hides order references and adds counts', async () => {
    const { store } = makeStore();
    const pub = toPublicCase(await store.getCase('MHNA010000012019'));
    assert.ok(pub.hearings.every((h) => !('orderRef' in h)));
    assert.deepEqual(pub.hearings.filter((h) => h.hasOrder).map((h) => h.id), [4, 7, 10]);
    assert.equal(pub.hearingStats.total, 14);
    assert.equal(pub.hearingStats.adjourned + pub.hearingStats.heard + pub.hearingStats.unclear + pub.hearingStats.disposed, 14);
    assert.equal(pub.isDemo, true);
});
